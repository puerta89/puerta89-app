-- Puerta 89 · Bloque 4: el dinero del día
create table cortes (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id) on delete restrict,
  fecha date not null,
  fondo_inicial numeric(12,2) not null default 0,
  -- lo que el sistema calcula que debería haber
  ventas_efectivo numeric(12,2) not null default 0,
  ventas_tarjeta numeric(12,2) not null default 0,
  entradas_efectivo numeric(12,2) not null default 0,
  salidas_efectivo numeric(12,2) not null default 0,
  efectivo_esperado numeric(12,2) not null default 0,
  -- lo que de verdad se contó
  efectivo_contado numeric(12,2),
  -- se muestran POR SEPARADO a propósito: si el sobrante se dispara un día,
  -- el dueño lo tiene que ver, no se puede esconder dentro de la propina
  sobrante numeric(12,2) generated always as (
    coalesce(efectivo_contado,0) - efectivo_esperado
  ) stored,
  propina_efectivo numeric(12,2) not null default 0 check (propina_efectivo >= 0),
  propina_tarjeta numeric(12,2) not null default 0 check (propina_tarjeta >= 0),
  propina_total numeric(12,2) generated always as (
    propina_efectivo + propina_tarjeta
  ) stored,
  meseros_en_turno int not null default 1 check (meseros_en_turno > 0),
  estado text not null default 'abierto' check (estado in ('abierto','cerrado')),
  abierto_por uuid references empleados(id),
  abierto_en timestamptz not null default now(),
  cerrado_por uuid references empleados(id),
  cerrado_en timestamptz,
  notas text,
  unique (sucursal_id, fecha)
);
comment on column cortes.propina_efectivo is 'Al cierre arranca igual al sobrante, pero el dueño lo puede ajustar.';

create table corte_propinas (
  id uuid primary key default gen_random_uuid(),
  corte_id uuid not null references cortes(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete restrict,
  monto numeric(12,2) not null check (monto >= 0),
  unique (corte_id, empleado_id)
);

alter table cortes         enable row level security;
alter table corte_propinas enable row level security;;
