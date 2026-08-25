-- Mercedes, tras la pregunta sobre la Cata, pidio algo mas fundamental:
-- "que sea facil para el cliente crearlo... que el panel de agregar cosas
-- al menu el solo pueda indicar lo que es". Nueva pantalla /catalogo
-- (solo dueno/gerente) con 3 formularios simples — Iram dice el nombre y
-- el costo, el sistema ya sabe como se vende (presentaciones y precios
-- de catalogo, segun las reglas de negocio ya fijadas del proyecto):
--
--  1) Vino: elige el tipo (Tinto/Blanco/Rosado/Naranja), pone el costo de
--     la botella -> crea presentaciones Copa+Botella con los precios FIJOS
--     por tipo (tinto 200/800, blanco 150/600, rosado 150/600,
--     naranja 180/720) y el costo de la copa = costo_botella/copas_por_botella.
--  2) Sabor de helado: pone el nombre y el costo del BOTE DE 5 LITROS (asi
--     compra, no "por litro" — eso confundiria) -> crea las 4
--     presentaciones (1 Bola/2 Bolas/Medio Litro/Litro) con los factores
--     reales ya usados en toda la ficha de helado y los precios fijos
--     (70/110/160/280).
--  3) Otra cosa (bebida/snack/merch sin talla): nombre, categoria (de las
--     que ya existen), precio y costo -> una sola presentacion "Única".
--
-- No cubre: vinos/merch con variantes de talla, ni productos "combo" como
-- la Cata (que consumiria de MULTIPLES cosas reales a la vez — vino de
-- botella abierta + helado elegido — eso quedo pendiente, es una
-- capacidad mas grande que esto).

create or replace function public.categorias_de()
returns table(id uuid, nombre text)
language sql
security definer
set search_path to 'public'
as $function$
  select id, nombre from categorias order by nombre;
$function$;

