-- Edición libre de cuentas, como Loyverse.
--
-- Antes: quitar un renglón pedía motivo escrito + código del dueño (si
-- quien lo pedía era mesero); bajar una cantidad solo se podía en los
-- primeros 10 minutos; y una cuenta en "Pidieron la cuenta" (por_cobrar)
-- no se podía editar en absoluto (ni sumar ni quitar).
--
-- Ahora: el dueño decide con un interruptor por sucursal
-- (sucursales.meseros_editan_libre, encendido por defecto) si los meseros
-- pueden editar libremente. Encendido: sin código, sin motivo obligatorio,
-- sin límite de 10 min, y también en cuentas por_cobrar. Todo lo que se
-- quita sigue quedando en `cancelaciones` (quién y cuándo). Apagado: se
-- comporta como antes (código del dueño + motivo + 10 min).

alter table sucursales
  add column if not exists meseros_editan_libre boolean not null default true;

create or replace function public.cancelar_linea(
  p_solicitante uuid, p_linea uuid, p_motivo text, p_codigo text default null
) returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_suc uuid; v_rol_solicitante text; v_autoriza uuid; v_rol_autoriza text;
  v_ticket uuid; v_estado text; v_cant numeric; v_libre boolean;
begin
  select sucursal_id, rol into v_suc, v_rol_solicitante
  from empleados where id = p_solicitante and activo;
  if v_suc is null then raise exception 'Ese mesero no está activo'; end if;

  select meseros_editan_libre into v_libre from sucursales where id = v_suc;

  if v_rol_solicitante in ('dueno', 'gerente') or coalesce(v_libre, false) then
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
  where tl.id = p_linea and tl.estado = 'activa'
    and t.sucursal_id = v_suc;

  if v_ticket is null then raise exception 'Ese renglón ya no está activo'; end if;
  if v_estado = 'cerrado' then
    raise exception 'Esa cuenta ya se cobró. Se necesita una devolución, no una cancelación';
  end if;

  update ticket_lineas set estado = 'cancelada' where id = p_linea;

  insert into cancelaciones (ticket_id, linea_id, cantidad, motivo,
                             solicitado_por, autorizado_por)
  values (v_ticket, p_linea, v_cant,
          coalesce(nullif(trim(p_motivo), ''), 'Quitado de la cuenta'),
          p_solicitante, v_autoriza);

  perform revertir_linea_inventario(p_linea, v_autoriza);

  update tickets t
     set subtotal = sub.total, total = sub.total - t.descuento
    from (select coalesce(sum(cantidad * precio_unitario), 0) as total
            from ticket_lineas where ticket_id = v_ticket and estado = 'activa') sub
   where t.id = v_ticket;
end;
$$;

-- aumentar_cantidad y disminuir_cantidad: mismo cuerpo de siempre, con
-- dos cambios de una línea cada uno (se parten sobre la definición viva
-- para no volver a copiar cuerpos largos): aceptar cuentas por_cobrar, y
-- que el límite de 10 minutos solo aplique si la edición libre está apagada.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.aumentar_cantidad(uuid,uuid,numeric)'::regprocedure);
  d := replace(d, $a$estado = 'abierto';$a$, $b$estado in ('abierto','por_cobrar');$b$);
  if d not like '%''por_cobrar''%' then raise exception 'aumentar_cantidad: no se pudo parchar'; end if;
  execute d;

  d := pg_get_functiondef('public.disminuir_cantidad(uuid,uuid,numeric)'::regprocedure);
  d := replace(d, $a$estado = 'abierto';$a$, $b$estado in ('abierto','por_cobrar');$b$);
  d := replace(d,
    $a$if v_creado_en < now() - interval '10 minutes' then$a$,
    $b$if v_creado_en < now() - interval '10 minutes'
     and not coalesce((select meseros_editan_libre from sucursales where id = v_suc), false) then$b$);
  if d not like '%''por_cobrar''%' or d not like '%meseros_editan_libre%' then
    raise exception 'disminuir_cantidad: no se pudo parchar';
  end if;
  execute d;
end $$;

revoke execute on function public.cancelar_linea(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.cancelar_linea(uuid, uuid, text, text) to service_role, postgres;
revoke execute on function public.aumentar_cantidad(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.aumentar_cantidad(uuid, uuid, numeric) to service_role, postgres;
revoke execute on function public.disminuir_cantidad(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.disminuir_cantidad(uuid, uuid, numeric) to service_role, postgres;
