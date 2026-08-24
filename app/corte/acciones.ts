"use server";

import { revalidatePath } from "next/cache";
import { supabaseServidor } from "@/lib/supabase/server";
import { leerSesion } from "@/lib/sesion";

type Falla = { error: string } | null;

/** Solo el dueño o el gerente pueden tocar la caja. */
async function jefe() {
  const sesion = await leerSesion();
  if (!sesion) return { falla: "Tu sesión venció. Vuelve a entrar con tu código." };
  if (sesion.rol === "mesero") return { falla: "Esto solo lo puede hacer el dueño." };
  return { sesion };
}

export async function abrirCaja(fecha: string, fondo: number): Promise<Falla> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("abrir_corte", {
    p_empleado: sesion.empleadoId,
    p_fecha: fecha,
    p_fondo: fondo,
  });
  if (error) return { error: error.message };
  revalidatePath("/corte");
  return null;
}

export async function moverEfectivo(
  corteId: string,
  tipo: "entrada" | "salida",
  monto: number,
  concepto: string,
): Promise<Falla> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };
  if (!(monto > 0)) return { error: "El monto tiene que ser mayor a cero." };
  if (!concepto.trim()) return { error: "Falta decir de qué fue." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("registrar_movimiento_caja", {
    p_empleado: sesion.empleadoId,
    p_corte: corteId,
    p_tipo: tipo,
    p_monto: monto,
    p_concepto: concepto.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/corte");
  return null;
}

export async function cerrarCaja(
  corteId: string,
  codigo: string,
  efectivoContado: number,
  propinaEfectivo: number,
  propinaTarjeta: number,
  meseros: string[],
): Promise<Falla> {
  const { sesion, falla } = await jefe();
  if (!sesion) return { error: falla! };
  if (!/^\d{4}$/.test(codigo)) return { error: "El código son 4 números." };
  if (meseros.length === 0) return { error: "Falta marcar quiénes estuvieron en el turno." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("cerrar_corte", {
    p_empleado: sesion.empleadoId,
    p_codigo: codigo,
    p_corte: corteId,
    p_efectivo_contado: efectivoContado,
    p_propina_efectivo: propinaEfectivo,
    p_propina_tarjeta: propinaTarjeta,
    p_meseros: meseros,
  });
  if (error) return { error: error.message };
  revalidatePath("/corte");
  return null;
}
