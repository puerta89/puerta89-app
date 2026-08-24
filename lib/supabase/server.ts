import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para usarse SOLO en el servidor.
 *
 * Si existe la llave secreta, se usa esa: le da al servidor acceso completo
 * y permite cerrarle la puerta al navegador por completo. El navegador nunca
 * ve esta llave, porque el nombre no empieza con NEXT_PUBLIC_ y Next.js solo
 * manda al navegador las que sí empiezan así.
 *
 * Si no está, se cae a la llave publicable, que es pública por diseño. Sirve
 * para trabajar, pero deja las funciones de la base al alcance de cualquiera.
 */
export function supabaseServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreta = process.env.SUPABASE_SECRET_KEY;
  const publicable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const llave = secreta || publicable;

  if (!url || !llave) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o las llaves de Supabase en .env.local",
    );
  }

  // En el servidor de verdad, sin la llave secreta la app arrancaría pero
  // fallaría en cada consulta con un "permiso denegado" que no dice nada.
  // Mejor que no arranque y diga exactamente qué falta.
  if (process.env.NODE_ENV === "production" && !secreta) {
    throw new Error(
      "Falta SUPABASE_SECRET_KEY. Sin ella la base no le responde a la app. " +
        "Agrégala en Vercel: Settings → Environment Variables.",
    );
  }

  return createClient(url, llave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Para poder avisar en pantalla si todavía falta cerrar la puerta. */
export function usandoLlaveSecreta() {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}
