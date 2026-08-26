-- Mercedes vio el rosa de CDMX en producción y pidió invertir: fondo rosa
-- claro y letra rojo vino (en vez de lo que tenía: fondo rosa vino con
-- letra crema, igual que Puebla salvo el tono). Se agrega un color de
-- texto POR SUCURSAL en vez de asumir siempre "texto crema" como estaba
-- hardcodeado en los 11 headers de la app.

alter table sucursales add column color_texto text not null default '#fbf6f6';

update sucursales set color_texto = '#fbf6f6' where nombre = 'Puebla'; -- crema, sin cambio
update sucursales set color = '#f4b3b3', color_texto = '#781727' where nombre = 'CDMX'; -- rosa claro + vino

create or replace function public.verificar_codigo(p_codigo text)
returns table(empleado_id uuid, empleado_nombre text, rol text, puede_cambiar_sucursal boolean, sucursal_id uuid, sucursal_nombre text, sucursal_color text, sucursal_color_texto text)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_rec record;
  v_fallos int;
begin
  select count(*) into v_fallos
  from intentos_login
  where not exitoso and creado_en > now() - interval '10 minutes';

  if v_fallos >= 8 then
    raise exception 'Demasiados intentos fallidos. Espera unos minutos.'
      using errcode = 'P0001';
  end if;

  select e.id, e.nombre, e.rol, e.puede_cambiar_sucursal,
         s.id as suc_id, s.nombre as suc_nombre, s.color as suc_color,
         s.color_texto as suc_color_texto
    into v_rec
  from empleados e
  join sucursales s on s.id = e.sucursal_id
  where e.activo
    and s.activa
    and e.codigo_hash = extensions.crypt(p_codigo, e.codigo_hash)
  limit 1;

  insert into intentos_login (exitoso, empleado_id)
  values (v_rec.id is not null, v_rec.id);

  if v_rec.id is null then
    return;
  end if;

  delete from intentos_login
   where not exitoso and creado_en > now() - interval '10 minutes';

  empleado_id := v_rec.id;
  empleado_nombre := v_rec.nombre;
  rol := v_rec.rol;
  puede_cambiar_sucursal := v_rec.puede_cambiar_sucursal;
  sucursal_id := v_rec.suc_id;
  sucursal_nombre := v_rec.suc_nombre;
  sucursal_color := v_rec.suc_color;
  sucursal_color_texto := v_rec.suc_color_texto;
  return next;
end;
$function$;

revoke execute on function public.verificar_codigo(text) from public, authenticated;
grant execute on function public.verificar_codigo(text) to anon, service_role, postgres;

create or replace function public.cambiar_sucursal(p_empleado uuid, p_sucursal uuid)
returns table(sucursal_id uuid, sucursal_nombre text, sucursal_color text, sucursal_color_texto text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_puede boolean;
  v_id uuid; v_nombre text; v_color text; v_color_texto text;
begin
  select puede_cambiar_sucursal into v_puede from empleados where id = p_empleado and activo;
  if v_puede is null then raise exception 'Ese empleado no está activo'; end if;
  if not v_puede then raise exception 'No puedes cambiar de sucursal'; end if;

  select s.id, s.nombre, s.color, s.color_texto into v_id, v_nombre, v_color, v_color_texto
  from sucursales s where s.id = p_sucursal;
  if v_id is null then raise exception 'Esa sucursal no existe'; end if;

  return query select v_id, v_nombre, v_color, v_color_texto;
end;
$function$;

revoke execute on function public.cambiar_sucursal(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cambiar_sucursal(uuid, uuid) to service_role, postgres;
