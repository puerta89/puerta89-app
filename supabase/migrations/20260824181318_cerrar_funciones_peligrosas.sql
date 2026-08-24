-- Supabase le da permiso de ejecución a "anon" sobre todo lo del esquema
-- public por omisión. Un "revoke from public" no lo quita, porque el
-- permiso de anon es aparte. Hay que quitárselo a anon explícitamente.

-- Con esta cualquiera podía darse de alta como dueño. Nunca se llama
-- desde el navegador: solo desde el servidor o desde el panel de Supabase.
revoke all on function public.crear_empleado(text, text, text, text)
  from anon, authenticated;

-- Ayudante interno del inventario. Las funciones que la usan corren con
-- permisos de su dueño, así que siguen funcionando igual.
revoke all on function public.mover_inventario(uuid, uuid, uuid, text, numeric, uuid, uuid, text)
  from anon, authenticated;;
