-- Mercedes: "pon opcion de cancelar ticket con codigo del dueño" — un
-- mesero se puede topar con un ticket en $0 (abierto por error, o uno de
-- los que dejó el bug del prefetch) y hoy no tiene cómo quitarlo de en
-- medio, porque cancelar_cuenta es solo para dueño/gerente. Se le agrega
-- la MISMA autorización por código que ya usa cancelar_linea: si quien
-- pide la cancelación no es dueño/gerente, tiene que traer el código de
-- alguien que sí lo sea (de la misma sucursal) — y ese es quien queda
-- registrado como quien autorizó, no el mesero.
--
-- OJO: se agrega un parámetro nuevo (p_codigo) al final — eso hace una
-- firma distinta, así que un CREATE OR REPLACE solo dejaría las DOS
-- versiones conviviendo (la de 3 parámetros y esta de 4). Hay que tirar
-- la vieja primero.
drop function if exists public.cancelar_cuenta(uuid, uuid, text);

create or replace function public.cancelar_cuenta(
  p_empleado uuid, p_ticket uuid, p_motivo text default null, p_codigo text default null
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_suc uuid; v_rol_solicitante text; v_autoriza uuid; v_rol_autoriza text;
  v_suc_ticket uuid; v_estado text; v_linea record;
begin
  select sucursal_id, rol into v_suc, v_rol_solicitante
  from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;

  if v_rol_solicitante in ('dueno', 'gerente') then
    v_autoriza := p_empleado;
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

  select sucursal_id, estado into v_suc_ticket, v_estado
  from tickets where id = p_ticket;
  if v_suc_ticket is null then raise exception 'Esa cuenta no existe'; end if;
  if v_suc_ticket <> v_suc then raise exception 'Esa cuenta no es de tu sucursal'; end if;
  if v_estado = 'cancelado' then raise exception 'Esa cuenta ya está cancelada'; end if;

  for v_linea in select id, cantidad from ticket_lineas
                  where ticket_id = p_ticket and estado = 'activa'
  loop
    update ticket_lineas set estado = 'cancelada' where id = v_linea.id;
    insert into cancelaciones (ticket_id, linea_id, cantidad, motivo, solicitado_por, autorizado_por)
    values (p_ticket, v_linea.id, v_linea.cantidad,
            coalesce(nullif(trim(p_motivo), ''), 'Cuenta cancelada por el dueño/gerente'),
            p_empleado, v_autoriza);
    perform revertir_linea_inventario(v_linea.id, v_autoriza);
  end loop;

  delete from pagos where ticket_id = p_ticket;

  update tickets
     set estado = 'cancelado',
         subtotal = 0,
         total = 0,
         cancelado_por = v_autoriza,
         cancelado_en = now(),
         cancelado_motivo = coalesce(nullif(trim(p_motivo), ''), 'Cancelada por el dueño/gerente')
   where id = p_ticket;

  update ticket_bancos set hasta = now()
   where ticket_id = p_ticket and hasta is null;
end;
$$;

revoke execute on function public.cancelar_cuenta(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.cancelar_cuenta(uuid, uuid, text, text) to service_role, postgres;
