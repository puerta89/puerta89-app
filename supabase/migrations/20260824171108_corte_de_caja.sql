-- Entradas y salidas de efectivo durante el turno. Nada de números
-- sueltos: cada movimiento dice de qué fue y quién lo hizo.
create table movimientos_caja (
  id uuid primary key default gen_random_uuid(),
  corte_id uuid not null references cortes(id) on delete cascade,
  tipo text not null check (tipo in ('entrada','salida')),
  monto numeric(12,2) not null check (monto > 0),
  concepto text not null,
  empleado_id uuid references empleados(id),
  creado_en timestamptz not null default now()
);
alter table movimientos_caja enable row level security;
create index movimientos_caja_corte_idx on movimientos_caja (corte_id);

-- Cómo va el día: lo que el sistema calcula que debería haber en la caja.
create or replace function public.resumen_del_dia(p_sucursal uuid, p_fecha date)
returns table (
  corte_id uuid, estado text, fondo_inicial numeric,
  ventas_efectivo numeric, ventas_tarjeta numeric,
  entradas numeric, salidas numeric,
  efectivo_esperado numeric,
  tickets int, propina_tarjeta numeric, efectivo_contado numeric
)
language sql security definer set search_path = public as $$
  with c as (
    select * from cortes where sucursal_id = p_sucursal and fecha = p_fecha
  ),
  v as (
    select
      coalesce(sum(pg.monto) filter (where pg.metodo = 'efectivo'), 0) as efec,
      coalesce(sum(pg.monto) filter (where pg.metodo = 'tarjeta'), 0) as tarj,
      count(distinct t.id)::int as n
    from tickets t
    join pagos pg on pg.ticket_id = t.id
    where t.sucursal_id = p_sucursal
      and t.estado = 'cerrado'
      and (t.cerrado_en at time zone 'America/Mexico_City')::date = p_fecha
  ),
  m as (
    select
      coalesce(sum(monto) filter (where tipo = 'entrada'), 0) as ent,
      coalesce(sum(monto) filter (where tipo = 'salida'), 0) as sal
    from movimientos_caja mc join c on c.id = mc.corte_id
  )
  select c.id, c.estado, c.fondo_inicial,
         v.efec, v.tarj, m.ent, m.sal,
         c.fondo_inicial + v.efec + m.ent - m.sal,
         v.n, c.propina_tarjeta, c.efectivo_contado
  from c cross join v cross join m;
$$;
grant execute on function public.resumen_del_dia(uuid, date) to anon, authenticated;

-- Quiénes trabajaron ese día, según los tickets que tocaron.
create or replace function public.meseros_del_dia(p_sucursal uuid, p_fecha date)
returns table (empleado_id uuid, nombre text, rol text, tickets int)
language sql security definer set search_path = public as $$
  select e.id, e.nombre, e.rol, count(distinct t.id)::int
  from empleados e
  join tickets t on t.abierto_por = e.id
  where t.sucursal_id = p_sucursal
    and (t.abierto_en at time zone 'America/Mexico_City')::date = p_fecha
  group by e.id, e.nombre, e.rol
  order by e.nombre;
$$;
grant execute on function public.meseros_del_dia(uuid, date) to anon, authenticated;

-- Abrir el día con su fondo de caja. Solo dueño o gerente.
create or replace function public.abrir_corte(
  p_empleado uuid, p_fecha date, p_fondo numeric
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_suc uuid; v_rol text; v_id uuid;
begin
  select sucursal_id, rol into v_suc, v_rol
  from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol not in ('dueno','gerente') then
    raise exception 'Solo el dueño puede abrir la caja';
  end if;

  insert into cortes (sucursal_id, fecha, fondo_inicial, abierto_por)
  values (v_suc, p_fecha, greatest(coalesce(p_fondo,0), 0), p_empleado)
  on conflict (sucursal_id, fecha) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from cortes where sucursal_id = v_suc and fecha = p_fecha;
  end if;
  return v_id;
end;
$$;
grant execute on function public.abrir_corte(uuid, date, numeric) to anon, authenticated;

create or replace function public.registrar_movimiento_caja(
  p_empleado uuid, p_corte uuid, p_tipo text, p_monto numeric, p_concepto text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_suc uuid;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if coalesce(trim(p_concepto), '') = '' then
    raise exception 'Hay que decir de qué fue el movimiento';
  end if;

  perform 1 from cortes
   where id = p_corte and sucursal_id = v_suc and estado = 'abierto';
  if not found then raise exception 'Esa caja ya está cerrada'; end if;

  insert into movimientos_caja (corte_id, tipo, monto, concepto, empleado_id)
  values (p_corte, p_tipo, p_monto, trim(p_concepto), p_empleado);
end;
$$;
grant execute on function public.registrar_movimiento_caja(uuid, uuid, text, numeric, text) to anon, authenticated;;
