-- Mercedes pidio confirmar/asegurar: "cuando des de alta un mesero en
-- puebla solo vea puebla y cuando sea uno de cdmx solo vea cdmx".
--
-- BUG REAL ENCONTRADO al revisarlo: alta_empleado/cambiar_codigo/
-- baja_empleado derivaban la sucursal del REGISTRO FIJO del empleado que
-- autoriza (Iram, fijo en Puebla en la tabla empleados), no de la sesion
-- activa. Con el selector de sucursal nuevo, si Iram cambiaba a CDMX y
-- daba de alta a alguien, se habria creado en Puebla por error. Ahora
-- las 3 funciones reciben p_sucursal explicito (la sesion actual).
--
-- SEGUNDO BUG encontrado probandolo en vivo: al buscar el codigo del
-- jefe SOLO dentro de p_sucursal, el propio Iram (su registro real vive
-- fijo en Puebla) no podia autorizar altas en CDMX -- "Ese codigo no es
-- de nadie". Se corrige: si el codigo no aparece entre los de esa
-- sucursal, tambien se acepta el codigo de un dueno con
-- puede_cambiar_sucursal=true (su registro puede vivir en otra plaza).
--
-- De paso: Mercedes pregunto su opinion sobre calcular el costo
-- automaticamente al agregar algo con receta al catalogo -- se
-- implemento: insumos_de() ahora devuelve el costo_promedio actual (por
-- sucursal) de cada insumo, y en /catalogo, "Otra cosa" ahora pide el
-- costo por unidad de cada ingrediente (prellenado si ya existe) y
-- calcula solo el costo total del producto (cantidad x costo de cada
-- ingrediente), reemplazando la necesidad de escribirlo a mano cuando
-- hay receta.

