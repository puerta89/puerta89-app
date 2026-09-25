"use server";

import { revalidatePath } from "next/cache";
import { supabaseServidor } from "@/lib/supabase/server";
import { leerSesion } from "@/lib/sesion";

/** Anula una venta ya cobrada (solo dueño/gerente): es como si nunca
 * hubiera pasado — el inventario regresa y el pago se borra, igual que
 * cancelar_cuenta (decisión de Mercedes, 26-ago). Queda registro de quién
 * y por qué. El recibo se busca por folio dentro de la sucursal de quien
 * lo pide. */
export async function anularVenta(
  folio: number,
  motivo: string,
): Promise<{ error: string } | null> {
  const sesion = await leerSesion();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar con tu código." };
  if (sesion.rol === "mesero") return { error: "Esto solo lo puede hacer el dueño o el gerente." };

  const supabase = supabaseServidor();
  const { data: t } = await supabase
    .from("tickets")
    .select("id")
    .eq("sucursal_id", sesion.sucursalId)
    .eq("folio", folio)
    .eq("estado", "cerrado")
    .maybeSingle();
  if (!t) return { error: "Ese recibo ya no está cobrado (¿ya se anuló?)." };

  const { error } = await supabase.rpc("cancelar_cuenta", {
    p_empleado: sesion.empleadoId,
    p_ticket: t.id,
    p_motivo: motivo.trim() || "Venta anulada por el dueño/gerente",
    p_codigo: null,
  });
  if (error) return { error: error.message };

  revalidatePath("/tickets");
  revalidatePath("/panel");
  return null;
}
