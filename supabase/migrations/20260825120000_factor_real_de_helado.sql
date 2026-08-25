-- Corrige el factor de consumo de helado (bolas/medio litro/litro) para que
-- coincida con los números REALES de Iram (Excel de operación), en vez del
-- valor estimado que se había usado hasta ahora.
--
-- Iram mide todo como fracción de un bote de 5 litros:
--   1 Bola      = 1/7  del bote  = 0.714285 L   (antes se calculaba 0.1333 L)
--   2 Bolas     = 2/9  del bote  = 1.111111 L   (NO es exactamente el doble
--                                                 de 1 bola: el bote rinde
--                                                 9 "dobles" pero 7 "sencillas")
--   Medio Litro = 1/2  del bote  = 2.5 L        (antes se calculaba 0.5 L)
--   Litro       = 1    del bote  = 5.0 L        (antes se calculaba 1.0 L)
--
-- Es decir: el inventario de helado se estaba descontando hasta 5 veces
-- menos de lo real. Esta migración corrige la columna y las funciones que
-- calculan el consumo, y de paso renombra `bolas_por_litro` (que ya no
-- describe bien el dato) a `litros_por_bola`: cuántos litros reales
-- consume UNA bola, el número que de verdad se necesita para calcular el
-- Affogato (que también consume 1 bola real de helado).

alter table sucursales rename column bolas_por_litro to litros_por_bola;
alter table sucursales alter column litros_por_bola type numeric(6,4);

update sucursales set litros_por_bola = 0.7143; -- 1/7 del bote de 5L, mismo dato para Puebla y CDMX

-- Ya no se necesita el caso especial 'bola': con el factor ya expresado en
-- litros reales, se calcula igual que "Medio Litro" y "Litro" (cantidad × factor).
update presentaciones pe
   set factor_consumo = 0.7143, consumo_derivado = null
  from productos p
 where pe.producto_id = p.id and p.es_sabor_helado and pe.nombre = '1 Bola';

update presentaciones pe
   set factor_consumo = 1.1111, consumo_derivado = null
  from productos p
 where pe.producto_id = p.id and p.es_sabor_helado and pe.nombre = '2 Bolas';

update presentaciones pe
   set factor_consumo = 2.5
  from productos p
 where pe.producto_id = p.id and p.es_sabor_helado and pe.nombre = 'Medio Litro';

update presentaciones pe
   set factor_consumo = 5.0
  from productos p
 where pe.producto_id = p.id and p.es_sabor_helado and pe.nombre = 'Litro';

-- ── agregar_linea: ya no divide entre bolas_por_litro ──────────────────────
create or replace function public.agregar_linea(p_empleado uuid, p_ticket uuid, p_presentacion uuid, p_cantidad numeric DEFAULT 1, p_botella uuid DEFAULT NULL::uuid, p_sabores uuid[] DEFAULT NULL::uuid[])
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_suc uuid; v_suc_ticket uuid; v_estado text;
  v_producto uuid; v_derivado text; v_factor numeric;
  v_precio numeric; v_costo numeric; v_copas int; v_litros_bola numeric;
  v_linea uuid; v_litros numeric; v_cada numeric; v_n int;
  v_es_sabor boolean;
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

  -- ── VINO POR COPA ──────────────────────────────────────────────
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

  -- ── HELADO (producto que ES un sabor: Pistache, Vainilla, etc) ───
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

  -- ── BOTELLA COMPLETA ───────────────────────────────────────────
  elsif v_derivado is null and exists (
    select 1 from productos where id = v_producto and unidad_base = 'botella'
  ) then
    perform mover_inventario(v_suc, v_producto, null, 'venta',
                             -p_cantidad * v_factor, v_linea, p_empleado, null);

  -- ── PRODUCTO QUE LLEVA UN SABOR PERO NO ES EN SÍ UN SABOR
  --    (el Affogato: es café + una bola de helado de verdad) ───────
  elsif v_derivado is null and p_sabores is not null
        and array_length(p_sabores, 1) is not null then
    v_n := array_length(p_sabores, 1);
    -- una unidad de este producto consume el equivalente a 1 bola real,
    -- repartida entre los sabores si se eligiera más de uno
    v_litros := p_cantidad * v_litros_bola;
    v_cada := v_litros / v_n;

    insert into linea_sabores (linea_id, producto_id, litros)
    select v_linea, x.id, v_cada from unnest(p_sabores) as x(id);

    perform mover_inventario(v_suc, x.id, null, 'venta', -v_cada,
                             v_linea, p_empleado, null)
    from unnest(p_sabores) as x(id);

  -- ── TODO LO DEMÁS ────────────────────────────────────────────────
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

-- ── aumentar_cantidad: mismo cambio ────────────────────────────────────────
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
    -- helado normal o Affogato con sabor: se reparte igual entre los
    -- mismos sabores que esa línea ya tenía
    select es_sabor_helado into v_es_sabor from productos where id = v_prod;
    v_n := (select count(*) from linea_sabores where linea_id = p_linea);
    v_litros := case
      when v_es_sabor then p_extra * v_factor
      else p_extra * v_litros_bola  -- Affogato: 1 bola real por unidad
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

-- ── disminuir_cantidad: mismo cambio ───────────────────────────────────────
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
  v_restante numeric;
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

    -- primero se devuelve el inventario, usando las filas de linea_sabores
    -- TAL COMO ESTÁN todavía (antes de tocarlas)
    perform mover_inventario(v_suc, ls.producto_id, null, 'ajuste', v_cada,
                             p_linea, p_empleado, 'Se corrigió la cantidad')
    from linea_sabores ls where ls.linea_id = p_linea;

    if v_restante <= 0 then
      delete from linea_sabores where linea_id = p_linea;
    else
      update linea_sabores set litros = greatest(0.001, litros - v_cada) where linea_id = p_linea;
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
    update ticket_lineas set estado = 'cancelada', cantidad = 0 where id = p_linea;
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

-- El CREATE OR REPLACE de aumentar_cantidad/disminuir_cantidad dejó su
-- permiso de ejecución abierto a PUBLIC (y por lo tanto a anon): se
-- detectó al verificar con has_function_privilege y se cierra aquí,
-- siguiendo el mismo patrón de bloqueo del resto de la base (ver
-- migraciones de seguridad del 2026-08-24).
revoke execute on function public.aumentar_cantidad(uuid, uuid, numeric) from public, anon, authenticated;
revoke execute on function public.disminuir_cantidad(uuid, uuid, numeric) from public, anon, authenticated;
revoke execute on function public.agregar_linea(uuid, uuid, uuid, numeric, uuid, uuid[]) from public, anon, authenticated;

grant execute on function public.agregar_linea(uuid, uuid, uuid, numeric, uuid, uuid[]) to service_role, postgres;
grant execute on function public.aumentar_cantidad(uuid, uuid, numeric) to service_role, postgres;
grant execute on function public.disminuir_cantidad(uuid, uuid, numeric) to service_role, postgres;
