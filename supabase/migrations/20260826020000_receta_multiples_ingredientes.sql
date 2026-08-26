-- Mercedes: para CDMX quiere agregar snacks que llevan VARIOS ingredientes
-- reales a la vez (ej. un botanero con lomo embuchado + arúgula + aceite
-- preparado). El mecanismo de "insumo compartido" (consume_de_id, un solo
-- insumo por producto) no alcanza. Se generaliza a una receta con lista
-- de ingredientes sin límite.
--
-- Tabla nueva `receta_ingredientes`: (producto_id, insumo_id, cantidad).
-- Reemplaza productos.consume_de_id/consumo_por_venta (se migran los
-- datos existentes de café y se eliminan esas columnas). Las 4 funciones
-- que tocan inventario de una línea (agregar/aumentar/disminuir/cancelar)
-- ahora recorren TODOS los ingredientes de la receta del producto,
-- además de lo que ya hacían (copa/sabor/botella/simple) — así que un
-- Affogato puede seguir restando su bola de helado Y su café, y un
-- Americano (que no tiene inventario propio) solo resta lo de su receta.
--
-- catalogo_crear_simple() ahora acepta una lista de ingredientes: cada
-- uno usa un insumo YA existente (por id) o crea uno nuevo sobre la
-- marcha (nombre + unidad), reusando por nombre si ya existe. Nueva
-- función insumos_de() para listar los productos elegibles como
-- ingrediente en el formulario.

create table receta_ingredientes (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  insumo_id uuid not null references productos(id) on delete restrict,
  cantidad numeric not null check (cantidad > 0),
  creado_en timestamptz not null default now(),
  unique (producto_id, insumo_id),
  check (producto_id <> insumo_id)
);

alter table receta_ingredientes enable row level security;

insert into receta_ingredientes (producto_id, insumo_id, cantidad)
select id, consume_de_id, consumo_por_venta
from productos
where consume_de_id is not null and consumo_por_venta is not null;

alter table productos drop column consume_de_id;
alter table productos drop column consumo_por_venta;

alter table productos drop constraint productos_unidad_base_check;
alter table productos add constraint productos_unidad_base_check
  check (unidad_base = any (array['botella','litro','pieza','bolsa','kg','gramo','mililitro']));

