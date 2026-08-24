-- Destapa una botella: sale una del almacén y nace una botella viva
-- con sus copas disponibles.
create or replace function public.abrir_botella(p_empleado uuid, p_producto uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_suc uuid; v_copas int; v_costo numeric; v_id uuid;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese mesero no está activo'; end if;

  select copas_por_botella into v_copas from sucursales where id = v_suc;

  -- el costo se toma de la presentación "Botella" de esa etiqueta
  select pr.costo into v_costo
  from presentaciones pe
  join precios pr on pr.presentacion_id = pe.id
                 and pr.sucursal_id = v_suc and pr.vigente_hasta is null
  where pe.producto_id = p_producto and pe.nombre = 'Botella';

  if v_costo is null then raise exception 'Esa etiqueta no tiene costo de botella'; end if;

  insert into botellas_abiertas (sucursal_id, producto_id, copas_totales,
                                 copas_restantes, costo_botella, abierta_por)
  values (v_suc, p_producto, v_copas, v_copas, v_costo, p_empleado)
  returning id into v_id;

  perform mover_inventario(v_suc, p_producto, null, 'apertura_botella', -1,
                           null, p_empleado, 'Se destapó una botella');
  return v_id;
end;
$$;
grant execute on function public.abrir_botella(uuid, uuid) to anon, authenticated;

-- Agrega un renglón a la cuenta. Aquí viven las reglas del vino y del helado.
create or replace function public.agregar_linea(
  p_empleado uuid,
  p_ticket uuid,
  p_presentacion uuid,
  p_cantidad numeric default 1,
  p_botella uuid default null,
  p_sabores uuid[] default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_suc uuid; v_suc_ticket uuid; v_estado text;
  v_producto uuid; v_derivado text; v_factor numeric;
  v_precio numeric; v_costo numeric; v_copas int; v_bolas numeric;
  v_linea uuid; v_litros numeric; v_cada numeric; v_n int;
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

  select copas_por_botella, bolas_por_litro into v_copas, v_bolas
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

    -- el costo real de la copa sale de ESA botella, no del catálogo
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

  -- ── HELADO ─────────────────────────────────────────────────────
  if (select es_sabor_helado from productos where id = v_producto) then
    v_litros := case when v_derivado = 'bola'
                     then p_cantidad * v_factor / v_bolas
                     else p_cantidad * v_factor end;

    if p_sabores is null or array_length(p_sabores, 1) is null then
      -- sin elegir sabores, se descuenta del sabor del propio producto
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

  -- ── TODO LO DEMÁS ──────────────────────────────────────────────
  elsif v_derivado is null then
    if (select inventario_por_presentacion from productos where id = v_producto) then
      perform mover_inventario(v_suc, null, p_presentacion, 'venta',
                               -p_cantidad * v_factor, v_linea, p_empleado, null);
    else
      perform mover_inventario(v_suc, v_producto, null, 'venta',
                               -p_cantidad * v_factor, v_linea, p_empleado, null);
    end if;
  end if;

  -- se recalculan los totales de la cuenta
  update tickets t
     set subtotal = sub.total,
         total = sub.total - t.descuento
    from (select coalesce(sum(cantidad * precio_unitario), 0) as total
            from ticket_lineas
           where ticket_id = p_ticket and estado = 'activa') sub
   where t.id = p_ticket;

  return v_linea;
end;
$$;
grant execute on function public.agregar_linea(uuid, uuid, uuid, numeric, uuid, uuid[]) to anon, authenticated;;
