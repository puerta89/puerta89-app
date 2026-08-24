-- El consumo tiene que ser NETO: si un renglón se canceló, el producto
-- volvió al inventario y no se consumió. Antes se contaba de todos modos
-- y eso inflaba lo que había que pedir.
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
    select p.id as prod, null::uuid as pres,
           p.nombre as nom, c.nombre as cat, p.unidad_base as uni
    from productos p
    join categorias c on c.id = p.categoria_id
    where p.activo and not p.inventario_por_presentacion
    union all
    select null::uuid, pe.id,
           p.nombre || ' · ' || pe.nombre, c.nombre, 'pieza'
    from presentaciones pe
    join productos p on p.id = pe.producto_id
    join categorias c on c.id = p.categoria_id
    where p.activo and pe.activa and p.inventario_por_presentacion
  ),
  cons as (
    select m.producto_id as prod, m.presentacion_id as pres,
           greatest(sum(-m.cantidad), 0) / 28.0 as por_dia
    from movimientos m
    where m.sucursal_id = p_sucursal
      and m.creado_en > now() - interval '28 days'
      and (
        m.tipo = 'venta'
        -- la devolución al cancelar viene como ajuste ligado a un renglón
        or (m.tipo = 'ajuste' and m.ticket_linea_id is not null)
      )
    group by 1, 2
  ),
  cat as (
    select pe.producto_id as prod, pe.id as pres, pr.costo
    from presentaciones pe
    join precios pr on pr.presentacion_id = pe.id
                   and pr.sucursal_id = p_sucursal and pr.vigente_hasta is null
    where pe.consumo_derivado is null and pe.factor_consumo = 1
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
grant execute on function public.items_inventario(uuid) to anon, authenticated;;
