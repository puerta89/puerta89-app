-- Tercera tanda de "que se parezca a Loyverse": comentario en la cuenta,
-- pasar la cuenta a otro mesero, y devolución parcial de una venta ya
-- cobrada (antes solo existía anular la venta COMPLETA).

-- 1) Comentario en la cuenta (ej. "sin cebolla", "mesa VIP") ---------------
alter table tickets add column if not exists comentario text;

create or replace function public.poner_comentario_cuenta(
  p_empleado uuid, p_ticket uuid, p_comentario text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_suc uuid;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;

  update tickets set comentario = nullif(trim(p_comentario), '')
   where id = p_ticket and sucursal_id = v_suc and estado in ('abierto', 'por_cobrar');
  if not found then raise exception 'Esa cuenta no está abierta'; end if;
end;
$$;

-- ticket_cabecera ahora también trae el comentario, para que la comanda
-- lo muestre y lo pueda editar (mismo lugar donde ya llega mesero/personas).
-- Cambia el shape de columnas, así que hay que tirarla primero.
drop function if exists public.ticket_cabecera(uuid, uuid);

create function public.ticket_cabecera(p_sucursal uuid, p_ticket uuid)
returns table(
  ticket_id uuid, estado text, personas integer,
  abierto_en timestamp with time zone, mesero text, bancos integer[],
  comentario text
)
language sql
security definer
set search_path to 'public'
as $$
  select t.id, t.estado, t.personas, t.abierto_en, e.nombre,
    (select array_agg(b.numero order by b.numero)
       from ticket_bancos tb join bancos b on b.id = tb.banco_id
      where tb.ticket_id = t.id and tb.hasta is null),
    t.comentario
  from tickets t
  left join empleados e on e.id = t.abierto_por
  where t.id = p_ticket and t.sucursal_id = p_sucursal
    and t.estado in ('abierto', 'por_cobrar');
$$;

-- 2) Pasar la cuenta a otro mesero (le cambia el dueño del ticket) --------
create or replace function public.reasignar_mesero(
  p_solicitante uuid, p_ticket uuid, p_nuevo uuid
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_suc uuid; v_suc_nuevo uuid; v_activo_nuevo boolean;
begin
  select sucursal_id into v_suc from empleados where id = p_solicitante and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;

  select sucursal_id, activo into v_suc_nuevo, v_activo_nuevo
  from empleados where id = p_nuevo;
  if v_suc_nuevo is null or v_suc_nuevo <> v_suc or not coalesce(v_activo_nuevo, false) then
    raise exception 'Ese empleado no está activo en esta sucursal';
  end if;

  update tickets set abierto_por = p_nuevo
   where id = p_ticket and sucursal_id = v_suc and estado in ('abierto', 'por_cobrar');
  if not found then raise exception 'Esa cuenta no está abierta'; end if;
end;
$$;

-- ticket_lineas.estado tenía un candado que solo dejaba 'activa' o
-- 'cancelada' — hay que ampliarlo antes de poder marcar algo 'devuelta'.
alter table ticket_lineas drop constraint if exists ticket_lineas_estado_check;
alter table ticket_lineas add constraint ticket_lineas_estado_check
  check (estado = any (array['activa', 'cancelada', 'devuelta']));

-- 3) Devolución parcial de una venta ya cobrada ---------------------------
-- Antes solo existía anular la cuenta COMPLETA (cancelar_cuenta). Esto
-- devuelve nada más los renglones elegidos: regresa su inventario y queda
-- registrado en `devoluciones` (quién, cuánto, con qué método se regresó
-- el dinero, y por qué). El renglón pasa a estado 'devuelta' — igual que
-- 'cancelada', panel_resumen ya NO lo cuenta como venta.
create or replace function public.devolver_lineas(
  p_empleado uuid, p_ticket uuid, p_lineas uuid[], p_metodo text, p_motivo text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_suc uuid; v_linea record; v_monto numeric;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if p_metodo not in ('efectivo', 'tarjeta') then
    raise exception 'El método de devolución debe ser efectivo o tarjeta';
  end if;
  if p_lineas is null or array_length(p_lineas, 1) is null then
    raise exception 'Elige al menos un renglón para devolver';
  end if;

  perform 1 from tickets
   where id = p_ticket and sucursal_id = v_suc and estado = 'cerrado';
  if not found then
    raise exception 'Esa cuenta no está cobrada, o no es de esta sucursal';
  end if;

  for v_linea in
    select id, cantidad, precio_unitario from ticket_lineas
     where id = any(p_lineas) and ticket_id = p_ticket and estado = 'activa'
  loop
    v_monto := v_linea.cantidad * v_linea.precio_unitario;
    update ticket_lineas set estado = 'devuelta' where id = v_linea.id;

    insert into devoluciones (ticket_id, linea_id, monto, metodo, regresa_a_inventario, motivo, autorizado_por)
    values (p_ticket, v_linea.id, v_monto, p_metodo, true, nullif(trim(p_motivo), ''), p_empleado);

    perform revertir_linea_inventario(v_linea.id, p_empleado);
  end loop;

  update tickets t
     set subtotal = sub.total, total = sub.total - t.descuento
    from (select coalesce(sum(cantidad * precio_unitario), 0) as total
            from ticket_lineas where ticket_id = p_ticket and estado = 'activa') sub
   where t.id = p_ticket;
end;
$$;

-- panel_resumen: las líneas devueltas se suman al mismo renglón que ya
-- existía para "cancelado" (mismo significado de negocio: se vendió algo
-- que al final no se cuenta como venta) — mismo shape de columnas, para
-- no tener que tocar el tipo TypeScript ni el Excel.
create or replace function public.panel_resumen(p_sucursal uuid, p_desde date, p_hasta date)
returns table(ventas numeric, costo numeric, utilidad_bruta numeric, margen numeric,
  tickets integer, ticket_promedio numeric, permanencia_min numeric, efectivo numeric,
  tarjeta numeric, propinas numeric, descuentos numeric, cancelado numeric,
  mermas numeric, gastos numeric, utilidad_real numeric)
language sql
security definer
set search_path to 'public'
as $$
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
    where tl.estado in ('cancelada', 'devuelta')
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

revoke execute on function public.poner_comentario_cuenta(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.poner_comentario_cuenta(uuid, uuid, text) to service_role, postgres;
revoke execute on function public.ticket_cabecera(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ticket_cabecera(uuid, uuid) to service_role, postgres;
revoke execute on function public.reasignar_mesero(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.reasignar_mesero(uuid, uuid, uuid) to service_role, postgres;
revoke execute on function public.devolver_lineas(uuid, uuid, uuid[], text, text) from public, anon, authenticated;
grant execute on function public.devolver_lineas(uuid, uuid, uuid[], text, text) to service_role, postgres;
revoke execute on function public.panel_resumen(uuid, date, date) from public, anon, authenticated;
grant execute on function public.panel_resumen(uuid, date, date) to service_role, postgres;
