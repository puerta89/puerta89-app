import { supabaseServidor } from "@/lib/supabase/server";

export type BancoDelMapa = {
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

export type ZonaDelMapa = {
  id: string;
  nombre: string;
  bancos: BancoDelMapa[];
};

type Renglon = BancoDelMapa & {
  zona_id: string;
  zona_nombre: string;
  zona_orden: number;
};

/** Trae el mapa de la barra ya agrupado por zona. */
export async function traerMapa(sucursalId: string): Promise<ZonaDelMapa[]> {
  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("mapa_barra", {
    p_sucursal: sucursalId,
  });

  if (error) throw new Error(`No se pudo leer el mapa: ${error.message}`);

  const zonas = new Map<string, ZonaDelMapa>();

  for (const r of (data ?? []) as Renglon[]) {
    if (!zonas.has(r.zona_id)) {
      zonas.set(r.zona_id, { id: r.zona_id, nombre: r.zona_nombre, bancos: [] });
    }
    zonas.get(r.zona_id)!.bancos.push({
      banco_id: r.banco_id,
      numero: r.numero,
      pos_x: Number(r.pos_x),
      pos_y: Number(r.pos_y),
      ticket_id: r.ticket_id,
      ticket_estado: r.ticket_estado,
      abierto_en: r.abierto_en,
      personas: r.personas,
      mesero: r.mesero,
    });
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
