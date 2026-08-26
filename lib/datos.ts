import { supabaseServidor } from "@/lib/supabase/server";

export type CuentaEnBanco = {
  ticket_id: string;
  estado: "abierto" | "por_cobrar";
  abierto_en: string;
  personas: number;
  mesero: string;
};

/** Un banco puede tener más de una cuenta: pidieron juntos y pagan separado. */
export type BancoDelMapa = {
  banco_id: string;
  numero: number;
  pos_x: number;
  pos_y: number;
  cuentas: CuentaEnBanco[];
};

export type ZonaDelMapa = {
  id: string;
  nombre: string;
  bancos: BancoDelMapa[];
};

type Renglon = {
  zona_id: string;
  zona_nombre: string;
  zona_orden: number;
  banco_id: string;
  numero: number;
  pos_x: number;
  pos_y: number;
  ticket_id: string | null;
  ticket_estado: "abierto" | "por_cobrar" | null;
  abierto_en: string | null;
  personas: number | null;
  mesero: string | null;
};

/** Trae el mapa de la barra ya agrupado por zona. */
export async function traerMapa(sucursalId: string): Promise<ZonaDelMapa[]> {
  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("mapa_barra", {
    p_sucursal: sucursalId,
  });

  if (error) throw new Error(`No se pudo leer el mapa: ${error.message}`);

  const zonas = new Map<string, ZonaDelMapa>();
  const bancos = new Map<string, BancoDelMapa>();

  for (const r of (data ?? []) as Renglon[]) {
    if (!zonas.has(r.zona_id)) {
      zonas.set(r.zona_id, { id: r.zona_id, nombre: r.zona_nombre, bancos: [] });
    }
    // La consulta trae un renglón por cada cuenta, así que un banco con dos
    // cuentas viene dos veces. Aquí se juntan.
    if (!bancos.has(r.banco_id)) {
      const banco: BancoDelMapa = {
        banco_id: r.banco_id,
        numero: r.numero,
        pos_x: Number(r.pos_x),
        pos_y: Number(r.pos_y),
        cuentas: [],
      };
      bancos.set(r.banco_id, banco);
      zonas.get(r.zona_id)!.bancos.push(banco);
    }
    if (r.ticket_id && r.ticket_estado && r.abierto_en) {
      bancos.get(r.banco_id)!.cuentas.push({
        ticket_id: r.ticket_id,
        estado: r.ticket_estado,
        abierto_en: r.abierto_en,
        personas: r.personas ?? 1,
        mesero: r.mesero ?? "",
      });
    }
  }

  return [...zonas.values()];
}

export type ItemCatalogo = {
  categoria: string;
  producto_id: string;
  producto: string;
  tipo_vino: string | null;
  es_sabor_helado: boolean;
  presentacion_id: string;
  presentacion: string;
  precio: number;
  consumo_derivado: "copa" | "bola" | null;
  factor_consumo: number;
  es_para_llevar: boolean;
};

export type Botella = {
  botella_id: string;
  producto_id: string;
  etiqueta: string;
  tipo_vino: string;
  copas_restantes: number;
  costo_botella: number;
};

export type LineaTicket = {
  linea_id: string;
  producto: string;
  presentacion: string;
  etiqueta: string | null;
  sabores: string | null;
  cantidad: number;
  precio_unitario: number;
  importe: number;
  creado_en: string;
};

export async function traerCatalogo(sucursalId: string) {
  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("catalogo", {
    p_sucursal: sucursalId,
  });
  if (error) throw new Error(`No se pudo leer el menú: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    precio: Number(r.precio),
    factor_consumo: Number(r.factor_consumo),
  })) as ItemCatalogo[];
}

export async function traerBotellas(sucursalId: string) {
  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("botellas_de", {
    p_sucursal: sucursalId,
  });
  if (error) throw new Error(`No se pudieron leer las botellas: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    copas_restantes: Number(r.copas_restantes),
    costo_botella: Number(r.costo_botella),
  })) as Botella[];
}

export async function traerLineas(ticketId: string) {
  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("ticket_detalle", {
    p_ticket: ticketId,
  });
  if (error) throw new Error(`No se pudo leer la cuenta: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    cantidad: Number(r.cantidad),
    precio_unitario: Number(r.precio_unitario),
    importe: Number(r.importe),
  })) as LineaTicket[];
}

export type Pago = {
  pago_id: string;
  metodo: "efectivo" | "tarjeta";
  monto: number;
  cobrado_en: string;
};

export async function traerPagos(ticketId: string) {
  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("pagos_de", { p_ticket: ticketId });
  if (error) throw new Error(`No se pudieron leer los pagos: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    monto: Number(r.monto),
  })) as Pago[];
}

export type ResumenDia = {
  corte_id: string;
  estado: "abierto" | "cerrado";
  fondo_inicial: number;
  ventas_efectivo: number;
  ventas_tarjeta: number;
  entradas: number;
  salidas: number;
  efectivo_esperado: number;
  tickets: number;
  propina_tarjeta: number;
  efectivo_contado: number | null;
};

