"use server";

import { revalidatePath } from "next/cache";
import { supabaseServidor } from "@/lib/supabase/server";
import { leerSesion } from "@/lib/sesion";
import { traerLineas, type LineaTicket } from "@/lib/datos";

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

/** Los renglones de un recibo cerrado (solo los que siguen "activos" —
 * los que ya se cancelaron o devolvieron antes no se pueden repetir),
 * para elegir cuáles devolver. */
export async function lineasDeVenta(
  folio: number,
): Promise<{ error: string } | { ticketId: string; lineas: LineaTicket[] }> {
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
  if (!t) return { error: "Ese recibo ya no está cobrado." };

  const lineas = await traerLineas(t.id);
  return { ticketId: t.id, lineas };
}

/** Devuelve nada más los renglones elegidos de una venta ya cobrada: su
 * inventario regresa y queda anotado con qué método se le regresó el
 * dinero al cliente — a diferencia de anular, el resto de la venta
 * sigue en pie. */
export async function devolverLineas(
  ticketId: string,
  lineaIds: string[],
  metodo: "efectivo" | "tarjeta",
  motivo: string,
): Promise<{ error: string } | null> {
  const sesion = await leerSesion();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar con tu código." };
  if (sesion.rol === "mesero") return { error: "Esto solo lo puede hacer el dueño o el gerente." };
  if (lineaIds.length === 0) return { error: "Elige al menos un renglón." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("devolver_lineas", {
    p_empleado: sesion.empleadoId,
    p_ticket: ticketId,
    p_lineas: lineaIds,
    p_metodo: metodo,
    p_motivo: motivo,
  });
  if (error) return { error: error.message };

  revalidatePath("/tickets");
  revalidatePath("/panel");
  return null;
}
