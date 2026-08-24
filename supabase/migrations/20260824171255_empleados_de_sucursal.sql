create or replace function public.empleados_de(p_sucursal uuid)
returns table (empleado_id uuid, nombre text, rol text)
language sql security definer set search_path = public as $$
  select id, nombre, rol from empleados
  where sucursal_id = p_sucursal and activo
  order by rol <> 'mesero', nombre;
$$;
grant execute on function public.empleados_de(uuid) to anon, authenticated;;
