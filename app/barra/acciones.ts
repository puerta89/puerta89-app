"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";
import { leerSesion, abrirSesion } from "@/lib/sesion";

export type ResultadoAbrir = { error: string } | { ticketId: string };

export async function abrirCuenta(
  empleadoId: string,
  bancos: string[],
  personas: number,
): Promise<ResultadoAbrir> {
  const sesion = await leerSesion();
  // El id que manda el navegador no es de fiar: mandamos el de la sesión.
  if (!sesion || sesion.empleadoId !== empleadoId) {
    return { error: "Tu sesión ya venció. Vuelve a entrar con tu código." };
  }

  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("abrir_cuenta", {
    p_empleado: sesion.empleadoId,
    p_bancos: bancos,
    p_personas: personas,
  });

  if (error) {
    console.error("Error al abrir la cuenta:", error.message);
    return { error: error.message };
  }

  revalidatePath("/barra");
  return { ticketId: data as string };
}

/** Solo para quien tiene puede_cambiar_sucursal (hoy nada más Iram):
 * mueve la sesión completa a otra sucursal, sin tener que salir y
 * volver a entrar con un código distinto. */
export async function cambiarSucursal(sucursalId: string): Promise<{ error: string } | null> {
  const sesion = await leerSesion();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar con tu código." };
  if (!sesion.puedeCambiarSucursal) {
    return { error: "No puedes cambiar de sucursal." };
  }

  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("cambiar_sucursal", {
    p_empleado: sesion.empleadoId,
    p_sucursal: sucursalId,
  });
  if (error) return { error: error.message };

  const nueva = data?.[0];
  if (!nueva) return { error: "Esa sucursal no existe." };

  await abrirSesion({
    empleadoId: sesion.empleadoId,
    nombre: sesion.nombre,
    rol: sesion.rol,
    sucursalId: nueva.sucursal_id,
    sucursalNombre: nueva.sucursal_nombre,
    sucursalColor: nueva.sucursal_color,
    sucursalColorTexto: nueva.sucursal_color_texto,
    puedeCambiarSucursal: sesion.puedeCambiarSucursal,
  });

  redirect("/barra");
}
