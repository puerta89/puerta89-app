create or replace function public.panel_desglose(
  p_sucursal uuid, p_desde date, p_hasta date, p_por text
)
returns table (etiqueta text, venta numeric, utilidad numeric, unidades numeric)
language sql security definer set search_path = public as $$
  with t as (
    select * from tickets
    where sucursal_id = p_sucursal and estado = 'cerrado'
      and (cerrado_en at time zone 'America/Mexico_City')::date between p_desde and p_hasta
  ),
  l as (
    select t.abierto_por, t.cerrado_en,
           tl.cantidad, tl.precio_unitario, tl.costo_unitario,
           p.nombre as producto, pe.nombre as presentacion, c.nombre as categoria
    from ticket_lineas tl
    join t on t.id = tl.ticket_id
    join presentaciones pe on pe.id = tl.presentacion_id
    join productos p on p.id = pe.producto_id
    join categorias c on c.id = p.categoria_id
    where tl.estado = 'activa'
  )
  select
    case p_por
      when 'categoria' then l.categoria
      when 'producto'  then l.producto || case when l.presentacion = 'Única'
                                               then '' else ' · ' || l.presentacion end
      when 'mesero'    then coalesce(e.nombre, 'sin mesero')
      when 'hora'      then to_char(l.cerrado_en at time zone 'America/Mexico_City', 'HH24') || ':00'
      else l.categoria
    end,
    sum(l.cantidad * l.precio_unitario),
    sum(l.cantidad * (l.precio_unitario - l.costo_unitario)),
    sum(l.cantidad)
  from l
  left join empleados e on e.id = l.abierto_por
  group by 1
  order by 2 desc;
$$;
grant execute on function public.panel_desglose(uuid, date, date, text) to anon, authenticated;

-- Qué bancos venden más. El total de una cuenta se reparte parejo entre
-- los bancos que ocupó, para no contarlo dos veces.
create or replace function public.panel_bancos(
  p_sucursal uuid, p_desde date, p_hasta date
)
returns table (banco int, zona text, cuentas int, venta numeric, permanencia_min numeric)
language sql security definer set search_path = public as $$
  with cuantos as (
    select ticket_id, count(*)::numeric as n
    from ticket_bancos group by ticket_id
  )
  select b.numero, z.nombre,
         count(distinct t.id)::int,
         coalesce(round(sum(t.total / c.n), 2), 0),
         coalesce(round(avg(extract(epoch from (t.cerrado_en - t.abierto_en)) / 60)::numeric, 0), 0)
  from tickets t
  join ticket_bancos tb on tb.ticket_id = t.id
  join cuantos c on c.ticket_id = t.id
  join bancos b on b.id = tb.banco_id
  join zonas z on z.id = b.zona_id
  where t.sucursal_id = p_sucursal and t.estado = 'cerrado'
    and (t.cerrado_en at time zone 'America/Mexico_City')::date between p_desde and p_hasta
  group by b.numero, z.nombre
  order by 4 desc;
$$;
grant execute on function public.panel_bancos(uuid, date, date) to anon, authenticated;

create or replace function public.panel_sucursales(p_desde date, p_hasta date)
returns table (sucursal text, color text, ventas numeric, utilidad numeric,
               tickets int, ticket_promedio numeric)
language sql security definer set search_path = public as $$
  select s.nombre, s.color, r.ventas, r.utilidad_bruta, r.tickets, r.ticket_promedio
  from sucursales s
  cross join lateral panel_resumen(s.id, p_desde, p_hasta) r
  where s.activa
  order by r.ventas desc;
$$;
grant execute on function public.panel_sucursales(date, date) to anon, authenticated;;
