"use server";

import { revalidatePath } from "next/cache";
import { supabaseServidor } from "@/lib/supabase/server";
import { leerSesion } from "@/lib/sesion";

type Falla = { error: string } | null;

async function dueno() {
  const sesion = await leerSesion();
  if (!sesion) return { falla: "Tu sesión venció. Vuelve a entrar con tu código." };
  if (sesion.rol !== "dueno") return { falla: "Esto solo lo puede hacer el dueño." };
  return { sesion };
}

export async function altaEmpleado(
  codigoJefe: string,
  nombre: string,
  rol: string,
  codigo: string,
): Promise<Falla> {
  const { sesion, falla } = await dueno();
  if (!sesion) return { error: falla! };
  if (!/^\d{4}$/.test(codigo)) return { error: "El código son 4 números." };
  if (!/^\d{4}$/.test(codigoJefe)) return { error: "Falta tu código." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("alta_empleado", {
    p_empleado: sesion.empleadoId,
    p_codigo_jefe: codigoJefe,
    p_nombre: nombre,
    p_rol: rol,
    p_codigo: codigo,
  });
  if (error) return { error: error.message };
  revalidatePath("/equipo");
  return null;
}

export async function cambiarCodigo(
  codigoJefe: string,
  objetivo: string,
  nuevo: string,
): Promise<Falla> {
  const { sesion, falla } = await dueno();
  if (!sesion) return { error: falla! };
  if (!/^\d{4}$/.test(nuevo)) return { error: "El código nuevo son 4 números." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("cambiar_codigo", {
    p_empleado: sesion.empleadoId,
    p_codigo_jefe: codigoJefe,
    p_objetivo: objetivo,
    p_nuevo: nuevo,
  });
  if (error) return { error: error.message };
  revalidatePath("/equipo");
  return null;
}

export async function cambiarAlta(
  codigoJefe: string,
  objetivo: string,
  activo: boolean,
): Promise<Falla> {
  const { sesion, falla } = await dueno();
  if (!sesion) return { error: falla! };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("baja_empleado", {
    p_empleado: sesion.empleadoId,
    p_codigo_jefe: codigoJefe,
    p_objetivo: objetivo,
    p_activo: activo,
  });
  if (error) return { error: error.message };
  revalidatePath("/equipo");
  return null;
}
