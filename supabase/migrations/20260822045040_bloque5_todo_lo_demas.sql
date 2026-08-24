-- Puerta 89 · Bloque 5: todo lo demás del negocio

-- El inventario se lleva en la unidad base de cada producto.
-- El merch apunta a la presentación, porque cada talla se cuenta aparte.
create table existencias (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id) on delete cascade,
  producto_id uuid references productos(id) on delete cascade,
  presentacion_id uuid references presentaciones(id) on delete cascade,
  cantidad numeric(12,3) not null default 0,
  minimo numeric(12,3) not null default 0 check (minimo >= 0),
  actualizado_en timestamptz not null default now(),
  check (num_nonnulls(producto_id, presentacion_id) = 1)
);
create unique index existencias_producto_idx
  on existencias (sucursal_id, producto_id) where producto_id is not null;
create unique index existencias_presentacion_idx
  on existencias (sucursal_id, presentacion_id) where presentacion_id is not null;

create table compras (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id) on delete restrict,
  proveedor_id uuid references proveedores(id),
  fecha date not null default current_date,
  folio_proveedor text,
  total numeric(12,2) not null default 0,
  notas text,
  registrado_por uuid references empleados(id),
  creado_en timestamptz not null default now()
);

create table compra_lineas (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references compras(id) on delete cascade,
  producto_id uuid references productos(id) on delete restrict,
  presentacion_id uuid references presentaciones(id) on delete restrict,
  cantidad numeric(12,3) not null check (cantidad > 0),
  costo_unitario numeric(12,2) not null check (costo_unitario >= 0),
  check (num_nonnulls(producto_id, presentacion_id) = 1)
);

-- Mercancía que sale de una sucursal y llega a la otra.
-- El detalle de qué se movió vive en movimientos, apuntando a este traspaso.
create table traspasos (
  id uuid primary key default gen_random_uuid(),
  sucursal_origen uuid not null references sucursales(id) on delete restrict,
  sucursal_destino uuid not null references sucursales(id) on delete restrict,
  fecha_salida date not null default current_date,
  fecha_llegada date,
  estado text not null default 'en_camino'
    check (estado in ('en_camino','recibido','cancelado')),
  notas text,
  registrado_por uuid references empleados(id),
  creado_en timestamptz not null default now(),
  check (sucursal_origen <> sucursal_destino)
);

-- El diario del inventario: TODO lo que entra y sale, con su motivo.
-- Es la tabla que permite explicar por qué el conteo físico no cuadra.
create table movimientos (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id) on delete cascade,
  producto_id uuid references productos(id) on delete restrict,
  presentacion_id uuid references presentaciones(id) on delete restrict,
  tipo text not null check (tipo in (
    'venta','compra','merma','cortesia','ajuste','devolucion',
    'traspaso_salida','traspaso_entrada','apertura_botella','conteo_fisico'
  )),
  -- negativo = sale, positivo = entra
  cantidad numeric(12,4) not null,
  -- de dónde vino este movimiento
  ticket_linea_id uuid references ticket_lineas(id) on delete set null,
  compra_id uuid references compras(id) on delete set null,
  traspaso_id uuid references traspasos(id) on delete set null,
  motivo text,
  empleado_id uuid references empleados(id),
  creado_en timestamptz not null default now(),
  check (num_nonnulls(producto_id, presentacion_id) = 1)
);
create index movimientos_sucursal_fecha_idx on movimientos (sucursal_id, creado_en);
create index movimientos_producto_idx on movimientos (producto_id, creado_en);

create table gastos (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id) on delete restrict,
  categoria text not null,
  concepto text not null,
  monto numeric(12,2) not null check (monto > 0),
  fecha date not null default current_date,
  recurrente boolean not null default false,
  registrado_por uuid references empleados(id),
  creado_en timestamptz not null default now()
);
create index gastos_sucursal_fecha_idx on gastos (sucursal_id, fecha);

alter table existencias   enable row level security;
alter table compras       enable row level security;
alter table compra_lineas enable row level security;
alter table traspasos     enable row level security;
alter table movimientos   enable row level security;
alter table gastos        enable row level security;;
