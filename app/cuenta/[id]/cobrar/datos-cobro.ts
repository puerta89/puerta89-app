import { notFound, redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/server";
import { traerLineas, traerPagos } from "@/lib/datos";

/** Lo que necesitan tanto la página completa de cobrar como la ventana
 * emergente (app/@modal/(.)cuenta/[id]/cobrar) — misma lógica una sola
 * vez, igual que datos-cuenta.ts un nivel arriba. */
export async function obtenerCobro(id: string) {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");

  const supabase = supabaseServidor();
  const { data: cabRows } = await supabase.rpc("ticket_cabecera", {
    p_sucursal: sesion.sucursalId,
    p_ticket: id,
  });
  const cab = cabRows?.[0];
  if (!cab) notFound();

  const bancos: number[] = cab.bancos ?? [];
  const [lineas, pagos] = await Promise.all([traerLineas(id), traerPagos(id)]);
  const total = lineas.reduce((s, l) => s + l.importe, 0);
  const personas: number = cab.personas ?? 1;

  return { sesion, bancos, lineas, pagos, total, personas };
}
