"use server";

import { revalidatePath } from "next/cache";
import { supabaseServidor } from "@/lib/supabase/server";
import { leerSesion } from "@/lib/sesion";
import { traerHistorialItem, type MovimientoItem } from "@/lib/datos";

type Falla = { error: string } | null;

async function jefe() {
  const sesion = await leerSesion();
  if (!sesion) return { falla: "Tu sesión venció. Vuelve a entrar con tu código." };
  if (sesion.rol === "mesero") return { falla: "Esto solo lo puede hacer el dueño." };
  return { sesion };
}

export async function fijarMinimo(
  productoId: string | null,
  presentacionId: string | null,
  minimo: number,
): Promise<Falla> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("fijar_minimo", {
    p_empleado: sesion.empleadoId,
    p_producto: productoId,
    p_presentacion: presentacionId,
    p_minimo: minimo,
  });
  if (error) return { error: error.message };
  revalidatePath("/inventario");
  return null;
}

export async function registrarMerma(
  codigo: string,
  productoId: string | null,
  presentacionId: string | null,
  cantidad: number,
  motivo: string,
): Promise<Falla> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };
  if (!/^\d{4}$/.test(codigo)) return { error: "El código son 4 números." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("registrar_merma", {
    p_empleado: sesion.empleadoId,
    p_codigo: codigo,
    p_producto: productoId,
    p_presentacion: presentacionId,
    p_cantidad: cantidad,
    p_motivo: motivo,
  });
  if (error) return { error: error.message };
  revalidatePath("/inventario");
  return null;
}

export type LineaCompra = {
  producto_id: string | null;
  presentacion_id: string | null;
  cantidad: number;
  costo_unitario: number;
};

export async function registrarCompra(
  proveedorId: string | null,
  fecha: string,
  folio: string,
  lineas: LineaCompra[],
): Promise<Falla> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };
  if (lineas.length === 0) return { error: "La compra no trae nada." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("registrar_compra", {
    p_empleado: sesion.empleadoId,
    p_proveedor: proveedorId,
    p_fecha: fecha,
    p_folio: folio,
    p_lineas: lineas,
  });
  if (error) return { error: error.message };
  revalidatePath("/inventario");
  return null;
}

export async function cambiarActivo(productoId: string, activo: boolean): Promise<Falla> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("cambiar_activo_producto", {
    p_empleado: sesion.empleadoId,
    p_producto: productoId,
    p_activo: activo,
  });
  if (error) return { error: error.message };
  revalidatePath("/inventario");
  return null;
}

/** Para un insumo compartido (ej. "Café en grano"): cuántas unidades
 * (cafés) rinde una unidad del insumo (una bolsa). Se aplica a todo lo
 * que consuma de ese insumo. */
export async function fijarRendimiento(insumoId: string, rinde: number): Promise<Falla> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("fijar_rendimiento_insumo", {
    p_empleado: sesion.empleadoId,
    p_insumo: insumoId,
    p_rinde: rinde,
  });
  if (error) return { error: error.message };
  revalidatePath("/inventario");
  return null;
}

export async function nuevoProveedor(nombre: string): Promise<Falla> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("guardar_proveedor", {
    p_empleado: sesion.empleadoId,
    p_nombre: nombre,
  });
  if (error) return { error: error.message };
  revalidatePath("/inventario/compra");
  return null;
}

/** Empieza el documento de conteo — desde aquí en adelante, cada número
 * que se escriba se guarda solo (ver guardarItemConteo). */
export async function crearConteo(): Promise<{ error: string } | { conteoId: string }> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };

  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("conteo_crear", {
    p_empleado: sesion.empleadoId,
  });
  if (error) return { error: error.message };
  revalidatePath("/inventario/conteo");
  return { conteoId: data as string };
}

/** Guarda lo contado de UN producto. Se llama solo, un ratito después de
 * que la persona deja de escribir — no hace falta picarle nada para que
 * quede guardado. Sin revalidatePath a propósito: se llama muy seguido
 * (cada vez que alguien deja de teclear) y no hace falta refrescar toda
 * la pantalla por cada uno. */
export async function guardarItemConteo(
  conteoId: string,
  productoId: string | null,
  presentacionId: string | null,
  contado: number,
): Promise<Falla> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("conteo_guardar_item", {
    p_empleado: sesion.empleadoId,
    p_conteo: conteoId,
    p_producto: productoId,
    p_presentacion: presentacionId,
    p_contado: contado,
  });
  if (error) return { error: error.message };
  return null;
}

export async function cancelarConteo(conteoId: string): Promise<Falla> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("conteo_cancelar", {
    p_empleado: sesion.empleadoId,
    p_conteo: conteoId,
  });
  if (error) return { error: error.message };
  revalidatePath("/inventario/conteo");
  return null;
}

export async function completarConteo(
  conteoId: string,
  codigo: string,
): Promise<{ error: string } | { diferencias: Diferencia[] }> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };
  if (!/^\d{4}$/.test(codigo)) return { error: "El código son 4 números." };

  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("conteo_completar", {
    p_empleado: sesion.empleadoId,
    p_conteo: conteoId,
    p_codigo: codigo,
  });
  if (error) return { error: error.message };
  revalidatePath("/inventario");
  revalidatePath("/inventario/conteo");
  return {
    diferencias: (data ?? []).map((r: Record<string, unknown>) => ({
      nombre: r.nombre as string,
      esperaba: Number(r.esperaba),
      habia: Number(r.habia),
      diferencia: Number(r.diferencia),
    })),
  };
}

export async function verHistorial(
  productoId: string | null,
  presentacionId: string | null,
): Promise<{ error: string } | { movimientos: MovimientoItem[] }> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };

  const movimientos = await traerHistorialItem(sesion.sucursalId, productoId, presentacionId);
  return { movimientos };
}

export type Diferencia = {
  nombre: string;
  esperaba: number;
  habia: number;
  diferencia: number;
};
