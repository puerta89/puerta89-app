-- mover_cuenta y partir_cuenta viven en la base desde hace rato pero
-- NUNCA tuvieron archivo de migración (se crearon directo, en una sesión
-- anterior) — si alguien reconstruye la base desde cero con las
-- migraciones del repo, estas dos funciones simplemente no existirían.
-- Se respaldan aquí tal como viven hoy en producción (sin cambiar su
-- lógica), y de paso se corrige un hueco de seguridad real que traían:
-- estaban otorgadas a `anon`/`authenticated` — cualquiera con la llave
-- pública (que es pública por diseño) podía llamarlas directo pasando
-- cualquier empleado_id, sin pasar por la sesión de la app. Se revocan y
-- se dejan solo para service_role/postgres, como toda función desde que
-- se adoptó ese patrón. [[patron-seguridad-rpc-supabase]]

create or replace function public.mover_cuenta(p_empleado uuid, p_ticket uuid, p_bancos uuid[])
returns void
language plpgsql security definer set search_path = public as $$
declare v_suc uuid; v_estado text;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese mesero no está activo'; end if;

  select estado into v_estado from tickets
   where id = p_ticket and sucursal_id = v_suc;
  if v_estado is null then raise exception 'Esa cuenta no es de tu sucursal'; end if;
  if v_estado = 'cerrado' then raise exception 'Esa cuenta ya se cobró'; end if;

  if p_bancos is null or array_length(p_bancos, 1) is null then
    raise exception 'Hay que elegir al menos un banco';
  end if;

  if exists (
    select 1 from unnest(p_bancos) as x(id)
    left join bancos b on b.id = x.id and b.activo
    where b.id is null or b.sucursal_id <> v_suc
  ) then
    raise exception 'Alguno de esos bancos no es de tu sucursal';
  end if;

  -- los bancos nuevos tienen que estar libres, salvo los que ya son de
  -- esta misma cuenta
  if exists (
    select 1 from ticket_bancos tb
    join tickets t on t.id = tb.ticket_id
    where tb.banco_id = any(p_bancos) and tb.hasta is null
      and t.estado in ('abierto','por_cobrar')
      and t.id <> p_ticket
  ) then
    raise exception 'Alguno de esos bancos ya tiene cuenta abierta';
  end if;

  update ticket_bancos set hasta = now()
   where ticket_id = p_ticket and hasta is null
     and banco_id <> all(p_bancos);

  insert into ticket_bancos (ticket_id, banco_id)
  select p_ticket, x.id from unnest(p_bancos) as x(id)
  where not exists (
    select 1 from ticket_bancos tb
    where tb.ticket_id = p_ticket and tb.banco_id = x.id and tb.hasta is null
  );
end;
$$;

revoke execute on function public.mover_cuenta(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.mover_cuenta(uuid, uuid, uuid[]) to service_role, postgres;

create or replace function public.partir_cuenta(p_empleado uuid, p_ticket uuid, p_lineas uuid[])
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_suc uuid; v_estado text; v_abierto timestamptz; v_personas int;
  v_nuevo uuid; v_cuantas int; v_total int;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese mesero no está activo'; end if;

  select estado, abierto_en, personas into v_estado, v_abierto, v_personas
  from tickets where id = p_ticket and sucursal_id = v_suc;
  if v_estado is null then raise exception 'Esa cuenta no es de tu sucursal'; end if;
  if v_estado = 'cerrado' then raise exception 'Esa cuenta ya se cobró'; end if;

  if p_lineas is null or array_length(p_lineas, 1) is null then
    raise exception 'Hay que elegir qué se pasa a la otra cuenta';
  end if;

  select count(*) into v_cuantas from ticket_lineas
   where id = any(p_lineas) and ticket_id = p_ticket and estado = 'activa';
  if v_cuantas <> array_length(p_lineas, 1) then
    raise exception 'Alguno de esos renglones ya no está en esta cuenta';
  end if;

  select count(*) into v_total from ticket_lineas
   where ticket_id = p_ticket and estado = 'activa';
  if v_cuantas >= v_total then
    raise exception 'No puedes pasar todo: entonces no se está partiendo nada';
  end if;

  if exists (select 1 from pagos where ticket_id = p_ticket) then
    raise exception 'Esa cuenta ya tiene pagos. Quítalos antes de partirla';
  end if;

  -- la cuenta nueva conserva la hora de llegada, para que la permanencia
  -- siga siendo la de verdad
  insert into tickets (sucursal_id, personas, abierto_por, abierto_en, estado)
  values (v_suc, 1, p_empleado, v_abierto, v_estado)
  returning id into v_nuevo;

  -- se sienta en los mismos bancos
  insert into ticket_bancos (ticket_id, banco_id)
  select v_nuevo, tb.banco_id from ticket_bancos tb
  where tb.ticket_id = p_ticket and tb.hasta is null;

  update ticket_lineas set ticket_id = v_nuevo where id = any(p_lineas);

  if v_personas > 1 then
    update tickets set personas = v_personas - 1 where id = p_ticket;
  end if;

  -- se recalculan las dos
  update tickets t
     set subtotal = sub.total, total = sub.total - t.descuento
    from (select ticket_id, coalesce(sum(cantidad * precio_unitario), 0) as total
            from ticket_lineas where ticket_id in (p_ticket, v_nuevo) and estado = 'activa'
           group by ticket_id) sub
   where t.id = sub.ticket_id;

  return v_nuevo;
end;
$$;

revoke execute on function public.partir_cuenta(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.partir_cuenta(uuid, uuid, uuid[]) to service_role, postgres;
