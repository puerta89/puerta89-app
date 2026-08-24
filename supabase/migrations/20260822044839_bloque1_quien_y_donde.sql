-- Puerta 89 · Bloque 1: quién y dónde
create extension if not exists pgcrypto with schema extensions;

create table sucursales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  ciudad text not null,
  -- color de identificación en pantalla, para que no se confundan de plaza
  color text not null default '#781727',
  -- 'rapido' = el mesero pica el tipo y luego la botella abierta (Puebla)
  -- 'desglosado' = el mesero pica directo la etiqueta (CDMX)
  modo_venta_vino text not null default 'rapido'
    check (modo_venta_vino in ('rapido','desglosado')),
  -- CDMX necesita más días porque el surtido tarda en llegar
  dias_anticipacion_pedido int not null default 3 check (dias_anticipacion_pedido >= 0),
  -- ajustables por el dueño sin tocar código
  bolas_por_litro numeric(5,2) not null default 7.5 check (bolas_por_litro > 0),
  copas_por_botella int not null default 6 check (copas_por_botella > 0),
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);
comment on table sucursales is 'Puebla y CDMX. Cada una con sus precios, su inventario y sus reglas.';

create table empleados (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id) on delete restrict,
  nombre text not null,
  rol text not null check (rol in ('dueno','gerente','mesero')),
  -- el código de 4 dígitos NUNCA se guarda en texto, solo su huella cifrada
  codigo_hash text not null,
  -- solo el dueño puede moverse entre sucursales
  puede_cambiar_sucursal boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
comment on column empleados.codigo_hash is 'Hash bcrypt del PIN. La unicidad del PIN se valida en la app al darlo de alta.';
create index empleados_sucursal_idx on empleados (sucursal_id) where activo;

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  correo text,
  notas text,
  creado_en timestamptz not null default now()
);

create table zonas (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id) on delete cascade,
  nombre text not null,
  orden int not null default 0,
  unique (sucursal_id, nombre)
);

create table bancos (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id) on delete cascade,
  zona_id uuid not null references zonas(id) on delete cascade,
  numero int not null,
  -- posición en el plano, para dibujar el mapa sin tocar código
  pos_x numeric(7,2),
  pos_y numeric(7,2),
  activo boolean not null default true,
  unique (sucursal_id, numero)
);

alter table sucursales enable row level security;
alter table empleados  enable row level security;
alter table clientes   enable row level security;
alter table zonas      enable row level security;
alter table bancos     enable row level security;;
