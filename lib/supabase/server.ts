import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para usarse SOLO en el servidor.
 *
 * Usa la llave publicable, que es pública por diseño. La seguridad no depende
 * de esconderla: depende de que las tablas tengan la protección prendida y de
 * que las funciones de la base decidan qué se puede consultar.
 */
export function supabaseServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
