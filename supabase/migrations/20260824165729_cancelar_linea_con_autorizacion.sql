-- Cancela un renglón. Necesita el código de alguien que pueda autorizar.
-- Nada se borra: el renglón se marca y queda el registro de quién autorizó.
create or replace function public.cancelar_linea(
  p_solicitante uuid,
  p_codigo text,
  p_linea uuid,
  p_motivo text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_suc uuid; v_autoriza uuid; v_rol text;
  v_ticket uuid; v_estado text; v_cant numeric;
  v_pres uuid; v_prod uuid; v_derivado text; v_factor numeric;
  v_botella uuid; v_bolas numeric; v_litros numeric;
begin
  select sucursal_id into v_suc from empleados where id = p_solicitante and activo;
  if v_suc is null then raise exception 'Ese mesero no está activo'; end if;

  -- ¿de quién es el código que se tecleó?
  select e.id, e.rol into v_autoriza, v_rol
  from empleados e
  where e.activo and e.sucursal_id = v_suc
    and e.codigo_hash = extensions.crypt(p_codigo, e.codigo_hash);

  if v_autoriza is null then
    raise exception 'Ese código no es de nadie';
  end if;
  if v_rol not in ('dueno', 'gerente') then
    raise exception 'Ese código no puede autorizar cancelaciones';
  end if;

  select tl.ticket_id, tl.cantidad, tl.presentacion_id, tl.botella_abierta_id,
         t.estado
    into v_ticket, v_cant, v_pres, v_botella, v_estado
  from ticket_lineas tl
  join tickets t on t.id = tl.ticket_id
  where tl.id = p_linea and tl.estado = 'activa';

  if v_ticket is null then raise exception 'Ese renglón ya no está activo'; end if;
  if v_estado = 'cerrado' then
    raise exception 'Esa cuenta ya se cobró. Se necesita una devolución, no una cancelación';
  end if;

  select pe.producto_id, pe.consumo_derivado, pe.factor_consumo
    into v_prod, v_derivado, v_factor
  from presentaciones pe where pe.id = v_pres;

  update ticket_lineas set estado = 'cancelada' where id = p_linea;

  insert into cancelaciones (ticket_id, linea_id, cantidad, motivo,
                             solicitado_por, autorizado_por)
  values (v_ticket, p_linea, v_cant, p_motivo, p_solicitante, v_autoriza);

  -- ── se devuelve lo que se había descontado ──
  if v_derivado = 'copa' and v_botella is not null then
    update botellas_abiertas
       set copas_restantes = least(copas_totales, copas_restantes + v_cant * v_factor),
           cerrada_en = null, motivo_cierre = null
     where id = v_botella;

  elsif (select es_sabor_helado from productos where id = v_prod) then
    select bolas_por_litro into v_bolas from sucursales where id = v_suc;
    v_litros := case when v_derivado = 'bola'
                     then v_cant * v_factor / v_bolas
                     else v_cant * v_factor end;
    perform mover_inventario(v_suc, ls.producto_id, null, 'ajuste', ls.litros,
                             p_linea, v_autoriza, 'Se canceló un renglón')
    from linea_sabores ls where ls.linea_id = p_linea;

  else
    if (select inventario_por_presentacion from productos where id = v_prod) then
      perform mover_inventario(v_suc, null, v_pres, 'ajuste', v_cant * v_factor,
                               p_linea, v_autoriza, 'Se canceló un renglón');
    else
      perform mover_inventario(v_suc, v_prod, null, 'ajuste', v_cant * v_factor,
                               p_linea, v_autoriza, 'Se canceló un renglón');
    end if;
  end if;

  update tickets t
     set subtotal = sub.total, total = sub.total - t.descuento
    from (select coalesce(sum(cantidad * precio_unitario), 0) as total
            from ticket_lineas where ticket_id = v_ticket and estado = 'activa') sub
   where t.id = v_ticket;
end;
$$;
grant execute on function public.cancelar_linea(uuid, text, uuid, text) to anon, authenticated;;
