"use server";

import { revalidatePath } from "next/cache";
import { supabaseServidor } from "@/lib/supabase/server";
import { leerSesion } from "@/lib/sesion";

type Falla = { error: string } | null;

export async function agregarLinea(
  ticketId: string,
  presentacionId: string,
  cantidad: number,
  botellaId: string | null,
  sabores: string[] | null,
): Promise<Falla> {
  const sesion = await leerSesion();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar con tu código." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("agregar_linea", {
    p_empleado: sesion.empleadoId,
    p_ticket: ticketId,
    p_presentacion: presentacionId,
    p_cantidad: cantidad,
    p_botella: botellaId,
    p_sabores: sabores,
  });

  if (error) {
    console.error("Error al agregar a la cuenta:", error.message);
    return { error: error.message };
  }

  revalidatePath(`/cuenta/${ticketId}`);
  return null;
}

export async function abrirBotella(
  ticketId: string,
  productoId: string,
): Promise<Falla> {
  const sesion = await leerSesion();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar con tu código." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("abrir_botella", {
    p_empleado: sesion.empleadoId,
    p_producto: productoId,
  });

  if (error) {
    console.error("Error al abrir la botella:", error.message);
    return { error: error.message };
  }

  revalidatePath(`/cuenta/${ticketId}`);
  return null;
}
