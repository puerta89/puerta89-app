-- Registro de intentos de entrada. Sirve para el rastro de auditoría
-- y para poder bloquear por intentos fallidos más adelante.
create table intentos_login (
  id uuid primary key default gen_random_uuid(),
  exitoso boolean not null,
  empleado_id uuid references empleados(id) on delete set null,
  creado_en timestamptz not null default now()
);
alter table intentos_login enable row level security;
create index intentos_login_fecha_idx on intentos_login (creado_en desc);

-- Verifica el código sin que nadie pueda leer la tabla de empleados.
-- La huella cifrada nunca sale de la base de datos.
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
begin
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

revoke all on function public.verificar_codigo(text) from public;
grant execute on function public.verificar_codigo(text) to anon, authenticated;

-- Da de alta un empleado cifrando su código. Solo desde el servidor.
create or replace function public.crear_empleado(
  p_nombre text, p_rol text, p_sucursal text, p_codigo text
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_id uuid;
begin
  insert into empleados (sucursal_id, nombre, rol, codigo_hash, puede_cambiar_sucursal)
  select s.id, p_nombre, p_rol,
         extensions.crypt(p_codigo, extensions.gen_salt('bf')),
         p_rol = 'dueno'
  from sucursales s where s.nombre = p_sucursal
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.crear_empleado(text,text,text,text) from public;;
