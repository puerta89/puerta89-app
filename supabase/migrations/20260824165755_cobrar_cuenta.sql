-- El mesero avisa que ya pidieron la cuenta: el banco se pinta de ámbar.
create or replace function public.pedir_cuenta(p_empleado uuid, p_ticket uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_suc uuid;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese mesero no está activo'; end if;

  update tickets set estado = 'por_cobrar'
   where id = p_ticket and sucursal_id = v_suc and estado = 'abierto';
  if not found then raise exception 'Esa cuenta ya no está abierta'; end if;
end;
$$;
grant execute on function public.pedir_cuenta(uuid, uuid) to anon, authenticated;

-- Registra un pago. Una cuenta puede tener varios: el 17% de los tickets
-- del año pasado se pagó en partes.
create or replace function public.agregar_pago(
  p_empleado uuid, p_ticket uuid, p_metodo text, p_monto numeric, p_terminal text default null
) returns numeric
language plpgsql security definer set search_path = public as $$
declare v_suc uuid; v_total numeric; v_pagado numeric;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese mesero no está activo'; end if;
  if p_monto <= 0 then raise exception 'El monto tiene que ser mayor a cero'; end if;

  select t.total into v_total from tickets t
   where t.id = p_ticket and t.sucursal_id = v_suc and t.estado <> 'cerrado';
  if v_total is null then raise exception 'Esa cuenta no está por cobrarse'; end if;

  insert into pagos (ticket_id, metodo, monto, terminal, cobrado_por)
  values (p_ticket, p_metodo, p_monto, p_terminal, p_empleado);

  select coalesce(sum(monto), 0) into v_pagado from pagos where ticket_id = p_ticket;
  return v_total - v_pagado;
end;
$$;
grant execute on function public.agregar_pago(uuid, uuid, text, numeric, text) to anon, authenticated;

create or replace function public.quitar_pago(p_empleado uuid, p_pago uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_suc uuid;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  delete from pagos p using tickets t
   where p.id = p_pago and t.id = p.ticket_id
     and t.sucursal_id = v_suc and t.estado <> 'cerrado';
  if not found then raise exception 'Ese pago ya no se puede quitar'; end if;
end;
$$;
grant execute on function public.quitar_pago(uuid, uuid) to anon, authenticated;

-- Cierra la cuenta. Solo si ya está pagada completa.
create or replace function public.cerrar_cuenta(
  p_empleado uuid, p_ticket uuid, p_propina numeric default 0
) returns void
language plpgsql security definer set search_path = public as $$
declare v_suc uuid; v_total numeric; v_pagado numeric;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese mesero no está activo'; end if;

  select t.total into v_total from tickets t
   where t.id = p_ticket and t.sucursal_id = v_suc and t.estado <> 'cerrado';
  if v_total is null then raise exception 'Esa cuenta ya está cerrada'; end if;

  select coalesce(sum(monto), 0) into v_pagado from pagos where ticket_id = p_ticket;

  if v_pagado + 0.001 < v_total then
    raise exception 'Todavía faltan $%', to_char(v_total - v_pagado, 'FM999999.00');
  end if;

  update tickets
     set estado = 'cerrado', cerrado_por = p_empleado, cerrado_en = now(),
         propina = greatest(coalesce(p_propina, 0), 0)
   where id = p_ticket;

  -- los bancos quedan libres
  update ticket_bancos set hasta = now()
   where ticket_id = p_ticket and hasta is null;
end;
$$;
grant execute on function public.cerrar_cuenta(uuid, uuid, numeric) to anon, authenticated;

-- Lo que ya se pagó de una cuenta.
create or replace function public.pagos_de(p_ticket uuid)
returns table (pago_id uuid, metodo text, monto numeric, cobrado_en timestamptz)
language sql security definer set search_path = public as $$
  select id, metodo, monto, cobrado_en from pagos
  where ticket_id = p_ticket order by cobrado_en;
$$;
grant execute on function public.pagos_de(uuid) to anon, authenticated;;
