-- El navegador ya no habla con la base de datos. Todo pasa por el servidor
-- de la app, que sí sabe quién entró con su código y qué puede hacer.
-- A partir de aquí, la llave que es pública por diseño no sirve para nada.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from anon, authenticated', f.firma);
  end loop;
end $$;

-- Que las funciones nuevas nazcan cerradas, sin tener que acordarse.
alter default privileges in schema public
  revoke execute on functions from anon, authenticated;;
