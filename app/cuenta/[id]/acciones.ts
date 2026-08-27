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

export async function cancelarLinea(
  ticketId: string,
  lineaId: string,
  codigo: string | null,
  motivo: string,
): Promise<Falla> {
  const sesion = await leerSesion();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar con tu código." };
  if (!motivo.trim()) return { error: "Falta decir por qué se cancela." };
  // El dueño o gerente se autoriza a sí mismo con su propia sesión: no
  // necesita teclear su propio código. El mesero sí necesita el código
  // de alguien con autoridad.
  const necesitaCodigo = sesion.rol === "mesero";
  if (necesitaCodigo && !/^\d{4}$/.test(codigo ?? "")) {
    return { error: "El código son 4 números." };
  }

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("cancelar_linea", {
    p_solicitante: sesion.empleadoId,
    p_linea: lineaId,
    p_motivo: motivo.trim(),
    p_codigo: necesitaCodigo ? codigo : null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/cuenta/${ticketId}`);
  return null;
}

/** "Sírveme otra copa": deshace un exceso propio, sin pedir código,
 * mientras esa línea siga dentro de los 10 minutos de haberse creado. */
export async function disminuirCantidad(
  ticketId: string,
  lineaId: string,
): Promise<Falla> {
  const sesion = await leerSesion();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar con tu código." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("disminuir_cantidad", {
    p_empleado: sesion.empleadoId,
    p_linea: lineaId,
    p_menos: 1,
  });
  if (error) return { error: error.message };
  revalidatePath(`/cuenta/${ticketId}`);
  return null;
}

export async function pedirCuenta(ticketId: string): Promise<Falla> {
  const sesion = await leerSesion();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar con tu código." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("pedir_cuenta", {
    p_empleado: sesion.empleadoId,
    p_ticket: ticketId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/cuenta/${ticketId}`);
  revalidatePath("/barra");
  return null;
}

export async function agregarPago(
  ticketId: string,
  metodo: "efectivo" | "tarjeta",
  monto: number,
  terminal: string | null,
): Promise<Falla> {
  const sesion = await leerSesion();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar con tu código." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("agregar_pago", {
    p_empleado: sesion.empleadoId,
    p_ticket: ticketId,
    p_metodo: metodo,
    p_monto: monto,
    p_terminal: terminal,
  });
  if (error) return { error: error.message };
  revalidatePath(`/cuenta/${ticketId}/cobrar`);
  return null;
}

export async function quitarPago(ticketId: string, pagoId: string): Promise<Falla> {
  const sesion = await leerSesion();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar con tu código." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("quitar_pago", {
    p_empleado: sesion.empleadoId,
    p_pago: pagoId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/cuenta/${ticketId}/cobrar`);
  return null;
}

export async function cerrarCuenta(
  ticketId: string,
  propina: number,
): Promise<Falla> {
  const sesion = await leerSesion();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar con tu código." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("cerrar_cuenta", {
    p_empleado: sesion.empleadoId,
    p_ticket: ticketId,
    p_propina: propina,
  });
  if (error) return { error: error.message };
  revalidatePath("/barra");
  return null;
}

export async function moverCuenta(
  ticketId: string,
  bancos: string[],
): Promise<Falla> {
  const sesion = await leerSesion();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar con tu código." };
  if (bancos.length === 0) return { error: "Elige a dónde se cambian." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("mover_cuenta", {
    p_empleado: sesion.empleadoId,
    p_ticket: ticketId,
    p_bancos: bancos,
  });
  if (error) return { error: error.message };
  revalidatePath(`/cuenta/${ticketId}`);
  revalidatePath("/barra");
  return null;
}

export async function partirCuenta(
  ticketId: string,
  lineas: string[],
): Promise<{ error: string } | { nuevoTicket: string }> {
  const sesion = await leerSesion();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar con tu código." };
  if (lineas.length === 0) return { error: "Elige qué se pasa a la otra cuenta." };

  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("partir_cuenta", {
    p_empleado: sesion.empleadoId,
    p_ticket: ticketId,
    p_lineas: lineas,
  });
  if (error) return { error: error.message };
  revalidatePath(`/cuenta/${ticketId}`);
  revalidatePath("/barra");
  return { nuevoTicket: data as string };
}

/** Para una mesa que se abrió por error (o donde ya se cancelaron todos
 * los renglones): la cierra sin que cuente como venta, y deja el banco
 * libre. Solo si no tiene consumo activo ni pagos. */
export async function cancelarCuenta(ticketId: string, motivo?: string): Promise<Falla> {
  const sesion = await leerSesion();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar con tu código." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("cancelar_cuenta", {
    p_empleado: sesion.empleadoId,
    p_ticket: ticketId,
    p_motivo: motivo?.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/barra");
  return null;
}

export async function aumentarCantidad(
  ticketId: string,
  lineaId: string,
): Promise<Falla> {
  const sesion = await leerSesion();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar con tu código." };

  const supabase = supabaseServidor();
  const { error } = await supabase.rpc("aumentar_cantidad", {
    p_empleado: sesion.empleadoId,
    p_linea: lineaId,
    p_extra: 1,
  });
  if (error) return { error: error.message };
  revalidatePath(`/cuenta/${ticketId}`);
  return null;
}