create or replace function public.catalogo_crear_vino(
  p_empleado uuid, p_nombre text, p_tipo_vino text, p_costo_botella numeric
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_suc uuid; v_rol text; v_cat uuid; v_prod uuid; v_tipo text;
  v_pres_copa uuid; v_pres_botella uuid;
  v_precio_copa numeric; v_precio_botella numeric;
  v_copas int;
begin
  select sucursal_id, rol into v_suc, v_rol from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño puede agregar productos'; end if;

  if p_nombre is null or trim(p_nombre) = '' then
    raise exception 'Falta el nombre del vino';
  end if;
  if exists (select 1 from productos where lower(nombre) = lower(trim(p_nombre))) then
    raise exception 'Ya existe un producto con ese nombre';
  end if;
  if p_costo_botella is null or p_costo_botella <= 0 then
    raise exception 'Falta el costo de la botella';
  end if;

  v_tipo := lower(trim(coalesce(p_tipo_vino, '')));

  case v_tipo
    when 'tinto'   then v_precio_copa := 200; v_precio_botella := 800;
    when 'blanco'  then v_precio_copa := 150; v_precio_botella := 600;
    when 'rosado'  then v_precio_copa := 150; v_precio_botella := 600;
    when 'naranja' then v_precio_copa := 180; v_precio_botella := 720;
    else raise exception 'El tipo de vino tiene que ser Tinto, Blanco, Rosado o Naranja';
  end case;

  select id into v_cat from categorias where nombre = 'Vinos';
  select copas_por_botella into v_copas from sucursales where id = v_suc;

  insert into productos (categoria_id, nombre, tipo_vino, unidad_base, activo)
  values (v_cat, trim(p_nombre), v_tipo, 'botella', true)
  returning id into v_prod;

  insert into presentaciones (producto_id, nombre, orden, es_para_llevar, factor_consumo, consumo_derivado)
  values (v_prod, 'Copa', 1, false, 1, 'copa')
  returning id into v_pres_copa;

  insert into presentaciones (producto_id, nombre, orden, es_para_llevar, factor_consumo, consumo_derivado)
  values (v_prod, 'Botella', 2, false, 1, null)
  returning id into v_pres_botella;

  insert into precios (presentacion_id, sucursal_id, precio, costo)
  values (v_pres_copa, v_suc, v_precio_copa, round(p_costo_botella / v_copas, 2));

  insert into precios (presentacion_id, sucursal_id, precio, costo)
  values (v_pres_botella, v_suc, v_precio_botella, p_costo_botella);

  return v_prod;
end;
$function$;

create or replace function public.catalogo_crear_sabor_helado(
  p_empleado uuid, p_nombre text, p_costo_bote numeric
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_suc uuid; v_rol text; v_cat uuid; v_prod uuid;
  v_1bola uuid; v_2bolas uuid; v_medio uuid; v_litro uuid;
  v_costo_litro numeric;
begin
  select sucursal_id, rol into v_suc, v_rol from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño puede agregar productos'; end if;

  if p_nombre is null or trim(p_nombre) = '' then
    raise exception 'Falta el nombre del sabor';
  end if;
  if exists (select 1 from productos where lower(nombre) = lower(trim(p_nombre))) then
    raise exception 'Ya existe un producto con ese nombre';
  end if;
  if p_costo_bote is null or p_costo_bote <= 0 then
    raise exception 'Falta el costo del bote';
  end if;

  v_costo_litro := p_costo_bote / 5.0;

  select id into v_cat from categorias where nombre = 'Helados';

  insert into productos (categoria_id, nombre, unidad_base, es_sabor_helado, activo)
  values (v_cat, trim(p_nombre), 'litro', true, true)
  returning id into v_prod;

  insert into presentaciones (producto_id, nombre, orden, es_para_llevar, factor_consumo, consumo_derivado)
  values (v_prod, '1 Bola', 1, false, 0.7143, null) returning id into v_1bola;
  insert into presentaciones (producto_id, nombre, orden, es_para_llevar, factor_consumo, consumo_derivado)
  values (v_prod, '2 Bolas', 2, false, 1.1111, null) returning id into v_2bolas;
  insert into presentaciones (producto_id, nombre, orden, es_para_llevar, factor_consumo, consumo_derivado)
  values (v_prod, 'Medio Litro', 3, true, 2.5000, null) returning id into v_medio;
  insert into presentaciones (producto_id, nombre, orden, es_para_llevar, factor_consumo, consumo_derivado)
  values (v_prod, 'Litro', 4, true, 5.0000, null) returning id into v_litro;

  insert into precios (presentacion_id, sucursal_id, precio, costo) values
    (v_1bola, v_suc, 70, round(0.7143 * v_costo_litro, 2)),
    (v_2bolas, v_suc, 110, round(1.1111 * v_costo_litro, 2)),
    (v_medio, v_suc, 160, round(2.5 * v_costo_litro, 2)),
    (v_litro, v_suc, 280, p_costo_bote);

  return v_prod;
end;
$function$;

create or replace function public.catalogo_crear_simple(
  p_empleado uuid, p_nombre text, p_categoria_id uuid, p_precio numeric, p_costo numeric
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_suc uuid; v_rol text; v_prod uuid; v_pres uuid;
begin
  select sucursal_id, rol into v_suc, v_rol from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño puede agregar productos'; end if;

  if p_nombre is null or trim(p_nombre) = '' then
    raise exception 'Falta el nombre del producto';
  end if;
  if exists (select 1 from productos where lower(nombre) = lower(trim(p_nombre))) then
    raise exception 'Ya existe un producto con ese nombre';
  end if;
  if p_categoria_id is null then raise exception 'Falta la categoría'; end if;
  if p_precio is null or p_precio <= 0 then raise exception 'Falta el precio'; end if;
  if p_costo is null or p_costo < 0 then raise exception 'El costo no puede ser negativo'; end if;

  insert into productos (categoria_id, nombre, unidad_base, activo)
  values (p_categoria_id, trim(p_nombre), 'pieza', true)
  returning id into v_prod;

  insert into presentaciones (producto_id, nombre, orden, es_para_llevar, factor_consumo, consumo_derivado)
  values (v_prod, 'Única', 1, false, 1, null)
  returning id into v_pres;

  insert into precios (presentacion_id, sucursal_id, precio, costo)
  values (v_pres, v_suc, p_precio, p_costo);

  return v_prod;
end;
$function$;

revoke execute on function public.categorias_de() from public, anon, authenticated;
grant execute on function public.categorias_de() to service_role, postgres;
revoke execute on function public.catalogo_crear_vino(uuid, text, text, numeric) from public, anon, authenticated;
grant execute on function public.catalogo_crear_vino(uuid, text, text, numeric) to service_role, postgres;
revoke execute on function public.catalogo_crear_sabor_helado(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.catalogo_crear_sabor_helado(uuid, text, numeric) to service_role, postgres;
revoke execute on function public.catalogo_crear_simple(uuid, text, uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.catalogo_crear_simple(uuid, text, uuid, numeric, numeric) to service_role, postgres;