export type Empleado = { empleado_id: string; nombre: string; rol: string };
export type MovimientoCaja = {
  id: string;
  tipo: "entrada" | "salida";
  monto: number;
  concepto: string;
};

const aNumero = (r: Record<string, unknown>, campos: string[]) => {
  const copia: Record<string, unknown> = { ...r };
  for (const c of campos) if (copia[c] !== null) copia[c] = Number(copia[c]);
  return copia;
};

export async function traerResumenDia(sucursalId: string, fecha: string) {
  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("resumen_del_dia", {
    p_sucursal: sucursalId,
    p_fecha: fecha,
  });
  if (error) throw new Error(`No se pudo leer el corte: ${error.message}`);
  const r = data?.[0];
  if (!r) return null;
  return aNumero(r, [
    "fondo_inicial",
    "ventas_efectivo",
    "ventas_tarjeta",
    "entradas",
    "salidas",
    "efectivo_esperado",
    "propina_tarjeta",
    "efectivo_contado",
  ]) as ResumenDia;
}

export async function traerEmpleados(sucursalId: string) {
  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("empleados_de", {
    p_sucursal: sucursalId,
  });
  if (error) throw new Error(`No se pudo leer el equipo: ${error.message}`);
  return (data ?? []) as Empleado[];
}

export async function traerMeserosDelDia(sucursalId: string, fecha: string) {
  const supabase = supabaseServidor();
  const { data } = await supabase.rpc("meseros_del_dia", {
    p_sucursal: sucursalId,
    p_fecha: fecha,
  });
  return (data ?? []) as (Empleado & { tickets: number })[];
}

export async function traerMovimientosCaja(corteId: string) {
  const supabase = supabaseServidor();
  const { data } = await supabase.rpc("movimientos_caja_de", { p_corte: corteId });
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    monto: Number(r.monto),
  })) as MovimientoCaja[];
}

export async function traerPropinasCorte(corteId: string) {
  const supabase = supabaseServidor();
  const { data } = await supabase.rpc("propinas_del_corte", { p_corte: corteId });
  return (data ?? []).map((r: Record<string, unknown>) => ({
    nombre: r.nombre as string,
    monto: Number(r.monto),
  }));
}

/** La fecha de hoy en México, no la del servidor. */
export function hoyEnMexico() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
  }).format(new Date());
}

export type ItemInventario = {
  producto_id: string | null;
  presentacion_id: string | null;
  nombre: string;
  categoria: string;
  unidad: string;
  cantidad: number;
  minimo: number;
  costo_promedio: number;
  costo_catalogo: number;
  consumo_dia: number;
  dias_restantes: number | null;
  sugerido: number;
  activo: boolean;
  // Si otros productos consumen de este (ej. "Café en grano" lo consumen
  // Americano/Espresso/Capuccino): con lo que hay ahora, para cuántas
  // unidades de esos alcanza; cuántas rinde UNA unidad de este insumo
  // (lo que se configura); y sus nombres.
  alcanza_unidades: number | null;
  rinde_configurado: number | null;
  vinculados: string | null;
};

