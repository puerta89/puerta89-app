-- Segunda etapa estilo Loyverse: inventario.
--
-- 1) El conteo físico pasa de ser un formulario que se pierde si algo
--    falla (se cerró la pestaña, se durmió la tablet, se fue el
--    internet a medias) a un DOCUMENTO que vive en la base desde que se
--    empieza: cada número que se escribe se guarda solo, renglón por
--    renglón, así que se puede seguir horas después o desde otro
--    aparato sin perder nada. Mismo concepto que "Inventory Count" de
--    Loyverse (pendiente → en progreso → completado).
-- 2) Historial: qué le ha pasado a un producto (ventas, compras, mermas,
--    conteos) — antes no había forma de verlo, solo el número de hoy.

create table conteos (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id),
  estado text not null default 'en_progreso'
    check (estado in ('en_progreso', 'completado', 'cancelado')),
  creado_por uuid not null references empleados(id),
  creado_en timestamptz not null default now(),
  completado_por uuid references empleados(id),
  completado_en timestamptz
);

-- Solo un conteo en progreso a la vez por sucursal — si hubiera dos,
-- cada uno vería un "esperado" distinto y se pisarían entre sí.
create unique index conteos_uno_en_progreso
  on conteos (sucursal_id) where estado = 'en_progreso';

create table conteo_lineas (
  id uuid primary key default gen_random_uuid(),
  conteo_id uuid not null references conteos(id) on delete cascade,
  producto_id uuid references productos(id),
  presentacion_id uuid references presentaciones(id),
  check (num_nonnulls(producto_id, presentacion_id) = 1),
  esperado numeric not null,
  contado numeric,
  actualizado_en timestamptz not null default now()
);
create unique index conteo_lineas_prod on conteo_lineas(conteo_id, producto_id) where producto_id is not null;
create unique index conteo_lineas_pres on conteo_lineas(conteo_id, presentacion_id) where presentacion_id is not null;

revoke all on table conteos, conteo_lineas from public, anon, authenticated;
grant all on table conteos, conteo_lineas to service_role, postgres;

