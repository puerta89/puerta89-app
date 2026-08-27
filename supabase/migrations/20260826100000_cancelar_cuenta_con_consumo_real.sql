-- Mercedes, sobre si el dueño puede borrar un ticket que YA tiene consumo
-- real y/o ya se cobró: "Todo se revierte — el inventario que se
-- descontó de esa venta regresa a existencias, y el pago registrado se
-- borra también. Es como si la venta nunca hubiera pasado."
--
-- Se extrae la reversión de inventario de un renglón (que ya vivía
-- inline dentro de cancelar_linea) a una función compartida
-- revertir_linea_inventario, para poder reusarla renglón por renglón
-- desde cancelar_cuenta sin duplicar esa lógica.
--
-- cancelar_cuenta ahora puede actuar sobre CUALQUIER ticket (abierto, por
-- cobrar, o ya cerrado/cobrado) mientras no esté ya cancelado: revierte
-- el inventario de cada renglón activo, cancela esos renglones (queda el
-- rastro en "cancelaciones", igual que al cancelar uno por uno), borra
-- los pagos registrados, y marca la cuenta como 'cancelado' — como si
-- nunca hubiera pasado. Sigue siendo solo para dueño/gerente, y el motivo
-- sigue siendo opcional (ver migración anterior).

create or replace function public.revertir_linea_inventario(p_linea uuid, p_autoriza uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_suc uuid; v_cant numeric; v_pres uuid; v_prod uuid; v_derivado text; v_factor numeric; v_botella uuid;
  v_ing record;
begin
  select tl.cantidad, tl.presentacion_id, tl.botella_abierta_id, t.sucursal_id
    into v_cant, v_pres, v_botella, v_suc
  from ticket_lineas tl join tickets t on t.id = tl.ticket_id
  where tl.id = p_linea;

  select pe.producto_id, pe.consumo_derivado, pe.factor_consumo
    into v_prod, v_derivado, v_factor
  from presentaciones pe where pe.id = v_pres;

  if v_derivado = 'copa' and v_botella is not null then
    update botellas_abiertas
       set copas_restantes = least(copas_totales, copas_restantes + v_cant * v_factor),
           cerrada_en = null, motivo_cierre = null
     where id = v_botella;

  elsif exists (select 1 from linea_sabores where linea_id = p_linea) then
    perform mover_inventario(v_suc, ls.producto_id, null, 'ajuste', ls.litros,
                             p_linea, p_autoriza, 'Se canceló un renglón')
    from linea_sabores ls where ls.linea_id = p_linea;

  elsif v_derivado is null and exists (
    select 1 from receta_ingredientes where producto_id = v_prod
  ) then
    null;

  else
    if (select inventario_por_presentacion from productos where id = v_prod) then
      perform mover_inventario(v_suc, null, v_pres, 'ajuste', v_cant * v_factor,
                               p_linea, p_autoriza, 'Se canceló un renglón');
    else
      perform mover_inventario(v_suc, v_prod, null, 'ajuste', v_cant * v_factor,
                               p_linea, p_autoriza, 'Se canceló un renglón');
    end if;
  end if;

  for v_ing in select insumo_id, cantidad from receta_ingredientes where producto_id = v_prod
  loop
    perform mover_inventario(v_suc, v_ing.insumo_id, null, 'ajuste', v_cant * v_ing.cantidad,
                             p_linea, p_autoriza, 'Se canceló un renglón');
  end loop;
end;
$function$;

create or replace function public.cancelar_linea(p_solicitante uuid, p_linea uuid, p_motivo text, p_codigo text DEFAULT NULL::text)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_suc uuid; v_rol_solicitante text; v_autoriza uuid; v_rol_autoriza text;
  v_ticket uuid; v_estado text; v_cant numeric;
begin
  select sucursal_id, rol into v_suc, v_rol_solicitante
  from empleados where id = p_solicitante and activo;
  if v_suc is null then raise exception 'Ese mesero no está activo'; end if;

  if v_rol_solicitante in ('dueno', 'gerente') then
    v_autoriza := p_solicitante;
  else
    select e.id, e.rol into v_autoriza, v_rol_autoriza
    from empleados e
    where e.activo and e.sucursal_id = v_suc
      and e.codigo_hash = extensions.crypt(coalesce(p_codigo, ''), e.codigo_hash);
    if v_autoriza is null then
      raise exception 'Ese código no es de nadie';
    end if;
    if v_rol_autoriza not in ('dueno', 'gerente') then
      raise exception 'Ese código no puede autorizar cancelaciones';
    end if;
  end if;

  select tl.ticket_id, tl.cantidad, t.estado
    into v_ticket, v_cant, v_estado
  from ticket_lineas tl
  join tickets t on t.id = tl.ticket_id
  where tl.id = p_linea and tl.estado = 'activa';

  if v_ticket is null then raise exception 'Ese renglón ya no está activo'; end if;
  if v_estado = 'cerrado' then
    raise exception 'Esa cuenta ya se cobró. Se necesita una devolución, no una cancelación';
  end if;

  update ticket_lineas set estado = 'cancelada' where id = p_linea;

  insert into cancelaciones (ticket_id, linea_id, cantidad, motivo,
                             solicitado_por, autorizado_por)
  values (v_ticket, p_linea, v_cant, p_motivo, p_solicitante, v_autoriza);

  perform revertir_linea_inventario(p_linea, v_autoriza);

  update tickets t
     set subtotal = sub.total, total = sub.total - t.descuento
    from (select coalesce(sum(cantidad * precio_unitario), 0) as total
            from ticket_lineas where ticket_id = v_ticket and estado = 'activa') sub
   where t.id = v_ticket;
end;
$function$;

create or replace function public.cancelar_cuenta(p_empleado uuid, p_ticket uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_suc uuid; v_rol text; v_suc_ticket uuid; v_estado text; v_linea record;
begin
  select sucursal_id, rol into v_suc, v_rol from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño o el gerente pueden cancelar una cuenta'; end if;

  select sucursal_id, estado into v_suc_ticket, v_estado
  from tickets where id = p_ticket;
  if v_suc_ticket is null then raise exception 'Esa cuenta no existe'; end if;
  if v_suc_ticket <> v_suc then raise exception 'Esa cuenta no es de tu sucursal'; end if;
  if v_estado = 'cancelado' then raise exception 'Esa cuenta ya está cancelada'; end if;

  -- revierte el inventario de cada renglón todavía activo y lo cancela
  -- (queda el mismo rastro que si se hubieran cancelado uno por uno)
  for v_linea in select id, cantidad from ticket_lineas
                  where ticket_id = p_ticket and estado = 'activa'
  loop
    update ticket_lineas set estado = 'cancelada' where id = v_linea.id;
    insert into cancelaciones (ticket_id, linea_id, cantidad, motivo, solicitado_por, autorizado_por)
    values (p_ticket, v_linea.id, v_linea.cantidad,
            coalesce(nullif(trim(p_motivo), ''), 'Cuenta cancelada por el dueño/gerente'),
            p_empleado, p_empleado);
    perform revertir_linea_inventario(v_linea.id, p_empleado);
  end loop;

  -- borra cualquier pago ya registrado: la venta nunca pasó
  delete from pagos where ticket_id = p_ticket;

  update tickets
     set estado = 'cancelado',
         subtotal = 0,
         total = 0,
         cancelado_por = p_empleado,
         cancelado_en = now(),
         cancelado_motivo = coalesce(nullif(trim(p_motivo), ''), 'Cancelada por el dueño/gerente')
   where id = p_ticket;

  update ticket_bancos set hasta = now()
   where ticket_id = p_ticket and hasta is null;
end;
$function$;

revoke execute on function public.revertir_linea_inventario(uuid, uuid) from public, anon, authenticated;
grant execute on function public.revertir_linea_inventario(uuid, uuid) to service_role, postgres;

revoke execute on function public.cancelar_linea(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.cancelar_linea(uuid, uuid, text, text) to service_role, postgres;

revoke execute on function public.cancelar_cuenta(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cancelar_cuenta(uuid, uuid, text) to service_role, postgres;