export async function traerInventario(sucursalId: string) {
  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("items_inventario", {
    p_sucursal: sucursalId,
  });
  if (error) throw new Error(`No se pudo leer el inventario: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    cantidad: Number(r.cantidad),
    minimo: Number(r.minimo),
    costo_promedio: Number(r.costo_promedio),
    costo_catalogo: Number(r.costo_catalogo),
    consumo_dia: Number(r.consumo_dia),
    dias_restantes: r.dias_restantes === null ? null : Number(r.dias_restantes),
    sugerido: Number(r.sugerido),
    alcanza_unidades: r.alcanza_unidades === null ? null : Number(r.alcanza_unidades),
    rinde_configurado: r.rinde_configurado === null ? null : Number(r.rinde_configurado),
  })) as ItemInventario[];
}

export async function traerProveedores() {
  const supabase = supabaseServidor();
  const { data } = await supabase.rpc("proveedores_de");
  return (data ?? []) as { id: string; nombre: string }[];
}

export type PanelResumen = {
  ventas: number; costo: number; utilidad_bruta: number; margen: number;
  tickets: number; ticket_promedio: number; permanencia_min: number;
  efectivo: number; tarjeta: number; propinas: number;
  descuentos: number; cancelado: number; mermas: number;
  gastos: number; utilidad_real: number;
};
export type Desglose = { etiqueta: string; venta: number; utilidad: number; unidades: number };
export type BancoPanel = { banco: number; zona: string; cuentas: number; venta: number; permanencia_min: number };
export type SucursalPanel = { sucursal: string; color: string; ventas: number; utilidad: number; tickets: number; ticket_promedio: number };
export type Gasto = { id: string; fecha: string; categoria: string; concepto: string; monto: number; recurrente: boolean };

const num = (r: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(r).map(([k, v]) =>
      typeof v === "string" && v !== "" && !Number.isNaN(Number(v)) ? [k, Number(v)] : [k, v],
    ),
  );

export async function traerPanel(sucursalId: string, desde: string, hasta: string) {
  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("panel_resumen", {
    p_sucursal: sucursalId, p_desde: desde, p_hasta: hasta,
  });
  if (error) throw new Error(`No se pudo leer el panel: ${error.message}`);
  return num(data?.[0] ?? {}) as unknown as PanelResumen;
}

export async function traerDesglose(
  sucursalId: string, desde: string, hasta: string,
  por: "categoria" | "producto" | "mesero" | "hora",
) {
  const supabase = supabaseServidor();
  const { data } = await supabase.rpc("panel_desglose", {
    p_sucursal: sucursalId, p_desde: desde, p_hasta: hasta, p_por: por,
  });
  return (data ?? []).map((r: Record<string, unknown>) => num(r)) as unknown as Desglose[];
}

export async function traerBancosPanel(sucursalId: string, desde: string, hasta: string) {
  const supabase = supabaseServidor();
  const { data } = await supabase.rpc("panel_bancos", {
    p_sucursal: sucursalId, p_desde: desde, p_hasta: hasta,
  });
  return (data ?? []).map((r: Record<string, unknown>) => num(r)) as unknown as BancoPanel[];
}

export async function traerSucursalesPanel(desde: string, hasta: string) {
  const supabase = supabaseServidor();
  const { data } = await supabase.rpc("panel_sucursales", { p_desde: desde, p_hasta: hasta });
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...num(r), color: r.color as string, sucursal: r.sucursal as string,
  })) as unknown as SucursalPanel[];
}

export async function traerGastos(sucursalId: string, desde: string, hasta: string) {
  const supabase = supabaseServidor();
  const { data } = await supabase.rpc("gastos_de", {
    p_sucursal: sucursalId, p_desde: desde, p_hasta: hasta,
  });
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...r, monto: Number(r.monto),
  })) as Gasto[];
}

// Una fila por día + artículo, con el mismo formato que el reporte
// "Ventas por artículo" de Loyverse — para que Iram pueda usar esta
// descarga igual que ya usa ese export (pegarlo en su propio Excel).
export type VentaLinea = {
  fecha: string;
  articulo: string;
  categoria: string;
  cantidad: number;
  ventas_brutas: number;
  ventas_netas: number;
  costo: number;
  beneficio_bruto: number;
  margen: number;
};

export async function traerVentasLineas(sucursalId: string, desde: string, hasta: string) {
  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("panel_ventas_lineas", {
    p_sucursal: sucursalId, p_desde: desde, p_hasta: hasta,
  });
  if (error) throw new Error(`No se pudo leer las ventas por artículo: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => num(r)) as unknown as VentaLinea[];
}

export type Categoria = { id: string; nombre: string };

export async function traerCategorias() {
  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("categorias_de");
  if (error) throw new Error(`No se pudieron leer las categorías: ${error.message}`);
  return (data ?? []) as Categoria[];
}

export type Insumo = { id: string; nombre: string; categoria: string; unidad_base: string };

export async function traerInsumos() {
  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("insumos_de");
  if (error) throw new Error(`No se pudieron leer los insumos: ${error.message}`);
  return (data ?? []) as Insumo[];
}

/** Rango de fechas en México para los últimos N días. */
export function rango(dias: number) {
  const hasta = hoyEnMexico();
  const d = new Date(hasta + "T12:00:00");
  d.setDate(d.getDate() - (dias - 1));
  return { desde: d.toISOString().slice(0, 10), hasta };
}

export type MiembroEquipo = {
  empleado_id: string;
  nombre: string;
  rol: "dueno" | "gerente" | "mesero";
  activo: boolean;
  cuentas_abiertas: number;
  desde: string;
};

export async function traerEquipo(sucursalId: string) {
  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("equipo_de", { p_sucursal: sucursalId });
  if (error) throw new Error(`No se pudo leer el equipo: ${error.message}`);
  return (data ?? []) as MiembroEquipo[];
}

export type MesPanel = {
  mes: string;
  ventas: number;
  utilidad: number;
  tickets: number;
  ticket_promedio: number;
};

export async function traerMeses(sucursalId: string) {
  const supabase = supabaseServidor();
  const { data } = await supabase.rpc("panel_meses", { p_sucursal: sucursalId });
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    ventas: Number(r.ventas),
    utilidad: Number(r.utilidad),
    ticket_promedio: Number(r.ticket_promedio),
  })) as MesPanel[];
}

export type MesGrupo = { mes: string; grupo: string; ventas: number };

export async function traerMesesGrupo(sucursalId: string) {
  const supabase = supabaseServidor();
  const { data } = await supabase.rpc("panel_meses_grupo", { p_sucursal: sucursalId });
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    ventas: Number(r.ventas),
  })) as MesGrupo[];
}
