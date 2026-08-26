-- Mercedes: "no hay manera de que pueda ver todo el menu tambien y que
-- si hay algun producto que se tenga que editar se pueda hacer
-- manualmente, por ejemplo que suban el precio o algo?"
--
-- Nueva vista "Ver todo el menú" en /catalogo (pestaña por default, junto
-- a "Agregar algo nuevo" que ya existía): lista TODO el catálogo de la
-- sucursal actual, agrupado por categoría, con buscador. Pica cualquier
-- renglón y se puede cambiar precio/costo.
--
-- El cambio de precio NO sobreescribe la fila existente: cierra la
-- vigente (vigente_hasta = now()) e inserta una nueva. Esto es justo lo
-- que la tabla precios ya estaba diseñada para hacer (tiene
-- vigente_desde/vigente_hasta desde el diseño original) — las ventas ya
-- hechas guardan su propio precio_unitario/costo_unitario en
-- ticket_lineas, así que cambiar el precio hacia adelante no altera el
-- historial ni los reportes ya calculados.

create or replace function public.catalogo_completo(p_sucursal uuid)
returns table(
  categoria text, categoria_orden int,
  producto_id uuid, producto text, tipo_vino text, activo boolean,
  presentacion_id uuid, presentacion text, presentacion_orden int,
  precio numeric, costo numeric
)
language sql
security definer
set search_path to 'public'
as $function$
  select c.nombre, c.orden,
         p.id, p.nombre, p.tipo_vino, p.activo,
         pe.id, pe.nombre, pe.orden,
         pr.precio, pr.costo
  from productos p
  join categorias c on c.id = p.categoria_id
  join presentaciones pe on pe.producto_id = p.id and pe.activa
  left join precios pr on pr.presentacion_id = pe.id
                      and pr.sucursal_id = p_sucursal
                      and pr.vigente_hasta is null
  order by c.orden, p.nombre, pe.orden;
$function$;

create or replace function public.catalogo_cambiar_precio(p_empleado uuid, p_presentacion uuid, p_precio numeric, p_costo numeric)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_suc uuid; v_rol text;
begin
  select sucursal_id, rol into v_suc, v_rol from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño o el gerente pueden cambiar precios'; end if;
  if p_precio is null or p_precio <= 0 then raise exception 'Falta el precio'; end if;
  if p_costo is null or p_costo < 0 then raise exception 'El costo no puede ser negativo'; end if;

  update precios
     set vigente_hasta = now()
   where presentacion_id = p_presentacion and sucursal_id = v_suc and vigente_hasta is null;

  insert into precios (presentacion_id, sucursal_id, precio, costo, vigente_desde)
  values (p_presentacion, v_suc, p_precio, p_costo, now());
end;
$function$;

revoke execute on function public.catalogo_completo(uuid) from public, anon, authenticated;
grant execute on function public.catalogo_completo(uuid) to service_role, postgres;
revoke execute on function public.catalogo_cambiar_precio(uuid, uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.catalogo_cambiar_precio(uuid, uuid, numeric, numeric) to service_role, postgres;
