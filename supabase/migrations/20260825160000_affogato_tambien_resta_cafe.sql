-- Mercedes: "el afogato tiene que restar igual un café y una bola de
-- helado, entonces no iria como inventario [aparte]". El Affogato ya
-- restaba la bola de helado real (vía linea_sabores); ahora TAMBIÉN
-- resta un café del insumo compartido "Café en grano", igual que un
-- Americano/Espresso/Capuccino — usa el mismo consumo_por_venta, así
-- que cuando se ajuste el rendimiento de una bolsa, también se ajusta
-- para el Affogato.
--
-- Se vincula el producto (consume_de_id + consumo_por_venta, reusando la
-- tasa ya configurada) y se agrega, en las 4 funciones que tocan el
-- inventario del Affogato, una resta/devolución extra del insumo dentro
-- de la misma rama que ya maneja linea_sabores (que cubre tanto el
-- helado real como el Affogato).

update productos
   set consume_de_id = (select id from productos where nombre = 'Café en grano'),
       consumo_por_venta = (select consumo_por_venta from productos where nombre = 'Americano')
 where nombre = 'Affogato 89';

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
  v_es_sabor boolean; v_insumo uuid; v_consumo numeric;
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

  -- ── PRODUCTO QUE LLEVA UN SABOR PERO NO ES EN SÍ UN SABOR
  --    (el Affogato: café + una bola de helado de verdad. Si además tiene
  --    consume_de_id, TAMBIÉN resta un café del insumo compartido) ─────
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

    select consume_de_id, coalesce(consumo_por_venta, 0) into v_insumo, v_consumo
    from productos where id = v_producto;
    if v_insumo is not null and v_consumo > 0 then
      perform mover_inventario(v_suc, v_insumo, null, 'venta',
                               -p_cantidad * v_consumo, v_linea, p_empleado, null);
    end if;

  elsif v_derivado is null and exists (
    select 1 from productos where id = v_producto and consume_de_id is not null
  ) then
    select consume_de_id, coalesce(consumo_por_venta, 0) into v_insumo, v_consumo
    from productos where id = v_producto;
    if v_consumo > 0 then
      perform mover_inventario(v_suc, v_insumo, null, 'venta',
                               -p_cantidad * v_consumo, v_linea, p_empleado, null);
    end if;

  elsif v_derivado is null then
    if (select inventario_por_presentacion from productos where id = v_producto) then
      perform mover_inventario(v_suc, null, p_presentacion, 'venta',
                               -p_cantidad * v_factor, v_linea, p_empleado, null);
    else
      perform mover_inventario(v_suc, v_producto, null, 'venta',
                               -p_cantidad * v_factor, v_linea, p_empleado, null);
    end if;
  end if;

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
  v_insumo uuid; v_consumo numeric;
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

    select consume_de_id, coalesce(consumo_por_venta, 0) into v_insumo, v_consumo
    from productos where id = v_prod;
    if v_insumo is not null and v_consumo > 0 then
      perform mover_inventario(v_suc, v_insumo, null, 'venta',
                               -p_extra * v_consumo, p_linea, p_empleado, null);
    end if;

  elsif v_derivado is null and exists (
    select 1 from productos where id = v_prod and unidad_base = 'botella'
  ) then
    perform mover_inventario(v_suc, v_prod, null, 'venta',
                             -p_extra * v_factor, p_linea, p_empleado, null);

  elsif v_derivado is null and exists (
    select 1 from productos where id = v_prod and consume_de_id is not null
  ) then
    select consume_de_id, coalesce(consumo_por_venta, 0) into v_insumo, v_consumo
    from productos where id = v_prod;
    if v_consumo > 0 then
      perform mover_inventario(v_suc, v_insumo, null, 'venta',
                               -p_extra * v_consumo, p_linea, p_empleado, null);
    end if;

  else
    if (select inventario_por_presentacion from productos where id = v_prod) then
      perform mover_inventario(v_suc, null, v_pres, 'venta',
                               -p_extra * v_factor, p_linea, p_empleado, null);
    else
      perform mover_inventario(v_suc, v_prod, null, 'venta',
                               -p_extra * v_factor, p_linea, p_empleado, null);
    end if;
  end if;

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
  v_restante numeric; v_insumo uuid; v_consumo numeric;
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

    select consume_de_id, coalesce(consumo_por_venta, 0) into v_insumo, v_consumo
    from productos where id = v_prod;
    if v_insumo is not null and v_consumo > 0 then
      perform mover_inventario(v_suc, v_insumo, null, 'ajuste', p_menos * v_consumo,
                               p_linea, p_empleado, 'Se corrigió la cantidad');
    end if;

  elsif v_derivado is null and exists (
    select 1 from productos where id = v_prod and consume_de_id is not null
  ) then
    select consume_de_id, coalesce(consumo_por_venta, 0) into v_insumo, v_consumo
    from productos where id = v_prod;
    if v_consumo > 0 then
      perform mover_inventario(v_suc, v_insumo, null, 'ajuste', p_menos * v_consumo,
                               p_linea, p_empleado, 'Se corrigió la cantidad');
    end if;

  else
    if (select inventario_por_presentacion from productos where id = v_prod) then
      perform mover_inventario(v_suc, null, v_pres, 'ajuste', p_menos * v_factor,
                               p_linea, p_empleado, 'Se corrigió la cantidad');
    else
      perform mover_inventario(v_suc, v_prod, null, 'ajuste', p_menos * v_factor,
                               p_linea, p_empleado, 'Se corrigió la cantidad');
    end if;
  end if;

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
  v_botella uuid; v_insumo uuid; v_consumo numeric;
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

    select consume_de_id, coalesce(consumo_por_venta, 0) into v_insumo, v_consumo
    from productos where id = v_prod;
    if v_insumo is not null and v_consumo > 0 then
      perform mover_inventario(v_suc, v_insumo, null, 'ajuste', v_cant * v_consumo,
                               p_linea, v_autoriza, 'Se canceló un renglón');
    end if;

  elsif v_derivado is null and exists (
    select 1 from productos where id = v_prod and consume_de_id is not null
  ) then
    select consume_de_id, coalesce(consumo_por_venta, 0) into v_insumo, v_consumo
    from productos where id = v_prod;
    if v_consumo > 0 then
      perform mover_inventario(v_suc, v_insumo, null, 'ajuste', v_cant * v_consumo,
                               p_linea, v_autoriza, 'Se canceló un renglón');
    end if;

  else
    if (select inventario_por_presentacion from productos where id = v_prod) then
      perform mover_inventario(v_suc, null, v_pres, 'ajuste', v_cant * v_factor,
                               p_linea, v_autoriza, 'Se canceló un renglón');
    else
      perform mover_inventario(v_suc, v_prod, null, 'ajuste', v_cant * v_factor,
                               p_linea, v_autoriza, 'Se canceló un renglón');
    end if;
  end if;

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
