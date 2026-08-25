-- Bug reportado por Mercedes en vivo: al picar el "−" para quitar la última
-- unidad de un renglón (dejarlo en 0), la app tiraba
--   "new row for relation ticket_lineas violates check constraint
--    ticket_lineas_cantidad_check"
-- porque disminuir_cantidad ponía cantidad = 0 explícitamente, y la tabla
-- exige cantidad > 0 SIEMPRE (para líneas activas o no). cancelar_linea ya
-- resolvía esto bien: cuando cancela, solo cambia el estado y NUNCA toca
-- cantidad. disminuir_cantidad ahora hace lo mismo.

create or replace function public.disminuir_cantidad(p_empleado uuid, p_linea uuid, p_menos numeric DEFAULT 1)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_suc uuid; v_ticket uuid; v_creado_en timestamptz;
  v_pres uuid; v_prod uuid; v_derivado text; v_factor numeric;
  v_botella uuid; v_copas int; v_litros_bola numeric; v_cantidad numeric;
  v_es_sabor boolean; v_n int; v_litros numeric; v_cada numeric;
  v_restante numeric;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese mesero no está activo'; end if;
  if not (p_menos > 0) then raise exception 'La cantidad tiene que ser mayor a cero'; end if;

  select tl.ticket_id, tl.presentacion_id, tl.botella_abierta_id,
         tl.cantidad, tl.creado_en
    into v_ticket, v_pres, v_botella, v_cantidad, v_creado_en
  from ticket_lineas tl where tl.id = p_linea and tl.estado = 'activa';
  if v_ticket is null then raise exception 'Ese renglón ya no está activo'; end if;

  perform 1 from tickets where id = v_ticket and sucursal_id = v_suc and estado = 'abierto';
  if not found then raise exception 'Esa cuenta ya no está abierta'; end if;

  if v_creado_en < now() - interval '10 minutes' then
    raise exception 'Ya pasaron los 10 minutos. Pide que el dueño lo quite.';
  end if;

  v_restante := v_cantidad - p_menos;
  if v_restante < 0 then
    raise exception 'No puedes quitar más de lo que hay';
  end if;

  select pe.producto_id, pe.consumo_derivado, pe.factor_consumo
    into v_prod, v_derivado, v_factor
  from presentaciones pe where pe.id = v_pres;

  select copas_por_botella, litros_por_bola into v_copas, v_litros_bola
  from sucursales where id = v_suc;

  if v_derivado = 'copa' and v_botella is not null then
    update botellas_abiertas
       set copas_restantes = least(copas_totales, copas_restantes + p_menos * v_factor),
           cerrada_en = null, motivo_cierre = null
     where id = v_botella;

  elsif exists (select 1 from linea_sabores where linea_id = p_linea) then
    select es_sabor_helado into v_es_sabor from productos where id = v_prod;
    v_n := (select count(*) from linea_sabores where linea_id = p_linea);
    v_litros := case
      when v_es_sabor then p_menos * v_factor
      else p_menos * v_litros_bola
    end;
    v_cada := v_litros / v_n;

    -- primero se devuelve el inventario, usando las filas de linea_sabores
    -- TAL COMO ESTÁN todavía (antes de tocarlas)
    perform mover_inventario(v_suc, ls.producto_id, null, 'ajuste', v_cada,
                             p_linea, p_empleado, 'Se corrigió la cantidad')
    from linea_sabores ls where ls.linea_id = p_linea;

    if v_restante <= 0 then
      delete from linea_sabores where linea_id = p_linea;
    else
      update linea_sabores set litros = greatest(0.001, litros - v_cada) where linea_id = p_linea;
    end if;

  else
    if (select inventario_por_presentacion from productos where id = v_prod) then
      perform mover_inventario(v_suc, null, v_pres, 'ajuste', p_menos * v_factor,
                               p_linea, p_empleado, 'Se corrigió la cantidad');
    else
      perform mover_inventario(v_suc, v_prod, null, 'ajuste', p_menos * v_factor,
                               p_linea, p_empleado, 'Se corrigió la cantidad');
    end if;
  end if;

  -- OJO: cantidad siempre debe quedar > 0 (la tabla lo exige). Al cancelar
  -- por completo NO se toca cantidad, solo el estado — igual que hace
  -- cancelar_linea.
  if v_restante <= 0 then
    update ticket_lineas set estado = 'cancelada' where id = p_linea;
  else
    update ticket_lineas set cantidad = v_restante where id = p_linea;
  end if;

  update tickets t
     set subtotal = sub.total, total = sub.total - t.descuento
    from (select coalesce(sum(cantidad * precio_unitario), 0) as total
            from ticket_lineas where ticket_id = v_ticket and estado = 'activa') sub
   where t.id = v_ticket;
end;
$function$;

revoke execute on function public.disminuir_cantidad(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.disminuir_cantidad(uuid, uuid, numeric) to service_role, postgres;