-- ── agregar_linea ────────────────────────────────────────────────────────
create or replace function public.agregar_linea(p_empleado uuid, p_ticket uuid, p_presentacion uuid, p_cantidad numeric DEFAULT 1, p_botella uuid DEFAULT NULL::uuid, p_sabores uuid[] DEFAULT NULL::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_suc uuid; v_suc_ticket uuid; v_estado text;
  v_producto uuid; v_derivado text; v_factor numeric;
  v_precio numeric; v_costo numeric; v_copas int; v_litros_bola numeric;
  v_linea uuid; v_litros numeric; v_cada numeric; v_n int;
  v_es_sabor boolean; v_ing record;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese mesero no está activo'; end if;

  select sucursal_id, estado into v_suc_ticket, v_estado
  from tickets where id = p_ticket;
  if v_suc_ticket is null then raise exception 'Esa cuenta no existe'; end if;
  if v_suc_ticket <> v_suc then raise exception 'Esa cuenta no es de tu sucursal'; end if;
  if v_estado <> 'abierto' then raise exception 'Esa cuenta ya no está abierta'; end if;

  select pe.producto_id, pe.consumo_derivado, pe.factor_consumo
    into v_producto, v_derivado, v_factor
  from presentaciones pe where pe.id = p_presentacion and pe.activa;
  if v_producto is null then raise exception 'Ese producto ya no está a la venta'; end if;

  select pr.precio, pr.costo into v_precio, v_costo
  from precios pr
  where pr.presentacion_id = p_presentacion and pr.sucursal_id = v_suc
    and pr.vigente_hasta is null;
  if v_precio is null then raise exception 'Ese producto no tiene precio en tu sucursal'; end if;

  select copas_por_botella, litros_por_bola into v_copas, v_litros_bola
  from sucursales where id = v_suc;

  if v_derivado = 'copa' then
    if p_botella is null then
      raise exception 'Hay que decir de cuál botella salió la copa';
    end if;

    perform 1 from botellas_abiertas
     where id = p_botella and sucursal_id = v_suc and cerrada_en is null
       and copas_restantes >= p_cantidad * v_factor
     for update;
    if not found then raise exception 'A esa botella ya no le quedan copas'; end if;

    select costo_botella / v_copas into v_costo
    from botellas_abiertas where id = p_botella;

    update botellas_abiertas
       set copas_restantes = copas_restantes - p_cantidad * v_factor,
           cerrada_en = case when copas_restantes - p_cantidad * v_factor <= 0
                             then now() else null end,
           motivo_cierre = case when copas_restantes - p_cantidad * v_factor <= 0
                                then 'agotada' else null end
     where id = p_botella;
  end if;

  insert into ticket_lineas (ticket_id, presentacion_id, cantidad,
                             precio_unitario, costo_unitario,
                             botella_abierta_id, creado_por)
  values (p_ticket, p_presentacion, p_cantidad, v_precio, v_costo,
          case when v_derivado = 'copa' then p_botella end, p_empleado)
  returning id into v_linea;

  select es_sabor_helado into v_es_sabor from productos where id = v_producto;

  if v_es_sabor then
    v_litros := p_cantidad * v_factor;

    if p_sabores is null or array_length(p_sabores, 1) is null then
      insert into linea_sabores (linea_id, producto_id, litros)
      values (v_linea, v_producto, v_litros);
      perform mover_inventario(v_suc, v_producto, null, 'venta', -v_litros,
                               v_linea, p_empleado, null);
    else
      v_n := array_length(p_sabores, 1);
      v_cada := v_litros / v_n;
      insert into linea_sabores (linea_id, producto_id, litros)
      select v_linea, x.id, v_cada from unnest(p_sabores) as x(id);

      perform mover_inventario(v_suc, x.id, null, 'venta', -v_cada,
                               v_linea, p_empleado, null)
      from unnest(p_sabores) as x(id);
    end if;

  elsif v_derivado is null and exists (
    select 1 from productos where id = v_producto and unidad_base = 'botella'
  ) then
    perform mover_inventario(v_suc, v_producto, null, 'venta',
                             -p_cantidad * v_factor, v_linea, p_empleado, null);

  -- ── AFFOGATO: café + una bola de helado de verdad (el sabor se
  --    elige, el café se resta más abajo vía receta_ingredientes) ────
  elsif v_derivado is null and p_sabores is not null
        and array_length(p_sabores, 1) is not null then
    v_n := array_length(p_sabores, 1);
    v_litros := p_cantidad * v_litros_bola;
    v_cada := v_litros / v_n;

    insert into linea_sabores (linea_id, producto_id, litros)
    select v_linea, x.id, v_cada from unnest(p_sabores) as x(id);

    perform mover_inventario(v_suc, x.id, null, 'venta', -v_cada,
                             v_linea, p_empleado, null)
    from unnest(p_sabores) as x(id);

  -- ── PRODUCTO QUE SOLO EXISTE COMO RECETA (ej. Americano: no tiene
  --    inventario propio, solo lo que dice su receta) ─────────────────
  elsif v_derivado is null and exists (
    select 1 from receta_ingredientes where producto_id = v_producto
  ) then
    null;

  elsif v_derivado is null then
    if (select inventario_por_presentacion from productos where id = v_producto) then
      perform mover_inventario(v_suc, null, p_presentacion, 'venta',
                               -p_cantidad * v_factor, v_linea, p_empleado, null);
    else
      perform mover_inventario(v_suc, v_producto, null, 'venta',
                               -p_cantidad * v_factor, v_linea, p_empleado, null);
    end if;
  end if;

  -- ── RECETA: cualquier ingrediente de inventario que este producto
  --    lleve (0, 1 o varios), sin importar qué rama fue arriba ────────
  for v_ing in select insumo_id, cantidad from receta_ingredientes where producto_id = v_producto
  loop
    perform mover_inventario(v_suc, v_ing.insumo_id, null, 'venta',
                             -p_cantidad * v_ing.cantidad, v_linea, p_empleado, null);
  end loop;

  update tickets t
     set subtotal = sub.total,
         total = sub.total - t.descuento
    from (select coalesce(sum(cantidad * precio_unitario), 0) as total
            from ticket_lineas
           where ticket_id = p_ticket and estado = 'activa') sub
   where t.id = p_ticket;

  return v_linea;
end;
$function$;

-- ── aumentar_cantidad ────────────────────────────────────────────────────
create or replace function public.aumentar_cantidad(p_empleado uuid, p_linea uuid, p_extra numeric DEFAULT 1)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_suc uuid; v_ticket uuid; v_estado text;
  v_pres uuid; v_prod uuid; v_derivado text; v_factor numeric;
  v_botella uuid; v_copas int; v_litros_bola numeric;
  v_es_sabor boolean; v_n int; v_litros numeric; v_cada numeric;
  v_ing record;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese mesero no está activo'; end if;
  if not (p_extra > 0) then raise exception 'La cantidad tiene que ser mayor a cero'; end if;

  select tl.ticket_id, tl.presentacion_id, tl.botella_abierta_id
    into v_ticket, v_pres, v_botella
  from ticket_lineas tl where tl.id = p_linea and tl.estado = 'activa';
  if v_ticket is null then raise exception 'Ese renglón ya no está activo'; end if;

  perform 1 from tickets where id = v_ticket and sucursal_id = v_suc and estado = 'abierto';
  if not found then raise exception 'Esa cuenta ya no está abierta'; end if;

  select pe.producto_id, pe.consumo_derivado, pe.factor_consumo
    into v_prod, v_derivado, v_factor
  from presentaciones pe where pe.id = v_pres;

  select copas_por_botella, litros_por_bola into v_copas, v_litros_bola
  from sucursales where id = v_suc;

  if v_derivado = 'copa' then
    if v_botella is null then
      raise exception 'Esa línea no se puede aumentar así';
    end if;
    perform 1 from botellas_abiertas
     where id = v_botella and sucursal_id = v_suc and cerrada_en is null
       and copas_restantes >= p_extra * v_factor
     for update;
    if not found then raise exception 'A esa botella ya no le quedan copas'; end if;

    update botellas_abiertas
       set copas_restantes = copas_restantes - p_extra * v_factor,
           cerrada_en = case when copas_restantes - p_extra * v_factor <= 0
                             then now() else null end,
           motivo_cierre = case when copas_restantes - p_extra * v_factor <= 0
                                then 'agotada' else null end
     where id = v_botella;

  elsif exists (select 1 from linea_sabores where linea_id = p_linea) then
    select es_sabor_helado into v_es_sabor from productos where id = v_prod;
    v_n := (select count(*) from linea_sabores where linea_id = p_linea);
    v_litros := case
      when v_es_sabor then p_extra * v_factor
      else p_extra * v_litros_bola
    end;
    v_cada := v_litros / v_n;

    update linea_sabores set litros = litros + v_cada where linea_id = p_linea;

    perform mover_inventario(v_suc, ls.producto_id, null, 'venta', -v_cada,
                             p_linea, p_empleado, null)
    from linea_sabores ls where ls.linea_id = p_linea;

  elsif v_derivado is null and exists (
    select 1 from productos where id = v_prod and unidad_base = 'botella'
  ) then
    perform mover_inventario(v_suc, v_prod, null, 'venta',
                             -p_extra * v_factor, p_linea, p_empleado, null);

  elsif v_derivado is null and exists (
    select 1 from receta_ingredientes where producto_id = v_prod
  ) then
    null;

  else
    if (select inventario_por_presentacion from productos where id = v_prod) then
      perform mover_inventario(v_suc, null, v_pres, 'venta',
                               -p_extra * v_factor, p_linea, p_empleado, null);
    else
      perform mover_inventario(v_suc, v_prod, null, 'venta',
                               -p_extra * v_factor, p_linea, p_empleado, null);
    end if;
  end if;

  for v_ing in select insumo_id, cantidad from receta_ingredientes where producto_id = v_prod
  loop
    perform mover_inventario(v_suc, v_ing.insumo_id, null, 'venta',
                             -p_extra * v_ing.cantidad, p_linea, p_empleado, null);
  end loop;

  update ticket_lineas set cantidad = cantidad + p_extra where id = p_linea;

  update tickets t
     set subtotal = sub.total, total = sub.total - t.descuento
    from (select coalesce(sum(cantidad * precio_unitario), 0) as total
            from ticket_lineas where ticket_id = v_ticket and estado = 'activa') sub
   where t.id = v_ticket;
end;
$function$;

-- ── disminuir_cantidad ───────────────────────────────────────────────────
create or replace function public.disminuir_cantidad(p_empleado uuid, p_linea uuid, p_menos numeric DEFAULT 1)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_suc uuid; v_ticket uuid; v_creado_en timestamptz;
  v_pres uuid; v_prod uuid; v_derivado text; v_factor numeric;
  v_botella uuid; v_copas int; v_litros_bola numeric; v_cantidad numeric;
  v_es_sabor boolean; v_n int; v_litros numeric; v_cada numeric;
  v_restante numeric; v_ing record;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese mesero no está activo'; end if;
  if not (p_menos > 0) then raise exception 'La cantidad tiene que ser mayor a cero'; end if;

  select tl.ticket_id, tl.presentacion_id, tl.botella_abierta_id,
         tl.cantidad, tl.creado_en
    into v_ticket, v_pres, v_botella, v_cantidad, v_creado_en
  from ticket_lineas tl where tl.id = p_linea and tl.estado = 'activa';
  if v_ticket is null then raise exception 'Ese renglón ya no está activo'; end if;

  perform 1 from tickets where id = v_ticket and sucursal_id = v_suc and estado = 'abierto';
  if not found then raise exception 'Esa cuenta ya no está abierta'; end if;

  if v_creado_en < now() - interval '10 minutes' then
    raise exception 'Ya pasaron los 10 minutos. Pide que el dueño lo quite.';
  end if;

  v_restante := v_cantidad - p_menos;
  if v_restante < 0 then
    raise exception 'No puedes quitar más de lo que hay';
  end if;

  select pe.producto_id, pe.consumo_derivado, pe.factor_consumo
    into v_prod, v_derivado, v_factor
  from presentaciones pe where pe.id = v_pres;

  select copas_por_botella, litros_por_bola into v_copas, v_litros_bola
  from sucursales where id = v_suc;

  if v_derivado = 'copa' and v_botella is not null then
    update botellas_abiertas
       set copas_restantes = least(copas_totales, copas_restantes + p_menos * v_factor),
           cerrada_en = null, motivo_cierre = null
     where id = v_botella;

  elsif exists (select 1 from linea_sabores where linea_id = p_linea) then
    select es_sabor_helado into v_es_sabor from productos where id = v_prod;
    v_n := (select count(*) from linea_sabores where linea_id = p_linea);
    v_litros := case
      when v_es_sabor then p_menos * v_factor
      else p_menos * v_litros_bola
    end;
    v_cada := v_litros / v_n;

    perform mover_inventario(v_suc, ls.producto_id, null, 'ajuste', v_cada,
                             p_linea, p_empleado, 'Se corrigió la cantidad')
    from linea_sabores ls where ls.linea_id = p_linea;

    if v_restante <= 0 then
      delete from linea_sabores where linea_id = p_linea;
    else
      update linea_sabores set litros = greatest(0.001, litros - v_cada) where linea_id = p_linea;
    end if;

  elsif v_derivado is null and exists (
    select 1 from receta_ingredientes where producto_id = v_prod
  ) then
    null;

  else
    if (select inventario_por_presentacion from productos where id = v_prod) then
      perform mover_inventario(v_suc, null, v_pres, 'ajuste', p_menos * v_factor,
                               p_linea, p_empleado, 'Se corrigió la cantidad');
    else
      perform mover_inventario(v_suc, v_prod, null, 'ajuste', p_menos * v_factor,
                               p_linea, p_empleado, 'Se corrigió la cantidad');
    end if;
  end if;

  for v_ing in select insumo_id, cantidad from receta_ingredientes where producto_id = v_prod
  loop
    perform mover_inventario(v_suc, v_ing.insumo_id, null, 'ajuste', p_menos * v_ing.cantidad,
                             p_linea, p_empleado, 'Se corrigió la cantidad');
  end loop;

  if v_restante <= 0 then
    update ticket_lineas set estado = 'cancelada' where id = p_linea;
  else
    update ticket_lineas set cantidad = v_restante where id = p_linea;
  end if;

  update tickets t
     set subtotal = sub.total, total = sub.total - t.descuento
    from (select coalesce(sum(cantidad * precio_unitario), 0) as total
            from ticket_lineas where ticket_id = v_ticket and estado = 'activa') sub
   where t.id = v_ticket;
end;
$function$;

-- ── cancelar_linea ───────────────────────────────────────────────────────
create or replace function public.cancelar_linea(p_solicitante uuid, p_linea uuid, p_motivo text, p_codigo text DEFAULT NULL::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_suc uuid; v_rol_solicitante text; v_autoriza uuid; v_rol_autoriza text;
  v_ticket uuid; v_estado text; v_cant numeric;
  v_pres uuid; v_prod uuid; v_derivado text; v_factor numeric;
  v_botella uuid; v_ing record;
begin
  select sucursal_id, rol into v_suc, v_rol_solicitante
  from empleados where id = p_solicitante and activo;
  if v_suc is null then raise exception 'Ese mesero no está activo'; end if;

  if v_rol_solicitante in ('dueno', 'gerente') then
    v_autoriza := p_solicitante;
  else
    select e.id, e.rol into v_autoriza, v_rol_autoriza
    from empleados e
    where e.activo and e.sucursal_id = v_suc
      and e.codigo_hash = extensions.crypt(coalesce(p_codigo, ''), e.codigo_hash);
    if v_autoriza is null then
      raise exception 'Ese código no es de nadie';
    end if;
    if v_rol_autoriza not in ('dueno', 'gerente') then
      raise exception 'Ese código no puede autorizar cancelaciones';
    end if;
  end if;

  select tl.ticket_id, tl.cantidad, tl.presentacion_id, tl.botella_abierta_id,
         t.estado
    into v_ticket, v_cant, v_pres, v_botella, v_estado
  from ticket_lineas tl
  join tickets t on t.id = tl.ticket_id
  where tl.id = p_linea and tl.estado = 'activa';

  if v_ticket is null then raise exception 'Ese renglón ya no está activo'; end if;
  if v_estado = 'cerrado' then
    raise exception 'Esa cuenta ya se cobró. Se necesita una devolución, no una cancelación';
  end if;

  select pe.producto_id, pe.consumo_derivado, pe.factor_consumo
    into v_prod, v_derivado, v_factor
  from presentaciones pe where pe.id = v_pres;

  update ticket_lineas set estado = 'cancelada' where id = p_linea;

  insert into cancelaciones (ticket_id, linea_id, cantidad, motivo,
                             solicitado_por, autorizado_por)
  values (v_ticket, p_linea, v_cant, p_motivo, p_solicitante, v_autoriza);

  if v_derivado = 'copa' and v_botella is not null then
    update botellas_abiertas
       set copas_restantes = least(copas_totales, copas_restantes + v_cant * v_factor),
           cerrada_en = null, motivo_cierre = null
     where id = v_botella;

  elsif exists (select 1 from linea_sabores where linea_id = p_linea) then
    perform mover_inventario(v_suc, ls.producto_id, null, 'ajuste', ls.litros,
                             p_linea, v_autoriza, 'Se canceló un renglón')
    from linea_sabores ls where ls.linea_id = p_linea;

  elsif v_derivado is null and exists (
    select 1 from receta_ingredientes where producto_id = v_prod
  ) then
    null;

  else
    if (select inventario_por_presentacion from productos where id = v_prod) then
      perform mover_inventario(v_suc, null, v_pres, 'ajuste', v_cant * v_factor,
                               p_linea, v_autoriza, 'Se canceló un renglón');
    else
      perform mover_inventario(v_suc, v_prod, null, 'ajuste', v_cant * v_factor,
                               p_linea, v_autoriza, 'Se canceló un renglón');
    end if;
  end if;

  for v_ing in select insumo_id, cantidad from receta_ingredientes where producto_id = v_prod
  loop
    perform mover_inventario(v_suc, v_ing.insumo_id, null, 'ajuste', v_cant * v_ing.cantidad,
                             p_linea, v_autoriza, 'Se canceló un renglón');
  end loop;

  update tickets t
     set subtotal = sub.total, total = sub.total - t.descuento
    from (select coalesce(sum(cantidad * precio_unitario), 0) as total
            from ticket_lineas where ticket_id = v_ticket and estado = 'activa') sub
   where t.id = v_ticket;
end;
$function$;

revoke execute on function public.agregar_linea(uuid, uuid, uuid, numeric, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.agregar_linea(uuid, uuid, uuid, numeric, uuid, uuid[]) to service_role, postgres;
revoke execute on function public.aumentar_cantidad(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.aumentar_cantidad(uuid, uuid, numeric) to service_role, postgres;
revoke execute on function public.disminuir_cantidad(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.disminuir_cantidad(uuid, uuid, numeric) to service_role, postgres;
revoke execute on function public.cancelar_linea(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.cancelar_linea(uuid, uuid, text, text) to service_role, postgres;

-- ── items_inventario(): basado en receta_ingredientes ───────────────────
drop function items_inventario(uuid);

create function public.items_inventario(p_sucursal uuid)
returns table(
  producto_id uuid, presentacion_id uuid, nombre text, categoria text, unidad text,
  cantidad numeric, minimo numeric, costo_promedio numeric, costo_catalogo numeric,
  consumo_dia numeric, dias_restantes numeric, sugerido numeric,
  activo boolean, alcanza_unidades numeric, rinde_configurado numeric, vinculados text
)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with base as (
    select p.id as prod, null::uuid as pres,
           p.nombre as nom, c.nombre as cat, p.unidad_base as uni, p.activo as act
    from productos p
    join categorias c on c.id = p.categoria_id
    where not p.inventario_por_presentacion
      and not exists (select 1 from receta_ingredientes ri where ri.producto_id = p.id)
    union all
    select null::uuid, pe.id,
           p.nombre || ' · ' || pe.nombre, c.nombre, 'pieza', p.activo
    from presentaciones pe
    join productos p on p.id = pe.producto_id
    join categorias c on c.id = p.categoria_id
    where pe.activa and p.inventario_por_presentacion
  ),
  cons as (
    select m.producto_id as prod, m.presentacion_id as pres,
           greatest(sum(-m.cantidad), 0) / 28.0 as por_dia
    from movimientos m
    where m.sucursal_id = p_sucursal
      and m.creado_en > now() - interval '28 days'
      and (
        m.tipo = 'venta'
        or (m.tipo = 'ajuste' and m.ticket_linea_id is not null)
      )
    group by 1, 2
  ),
  cat as (
    select pe.producto_id as prod, pe.id as pres, pr.costo
    from presentaciones pe
    join precios pr on pr.presentacion_id = pe.id
                   and pr.sucursal_id = p_sucursal and pr.vigente_hasta is null
    where pe.consumo_derivado is null and pe.factor_consumo = 1
  ),
  vinc as (
    select ri.insumo_id as insumo,
           string_agg(distinct p2.nombre, ', ' order by p2.nombre) as nombres,
           case when count(distinct ri.cantidad) = 1 then max(ri.cantidad) else null end as cantidad_uniforme
    from receta_ingredientes ri
    join productos p2 on p2.id = ri.producto_id
    group by ri.insumo_id
  )
  select b.prod, b.pres, b.nom, b.cat, b.uni,
         coalesce(e.cantidad, 0),
         coalesce(e.minimo, 0),
         coalesce(e.costo_promedio, 0),
         coalesce(
           (select cat.costo from cat where cat.prod = b.prod limit 1),
           (select cat.costo from cat where cat.pres = b.pres limit 1),
           0),
         round(coalesce(cn.por_dia, 0), 3),
         case when coalesce(cn.por_dia, 0) > 0
              then round(coalesce(e.cantidad, 0) / cn.por_dia, 1)
              else null end,
         case when coalesce(cn.por_dia, 0) > 0
              then greatest(0, ceil(cn.por_dia * 14 - coalesce(e.cantidad, 0)))
              else greatest(0, coalesce(e.minimo, 0) - coalesce(e.cantidad, 0))
         end,
         b.act,
         case when vinc.cantidad_uniforme > 0
              then round(coalesce(e.cantidad, 0) / vinc.cantidad_uniforme, 0)
              else null end,
         case when vinc.cantidad_uniforme > 0
              then round(1.0 / vinc.cantidad_uniforme, 1)
              else null end,
         vinc.nombres
  from base b
  left join existencias e
    on e.sucursal_id = p_sucursal
   and (e.producto_id = b.prod or e.presentacion_id = b.pres)
  left join cons cn
    on (cn.prod = b.prod or cn.pres = b.pres)
  left join vinc
    on vinc.insumo = b.prod
  order by b.cat, b.nom;
$function$;

revoke execute on function public.items_inventario(uuid) from public, anon, authenticated;
grant execute on function public.items_inventario(uuid) to service_role, postgres;

-- ── fijar_rendimiento_insumo: ahora sobre receta_ingredientes ───────────
create or replace function public.fijar_rendimiento_insumo(p_empleado uuid, p_insumo uuid, p_rinde numeric)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_suc uuid; v_rol text;
begin
  select sucursal_id, rol into v_suc, v_rol from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño puede ajustar esto'; end if;
  if p_rinde is null or p_rinde <= 0 then raise exception 'Tiene que rendir más de cero'; end if;

  update receta_ingredientes
     set cantidad = 1.0 / p_rinde
   where insumo_id = p_insumo;

  if not found then
    raise exception 'Nada consume de ese insumo todavía';
  end if;
end;
$function$;

-- ── insumos_de(): productos elegibles como ingrediente ──────────────────
create or replace function public.insumos_de()
returns table(id uuid, nombre text, categoria text, unidad_base text)
language sql
security definer
set search_path to 'public'
as $function$
  select p.id, p.nombre, c.nombre as categoria, p.unidad_base
  from productos p join categorias c on c.id = p.categoria_id
  order by c.nombre, p.nombre;
$function$;

-- ── catalogo_crear_simple(): ahora acepta ingredientes de receta ────────
drop function public.catalogo_crear_simple(uuid, text, uuid, numeric, numeric);

create function public.catalogo_crear_simple(
  p_empleado uuid, p_nombre text, p_categoria_id uuid, p_precio numeric, p_costo numeric,
  p_ingredientes jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_suc uuid; v_rol text; v_prod uuid; v_pres uuid;
  l jsonb; v_insumo uuid; v_insumo_nombre text; v_insumo_unidad text; v_cantidad numeric;
begin
  select sucursal_id, rol into v_suc, v_rol from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño puede agregar productos'; end if;

  if p_nombre is null or trim(p_nombre) = '' then
    raise exception 'Falta el nombre del producto';
  end if;
  if exists (select 1 from productos where lower(nombre) = lower(trim(p_nombre))) then
    raise exception 'Ya existe un producto con ese nombre';
  end if;
  if p_categoria_id is null then raise exception 'Falta la categoría'; end if;
  if p_precio is null or p_precio <= 0 then raise exception 'Falta el precio'; end if;
  if p_costo is null or p_costo < 0 then raise exception 'El costo no puede ser negativo'; end if;

  insert into productos (categoria_id, nombre, unidad_base, activo)
  values (p_categoria_id, trim(p_nombre), 'pieza', true)
  returning id into v_prod;

  insert into presentaciones (producto_id, nombre, orden, es_para_llevar, factor_consumo, consumo_derivado)
  values (v_prod, 'Única', 1, false, 1, null)
  returning id into v_pres;

  insert into precios (presentacion_id, sucursal_id, precio, costo)
  values (v_pres, v_suc, p_precio, p_costo);

  for l in select * from jsonb_array_elements(coalesce(p_ingredientes, '[]'::jsonb))
  loop
    v_cantidad := (l->>'cantidad')::numeric;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Un ingrediente no tiene una cantidad válida';
    end if;

    v_insumo := nullif(l->>'insumo_id', '')::uuid;

    if v_insumo is null then
      v_insumo_nombre := trim(coalesce(l->>'insumo_nombre', ''));
      v_insumo_unidad := coalesce(l->>'insumo_unidad', 'pieza');
      if v_insumo_nombre = '' then
        raise exception 'Falta el nombre de un ingrediente nuevo';
      end if;

      select id into v_insumo from productos where lower(nombre) = lower(v_insumo_nombre);

      if v_insumo is null then
        insert into productos (categoria_id, nombre, unidad_base, activo)
        values ((select id from categorias where nombre = 'Insumos'), v_insumo_nombre, v_insumo_unidad, true)
        returning id into v_insumo;
      end if;
    end if;

    if v_insumo = v_prod then
      raise exception 'Un producto no puede llevar de ingrediente a sí mismo';
    end if;

    insert into receta_ingredientes (producto_id, insumo_id, cantidad)
    values (v_prod, v_insumo, v_cantidad)
    on conflict (producto_id, insumo_id) do update set cantidad = excluded.cantidad;
  end loop;

  return v_prod;
end;
$function$;

revoke execute on function public.insumos_de() from public, anon, authenticated;
grant execute on function public.insumos_de() to service_role, postgres;
revoke execute on function public.fijar_rendimiento_insumo(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.fijar_rendimiento_insumo(uuid, uuid, numeric) to service_role, postgres;
revoke execute on function public.catalogo_crear_simple(uuid, text, uuid, numeric, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.catalogo_crear_simple(uuid, text, uuid, numeric, numeric, jsonb) to service_role, postgres;
