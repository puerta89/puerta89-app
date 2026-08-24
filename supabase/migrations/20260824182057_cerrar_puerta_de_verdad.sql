-- El permiso venía de PUBLIC (todo el mundo), no de anon. Se quita de ahí
-- y se le da acceso explícito solo a los roles del servidor.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.firma);
    execute format('grant execute on function %s to service_role, postgres', f.firma);
  end loop;
end $$;

alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public
  grant execute on functions to service_role, postgres;;
