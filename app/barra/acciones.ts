"use server";

import { revalidatePath } from "next/cache";
import { supabaseServidor } from "@/lib/supabase/server";
import { leerSesion } from "@/lib/sesion";

export async function abrirCuenta(
  empleadoId: string,
  bancos: string[],
  personas: number,
) {
  const sesion = await leerSesion();
  // El id que manda el navegador no es de fiar: mandamos el de la sesión.
  if (!sesion || sesion.empleadoId !== empleadoId) {
    return { error: "Tu sesión ya venció. Vuelve a entrar con tu código." };
  }

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("abrir_cuenta", {
    p_empleado: sesion.empleadoId,
    p_bancos: bancos,
    p_personas: personas,
  });

  if (error) {
    console.error("Error al abrir la cuenta:", error.message);
    return { error: error.message };
  }

  revalidatePath("/barra");
  return null;
}
