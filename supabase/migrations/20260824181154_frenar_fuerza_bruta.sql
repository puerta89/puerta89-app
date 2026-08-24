-- Antes, cualquiera con la dirección podía ir probando códigos de 4 números
-- hasta atinarle. Ahora, después de varios fallos seguidos, se cierra la
-- puerta un rato. Un mesero que se equivoca dos veces no lo va a notar;
-- alguien probando diez mil combinaciones se topa con pared.
create or replace function public.verificar_codigo(p_codigo text)
returns table (
  empleado_id uuid,
  empleado_nombre text,
  rol text,
  puede_cambiar_sucursal boolean,
  sucursal_id uuid,
  sucursal_nombre text,
  sucursal_color text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rec record;
  v_fallos int;
begin
  select count(*) into v_fallos
  from intentos_login
  where not exitoso and creado_en > now() - interval '10 minutes';

  if v_fallos >= 8 then
    insert into intentos_login (exitoso, empleado_id) values (false, null);
    raise exception 'Demasiados intentos fallidos. Espera unos minutos.'
      using errcode = 'P0001';
  end if;

  select e.id, e.nombre, e.rol, e.puede_cambiar_sucursal,
         s.id as suc_id, s.nombre as suc_nombre, s.color as suc_color
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

  -- una entrada buena limpia el contador, para no castigar al equipo
  delete from intentos_login
   where not exitoso and creado_en > now() - interval '10 minutes';

  empleado_id := v_rec.id;
  empleado_nombre := v_rec.nombre;
  rol := v_rec.rol;
  puede_cambiar_sucursal := v_rec.puede_cambiar_sucursal;
  sucursal_id := v_rec.suc_id;
  sucursal_nombre := v_rec.suc_nombre;
  sucursal_color := v_rec.suc_color;
  return next;
end;
$$;
grant execute on function public.verificar_codigo(text) to anon, authenticated;;
