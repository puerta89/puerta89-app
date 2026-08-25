-- Mercedes pidió que el Excel se pueda descargar "como los excels de
-- Loyverse" para que Iram lo pueda seguir usando igual que el export de
-- Loyverse ("Informes → Ventas por artículo") que hoy pega a mano en su
-- propio Excel de operación. Esta función arma exactamente ese formato:
-- una fila por día + artículo vendido, con las mismas columnas
-- (Fecha, Artículo, Categoría, Cantidad, Ventas brutas, Ventas netas,
-- Costo de los bienes, Beneficio bruto, Margen).
--
-- "Artículo" se arma igual que Loyverse lo nombraba: el producto solo si
-- su presentación es "Única" (sin variante), o "Producto (Variante)" para
-- copa/bola/talla/etc. Para el Affogato (que no es un sabor en sí, pero
-- lleva uno real via linea_sabores) se usa el sabor elegido, igual que
-- Loyverse mostraba "Affogato 89 (Vainilla)".
--
-- "Ventas netas" resta el descuento del ticket, repartido proporcional
-- al importe de cada línea (mi sistema solo registra descuento a nivel
-- de cuenta completa, no por renglón).
create or replace function public.panel_ventas_lineas(p_sucursal uuid, p_desde date, p_hasta date)
returns table(
  fecha date, articulo text, categoria text, cantidad numeric,
  ventas_brutas numeric, ventas_netas numeric, costo numeric,
  beneficio_bruto numeric, margen numeric
)
language sql
security definer
set search_path to 'public'
as $function$
  with base as (
    select
      (t.cerrado_en at time zone 'America/Mexico_City')::date as fecha,
      c.nombre as categoria,
      case
        when pe.consumo_derivado = 'copa' then p.nombre || ' (Copa)'
        when p.es_sabor_helado then p.nombre || ' (' || pe.nombre || ')'
        when exists (select 1 from linea_sabores ls2 where ls2.linea_id = tl.id) then
          p.nombre || ' (' || (
            select string_agg(sp.nombre, ', ' order by sp.nombre)
            from linea_sabores ls3
            join productos sp on sp.id = ls3.producto_id
            where ls3.linea_id = tl.id
          ) || ')'
        when pe.nombre = 'Única' then p.nombre
        else p.nombre || ' (' || pe.nombre || ')'
      end as articulo,
      tl.cantidad as cantidad,
      tl.cantidad * tl.precio_unitario as ventas_brutas,
      tl.cantidad * tl.precio_unitario
        - coalesce(t.descuento, 0) * (tl.cantidad * tl.precio_unitario) / nullif(t.subtotal, 0) as ventas_netas,
      tl.cantidad * tl.costo_unitario as costo
    from ticket_lineas tl
    join tickets t on t.id = tl.ticket_id
    join presentaciones pe on pe.id = tl.presentacion_id
    join productos p on p.id = pe.producto_id
    join categorias c on c.id = p.categoria_id
    where t.sucursal_id = p_sucursal
      and t.estado = 'cerrado'
      and tl.estado = 'activa'
      and (t.cerrado_en at time zone 'America/Mexico_City')::date between p_desde and p_hasta
  )
  select
    fecha, articulo, categoria,
    sum(cantidad) as cantidad,
    sum(ventas_brutas) as ventas_brutas,
    sum(ventas_netas) as ventas_netas,
    sum(costo) as costo,
    sum(ventas_netas) - sum(costo) as beneficio_bruto,
    case when sum(ventas_netas) > 0
         then round((sum(ventas_netas) - sum(costo)) / sum(ventas_netas), 4)
         else 0 end as margen
  from base
  group by fecha, articulo, categoria
  order by fecha, articulo;
$function$;

revoke execute on function public.panel_ventas_lineas(uuid, date, date) from public, anon, authenticated;
grant execute on function public.panel_ventas_lineas(uuid, date, date) to service_role, postgres;
