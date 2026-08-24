-- Entrada de mercancía. Cada compra actualiza el costo promedio real,
-- que es lo que permite saber la utilidad de verdad.
create or replace function public.registrar_compra(
  p_empleado uuid,
  p_proveedor uuid,
  p_fecha date,
  p_folio text,
  p_lineas jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_suc uuid; v_rol text; v_compra uuid; l jsonb;
  v_prod uuid; v_pres uuid; v_cant numeric; v_costo numeric;
  v_antes numeric; v_costo_antes numeric; v_total numeric := 0;
begin
  select sucursal_id, rol into v_suc, v_rol
  from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño puede registrar compras'; end if;
  if jsonb_array_length(coalesce(p_lineas, '[]'::jsonb)) = 0 then
    raise exception 'La compra no trae nada';
  end if;

  insert into compras (sucursal_id, proveedor_id, fecha, folio_proveedor, registrado_por)
  values (v_suc, p_proveedor, coalesce(p_fecha, current_date), nullif(trim(coalesce(p_folio,'')),''), p_empleado)
  returning id into v_compra;

  for l in select * from jsonb_array_elements(p_lineas) loop
    v_prod  := nullif(l->>'producto_id','')::uuid;
    v_pres  := nullif(l->>'presentacion_id','')::uuid;
    v_cant  := (l->>'cantidad')::numeric;
    v_costo := (l->>'costo_unitario')::numeric;

    if v_cant is null or v_cant <= 0 then raise exception 'Una cantidad no se entiende'; end if;
    if v_costo is null or v_costo < 0 then raise exception 'Un costo no se entiende'; end if;

    insert into compra_lineas (compra_id, producto_id, presentacion_id, cantidad, costo_unitario)
    values (v_compra, v_prod, v_pres, v_cant, v_costo);

    -- costo promedio ponderado con lo que ya había
    select coalesce(cantidad,0), coalesce(costo_promedio,0)
      into v_antes, v_costo_antes
    from existencias
    where sucursal_id = v_suc
      and (producto_id = v_prod or presentacion_id = v_pres);

    perform mover_inventario(v_suc, v_prod, v_pres, 'compra', v_cant,
                             null, p_empleado, 'Entrada de mercancía');

    update existencias
       set costo_promedio = case
             when greatest(coalesce(v_antes,0), 0) + v_cant > 0
             then (greatest(coalesce(v_antes,0),0) * coalesce(v_costo_antes,0)
                   + v_cant * v_costo)
                  / (greatest(coalesce(v_antes,0),0) + v_cant)
             else v_costo end
     where sucursal_id = v_suc
       and (producto_id = v_prod or presentacion_id = v_pres);

    v_total := v_total + v_cant * v_costo;
  end loop;

  update compras set total = v_total where id = v_compra;
  return v_compra;
end;
$$;
grant execute on function public.registrar_compra(uuid, uuid, date, text, jsonb) to anon, authenticated;

-- Merma: producto que se perdió. Necesita código de quien autoriza,
-- porque es dinero que se va.
create or replace function public.registrar_merma(
  p_empleado uuid, p_codigo text,
  p_producto uuid, p_presentacion uuid,
  p_cantidad numeric, p_motivo text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_suc uuid; v_autoriza uuid; v_rol text;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'La cantidad tiene que ser mayor a cero'; end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'Falta decir qué pasó'; end if;

  select e.id, e.rol into v_autoriza, v_rol
  from empleados e
  where e.activo and e.sucursal_id = v_suc
    and e.codigo_hash = extensions.crypt(p_codigo, e.codigo_hash);
  if v_autoriza is null then raise exception 'Ese código no es de nadie'; end if;
  if v_rol not in ('dueno','gerente') then
    raise exception 'Ese código no puede autorizar mermas';
  end if;

  perform mover_inventario(v_suc, p_producto, p_presentacion, 'merma',
                           -p_cantidad, null, v_autoriza, trim(p_motivo));
end;
$$;
grant execute on function public.registrar_merma(uuid, text, uuid, uuid, numeric, text) to anon, authenticated;

-- Conteo físico: se pone lo que de verdad hay. La diferencia contra lo
-- que creía el sistema queda registrada, que es el dato más útil que existe.
create or replace function public.registrar_conteo(
  p_empleado uuid, p_codigo text, p_items jsonb
) returns table (nombre text, esperaba numeric, habia numeric, diferencia numeric)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_suc uuid; v_autoriza uuid; v_rol text; i jsonb;
  v_prod uuid; v_pres uuid; v_contado numeric; v_antes numeric; v_dif numeric;
  v_nombre text;
begin
  select sucursal_id into v_suc from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;

  select e.id, e.rol into v_autoriza, v_rol
  from empleados e
  where e.activo and e.sucursal_id = v_suc
    and e.codigo_hash = extensions.crypt(p_codigo, e.codigo_hash);
  if v_autoriza is null then raise exception 'Ese código no es de nadie'; end if;
  if v_rol not in ('dueno','gerente') then
    raise exception 'Solo el dueño puede cerrar un conteo';
  end if;

  for i in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    v_prod    := nullif(i->>'producto_id','')::uuid;
    v_pres    := nullif(i->>'presentacion_id','')::uuid;
    v_contado := (i->>'contado')::numeric;
    if v_contado is null or v_contado < 0 then continue; end if;

    select coalesce(cantidad,0) into v_antes from existencias
     where sucursal_id = v_suc and (producto_id = v_prod or presentacion_id = v_pres);
    v_antes := coalesce(v_antes, 0);
    v_dif := v_contado - v_antes;

    if v_dif <> 0 then
      perform mover_inventario(v_suc, v_prod, v_pres, 'conteo_fisico', v_dif,
                               null, v_autoriza, 'Ajuste por conteo físico');
    end if;

    select coalesce(p.nombre, pr.nombre || ' · ' || pe.nombre) into v_nombre
    from (select 1) x
    left join productos p on p.id = v_prod
    left join presentaciones pe on pe.id = v_pres
    left join productos pr on pr.id = pe.producto_id;

    nombre := v_nombre; esperaba := v_antes; habia := v_contado; diferencia := v_dif;
    return next;
  end loop;
end;
$$;
grant execute on function public.registrar_conteo(uuid, text, jsonb) to anon, authenticated;

create or replace function public.proveedores_de()
returns table (id uuid, nombre text)
language sql security definer set search_path = public as $$
  select id, nombre from proveedores where activo order by nombre;
$$;
grant execute on function public.proveedores_de() to anon, authenticated;

create or replace function public.guardar_proveedor(p_empleado uuid, p_nombre text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_rol text; v_id uuid;
begin
  select rol into v_rol from empleados where id = p_empleado and activo;
  if v_rol is null or v_rol = 'mesero' then
    raise exception 'Solo el dueño puede dar de alta proveedores';
  end if;
  if coalesce(trim(p_nombre),'') = '' then raise exception 'Falta el nombre'; end if;

  insert into proveedores (nombre) values (trim(p_nombre))
  on conflict (nombre) do update set activo = true
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.guardar_proveedor(uuid, text) to anon, authenticated;;
