-- Puerta 89 · Bloque 3: la operación
create table tickets (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id) on delete restrict,
  folio bigint generated always as identity,
  cliente_id uuid references clientes(id),
  personas int not null default 1 check (personas > 0),
  estado text not null default 'abierto'
    check (estado in ('abierto','por_cobrar','cerrado','cancelado')),
  -- de la resta de estas dos horas sale la permanencia del cliente
  abierto_por uuid not null references empleados(id),
  abierto_en timestamptz not null default now(),
  cerrado_por uuid references empleados(id),
  cerrado_en timestamptz,
  subtotal numeric(12,2) not null default 0,
  descuento numeric(12,2) not null default 0 check (descuento >= 0),
  promocion_id uuid references promociones(id),
  descuento_motivo text,
  descuento_autorizado_por uuid references empleados(id),
  total numeric(12,2) not null default 0,
  propina numeric(12,2) not null default 0 check (propina >= 0),
  notas text,
  check (cerrado_en is null or cerrado_en >= abierto_en)
);
create index tickets_abiertos_idx on tickets (sucursal_id, estado) where estado <> 'cerrado';
create index tickets_fecha_idx on tickets (sucursal_id, abierto_en);

-- Una cuenta puede ocupar varios bancos, y puede cambiarse de lugar
create table ticket_bancos (
  ticket_id uuid not null references tickets(id) on delete cascade,
  banco_id uuid not null references bancos(id) on delete restrict,
  desde timestamptz not null default now(),
  hasta timestamptz,
  primary key (ticket_id, banco_id, desde)
);

create table ticket_lineas (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  presentacion_id uuid not null references presentaciones(id) on delete restrict,
  cantidad numeric(10,2) not null default 1 check (cantidad > 0),
  -- precio y costo se COPIAN al momento de la venta.
  -- Si mañana sube el vino, la utilidad de ayer no cambia.
  precio_unitario numeric(12,2) not null,
  costo_unitario numeric(12,2) not null default 0,
  -- de qué botella destapada salió esta copa
  botella_abierta_id uuid references botellas_abiertas(id),
  estado text not null default 'activa' check (estado in ('activa','cancelada')),
  notas text,
  creado_por uuid not null references empleados(id),
  creado_en timestamptz not null default now()
);
create index ticket_lineas_ticket_idx on ticket_lineas (ticket_id);

-- Un helado de 2 bolas es UNA línea pero DOS descuentos de inventario
create table linea_sabores (
  id uuid primary key default gen_random_uuid(),
  linea_id uuid not null references ticket_lineas(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete restrict,
  litros numeric(10,4) not null check (litros > 0)
);

-- El 17% de sus tickets se paga en partes. No es raro, es lo normal.
create table pagos (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  metodo text not null check (metodo in ('efectivo','tarjeta')),
  monto numeric(12,2) not null check (monto > 0),
  terminal text,
  referencia text,
  cobrado_por uuid not null references empleados(id),
  cobrado_en timestamptz not null default now()
);
create index pagos_ticket_idx on pagos (ticket_id);

-- Nada se borra. Cancelar es AGREGAR un registro, no quitar uno.
create table cancelaciones (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  linea_id uuid references ticket_lineas(id) on delete cascade,
  cantidad numeric(10,2),
  motivo text not null,
  solicitado_por uuid not null references empleados(id),
  autorizado_por uuid not null references empleados(id),
  creado_en timestamptz not null default now()
);

-- Dinero que se regresa DESPUÉS de haber cobrado
create table devoluciones (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete restrict,
  linea_id uuid references ticket_lineas(id),
  monto numeric(12,2) not null check (monto > 0),
  metodo text not null check (metodo in ('efectivo','tarjeta')),
  -- si es true, el producto regresa al inventario
  regresa_a_inventario boolean not null default true,
  motivo text not null,
  autorizado_por uuid not null references empleados(id),
  creado_en timestamptz not null default now()
);

alter table tickets       enable row level security;
alter table ticket_bancos enable row level security;
alter table ticket_lineas enable row level security;
alter table linea_sabores enable row level security;
alter table pagos         enable row level security;
alter table cancelaciones enable row level security;
alter table devoluciones  enable row level security;;
