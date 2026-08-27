-- Mercedes: "quiero que me modifiques que el dueño pueda mover TODO LO QUE
-- QUIERA... no se calcularon los gastos de redes, si el quiere moverlo,
-- agregarlo de algo anterior que el pueda modificarlo. que si quiere
-- borrar algun ticket que solo aparezca estas seguro y ya no tener que
-- poner una explicacion, es el dueño"
--
-- 1) Gastos: hasta ahora solo se podían anotar (crear), nunca editar ni
--    borrar. Se agregan editar_gasto y eliminar_gasto (dueño/gerente).
--
-- 2) Cancelar una mesa vacía (cancelar_cuenta, de la migración anterior):
--    ya no exige escribir un motivo — se vuelve opcional, y si no se
--    escribe nada queda anotado "Cancelada por el dueño/gerente" para no
--    perder el rastro de quién y cuándo, sin obligar a justificarse.

create or replace function public.editar_gasto(
  p_empleado uuid,
  p_gasto uuid,
  p_categoria text,
  p_concepto text,
  p_monto numeric,
  p_fecha date,
  p_recurrente boolean
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_suc uuid; v_rol text;
begin
  select sucursal_id, rol into v_suc, v_rol from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño puede editar gastos'; end if;
  if not (p_monto > 0) then raise exception 'El monto tiene que ser mayor a cero'; end if;
  if coalesce(trim(p_concepto),'') = '' then raise exception 'Falta el concepto'; end if;

  update gastos
     set categoria = coalesce(nullif(trim(p_categoria),''), 'Otros'),
         concepto = trim(p_concepto),
         monto = p_monto,
         fecha = coalesce(p_fecha, fecha),
         recurrente = coalesce(p_recurrente, false)
   where id = p_gasto and sucursal_id = v_suc;
  if not found then raise exception 'Ese gasto no existe'; end if;
end;
$function$;

create or replace function public.eliminar_gasto(p_empleado uuid, p_gasto uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_suc uuid; v_rol text;
begin
  select sucursal_id, rol into v_suc, v_rol from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño puede eliminar gastos'; end if;

  delete from gastos where id = p_gasto and sucursal_id = v_suc;
  if not found then raise exception 'Ese gasto no existe'; end if;
end;
$function$;

create or replace function public.cancelar_cuenta(p_empleado uuid, p_ticket uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_suc uuid; v_rol text; v_suc_ticket uuid; v_estado text; v_activas int; v_pagado numeric;
begin
  select sucursal_id, rol into v_suc, v_rol from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño o el gerente pueden cancelar una mesa'; end if;

  select sucursal_id, estado into v_suc_ticket, v_estado
  from tickets where id = p_ticket;
  if v_suc_ticket is null then raise exception 'Esa cuenta no existe'; end if;
  if v_suc_ticket <> v_suc then raise exception 'Esa cuenta no es de tu sucursal'; end if;
  if v_estado not in ('abierto', 'por_cobrar') then
    raise exception 'Esa cuenta ya está cerrada o cancelada';
  end if;

  select count(*) into v_activas from ticket_lineas
   where ticket_id = p_ticket and estado = 'activa';
  if v_activas > 0 then
    raise exception 'Esta cuenta todavía tiene consumo — cancela cada renglón primero, o ciérrala normal desde Cobrar';
  end if;

  select coalesce(sum(monto), 0) into v_pagado from pagos where ticket_id = p_ticket;
  if v_pagado > 0 then
    raise exception 'Esta cuenta ya tiene pagos registrados — no se puede cancelar así';
  end if;

  update tickets
     set estado = 'cancelado',
         cancelado_por = p_empleado,
         cancelado_en = now(),
         cancelado_motivo = coalesce(nullif(trim(p_motivo), ''), 'Cancelada por el dueño/gerente')
   where id = p_ticket;

  update ticket_bancos set hasta = now()
   where ticket_id = p_ticket and hasta is null;
end;
$function$;

revoke execute on function public.editar_gasto(uuid, uuid, text, text, numeric, date, boolean) from public, anon, authenticated;
grant execute on function public.editar_gasto(uuid, uuid, text, text, numeric, date, boolean) to service_role, postgres;

revoke execute on function public.eliminar_gasto(uuid, uuid) from public, anon, authenticated;
grant execute on function public.eliminar_gasto(uuid, uuid) to service_role, postgres;

revoke execute on function public.cancelar_cuenta(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cancelar_cuenta(uuid, uuid, text) to service_role, postgres;