create or replace function public.alta_empleado(p_empleado uuid, p_sucursal uuid, p_codigo_jefe text, p_nombre text, p_rol text, p_codigo text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_rol text; v_id uuid; v_activo boolean;
begin
  select activo into v_activo from empleados where id = p_empleado;
  if v_activo is not true then raise exception 'Ese empleado no está activo'; end if;

  select e.rol into v_rol from empleados e
  where e.activo and e.sucursal_id = p_sucursal
    and e.codigo_hash = extensions.crypt(p_codigo_jefe, e.codigo_hash);

  if v_rol is null then
    select e.rol into v_rol from empleados e
    where e.activo and e.rol = 'dueno' and e.puede_cambiar_sucursal
      and e.codigo_hash = extensions.crypt(p_codigo_jefe, e.codigo_hash);
  end if;

  if v_rol is null then raise exception 'Ese código no es de nadie'; end if;
  if v_rol <> 'dueno' then raise exception 'Solo el dueño puede dar de alta gente'; end if;

  if coalesce(trim(p_nombre),'') = '' then raise exception 'Falta el nombre'; end if;
  if p_codigo !~ '^\d{4}$' then raise exception 'El código son 4 números'; end if;
  if p_rol not in ('dueno','gerente','mesero') then raise exception 'Ese puesto no existe'; end if;
  if not codigo_libre(p_sucursal, p_codigo, null) then
    raise exception 'Ese código ya lo tiene alguien más. Escoge otro';
  end if;

  insert into empleados (sucursal_id, nombre, rol, codigo_hash, puede_cambiar_sucursal)
  values (p_sucursal, trim(p_nombre), p_rol,
          extensions.crypt(p_codigo, extensions.gen_salt('bf')),
          p_rol = 'dueno')
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.cambiar_codigo(p_empleado uuid, p_sucursal uuid, p_codigo_jefe text, p_objetivo uuid, p_nuevo text)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_rol text; v_activo boolean;
begin
  select activo into v_activo from empleados where id = p_empleado;
  if v_activo is not true then raise exception 'Ese empleado no está activo'; end if;

  select e.rol into v_rol from empleados e
  where e.activo and e.sucursal_id = p_sucursal
    and e.codigo_hash = extensions.crypt(p_codigo_jefe, e.codigo_hash);

  if v_rol is null then
    select e.rol into v_rol from empleados e
    where e.activo and e.rol = 'dueno' and e.puede_cambiar_sucursal
      and e.codigo_hash = extensions.crypt(p_codigo_jefe, e.codigo_hash);
  end if;

  if v_rol is null then raise exception 'Ese código no es de nadie'; end if;
  if v_rol <> 'dueno' then raise exception 'Solo el dueño puede cambiar códigos'; end if;

  if p_nuevo !~ '^\d{4}$' then raise exception 'El código son 4 números'; end if;
  if not codigo_libre(p_sucursal, p_nuevo, p_objetivo) then
    raise exception 'Ese código ya lo tiene alguien más. Escoge otro';
  end if;

  update empleados
     set codigo_hash = extensions.crypt(p_nuevo, extensions.gen_salt('bf'))
   where id = p_objetivo and sucursal_id = p_sucursal;
  if not found then raise exception 'Esa persona no es de tu sucursal'; end if;
end;
$function$;

create or replace function public.baja_empleado(p_empleado uuid, p_sucursal uuid, p_codigo_jefe text, p_objetivo uuid, p_activo boolean)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_rol text; v_abiertas int; v_activo_sesion boolean;
begin
  select activo into v_activo_sesion from empleados where id = p_empleado;
  if v_activo_sesion is not true then raise exception 'Ese empleado no está activo'; end if;

  select e.rol into v_rol from empleados e
  where e.activo and e.sucursal_id = p_sucursal
    and e.codigo_hash = extensions.crypt(p_codigo_jefe, e.codigo_hash);

  if v_rol is null then
    select e.rol into v_rol from empleados e
    where e.activo and e.rol = 'dueno' and e.puede_cambiar_sucursal
      and e.codigo_hash = extensions.crypt(p_codigo_jefe, e.codigo_hash);
  end if;

  if v_rol is null then raise exception 'Ese código no es de nadie'; end if;
  if v_rol <> 'dueno' then raise exception 'Solo el dueño puede dar de baja'; end if;

  if not p_activo then
    select count(*) into v_abiertas from tickets
     where abierto_por = p_objetivo and estado <> 'cerrado';
    if v_abiertas > 0 then
      raise exception 'Tiene % cuentas sin cobrar. Ciérralas antes de darle de baja', v_abiertas;
    end if;
    if p_objetivo = p_empleado then
      raise exception 'No te puedes dar de baja a ti mismo';
    end if;
  end if;

  update empleados set activo = p_activo
   where id = p_objetivo and sucursal_id = p_sucursal;
  if not found then raise exception 'Esa persona no es de tu sucursal'; end if;
end;
$function$;

revoke execute on function public.alta_empleado(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.alta_empleado(uuid, uuid, text, text, text, text) to service_role, postgres;
revoke execute on function public.cambiar_codigo(uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.cambiar_codigo(uuid, uuid, text, uuid, text) to service_role, postgres;
revoke execute on function public.baja_empleado(uuid, uuid, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.baja_empleado(uuid, uuid, text, uuid, boolean) to service_role, postgres;

-- ── Costo automático de un producto con receta ──────────────────────────
create or replace function public.insumos_de(p_sucursal uuid)
returns table(id uuid, nombre text, categoria text, unidad_base text, costo_promedio numeric)
language sql
security definer
set search_path to 'public'
as $function$
  select p.id, p.nombre, c.nombre as categoria, p.unidad_base,
         coalesce(e.costo_promedio, 0)
  from productos p
  join categorias c on c.id = p.categoria_id
  left join existencias e on e.producto_id = p.id and e.sucursal_id = p_sucursal
  order by c.nombre, p.nombre;
$function$;

revoke execute on function public.insumos_de(uuid) from public, anon, authenticated;
grant execute on function public.insumos_de(uuid) to service_role, postgres;
