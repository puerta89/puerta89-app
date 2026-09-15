-- Mercedes: "no es necesario que en tickets abiertos aparezca el vacío,
-- simplemente los que ya se guardaron" — una cuenta sin mesa (borrador,
-- recién tomada, antes de picarle "Guardar") no debería aparecer en la
-- lista general: solo le importa al mesero que la está armando, y ya se
-- retoma sola por Sesion.ordenActualId. Mostrarla en "Tickets abiertos"
-- solo confundía (y, si alguien la cancelaba desde ahí, la lista se
-- quedaba con un link muerto que tronaba en 404 al tocarlo otra vez).
create or replace function public.tickets_abiertos_de(p_sucursal uuid)
returns table(
  ticket_id uuid,
  estado text,
  personas int,
  abierto_en timestamptz,
  mesero text,
  bancos int[],
  total numeric
)
language sql
security definer
set search_path = public
as $$
  select t.id, t.estado, t.personas, t.abierto_en, e.nombre,
    (select array_agg(b.numero order by b.numero)
       from ticket_bancos tb join bancos b on b.id = tb.banco_id
      where tb.ticket_id = t.id and tb.hasta is null),
    t.total
  from tickets t
  left join empleados e on e.id = t.abierto_por
  where t.sucursal_id = p_sucursal
    and t.estado in ('abierto', 'por_cobrar')
    and exists (
      select 1 from ticket_bancos tb
      where tb.ticket_id = t.id and tb.hasta is null
    )
  order by t.abierto_en;
$$;

revoke execute on function public.tickets_abiertos_de(uuid) from public, anon, authenticated;
grant execute on function public.tickets_abiertos_de(uuid) to service_role, postgres;
