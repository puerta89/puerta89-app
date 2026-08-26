-- Mercedes: "no me deja eliminar tickets desde el panel de iram" — al
-- preguntar, era sobre una mesa que se abre por error (o donde ya se
-- cancelaron todos los renglones) y se queda pegada, ocupando un banco
-- para siempre: la pantalla de la cuenta solo mostraba "Cobrar" cuando
-- había al menos un renglón activo, así que una mesa vacía no tenía
-- ningún botón para soltarla.
--
-- Se agrega una forma explícita de cancelar la CUENTA completa (no un
-- renglón) cuando no tiene ningún consumo activo — deja libre el banco
-- sin que cuente como una venta cerrada (por eso es un estado aparte,
-- 'cancelado', que ya existía en el catálogo de estados pero ninguna
-- función lo producía todavía).

alter table public.tickets
  add column if not exists cancelado_por uuid references public.empleados(id),
  add column if not exists cancelado_en timestamptz,
  add column if not exists cancelado_motivo text;

create or replace function public.cancelar_cuenta(p_empleado uuid, p_ticket uuid, p_motivo text)
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
  if p_motivo is null or trim(p_motivo) = '' then raise exception 'Falta decir por qué se cancela'; end if;

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
         cancelado_motivo = trim(p_motivo)
   where id = p_ticket;

  -- el banco queda libre, igual que al cerrar una cuenta normal
  update ticket_bancos set hasta = now()
   where ticket_id = p_ticket and hasta is null;
end;
$function$;

revoke execute on function public.cancelar_cuenta(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cancelar_cuenta(uuid, uuid, text) to service_role, postgres;
