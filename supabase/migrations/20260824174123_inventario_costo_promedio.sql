-- Lo que de verdad ha costado, según las compras. Se compara contra el
-- costo del catálogo para que el dueño vea si se le quedó viejo.
alter table existencias
  add column if not exists costo_promedio numeric(12,4) not null default 0;

-- Todo lo que se cuenta en una sucursal, con su consumo y cuánto le queda.
create or replace function public.items_inventario(p_sucursal uuid)
returns table (
  producto_id uuid, presentacion_id uuid,
  nombre text, categoria text, unidad text,
  cantidad numeric, minimo numeric,
  costo_promedio numeric, costo_catalogo numeric,
  consumo_dia numeric, dias_restantes numeric, sugerido numeric
)
language sql security definer set search_path = public as $$
  with base as (
    -- lo que se cuenta por producto
    select p.id as prod, null::uuid as pres,
           p.nombre as nom, c.nombre as cat, p.unidad_base as uni
    from productos p
    join categorias c on c.id = p.categoria_id
    where p.activo and not p.inventario_por_presentacion
    union all
    -- y lo que se cuenta por talla
    select null::uuid, pe.id,
           p.nombre || ' · ' || pe.nombre, c.nombre, 'pieza'
    from presentaciones pe
    join productos p on p.id = pe.producto_id
    join categorias c on c.id = p.categoria_id
    where p.activo and pe.activa and p.inventario_por_presentacion
  ),
  cons as (
    select m.producto_id as prod, m.presentacion_id as pres,
           sum(abs(m.cantidad)) / 28.0 as por_dia
    from movimientos m
    where m.sucursal_id = p_sucursal
      and m.tipo = 'venta'
      and m.creado_en > now() - interval '28 days'
    group by 1, 2
  ),
  cat as (
    -- el costo del catálogo de la unidad base (botella entera, litro, pieza)
    select pe.producto_id as prod, pe.id as pres, pr.costo
    from presentaciones pe
    join precios pr on pr.presentacion_id = pe.id
                   and pr.sucursal_id = p_sucursal and pr.vigente_hasta is null
    where pe.consumo_derivado is null and pe.factor_consumo = 1
  ),
  s as (
    select d.sucursal_id, s.id as suc from sucursales s
    cross join (select p_sucursal as sucursal_id) d
    where s.id = p_sucursal
  )
  select b.prod, b.pres, b.nom, b.cat, b.uni,
         coalesce(e.cantidad, 0),
         coalesce(e.minimo, 0),
         coalesce(e.costo_promedio, 0),
         coalesce(
           (select cat.costo from cat where cat.prod = b.prod limit 1),
           (select cat.costo from cat where cat.pres = b.pres limit 1),
           0),
         round(coalesce(cn.por_dia, 0), 3),
         case when coalesce(cn.por_dia, 0) > 0
              then round(coalesce(e.cantidad, 0) / cn.por_dia, 1)
              else null end,
         -- sugerido: lo necesario para 14 días, menos lo que hay
         case when coalesce(cn.por_dia, 0) > 0
              then greatest(0, ceil(cn.por_dia * 14 - coalesce(e.cantidad, 0)))
              else greatest(0, coalesce(e.minimo, 0) - coalesce(e.cantidad, 0))
         end
  from base b
  left join existencias e
    on e.sucursal_id = p_sucursal
   and (e.producto_id = b.prod or e.presentacion_id = b.pres)
  left join cons cn
    on (cn.prod = b.prod or cn.pres = b.pres)
  order by b.cat, b.nom;
$$;
grant execute on function public.items_inventario(uuid) to anon, authenticated;

create or replace function public.fijar_minimo(
  p_empleado uuid, p_producto uuid, p_presentacion uuid, p_minimo numeric
) returns void
language plpgsql security definer set search_path = public as $$
declare v_suc uuid; v_rol text;
begin
  select sucursal_id, rol into v_suc, v_rol
  from empleados where id = p_empleado and activo;
  if v_suc is null then raise exception 'Ese empleado no está activo'; end if;
  if v_rol = 'mesero' then raise exception 'Solo el dueño puede fijar mínimos'; end if;

  if p_producto is not null then
    insert into existencias (sucursal_id, producto_id, cantidad, minimo)
    values (v_suc, p_producto, 0, greatest(coalesce(p_minimo,0),0))
    on conflict (sucursal_id, producto_id) where producto_id is not null
    do update set minimo = greatest(coalesce(p_minimo,0),0), actualizado_en = now();
  else
    insert into existencias (sucursal_id, presentacion_id, cantidad, minimo)
    values (v_suc, p_presentacion, 0, greatest(coalesce(p_minimo,0),0))
    on conflict (sucursal_id, presentacion_id) where presentacion_id is not null
    do update set minimo = greatest(coalesce(p_minimo,0),0), actualizado_en = now();
  end if;
end;
$$;
grant execute on function public.fijar_minimo(uuid, uuid, uuid, numeric) to anon, authenticated;;
