-- Ayudante interno: registra un movimiento y ajusta las existencias.
-- Cantidad negativa = sale, positiva = entra.
create or replace function public.mover_inventario(
  p_sucursal uuid, p_producto uuid, p_presentacion uuid,
  p_tipo text, p_cantidad numeric,
  p_linea uuid default null, p_empleado uuid default null, p_motivo text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into movimientos (sucursal_id, producto_id, presentacion_id, tipo,
                           cantidad, ticket_linea_id, empleado_id, motivo)
  values (p_sucursal, p_producto, p_presentacion, p_tipo,
          p_cantidad, p_linea, p_empleado, p_motivo);

  if p_producto is not null then
    insert into existencias (sucursal_id, producto_id, cantidad)
    values (p_sucursal, p_producto, p_cantidad)
    on conflict (sucursal_id, producto_id) where producto_id is not null
    do update set cantidad = existencias.cantidad + excluded.cantidad,
                  actualizado_en = now();
  else
    insert into existencias (sucursal_id, presentacion_id, cantidad)
    values (p_sucursal, p_presentacion, p_cantidad)
    on conflict (sucursal_id, presentacion_id) where presentacion_id is not null
    do update set cantidad = existencias.cantidad + excluded.cantidad,
                  actualizado_en = now();
  end if;
end;
$$;
revoke all on function public.mover_inventario(uuid,uuid,uuid,text,numeric,uuid,uuid,text) from public;

-- El menú de una sucursal, con SUS precios.
create or replace function public.catalogo(p_sucursal uuid)
returns table (
  categoria text, categoria_orden int,
  producto_id uuid, producto text, tipo_vino text,
  unidad_base text, es_sabor_helado boolean, inventario_por_presentacion boolean,
  presentacion_id uuid, presentacion text, presentacion_orden int,
  precio numeric, consumo_derivado text, factor_consumo numeric,
  es_para_llevar boolean
)
language sql security definer set search_path = public as $$
  select c.nombre, c.orden,
         p.id, p.nombre, p.tipo_vino, p.unidad_base, p.es_sabor_helado,
         p.inventario_por_presentacion,
         pe.id, pe.nombre, pe.orden,
         pr.precio, pe.consumo_derivado, pe.factor_consumo, pe.es_para_llevar
  from categorias c
  join productos p on p.categoria_id = c.id and p.activo
  join presentaciones pe on pe.producto_id = p.id and pe.activa
  join precios pr on pr.presentacion_id = pe.id
                 and pr.sucursal_id = p_sucursal
                 and pr.vigente_hasta is null
  where c.activa
  order by c.orden, p.nombre, pe.orden;
$$;
grant execute on function public.catalogo(uuid) to anon, authenticated;

-- Qué botellas están destapadas ahorita en la barra.
create or replace function public.botellas_de(p_sucursal uuid)
returns table (
  botella_id uuid, producto_id uuid, etiqueta text, tipo_vino text,
  copas_restantes numeric, costo_botella numeric
)
language sql security definer set search_path = public as $$
  select ba.id, p.id, p.nombre, p.tipo_vino, ba.copas_restantes, ba.costo_botella
  from botellas_abiertas ba
  join productos p on p.id = ba.producto_id
  where ba.sucursal_id = p_sucursal
    and ba.cerrada_en is null
    and ba.copas_restantes > 0
  order by p.tipo_vino, ba.abierta_en;
$$;
grant execute on function public.botellas_de(uuid) to anon, authenticated;

-- Lo que lleva una cuenta.
create or replace function public.ticket_detalle(p_ticket uuid)
returns table (
  linea_id uuid, producto text, presentacion text, tipo_vino text,
  etiqueta text, sabores text, cantidad numeric,
  precio_unitario numeric, importe numeric, estado text
)
language sql security definer set search_path = public as $$
  select tl.id, p.nombre, pe.nombre, p.tipo_vino,
         bp.nombre,
         (select string_agg(sp.nombre, ' · ' order by sp.nombre)
            from linea_sabores ls join productos sp on sp.id = ls.producto_id
           where ls.linea_id = tl.id),
         tl.cantidad, tl.precio_unitario,
         round(tl.cantidad * tl.precio_unitario, 2), tl.estado
  from ticket_lineas tl
  join presentaciones pe on pe.id = tl.presentacion_id
  join productos p on p.id = pe.producto_id
  left join botellas_abiertas ba on ba.id = tl.botella_abierta_id
  left join productos bp on bp.id = ba.producto_id
  where tl.ticket_id = p_ticket and tl.estado = 'activa'
  order by tl.creado_en;
$$;
grant execute on function public.ticket_detalle(uuid) to anon, authenticated;;
