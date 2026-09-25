-- Cobrar y cerrar en UN solo paso.
--
-- Antes, cobrar eran dos llamadas separadas desde la pantalla (agregar_pago
-- y luego cerrar_cuenta). Si la segunda se cortaba (internet flojo, el
-- teléfono se dormía), el pago quedaba guardado pero la cuenta seguía
-- abierta, y la pantalla se quedaba bloqueada. Esta función hace las dos
-- cosas en una sola transacción: o se guarda el pago Y (si ya se cubrió el
-- total) se cierra la cuenta, o no pasa nada.
--
-- También bloquea la fila del ticket mientras trabaja, para que dos toques
-- casi simultáneos (doble clic, red lenta) no registren dos veces el mismo
-- pago, y no deja cobrar cuentas canceladas (agregar_pago sí dejaba).
create or replace function public.cobrar_y_cerrar(
  p_empleado uuid,
  p_ticket   uuid,
  p_metodo   text,
  p_monto    numeric,
  p_propina  numeric default 0
) returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_suc uuid; v_total numeric; v_estado text; v_pagado numeric;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese mesero no está activo'; end if;
  if p_monto <= 0 then raise exception 'El monto tiene que ser mayor a cero'; end if;

  select t.total, t.estado into v_total, v_estado
    from tickets t
   where t.id = p_ticket and t.sucursal_id = v_suc
   for update;
  if v_total is null then raise exception 'Esa cuenta no existe'; end if;
  if v_estado = 'cerrado' then raise exception 'Esa cuenta ya está cerrada'; end if;
  if v_estado <> 'abierto' and v_estado <> 'por_cobrar' then
    raise exception 'Esa cuenta no está por cobrarse';
  end if;

  insert into pagos (ticket_id, metodo, monto, cobrado_por)
  values (p_ticket, p_metodo, p_monto, p_empleado);

  select coalesce(sum(monto), 0) into v_pagado from pagos where ticket_id = p_ticket;

  if v_pagado + 0.001 < v_total then
    return false;  -- todavía falta; el pago quedó guardado
  end if;

  update tickets
     set estado = 'cerrado', cerrado_por = p_empleado, cerrado_en = now(),
         propina = greatest(coalesce(p_propina, 0), 0)
   where id = p_ticket;

  update ticket_bancos set hasta = now()
   where ticket_id = p_ticket and hasta is null;

  return true;
end;
$$;

revoke execute on function public.cobrar_y_cerrar(uuid, uuid, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.cobrar_y_cerrar(uuid, uuid, text, numeric, numeric) to service_role, postgres;
