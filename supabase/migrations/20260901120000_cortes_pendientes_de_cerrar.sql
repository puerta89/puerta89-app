-- Mercedes, tras probar con el equipo: "que a fuerza se cierre manual la
-- caja" y, al preguntar qué pasaba, "cuando llegas el siguiente día ya
-- sale cerrada solita". Lo que en verdad pasaba: /corte solo mostraba el
-- día de HOY (hoyEnMexico()), así que si un corte se quedaba abierto sin
-- cerrarlo, al día siguiente ya no había manera de volver a alcanzarlo
-- desde la pantalla — como si se hubiera cerrado solo, aunque en la base
-- siguiera "abierto" para siempre. Esta función deja ver, desde el corte
-- de hoy, qué días anteriores se quedaron sin cerrar, para poder entrar a
-- cada uno (con /corte?fecha=) y sí cerrarlo a mano.
create or replace function public.cortes_abiertos_antes(p_sucursal uuid, p_fecha date)
returns table(fecha date)
language sql security definer set search_path = public as $$
  select c.fecha
  from cortes c
  where c.sucursal_id = p_sucursal
    and c.estado = 'abierto'
    and c.fecha < p_fecha
  order by c.fecha;
$$;

revoke execute on function public.cortes_abiertos_antes(uuid, date) from public, anon, authenticated;
grant execute on function public.cortes_abiertos_antes(uuid, date) to service_role, postgres;