-- ── Empezar un conteo: crea el documento y lo llena con todo lo que hoy
--    se cuenta, tomando "cuánto hay" como punto de partida (lo mismo que
--    ya usa /inventario, pero sin productos desactivados — no tiene
--    caso contar algo que ya no se vende). ------------------------------
create or replace function public.conteo_crear(p_empleado uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_suc uuid; v_rol text; v_conteo uuid;
begin
  select sucursal_id, rol into v_suc, v_rol from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño o el gerente puede empezar un conteo'; end if;

  perform 1 from conteos where sucursal_id = v_suc and estado = 'en_progreso';
  if found then raise exception 'Ya hay un conteo en progreso'; end if;

  insert into conteos (sucursal_id, creado_por) values (v_suc, p_empleado)
  returning id into v_conteo;

  insert into conteo_lineas (conteo_id, producto_id, presentacion_id, esperado)
  with base as (
    select p.id as prod, null::uuid as pres
    from productos p
    where p.activo
      and not p.inventario_por_presentacion
      and not exists (select 1 from receta_ingredientes ri where ri.producto_id = p.id)
    union all
    select null::uuid, pe.id
    from presentaciones pe
    join productos p on p.id = pe.producto_id
    where pe.activa and p.activo and p.inventario_por_presentacion
  )
  select v_conteo, b.prod, b.pres, coalesce(e.cantidad, 0)
  from base b
  left join existencias e
    on e.sucursal_id = v_suc and (e.producto_id = b.prod or e.presentacion_id = b.pres);

  return v_conteo;
end;
$$;

-- ── El conteo en progreso ahora mismo, con lo que ya se haya escrito. ---
create or replace function public.conteo_activo(p_sucursal uuid)
returns table(
  conteo_id uuid, creado_en timestamptz, creado_por text,
  producto_id uuid, presentacion_id uuid, nombre text, unidad text,
  esperado numeric, contado numeric
)
language sql
security definer
set search_path to 'public'
as $$
  select c.id, c.creado_en, e.nombre,
         cl.producto_id, cl.presentacion_id,
         coalesce(p.nombre, pr.nombre || ' · ' || pe.nombre),
         coalesce(p.unidad_base, 'pieza'),
         cl.esperado, cl.contado
  from conteos c
  join empleados e on e.id = c.creado_por
  join conteo_lineas cl on cl.conteo_id = c.id
  left join productos p on p.id = cl.producto_id
  left join presentaciones pe on pe.id = cl.presentacion_id
  left join productos pr on pr.id = pe.producto_id
  where c.sucursal_id = p_sucursal and c.estado = 'en_progreso'
  order by coalesce(p.nombre, pr.nombre);
$$;

-- ── Guardar UN renglón — se llama solo, un ratito después de que la
--    persona deja de escribir en ese campo. Así nunca se pierde más que
--    el último numerito si algo falla justo ahí. -----------------------
create or replace function public.conteo_guardar_item(
  p_empleado uuid, p_conteo uuid, p_producto uuid, p_presentacion uuid, p_contado numeric
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_suc uuid;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;

  update conteo_lineas cl
     set contado = p_contado, actualizado_en = now()
    from conteos c
   where c.id = cl.conteo_id
     and cl.conteo_id = p_conteo
     and c.sucursal_id = v_suc
     and c.estado = 'en_progreso'
     and coalesce(cl.producto_id, cl.presentacion_id) = coalesce(p_producto, p_presentacion);
  if not found then raise exception 'Ese conteo ya no está en progreso'; end if;
end;
$$;

-- ── Cerrar el conteo: aplica las diferencias (mismo mecanismo que ya
--    usaba registrar_conteo) y devuelve qué cambió, para mostrarlo. -----
create or replace function public.conteo_completar(p_empleado uuid, p_conteo uuid, p_codigo text)
returns table(nombre text, esperaba numeric, habia numeric, diferencia numeric)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_suc uuid; v_autoriza uuid; v_rol text; r record; v_dif numeric; v_nombre text;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;

  perform 1 from conteos where id = p_conteo and sucursal_id = v_suc and estado = 'en_progreso';
  if not found then raise exception 'Ese conteo ya no está en progreso'; end if;

  select e.id, e.rol into v_autoriza, v_rol
  from empleados e
  where e.activo and e.sucursal_id = v_suc
    and e.codigo_hash = extensions.crypt(coalesce(p_codigo, ''), e.codigo_hash);
  if v_autoriza is null then raise exception 'Ese código no es de nadie'; end if;
  if v_rol not in ('dueno', 'gerente') then
    raise exception 'Solo el dueño puede cerrar un conteo';
  end if;

  for r in
    select cl.producto_id, cl.presentacion_id, cl.esperado, cl.contado
    from conteo_lineas cl
    where cl.conteo_id = p_conteo and cl.contado is not null
  loop
    v_dif := r.contado - r.esperado;
    if v_dif <> 0 then
      perform mover_inventario(v_suc, r.producto_id, r.presentacion_id, 'conteo_fisico', v_dif,
                                null, v_autoriza, 'Ajuste por conteo físico');
    end if;

    select coalesce(p.nombre, pr.nombre || ' · ' || pe.nombre) into v_nombre
    from (select 1) x
    left join productos p on p.id = r.producto_id
    left join presentaciones pe on pe.id = r.presentacion_id
    left join productos pr on pr.id = pe.producto_id;

    nombre := v_nombre; esperaba := r.esperado; habia := r.contado; diferencia := v_dif;
    return next;
  end loop;

  update conteos set estado = 'completado', completado_por = v_autoriza, completado_en = now()
   where id = p_conteo;
end;
$$;

-- ── Abandonar un conteo sin aplicar nada (ej. se empezó por error). -----
create or replace function public.conteo_cancelar(p_empleado uuid, p_conteo uuid) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_suc uuid; v_rol text;
begin
  select sucursal_id, rol into v_suc, v_rol from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño o el gerente puede cancelar un conteo'; end if;

  update conteos set estado = 'cancelado'
   where id = p_conteo and sucursal_id = v_suc and estado = 'en_progreso';
  if not found then raise exception 'Ese conteo ya no está en progreso'; end if;
end;
$$;

-- ── Historial de un producto/presentación: qué le ha pasado. ------------
create or replace function public.historial_item(
  p_sucursal uuid, p_producto uuid, p_presentacion uuid, p_limite int default 60
) returns table(fecha timestamptz, tipo text, cantidad numeric, motivo text, empleado text)
language sql
security definer
set search_path to 'public'
as $$
  select m.creado_en, m.tipo, m.cantidad, m.motivo, e.nombre
  from movimientos m
  left join empleados e on e.id = m.empleado_id
  where m.sucursal_id = p_sucursal
    and (
      (p_producto is not null and m.producto_id = p_producto) or
      (p_presentacion is not null and m.presentacion_id = p_presentacion)
    )
  order by m.creado_en desc
  limit p_limite;
$$;

revoke execute on function public.conteo_crear(uuid) from public, anon, authenticated;
grant execute on function public.conteo_crear(uuid) to service_role, postgres;
revoke execute on function public.conteo_activo(uuid) from public, anon, authenticated;
grant execute on function public.conteo_activo(uuid) to service_role, postgres;
revoke execute on function public.conteo_guardar_item(uuid, uuid, uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.conteo_guardar_item(uuid, uuid, uuid, uuid, numeric) to service_role, postgres;
revoke execute on function public.conteo_completar(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.conteo_completar(uuid, uuid, text) to service_role, postgres;
revoke execute on function public.conteo_cancelar(uuid, uuid) from public, anon, authenticated;
grant execute on function public.conteo_cancelar(uuid, uuid) to service_role, postgres;
revoke execute on function public.historial_item(uuid, uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.historial_item(uuid, uuid, uuid, int) to service_role, postgres;
