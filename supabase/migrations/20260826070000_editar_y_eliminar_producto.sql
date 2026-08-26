-- Mercedes: "cuando le pico al producto del menú me gustaría que se abra
-- el menú completo para editarlo, como si agregaras un nuevo producto...
-- que se pueda editar eliminar, lo que sea, porque por ejemplo ahorita
-- agregue lomo embuchado pero que se pueda poner eliminar en el caso de
-- que no se haya hecho ninguna venta con ese activo. en el caso de que si
-- se haya utilizado que aparezca inactivo y si los vuelven a poner en el
-- menú algún inactivo que igual se pueda volver a activar"
--
-- Tres funciones nuevas para "Ver todo el menú":
--
-- 1. catalogo_producto_detalle: trae TODO el desglose de un producto
--    (nombre, categoría, tipo de vino, sus presentaciones con precio/costo
--    vigente en la sucursal actual, y sus ingredientes de receta), más si
--    se puede eliminar (nunca se ha vendido nada de ese producto).
--
-- 2. catalogo_guardar_producto: guarda los cambios del desglose completo —
--    nombre/categoría/tipo, precios y costos de cada presentación (solo
--    abre un nuevo renglón de precio si de verdad cambió algo, para no
--    ensuciar el historial sin necesidad), y la receta de ingredientes
--    (agrega/edita/quita, igual que al crear un producto nuevo).
--
-- 3. catalogo_eliminar_producto: borra un producto por completo, pero
--    SOLO si nunca se vendió (ni él ni ninguna de sus presentaciones). Si
--    ya se vendió alguna vez, o tiene cualquier otro movimiento (compras,
--    inventario, o lo usa otra receta como ingrediente), se rechaza con un
--    mensaje claro — en ese caso lo que corresponde es desactivarlo
--    (ya existía cambiar_activo_producto, que también sirve para
--    reactivar uno que ya estaba inactivo).

create or replace function public.catalogo_producto_detalle(p_sucursal uuid, p_producto uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_resultado jsonb;
begin
  select jsonb_build_object(
    'producto_id', p.id,
    'nombre', p.nombre,
    'categoria_id', p.categoria_id,
    'tipo_vino', p.tipo_vino,
    'activo', p.activo,
    'presentaciones', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'presentacion_id', pe.id,
        'nombre', pe.nombre,
        'orden', pe.orden,
        'precio', pr.precio,
        'costo', pr.costo
      ) order by pe.orden), '[]'::jsonb)
      from presentaciones pe
      left join precios pr on pr.presentacion_id = pe.id
                           and pr.sucursal_id = p_sucursal
                           and pr.vigente_hasta is null
      where pe.producto_id = p.id and pe.activa
    ),
    'ingredientes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', ri.id,
        'insumo_id', ri.insumo_id,
        'insumo_nombre', ins.nombre,
        'unidad', ins.unidad_base,
        'cantidad', ri.cantidad,
        'costo_promedio', coalesce(ex.costo_promedio, 0)
      )), '[]'::jsonb)
      from receta_ingredientes ri
      join productos ins on ins.id = ri.insumo_id
      left join existencias ex on ex.producto_id = ri.insumo_id and ex.sucursal_id = p_sucursal
      where ri.producto_id = p.id
    ),
    'puede_eliminar', not exists (
      select 1 from ticket_lineas tl
      join presentaciones pe2 on pe2.id = tl.presentacion_id
      where pe2.producto_id = p.id
    )
  ) into v_resultado
  from productos p
  where p.id = p_producto;

  if v_resultado is null then raise exception 'Ese producto no existe'; end if;
  return v_resultado;
end;
$function$;

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

create or replace function public.catalogo_eliminar_producto(p_empleado uuid, p_producto uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_suc uuid; v_rol text;
begin
  select sucursal_id, rol into v_suc, v_rol from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño puede eliminar productos'; end if;

  if exists (
    select 1 from ticket_lineas tl
    join presentaciones pe on pe.id = tl.presentacion_id
    where pe.producto_id = p_producto
  ) then
    raise exception 'Ya se vendió al menos una vez — no se puede eliminar. Márcalo como inactivo si ya no se usa.';
  end if;

  begin
    delete from precios where presentacion_id in (select id from presentaciones where producto_id = p_producto);
    delete from receta_ingredientes where producto_id = p_producto;
    delete from presentaciones where producto_id = p_producto;
    delete from productos where id = p_producto;
  exception when foreign_key_violation then
    raise exception 'Este producto tiene otros movimientos registrados (compras, inventario, o lo usa otra receta como ingrediente) — no se puede eliminar. Márcalo como inactivo.';
  end;
end;
$function$;

revoke execute on function public.catalogo_producto_detalle(uuid, uuid) from public, anon, authenticated;
grant execute on function public.catalogo_producto_detalle(uuid, uuid) to service_role, postgres;

revoke execute on function public.catalogo_guardar_producto(uuid, uuid, text, uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.catalogo_guardar_producto(uuid, uuid, text, uuid, text, jsonb, jsonb) to service_role, postgres;

revoke execute on function public.catalogo_eliminar_producto(uuid, uuid) from public, anon, authenticated;
grant execute on function public.catalogo_eliminar_producto(uuid, uuid) to service_role, postgres;
