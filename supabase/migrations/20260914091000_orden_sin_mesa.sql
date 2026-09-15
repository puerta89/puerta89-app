-- Mercedes, tras poner la app en uso: "es más eficiente empezar con
-- tomar la orden... una vez la tengan la guarden y en ese momento elijan
-- dónde están sentados... o que cobren directo" — llegan a pedir un
-- helado para llevar y no se sientan, así que forzar a elegir mesa ANTES
-- de poder pedir no sirve.
--
-- abrir_cuenta ya no exige al menos un banco: un ticket puede nacer sin
-- mesa (para llevar / se decide después) y asignársela luego con
-- mover_cuenta, o cobrarse directo sin jamás tener banco.
create or replace function public.abrir_cuenta(
  p_empleado uuid, p_bancos uuid[], p_personas int
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sucursal uuid;
  v_ticket uuid;
  v_ocupados int;
  v_hay_bancos boolean := p_bancos is not null and array_length(p_bancos, 1) is not null;
begin
  select sucursal_id into v_sucursal
  from empleados where id = p_empleado and activo;

  if v_sucursal is null then
    raise exception 'Ese mesero no está activo';
  end if;

  if v_hay_bancos then
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
  end if;

  insert into tickets (sucursal_id, personas, abierto_por)
  values (v_sucursal, greatest(p_personas, 1), p_empleado)
  returning id into v_ticket;

  if v_hay_bancos then
    insert into ticket_bancos (ticket_id, banco_id)
    select v_ticket, x.id from unnest(p_bancos) as x(id);
  end if;

  return v_ticket;
end;
$$;

revoke execute on function public.abrir_cuenta(uuid, uuid[], int) from public, anon, authenticated;
grant execute on function public.abrir_cuenta(uuid, uuid[], int) to service_role, postgres;

-- La cabecera de un ticket (mesero, personas, cuándo abrió, en qué
-- bancos está) buscándolo por su propio id — a diferencia de mapa_barra,
-- que parte DE los bancos, así que un ticket sin mesa (o que ya no tiene
-- ninguna asignada) nunca aparecía ahí y la pantalla de la cuenta
-- tronaba con 404. p_sucursal acota el acceso igual que en mapa_barra:
-- un mesero de una sucursal no puede ver un ticket de la otra aunque
-- sepa su id.
create or replace function public.ticket_cabecera(p_sucursal uuid, p_ticket uuid)
returns table(
  ticket_id uuid,
  estado text,
  personas int,
  abierto_en timestamptz,
  mesero text,
  bancos int[]
)
language sql
security definer
set search_path = public
as $$
  select t.id, t.estado, t.personas, t.abierto_en, e.nombre,
    (select array_agg(b.numero order by b.numero)
       from ticket_bancos tb join bancos b on b.id = tb.banco_id
      where tb.ticket_id = t.id and tb.hasta is null)
  from tickets t
  left join empleados e on e.id = t.abierto_por
  where t.id = p_ticket and t.sucursal_id = p_sucursal
    and t.estado in ('abierto','por_cobrar');
$$;

revoke execute on function public.ticket_cabecera(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ticket_cabecera(uuid, uuid) to service_role, postgres;
