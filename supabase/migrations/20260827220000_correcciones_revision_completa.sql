-- Mercedes pidió una revisión completa de todo lo agregado hoy. Se
-- corrigen tres cosas reales que salieron de esa revisión:
--
-- 1. catalogo_guardar_producto no verificaba que cada presentación en
--    p_precios de verdad fuera de p_producto — si alguna vez llegara un
--    presentacion_id que no le pertenece (bug futuro del cliente, o dato
--    viejo en el navegador), le cambiaría el precio a OTRO producto sin
--    avisar. Ahora se valida antes de tocar nada.
--
-- 2. editar_gasto: si p_recurrente llegara en null, lo dejaba en false en
--    vez de conservar el valor que ya tenía (a diferencia de p_fecha, que
--    sí se conserva con coalesce(p_fecha, fecha)). Hoy el cliente siempre
--    manda un booleano real, así que no se ha disparado, pero se deja
--    igual de consistente que el resto de los campos.

create or replace function public.catalogo_guardar_producto(
  p_empleado uuid,
  p_producto uuid,
  p_nombre text,
  p_categoria_id uuid,
  p_tipo_vino text,
  p_precios jsonb default '[]'::jsonb,
  p_ingredientes jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_suc uuid; v_rol text;
  l jsonb;
  v_pres uuid; v_precio numeric; v_costo numeric;
  v_precio_actual numeric; v_costo_actual numeric;
  v_insumo uuid; v_insumo_nombre text; v_insumo_unidad text; v_cantidad numeric;
  v_ids_finales uuid[] := '{}';
begin
  select sucursal_id, rol into v_suc, v_rol from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño puede editar el menú'; end if;

  if p_nombre is null or trim(p_nombre) = '' then
    raise exception 'Falta el nombre del producto';
  end if;
  if exists (select 1 from productos where lower(nombre) = lower(trim(p_nombre)) and id <> p_producto) then
    raise exception 'Ya existe otro producto con ese nombre';
  end if;
  if p_categoria_id is null then raise exception 'Falta la categoría'; end if;

  update productos
     set nombre = trim(p_nombre),
         categoria_id = p_categoria_id,
         tipo_vino = nullif(lower(trim(coalesce(p_tipo_vino, ''))), '')
   where id = p_producto;
  if not found then raise exception 'Ese producto no existe'; end if;

  -- ── Precios: solo se abre un renglón nuevo si de verdad cambió algo ──
  for l in select * from jsonb_array_elements(coalesce(p_precios, '[]'::jsonb))
  loop
    v_pres := (l->>'presentacion_id')::uuid;
    v_precio := (l->>'precio')::numeric;
    v_costo := (l->>'costo')::numeric;

    if not exists (select 1 from presentaciones where id = v_pres and producto_id = p_producto) then
      raise exception 'Esa presentación no es de este producto';
    end if;
    if v_precio is null or v_precio <= 0 then raise exception 'Falta el precio de una presentación'; end if;
    if v_costo is null or v_costo < 0 then raise exception 'El costo no puede ser negativo'; end if;

    select precio, costo into v_precio_actual, v_costo_actual
    from precios where presentacion_id = v_pres and sucursal_id = v_suc and vigente_hasta is null;

    if v_precio_actual is distinct from v_precio or v_costo_actual is distinct from v_costo then
      update precios set vigente_hasta = now()
       where presentacion_id = v_pres and sucursal_id = v_suc and vigente_hasta is null;
      insert into precios (presentacion_id, sucursal_id, precio, costo, vigente_desde)
      values (v_pres, v_suc, v_precio, v_costo, now());
    end if;
  end loop;

  -- ── Receta: se reemplaza por la lista que llega (se crean insumos
  -- nuevos si hace falta, igual que al crear un producto) ────────────
  for l in select * from jsonb_array_elements(coalesce(p_ingredientes, '[]'::jsonb))
  loop
    v_cantidad := (l->>'cantidad')::numeric;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Un ingrediente no tiene una cantidad válida';
    end if;

    v_insumo := nullif(l->>'insumo_id', '')::uuid;

    if v_insumo is null then
      v_insumo_nombre := trim(coalesce(l->>'insumo_nombre', ''));
      v_insumo_unidad := coalesce(l->>'insumo_unidad', 'pieza');
      if v_insumo_nombre = '' then
        raise exception 'Falta el nombre de un ingrediente nuevo';
      end if;

      select id into v_insumo from productos where lower(nombre) = lower(v_insumo_nombre);

      if v_insumo is null then
        insert into productos (categoria_id, nombre, unidad_base, activo)
        values ((select id from categorias where nombre = 'Insumos'), v_insumo_nombre, v_insumo_unidad, true)
        returning id into v_insumo;
      end if;
    end if;

    if v_insumo = p_producto then
      raise exception 'Un producto no puede llevar de ingrediente a sí mismo';
    end if;

    insert into receta_ingredientes (producto_id, insumo_id, cantidad)
    values (p_producto, v_insumo, v_cantidad)
    on conflict (producto_id, insumo_id) do update set cantidad = excluded.cantidad;

    v_ids_finales := array_append(v_ids_finales, v_insumo);
  end loop;

  delete from receta_ingredientes
   where producto_id = p_producto
     and not (insumo_id = any(v_ids_finales));
end;
$function$;

create or replace function public.editar_gasto(
  p_empleado uuid,
  p_gasto uuid,
  p_categoria text,
  p_concepto text,
  p_monto numeric,
  p_fecha date,
  p_recurrente boolean
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_suc uuid; v_rol text;
begin
  select sucursal_id, rol into v_suc, v_rol from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño puede editar gastos'; end if;
  if not (p_monto > 0) then raise exception 'El monto tiene que ser mayor a cero'; end if;
  if coalesce(trim(p_concepto),'') = '' then raise exception 'Falta el concepto'; end if;

  update gastos
     set categoria = coalesce(nullif(trim(p_categoria),''), 'Otros'),
         concepto = trim(p_concepto),
         monto = p_monto,
         fecha = coalesce(p_fecha, fecha),
         recurrente = coalesce(p_recurrente, recurrente)
   where id = p_gasto and sucursal_id = v_suc;
  if not found then raise exception 'Ese gasto no existe'; end if;
end;
$function$;

revoke execute on function public.catalogo_guardar_producto(uuid, uuid, text, uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.catalogo_guardar_producto(uuid, uuid, text, uuid, text, jsonb, jsonb) to service_role, postgres;

revoke execute on function public.editar_gasto(uuid, uuid, text, text, numeric, date, boolean) from public, anon, authenticated;
grant execute on function public.editar_gasto(uuid, uuid, text, text, numeric, date, boolean) to service_role, postgres;
