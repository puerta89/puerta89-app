-- Gastos: renta, nómina, luz. Es lo que convierte la utilidad bruta
-- en utilidad real.
create or replace function public.registrar_gasto(
  p_empleado uuid, p_categoria text, p_concepto text,
  p_monto numeric, p_fecha date, p_recurrente boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare v_suc uuid; v_rol text;
begin
  select sucursal_id, rol into v_suc, v_rol
  from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño puede registrar gastos'; end if;
  if not (p_monto > 0) then raise exception 'El monto tiene que ser mayor a cero'; end if;
  if coalesce(trim(p_concepto),'') = '' then raise exception 'Falta el concepto'; end if;

  insert into gastos (sucursal_id, categoria, concepto, monto, fecha, recurrente, registrado_por)
  values (v_suc, coalesce(nullif(trim(p_categoria),''), 'Otros'), trim(p_concepto),
          p_monto, coalesce(p_fecha, current_date), coalesce(p_recurrente, false), p_empleado);
end;
$$;
grant execute on function public.registrar_gasto(uuid, text, text, numeric, date, boolean) to anon, authenticated;

create or replace function public.gastos_de(p_sucursal uuid, p_desde date, p_hasta date)
returns table (id uuid, fecha date, categoria text, concepto text, monto numeric, recurrente boolean)
language sql security definer set search_path = public as $$
  select id, fecha, categoria, concepto, monto, recurrente
  from gastos
  where sucursal_id = p_sucursal and fecha between p_desde and p_hasta
  order by fecha desc, creado_en desc;
$$;
grant execute on function public.gastos_de(uuid, date, date) to anon, authenticated;

-- El resumen grande del periodo.
create or replace function public.panel_resumen(
  p_sucursal uuid, p_desde date, p_hasta date
)
returns table (
  ventas numeric, costo numeric, utilidad_bruta numeric, margen numeric,
  tickets int, ticket_promedio numeric, permanencia_min numeric,
  efectivo numeric, tarjeta numeric, propinas numeric,
  descuentos numeric, cancelado numeric, mermas numeric,
  gastos numeric, utilidad_real numeric
)
language sql security definer set search_path = public as $$
  with t as (
    select * from tickets
    where sucursal_id = p_sucursal and estado = 'cerrado'
      and (cerrado_en at time zone 'America/Mexico_City')::date between p_desde and p_hasta
  ),
  l as (
    select coalesce(sum(tl.cantidad * tl.precio_unitario), 0) as venta,
           coalesce(sum(tl.cantidad * tl.costo_unitario), 0) as costo
    from ticket_lineas tl join t on t.id = tl.ticket_id
    where tl.estado = 'activa'
  ),
  can as (
    select coalesce(sum(tl.cantidad * tl.precio_unitario), 0) as monto
    from ticket_lineas tl join t on t.id = tl.ticket_id
    where tl.estado = 'cancelada'
  ),
  pg as (
    select coalesce(sum(p.monto) filter (where p.metodo='efectivo'), 0) as efec,
           coalesce(sum(p.monto) filter (where p.metodo='tarjeta'), 0) as tarj
    from pagos p join t on t.id = p.ticket_id
  ),
  mer as (
    select coalesce(sum(abs(m.cantidad) * coalesce(e.costo_promedio, 0)), 0) as monto
    from movimientos m
    left join existencias e
      on e.sucursal_id = m.sucursal_id
     and (e.producto_id = m.producto_id or e.presentacion_id = m.presentacion_id)
    where m.sucursal_id = p_sucursal and m.tipo = 'merma'
      and (m.creado_en at time zone 'America/Mexico_City')::date between p_desde and p_hasta
  ),
  gas as (
    select coalesce(sum(monto), 0) as monto from gastos
    where sucursal_id = p_sucursal and fecha between p_desde and p_hasta
  )
  select
    l.venta, l.costo, l.venta - l.costo,
    case when l.venta > 0 then round((l.venta - l.costo) / l.venta * 100, 1) else 0 end,
    (select count(*)::int from t),
    case when (select count(*) from t) > 0
         then round(l.venta / (select count(*) from t), 2) else 0 end,
    coalesce((select round(avg(extract(epoch from (cerrado_en - abierto_en)) / 60)::numeric, 0) from t), 0),
    pg.efec, pg.tarj,
    coalesce((select sum(propina) from t), 0),
    coalesce((select sum(descuento) from t), 0),
    can.monto, mer.monto, gas.monto,
    (l.venta - l.costo) - gas.monto - mer.monto
  from l cross join can cross join pg cross join mer cross join gas;
$$;
grant execute on function public.panel_resumen(uuid, date, date) to anon, authenticated;;
