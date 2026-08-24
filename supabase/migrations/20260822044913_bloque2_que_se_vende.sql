-- Puerta 89 · Bloque 2: qué se vende
create table categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden int not null default 0,
  activa boolean not null default true
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references categorias(id) on delete restrict,
  nombre text not null,
  -- solo para vinos: sirve para agrupar en la pantalla del mesero
  tipo_vino text check (tipo_vino in ('tinto','blanco','rosado','naranja')),
  -- la unidad en la que se cuenta el inventario de este producto
  unidad_base text not null default 'pieza'
    check (unidad_base in ('botella','litro','pieza')),
  -- true para el merch: cada talla se cuenta por separado
  inventario_por_presentacion boolean not null default false,
  es_sabor_helado boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (categoria_id, nombre)
);
comment on column productos.unidad_base is 'Vino en botellas, helado en litros, lo demás en piezas.';

create table presentaciones (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  nombre text not null,
  orden int not null default 0,
  -- medio litro y litro de helado, y el merch
  es_para_llevar boolean not null default false,
  -- cuánto consume de la unidad base. 1 botella = 1, medio litro = 0.5
  factor_consumo numeric(10,4),
  -- cuando el consumo depende de la sucursal: 'copa' usa copas_por_botella,
  -- 'bola' usa bolas_por_litro. Si es null, manda factor_consumo.
  consumo_derivado text check (consumo_derivado in ('copa','bola')),
  activa boolean not null default true,
  unique (producto_id, nombre),
  check (factor_consumo is not null or consumo_derivado is not null)
);

-- Precio y costo POR SUCURSAL, con historia. Puebla y CDMX cobran distinto.
create table precios (
  id uuid primary key default gen_random_uuid(),
  presentacion_id uuid not null references presentaciones(id) on delete cascade,
  sucursal_id uuid not null references sucursales(id) on delete cascade,
  precio numeric(12,2) not null check (precio >= 0),
  costo numeric(12,2) not null default 0 check (costo >= 0),
  vigente_desde timestamptz not null default now(),
  vigente_hasta timestamptz
);
create unique index precios_vigente_idx
  on precios (presentacion_id, sucursal_id) where vigente_hasta is null;

-- El corazón del control del vino: qué está destapado ahorita
create table botellas_abiertas (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete restrict,
  copas_totales int not null check (copas_totales > 0),
  copas_restantes numeric(6,2) not null check (copas_restantes >= 0),
  costo_botella numeric(12,2) not null,
  abierta_por uuid references empleados(id),
  abierta_en timestamptz not null default now(),
  cerrada_en timestamptz,
  motivo_cierre text check (motivo_cierre in ('agotada','merma','ajuste')),
  check (copas_restantes <= copas_totales)
);
create index botellas_abiertas_activas_idx
  on botellas_abiertas (sucursal_id, producto_id) where cerrada_en is null;

create table promociones (
  id uuid primary key default gen_random_uuid(),
  -- null = aplica en las dos sucursales
  sucursal_id uuid references sucursales(id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('porcentaje','monto','cortesia')),
  valor numeric(12,2) not null default 0 check (valor >= 0),
  vigente_desde date,
  vigente_hasta date,
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

create table proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  contacto text,
  telefono text,
  correo text,
  notas text,
  activo boolean not null default true
);

alter table categorias        enable row level security;
alter table productos         enable row level security;
alter table presentaciones    enable row level security;
alter table precios           enable row level security;
alter table botellas_abiertas enable row level security;
alter table promociones       enable row level security;
alter table proveedores       enable row level security;;
