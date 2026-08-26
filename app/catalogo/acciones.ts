"use server";

import { revalidatePath } from "next/cache";
import { supabaseServidor } from "@/lib/supabase/server";
import { leerSesion } from "@/lib/sesion";

type Falla = { error: string } | null;

async function jefe() {
  const sesion = await leerSesion();
  if (!sesion) return { falla: "Tu sesión venció. Vuelve a entrar con tu código." };
  if (sesion.rol === "mesero") return { falla: "Esto solo lo puede hacer el dueño o el gerente." };
  return { sesion };
}

export async function crearVino(
  nombre: string,
  tipoVino: string,
  costoBotella: number,
): Promise<Falla> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("catalogo_crear_vino", {
    p_empleado: sesion.empleadoId,
    p_nombre: nombre,
    p_tipo_vino: tipoVino,
    p_costo_botella: costoBotella,
  });
  if (error) return { error: error.message };
  revalidatePath("/catalogo");
  return null;
}

export async function crearSaborHelado(
  nombre: string,
  costoBote: number,
): Promise<Falla> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("catalogo_crear_sabor_helado", {
    p_empleado: sesion.empleadoId,
    p_nombre: nombre,
    p_costo_bote: costoBote,
  });
  if (error) return { error: error.message };
  revalidatePath("/catalogo");
  return null;
}

export type IngredienteReceta =
  | { insumo_id: string; cantidad: number }
  | { insumo_nombre: string; insumo_unidad: string; cantidad: number };

export async function crearSimple(
  nombre: string,
  categoriaId: string,
  precio: number,
  costo: number,
  ingredientes: IngredienteReceta[] = [],
): Promise<Falla> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("catalogo_crear_simple", {
    p_empleado: sesion.empleadoId,
    p_nombre: nombre,
    p_categoria_id: categoriaId,
    p_precio: precio,
    p_costo: costo,
    p_ingredientes: ingredientes,
  });
  if (error) return { error: error.message };
  revalidatePath("/catalogo");
  revalidatePath("/inventario");
  return null;
}

export async function cambiarPrecio(
  presentacionId: string,
  precio: number,
  costo: number,
): Promise<Falla> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("catalogo_cambiar_precio", {
    p_empleado: sesion.empleadoId,
    p_presentacion: presentacionId,
    p_precio: precio,
    p_costo: costo,
  });
  if (error) return { error: error.message };
  revalidatePath("/catalogo");
  revalidatePath("/inventario");
  return null;
}
