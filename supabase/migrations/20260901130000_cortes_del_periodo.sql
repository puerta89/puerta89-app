-- Mercedes, sobre la nueva pantalla /tickets: "que se puedan seleccionar un
-- rango de fechas... y hasta abajo del día en cuanto cerró la caja. porque
-- actualmente no pueden ver en cuánto quedó la caja del día anterior o
-- cuánto es de propinas en efectivo".
--
-- resumen_del_dia (bloque4_dinero_del_dia) ya hace esto para UN solo día;
-- esta función es su versión "de rango": una fila por cada día entre
-- p_desde y p_hasta (con generate_series, para que salgan también los días
-- donde nunca se abrió un corte), con lo mismo que se ve en /corte al
-- cerrar: cuánto se esperaba, cuánto se contó, el sobrante/faltante, y las
-- dos propinas (efectivo y tarjeta) por separado.
--
-- El efectivo_esperado se recalcula EN VIVO (igual que resumen_del_dia) en
-- vez de solo leer la columna congelada de "cortes" — esa columna solo se
-- llena al cerrar, así que un día todavía abierto saldría en $0 si no se
-- recalculara. Lo contado/sobrante/propinas sí son los valores congelados
-- de verdad (lo que alguien capturó a mano al cerrar) — esos no se pueden
-- inventar para un día que sigue abierto.
create or replace function public.cortes_del_periodo(p_sucursal uuid, p_desde date, p_hasta date)
returns table(
  fecha date,
  estado text,
  fondo_inicial numeric,
  ventas_efectivo numeric,
  ventas_tarjeta numeric,
  entradas numeric,
  salidas numeric,
  efectivo_esperado numeric,
  efectivo_contado numeric,
  sobrante numeric,
  propina_efectivo numeric,
  propina_tarjeta numeric,
  propina_total numeric,
  cerrado_por text
)
language sql security definer set search_path = public as $$
  with dias as (
    select generate_series(p_desde, p_hasta, interval '1 day')::date as fecha
  ),
  c as (
    select * from cortes where sucursal_id = p_sucursal and fecha between p_desde and p_hasta
  ),
  v as (
    select
      (t.cerrado_en at time zone 'America/Mexico_City')::date as fecha,
      coalesce(sum(pg.monto) filter (where pg.metodo = 'efectivo'), 0) as efec,
      coalesce(sum(pg.monto) filter (where pg.metodo = 'tarjeta'), 0) as tarj
    from tickets t
    join pagos pg on pg.ticket_id = t.id
    where t.sucursal_id = p_sucursal
      and t.estado = 'cerrado'
      and (t.cerrado_en at time zone 'America/Mexico_City')::date between p_desde and p_hasta
    group by 1
  ),
  m as (
    select c.fecha,
      coalesce(sum(mc.monto) filter (where mc.tipo = 'entrada'), 0) as ent,
      coalesce(sum(mc.monto) filter (where mc.tipo = 'salida'), 0) as sal
    from c join movimientos_caja mc on mc.corte_id = c.id
    group by c.fecha
  )
  select
    d.fecha,
    coalesce(c.estado, 'sin_abrir'),
    coalesce(c.fondo_inicial, 0),
    coalesce(v.efec, 0),
    coalesce(v.tarj, 0),
    coalesce(m.ent, 0),
    coalesce(m.sal, 0),
    coalesce(c.fondo_inicial, 0) + coalesce(v.efec, 0) + coalesce(m.ent, 0) - coalesce(m.sal, 0),
    -- efectivo_contado/sobrante/propinas son columnas "not null default 0"
    -- (o generadas a partir de esas) en `cortes`, así que sin este filtro
    -- un corte que sigue ABIERTO saldría con sobrante/propina en $0 (o
    -- hasta negativo) en vez de "todavía no se sabe" — se fuerza a null
    -- hasta que de verdad se cierra.
    case when c.estado = 'cerrado' then c.efectivo_contado end,
    case when c.estado = 'cerrado' then c.sobrante end,
    case when c.estado = 'cerrado' then c.propina_efectivo end,
    case when c.estado = 'cerrado' then c.propina_tarjeta end,
    case when c.estado = 'cerrado' then c.propina_total end,
    e.nombre
  from dias d
  left join c on c.fecha = d.fecha
  left join v on v.fecha = d.fecha
  left join m on m.fecha = d.fecha
  left join empleados e on e.id = c.cerrado_por
  order by d.fecha;
$$;

revoke execute on function public.cortes_del_periodo(uuid, date, date) from public, anon, authenticated;
grant execute on function public.cortes_del_periodo(uuid, date, date) to service_role, postgres;
