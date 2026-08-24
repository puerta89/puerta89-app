"use server";

import { revalidatePath } from "next/cache";
import { supabaseServidor } from "@/lib/supabase/server";
import { leerSesion } from "@/lib/sesion";

export async function nuevoGasto(
  categoria: string,
  concepto: string,
  monto: number,
  fecha: string,
  recurrente: boolean,
): Promise<{ error: string } | null> {
  const sesion = await leerSesion();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar con tu código." };
  if (sesion.rol === "mesero") return { error: "Esto solo lo puede hacer el dueño." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("registrar_gasto", {
    p_empleado: sesion.empleadoId,
    p_categoria: categoria,
    p_concepto: concepto,
    p_monto: monto,
    p_fecha: fecha,
    p_recurrente: recurrente,
  });
  if (error) return { error: error.message };
  revalidatePath("/gastos");
  revalidatePath("/panel");
  return null;
}
