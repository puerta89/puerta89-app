-- Mercedes: "en el inventario, sigue apareciendo asi" (columnas "Al día"
-- y "Alcanza" en blanco / con "—").
--
-- Causa real: "Al día" y "Alcanza" (app/inventario/lista.tsx,
-- items_inventario) se calculan leyendo la tabla `movimientos` de los
-- últimos 28 días — pero esa tabla es nueva (empezó a llenarse hace
-- apenas unos días, junto con el sistema de receta_ingredientes). Las
-- ventas reales de antes de eso (las 6683+ líneas de ticket históricas)
-- nunca generaron su movimiento correspondiente, así que para casi todo
-- no hay ninguna señal de consumo real en la ventana de 28 días —de ahí
-- el "—" en todos lados, no es que esté roto.
--
-- Este es un backfill de una sola vez: para cada línea de ticket REAL
-- (no cancelada) de los últimos 35 días que todavía no tiene su
-- movimiento, se inserta el movimiento que le habría tocado —exactamente
-- las mismas reglas que ya usa agregar_linea (sabores, botella completa,
-- ingredientes de receta, todo lo demás)— pero SOLO en la bitácora
-- `movimientos`. A propósito NO se llama a mover_inventario ni se toca
-- `existencias`: eso ya refleja el inventario real de HOY, y sumarle
-- ventas de hace semanas otra vez lo dejaría mal. Este backfill es solo
-- para que "Al día"/"Alcanza" tengan de dónde leer.

-- 1) Sabores de helado (vendidos directo, o dentro de un Affogato)
insert into movimientos (sucursal_id, producto_id, tipo, cantidad, ticket_linea_id, creado_en, motivo)
select t.sucursal_id, ls.producto_id, 'venta', -ls.litros, tl.id, tl.creado_en,
       'Backfill histórico para Al día/Alcanza'
from ticket_lineas tl
join tickets t on t.id = tl.ticket_id
join linea_sabores ls on ls.linea_id = tl.id
where tl.estado = 'activa'
  and tl.creado_en > now() - interval '35 days'
  and not exists (select 1 from movimientos m where m.ticket_linea_id = tl.id);

-- 2) Botella completa (unidad_base = 'botella', sin derivado — no es copa)
insert into movimientos (sucursal_id, producto_id, tipo, cantidad, ticket_linea_id, creado_en, motivo)
select t.sucursal_id, pe.producto_id, 'venta', -(tl.cantidad * pe.factor_consumo), tl.id, tl.creado_en,
       'Backfill histórico para Al día/Alcanza'
from ticket_lineas tl
join tickets t on t.id = tl.ticket_id
join presentaciones pe on pe.id = tl.presentacion_id
join productos p on p.id = pe.producto_id
where tl.estado = 'activa'
  and tl.creado_en > now() - interval '35 days'
  and pe.consumo_derivado is null
  and p.unidad_base = 'botella'
  and not exists (select 1 from movimientos m where m.ticket_linea_id = tl.id);

-- 3) Todo lo demás sin derivado: ni sabores, ni botella completa, ni un
--    producto que exista solo como receta (ej. Americano — ese no lleva
--    inventario propio, solo cuenta lo que dice su receta, paso 4)
insert into movimientos (sucursal_id, producto_id, presentacion_id, tipo, cantidad, ticket_linea_id, creado_en, motivo)
select t.sucursal_id,
       case when p.inventario_por_presentacion then null else pe.producto_id end,
       case when p.inventario_por_presentacion then pe.id else null end,
       'venta', -(tl.cantidad * pe.factor_consumo), tl.id, tl.creado_en,
       'Backfill histórico para Al día/Alcanza'
from ticket_lineas tl
join tickets t on t.id = tl.ticket_id
join presentaciones pe on pe.id = tl.presentacion_id
join productos p on p.id = pe.producto_id
where tl.estado = 'activa'
  and tl.creado_en > now() - interval '35 days'
  and pe.consumo_derivado is null
  and p.unidad_base <> 'botella'
  and not exists (select 1 from linea_sabores ls where ls.linea_id = tl.id)
  and not exists (select 1 from receta_ingredientes ri where ri.producto_id = pe.producto_id)
  and not exists (select 1 from movimientos m where m.ticket_linea_id = tl.id);

-- 4) Ingredientes de receta, para cualquier producto vendido que tenga
--    receta (Americano, o cualquier "Otra cosa" armada con ingredientes),
--    sin importar si además cayó en alguna de las ramas de arriba
insert into movimientos (sucursal_id, producto_id, tipo, cantidad, ticket_linea_id, creado_en, motivo)
select t.sucursal_id, ri.insumo_id, 'venta', -(tl.cantidad * ri.cantidad), tl.id, tl.creado_en,
       'Backfill histórico para Al día/Alcanza'
from ticket_lineas tl
join tickets t on t.id = tl.ticket_id
join presentaciones pe on pe.id = tl.presentacion_id
join receta_ingredientes ri on ri.producto_id = pe.producto_id
where tl.estado = 'activa'
  and tl.creado_en > now() - interval '35 days'
  and not exists (
    select 1 from movimientos m
    where m.ticket_linea_id = tl.id and m.producto_id = ri.insumo_id
  );
