-- Devuelve el mapa de una sucursal: sus zonas, sus bancos y cuáles están
-- ocupados. A propósito NO devuelve dinero: para el mapa no hace falta.
create or replace function public.mapa_barra(p_sucursal uuid)
returns table (
  zona_id uuid,
  zona_nombre text,
  zona_orden int,
  banco_id uuid,
  numero int,
  pos_x numeric,
  pos_y numeric,
  ticket_id uuid,
  ticket_estado text,
  abierto_en timestamptz,
  personas int,
  mesero text
)
language sql
security definer
set search_path = public
as $$
  select z.id, z.nombre, z.orden,
         b.id, b.numero, b.pos_x, b.pos_y,
         t.id, t.estado, t.abierto_en, t.personas, e.nombre
  from zonas z
  join bancos b on b.zona_id = z.id and b.activo
  left join ticket_bancos tb on tb.banco_id = b.id and tb.hasta is null
  left join tickets t on t.id = tb.ticket_id and t.estado in ('abierto','por_cobrar')
  left join empleados e on e.id = t.abierto_por
  where z.sucursal_id = p_sucursal
  order by z.orden, b.numero;
$$;

revoke all on function public.mapa_barra(uuid) from public;
grant execute on function public.mapa_barra(uuid) to anon, authenticated;

-- Abre una cuenta en uno o varios bancos. Valida que el mesero esté activo
-- y que los bancos sean de SU sucursal y estén libres.
create or replace function public.abrir_cuenta(
  p_empleado uuid,
  p_bancos uuid[],
  p_personas int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sucursal uuid;
  v_ticket uuid;
  v_ocupados int;
begin
  select sucursal_id into v_sucursal
  from empleados where id = p_empleado and activo;

  if v_sucursal is null then
    raise exception 'Ese mesero no está activo';
  end if;

  if p_bancos is null or array_length(p_bancos, 1) is null then
    raise exception 'Hay que elegir al menos un banco';
  end if;

  -- todos los bancos tienen que ser de la sucursal del mesero
  if exists (
    select 1 from unnest(p_bancos) as x(id)
    left join bancos b on b.id = x.id and b.activo
    where b.id is null or b.sucursal_id <> v_sucursal
  ) then
    raise exception 'Alguno de esos bancos no es de tu sucursal';
  end if;

  -- y tienen que estar libres
  select count(*) into v_ocupados
  from ticket_bancos tb
  join tickets t on t.id = tb.ticket_id
  where tb.banco_id = any(p_bancos)
    and tb.hasta is null
    and t.estado in ('abierto','por_cobrar');

  if v_ocupados > 0 then
    raise exception 'Alguno de esos bancos ya tiene cuenta abierta';
  end if;

  insert into tickets (sucursal_id, personas, abierto_por)
  values (v_sucursal, greatest(p_personas, 1), p_empleado)
  returning id into v_ticket;

  insert into ticket_bancos (ticket_id, banco_id)
  select v_ticket, x.id from unnest(p_bancos) as x(id);

  return v_ticket;
end;
$$;

revoke all on function public.abrir_cuenta(uuid, uuid[], int) from public;
grant execute on function public.abrir_cuenta(uuid, uuid[], int) to anon, authenticated;;
