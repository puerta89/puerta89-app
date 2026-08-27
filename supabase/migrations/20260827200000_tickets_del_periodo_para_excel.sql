-- Mercedes: "cuando descargas el excel no te aparecen todos los tickets.
-- o sea como el que te descargue de loyverse"
--
-- El Excel de /panel/exportar ya tenía una hoja "Ventas" (una fila por
-- día+artículo, como el reporte "Ventas por artículo" de Loyverse), pero
-- nunca hubo una hoja de una fila POR TICKET/RECIBO — eso es justo lo
-- que Loyverse sí traía y lo que está pidiendo. Se agrega
-- tickets_del_periodo: una fila por cada cuenta cerrada, con folio,
-- fecha, hora, mesero, banco(s), personas, subtotal, descuento, propina,
-- total, y cuánto de eso fue efectivo/tarjeta.

create or replace function public.tickets_del_periodo(p_sucursal uuid, p_desde date, p_hasta date)
returns table(
  folio bigint,
  fecha date,
  hora text,
  mesero text,
  bancos text,
  personas int,
  subtotal numeric,
  descuento numeric,
  propina numeric,
  total numeric,
  efectivo numeric,
  tarjeta numeric,
  permanencia_min numeric
)
language sql
security definer
set search_path to 'public'
as $function$
  select t.folio,
         (t.cerrado_en at time zone 'America/Mexico_City')::date,
         to_char(t.cerrado_en at time zone 'America/Mexico_City', 'HH24:MI'),
         e.nombre,
         (select string_agg(b.numero::text, ', ' order by b.numero)
            from ticket_bancos tb join bancos b on b.id = tb.banco_id
           where tb.ticket_id = t.id),
         t.personas,
         t.subtotal,
         t.descuento,
         t.propina,
         t.total,
         coalesce((select sum(monto) from pagos where ticket_id = t.id and metodo = 'efectivo'), 0),
         coalesce((select sum(monto) from pagos where ticket_id = t.id and metodo = 'tarjeta'), 0),
         round(extract(epoch from (t.cerrado_en - t.abierto_en)) / 60)
  from tickets t
  left join empleados e on e.id = t.abierto_por
  where t.sucursal_id = p_sucursal
    and t.estado = 'cerrado'
    and (t.cerrado_en at time zone 'America/Mexico_City')::date between p_desde and p_hasta
  order by t.cerrado_en;
$function$;

revoke execute on function public.tickets_del_periodo(uuid, date, date) from public, anon, authenticated;
grant execute on function public.tickets_del_periodo(uuid, date, date) to service_role, postgres;
