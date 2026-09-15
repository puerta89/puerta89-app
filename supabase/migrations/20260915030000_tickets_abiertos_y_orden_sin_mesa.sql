-- Mercedes: quiere un botón "Tickets abiertos" arriba, para que el
-- mesero pueda ver y retomar cualquier cuenta en curso (con mesa o sin
-- ella) sin depender del mapa — que para meseros ya no es la pantalla
-- principal. Devuelve una fila por cada ticket abierto o por_cobrar de
-- la sucursal, sin importar quién lo abrió.
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
  order by t.abierto_en;
$$;

revoke execute on function public.tickets_abiertos_de(uuid) from public, anon, authenticated;
grant execute on function public.tickets_abiertos_de(uuid) to service_role, postgres;
