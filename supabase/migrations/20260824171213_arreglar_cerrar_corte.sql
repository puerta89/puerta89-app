create or replace function public.cerrar_corte(
  p_empleado uuid,
  p_codigo text,
  p_corte uuid,
  p_efectivo_contado numeric,
  p_propina_efectivo numeric,
  p_propina_tarjeta numeric,
  p_meseros uuid[]
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_suc uuid; v_fecha date; v_autoriza uuid; v_rol text;
  r record; v_total_propina numeric;
  v_n int; v_cada numeric; v_primero uuid;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;

  select e.id, e.rol into v_autoriza, v_rol
  from empleados e
  where e.activo and e.sucursal_id = v_suc
    and e.codigo_hash = extensions.crypt(p_codigo, e.codigo_hash);
  if v_autoriza is null then raise exception 'Ese código no es de nadie'; end if;
  if v_rol not in ('dueno','gerente') then
    raise exception 'Solo el dueño puede cerrar la caja';
  end if;

  if p_efectivo_contado is null or p_efectivo_contado < 0 then
    raise exception 'Falta capturar el efectivo contado';
  end if;
  if p_meseros is null or array_length(p_meseros, 1) is null then
    raise exception 'Hay que decir quiénes estuvieron en el turno';
  end if;

  select c.fecha into v_fecha
  from cortes c where c.id = p_corte and c.sucursal_id = v_suc and c.estado = 'abierto';
  if v_fecha is null then raise exception 'Esa caja ya está cerrada'; end if;

  -- se lee primero lo que el sistema calculó, y luego se congela en el corte
  select * into r from resumen_del_dia(v_suc, v_fecha);

  update cortes
     set ventas_efectivo   = r.ventas_efectivo,
         ventas_tarjeta    = r.ventas_tarjeta,
         entradas_efectivo = r.entradas,
         salidas_efectivo  = r.salidas,
         efectivo_esperado = r.efectivo_esperado,
         efectivo_contado  = p_efectivo_contado,
         propina_efectivo  = greatest(coalesce(p_propina_efectivo, 0), 0),
         propina_tarjeta   = greatest(coalesce(p_propina_tarjeta, 0), 0),
         meseros_en_turno  = array_length(p_meseros, 1),
         estado            = 'cerrado',
         cerrado_por       = v_autoriza,
         cerrado_en        = now()
   where id = p_corte;

  select propina_total into v_total_propina from cortes where id = p_corte;

  -- reparto parejo; los centavos que sobran se le cargan al primero
  v_n := array_length(p_meseros, 1);
  v_cada := trunc(v_total_propina / v_n, 2);
  v_primero := p_meseros[1];

  delete from corte_propinas where corte_id = p_corte;
  insert into corte_propinas (corte_id, empleado_id, monto)
  select p_corte, x.id,
         v_cada + case when x.id = v_primero
                       then v_total_propina - (v_cada * v_n) else 0 end
  from unnest(p_meseros) as x(id);
end;
$$;
grant execute on function public.cerrar_corte(uuid, text, uuid, numeric, numeric, numeric, uuid[]) to anon, authenticated;;
