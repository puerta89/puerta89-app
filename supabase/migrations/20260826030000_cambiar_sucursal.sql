-- Mercedes: "quiero dejarle ya configurado el de mexico pero todo en
-- blanco... que en la parte superior izquierda iram pueda seleccionar
-- puebla o mexico". La base ya traia el terreno preparado para esto
-- desde el diseño original: empleados.puede_cambiar_sucursal (Iram ya
-- lo tenia en true) y Sesion.puedeCambiarSucursal en lib/sesion.ts,
-- pero nunca se habia construido el selector ni la accion para usarlo.
--
-- CDMX se activa (estaba activa=false) — sus constantes (color, modo de
-- venta de vino, dias de anticipacion, litros_por_bola, copas_por_botella)
-- ya estaban cargadas desde el diseño original del proyecto. A propósito
-- NO se le cargan zonas/bancos/precios/existencias: queda en blanco para
-- que Iram la configure él mismo con los datos reales de esa sucursal
-- (el mapa de la barra sigue siendo cosa de una migración a mano, como
-- se hizo con Puebla, hasta que se pida un editor visual para eso).

update sucursales set activa = true where nombre = 'CDMX';

-- Sucursales entre las que un empleado puede moverse (solo si tiene
-- puede_cambiar_sucursal; si no, solo ve la suya).
create or replace function public.sucursales_de(p_empleado uuid)
returns table(id uuid, nombre text, color text, activa boolean)
language sql
security definer
set search_path to 'public'
as $function$
  select s.id, s.nombre, s.color, s.activa
  from sucursales s
  where (select puede_cambiar_sucursal from empleados where id = p_empleado)
     or s.id = (select sucursal_id from empleados where id = p_empleado)
  order by s.nombre;
$function$;

-- Valida y devuelve los datos para reconstruir la sesión en otra sucursal.
create or replace function public.cambiar_sucursal(p_empleado uuid, p_sucursal uuid)
returns table(sucursal_id uuid, sucursal_nombre text, sucursal_color text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_puede boolean;
  v_id uuid; v_nombre text; v_color text;
begin
  select puede_cambiar_sucursal into v_puede from empleados where id = p_empleado and activo;
  if v_puede is null then raise exception 'Ese empleado no está activo'; end if;
  if not v_puede then raise exception 'No puedes cambiar de sucursal'; end if;

  select s.id, s.nombre, s.color into v_id, v_nombre, v_color
  from sucursales s where s.id = p_sucursal;
  if v_id is null then raise exception 'Esa sucursal no existe'; end if;

  return query select v_id, v_nombre, v_color;
end;
$function$;

revoke execute on function public.sucursales_de(uuid) from public, anon, authenticated;
grant execute on function public.sucursales_de(uuid) to service_role, postgres;
revoke execute on function public.cambiar_sucursal(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cambiar_sucursal(uuid, uuid) to service_role, postgres;
