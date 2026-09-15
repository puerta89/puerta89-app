import { redirect } from "next/navigation";
import { leerSesion, actualizarOrdenActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/server";

/** A dónde llega un mesero al entrar a /barra: se le crea una cuenta sin
 * mesa (Mercedes: "aparezcan las categorías... y así se vaya creando la
 * cuenta") y se manda directo a tomar el pedido — sin tener que picarle a
 * nada primero. Es un Route Handler y no parte del render de /barra
 * porque crear la cuenta y recordar cuál es (para poder retomarla si sale
 * y regresa) necesita escribir la sesión, y eso no se puede hacer dentro
 * de un Server Component. */
export async function GET() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");

  const supabase = supabaseServidor();
  const { data, error } = await supabase.rpc("abrir_cuenta", {
    p_empleado: sesion.empleadoId,
    p_bancos: [],
    p_personas: 1,
  });

  if (error || !data) {
    // No se manda de vuelta a /barra: si el mesero ya no está activo,
    // /barra volvería a mandar para acá y se haría un ciclo sin fin.
    console.error("Error al iniciar una orden sin mesa:", error?.message);
    return new Response(
      `<!doctype html><meta charset="utf-8">` +
        `<body style="font-family:system-ui;padding:2rem;max-width:32rem">` +
        `<p>No se pudo empezar una orden nueva: ${error?.message ?? "error desconocido"}.</p>` +
        `<p><a href="/entrar">Vuelve a entrar con tu código</a></p>` +
        `</body>`,
      { status: 500, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  await actualizarOrdenActual(data as string);
  redirect(`/cuenta/${data}`);
}
