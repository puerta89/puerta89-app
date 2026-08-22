"use server";

import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";
import { abrirSesion, cerrarSesion } from "@/lib/sesion";

export type ResultadoEntrada = { error: string } | null;

export async function entrarConCodigo(
  _anterior: ResultadoEntrada,
  formulario: FormData,
): Promise<ResultadoEntrada> {
  const codigo = String(formulario.get("codigo") ?? "").trim();

  if (!/^\d{4}$/.test(codigo)) {
    return { error: "El código son 4 números." };
  }

  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("verificar_codigo", {
    p_codigo: codigo,
  });

  if (error) {
    console.error("Error al verificar el código:", error.message);
    return { error: "No se pudo conectar. Revisa el internet." };
  }

  const empleado = data?.[0];
  if (!empleado) {
    return { error: "Ese código no es de nadie." };
  }

  await abrirSesion({
    empleadoId: empleado.empleado_id,
    nombre: empleado.empleado_nombre,
    rol: empleado.rol,
    sucursalId: empleado.sucursal_id,
    sucursalNombre: empleado.sucursal_nombre,
    sucursalColor: empleado.sucursal_color,
    puedeCambiarSucursal: empleado.puede_cambiar_sucursal,
  });

  redirect("/barra");
}

export async function salir() {
  await cerrarSesion();
  redirect("/entrar");
}
