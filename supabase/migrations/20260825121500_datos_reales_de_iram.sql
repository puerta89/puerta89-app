-- Carga los datos reales de operación que Iram lleva en su Excel paralelo
-- (Puerta89_Local1_Operacion_Copia.xlsx), pedido explícito de Mercedes:
-- "actualizar datos de inventario y gastos".
--
-- Contexto: la tabla `existencias` nunca había tenido un inventario real
-- cargado (solo 7 filas, todas de pruebas del mismo día 2026-08-25, todas
-- en negativo por partir de cero). Este snapshot de Iram (corte ~22 de
-- agosto de 2026) reemplaza esas filas de prueba con el inventario real.
-- De aquí en adelante la app es la fuente de verdad; Iram ya no necesita
-- capturar en Excel.

-- 1) Factor real de los snacks: Iram los mide como fracción de una
--    bolsa/paquete comprado, no como "1 pieza entera" (que era el valor
--    que había, subestimando el consumo real).
update presentaciones pe
   set factor_consumo = 0.2222
  from productos p
 where pe.producto_id = p.id and p.nombre = 'Aceitunas Preparadas' and pe.nombre = 'Única';

update presentaciones pe
   set factor_consumo = 0.1667
  from productos p
 where pe.producto_id = p.id and p.nombre = 'Pretzels' and pe.nombre = 'Única';

update presentaciones pe
   set factor_consumo = 0.2000
  from productos p
 where pe.producto_id = p.id and p.nombre = 'Nueces' and pe.nombre = 'Única';

-- 2) Inventario real (sucursal Puebla). Se borra cualquier fila previa de
--    estos mismos productos (las de prueba) y se inserta el snapshot real.
--    Los productos de mi catálogo que Iram todavía no compra/vende (varios
--    vinos nuevos, algunos helados de temporada, los 4 "Affogato por
--    sabor" que en Iram son SKUs separados pero en la app son un solo
--    producto con selección real de sabor) no tienen fila aquí a propósito.
with datos(nombre_producto, cantidad, minimo) as (
  values
    ('Rosado White Zinf', 2.6333, 1),
    ('Rosado Tempranillo', 2.5333, 1),
    ('Rosado Analogía', 0, 1),
    ('Tinto Cabernet Franc', 2.6999, 1),
    ('Tinto Pinot Noir', -0.1333, 1),
    ('Tinto Emeve', 1.0333, 1),
    ('Blanco Sauv Blanc', 4.9999, 1),
    ('Blanco Chardonnay', 3.4999, 1),
    ('Blanco Satinela', 1.9999, 1),
    ('Blanco Mara', 0, 1),
    ('Naranja Raza', -0.1666, 1),
    ('Rosado Pierre', -0.5333, 1),
    ('Selva Negra', -0.8015, 0.5),
    ('Maracuya', 6.6349, 0.5),
    ('Vainilla', 5.5714, 0.5),
    ('Dulce de leche', 5.4000, 0.5),
    ('Café', 4.8571, 0.5),
    ('Limón', 1, 0.5),
    ('Pistache', 3.9920, 0.5),
    ('Lotus', 3.3492, 0.5),
    ('Maíz', 3.5634, 0.5),
    ('Temporada (Mamey)', 0.0269, 0.5),
    ('Temporada (Nogada)', 2.4841, 0.5),
    ('Aceitunas Preparadas', -0.1111, 0.5),
    ('Pretzels', 0.1666, 0.5),
    ('Nueces', 0.4, 0.5),
    ('Agua Mineral', 7, 2),
    ('Americano', -3, 0),
    ('Espresso', -8, 0),
    ('Capuccino', 0, 0),
    ('Gorra', 5, 2),
    ('Playera', 0, 2),
    ('Hoodie', 0, 2)
), suc as (select id from sucursales where nombre='Puebla')
delete from existencias e
using datos d, suc, productos p
where e.sucursal_id = suc.id and e.producto_id = p.id and p.nombre = d.nombre_producto
  and e.presentacion_id is null;

with datos(nombre_producto, cantidad, minimo) as (
  values
    ('Rosado White Zinf', 2.6333, 1),
    ('Rosado Tempranillo', 2.5333, 1),
    ('Rosado Analogía', 0, 1),
    ('Tinto Cabernet Franc', 2.6999, 1),
    ('Tinto Pinot Noir', -0.1333, 1),
    ('Tinto Emeve', 1.0333, 1),
    ('Blanco Sauv Blanc', 4.9999, 1),
    ('Blanco Chardonnay', 3.4999, 1),
    ('Blanco Satinela', 1.9999, 1),
    ('Blanco Mara', 0, 1),
    ('Naranja Raza', -0.1666, 1),
    ('Rosado Pierre', -0.5333, 1),
    ('Selva Negra', -0.8015, 0.5),
    ('Maracuya', 6.6349, 0.5),
    ('Vainilla', 5.5714, 0.5),
    ('Dulce de leche', 5.4000, 0.5),
    ('Café', 4.8571, 0.5),
    ('Limón', 1, 0.5),
    ('Pistache', 3.9920, 0.5),
    ('Lotus', 3.3492, 0.5),
    ('Maíz', 3.5634, 0.5),
    ('Temporada (Mamey)', 0.0269, 0.5),
    ('Temporada (Nogada)', 2.4841, 0.5),
    ('Aceitunas Preparadas', -0.1111, 0.5),
    ('Pretzels', 0.1666, 0.5),
    ('Nueces', 0.4, 0.5),
    ('Agua Mineral', 7, 2),
    ('Americano', -3, 0),
    ('Espresso', -8, 0),
    ('Capuccino', 0, 0),
    ('Gorra', 5, 2),
    ('Playera', 0, 2),
    ('Hoodie', 0, 2)
), suc as (select id from sucursales where nombre='Puebla')
insert into existencias (sucursal_id, producto_id, presentacion_id, cantidad, minimo, costo_promedio)
select suc.id, p.id, null, d.cantidad, d.minimo, 0
from datos d, suc, productos p
where p.nombre = d.nombre_producto;

-- 3) Gastos fijos reales. Se quita el "Renta de agosto" de $18,000 que era
--    un dato de prueba fabricado (la renta real es $2,500, ya estaba bien
--    cargada) y se agregan los dos que faltaban.
delete from gastos where concepto = 'Renta de agosto' and monto = 18000;

insert into gastos (sucursal_id, categoria, concepto, monto, fecha, recurrente, registrado_por)
select s.id, 'Luz', 'Luz', 1250, '2026-07-01',
       true, (select registrado_por from gastos where concepto='Renta' limit 1)
from sucursales s where s.nombre='Puebla';

insert into gastos (sucursal_id, categoria, concepto, monto, fecha, recurrente, registrado_por)
select s.id, 'Normatividad', 'Normatividad', 4000, '2026-08-01',
       true, (select registrado_por from gastos where concepto='Renta' limit 1)
from sucursales s where s.nombre='Puebla';
