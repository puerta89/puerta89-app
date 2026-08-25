"use server";

import { revalidatePath } from "next/cache";
import { supabaseServidor } from "@/lib/supabase/server";
import { leerSesion } from "@/lib/sesion";

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

export type Diferencia = {
  nombre: string;
  esperaba: number;
  habia: number;
  diferencia: number;
};

export async function registrarConteo(
  codigo: string,
  items: { producto_id: string | null; presentacion_id: string | null; contado: number }[],
): Promise<{ error: string } | { diferencias: Diferencia[] }> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };
  if (!/^\d{4}$/.test(codigo)) return { error: "El código son 4 números." };
  if (items.length === 0) return { error: "No contaste nada." };

  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("registrar_conteo", {
    p_empleado: sesion.empleadoId,
    p_codigo: codigo,
    p_items: items,
  });
  if (error) return { error: error.message };
  revalidatePath("/inventario");
  return {
    diferencias: (data ?? []).map((r: Record<string, unknown>) => ({
      nombre: r.nombre as string,
      esperaba: Number(r.esperaba),
      habia: Number(r.habia),
      diferencia: Number(r.diferencia),
    })),
  };
}
