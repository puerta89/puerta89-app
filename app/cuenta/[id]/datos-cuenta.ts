import { notFound, redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/server";
import { traerCatalogo, traerBotellas, traerLineas } from "@/lib/datos";

/** Todo lo que necesitan tanto la página completa de la cuenta
 * (app/cuenta/[id]/page.tsx) como el panel lateral que se abre desde el
 * mapa (app/@modal/(.)cuenta/[id]/page.tsx) — para no leer las cosas dos
 * veces con lógica separada que se puede desincronizar. */
export async function obtenerCuenta(id: string) {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");

  const supabase = supabaseServidor();
  const { data: mapa } = await supabase.rpc("mapa_barra", {
    p_sucursal: sesion.sucursalId,
  });

  const suyos = (mapa ?? []).filter(
    (r: { ticket_id: string | null }) => r.ticket_id === id,
  );
  if (suyos.length === 0) notFound();

  const bancos = suyos
    .map((r: { numero: number }) => r.numero)
    .sort((a: number, b: number) => a - b);
  const cabecera = suyos[0];

  type Fila = {
    banco_id: string; numero: number; zona_nombre: string; ticket_id: string | null;
  };
  const filas = (mapa ?? []) as Fila[];
  // Los bancos donde ya está esta cuenta, más los que están libres.
  const bancosPropios = [
    ...new Set(filas.filter((r) => r.ticket_id === id).map((r) => r.banco_id)),
  ];
  const ocupadosPorOtros = new Set(
    filas.filter((r) => r.ticket_id && r.ticket_id !== id).map((r) => r.banco_id),
  );
  const bancosLibres = [
    ...new Map(
      filas
        .filter(
          (r) => bancosPropios.includes(r.banco_id) || !ocupadosPorOtros.has(r.banco_id),
        )
        .map((r) => [
          r.banco_id,
          { id: r.banco_id, numero: r.numero, zona: r.zona_nombre },
        ]),
    ).values(),
  ].sort((a, b) => a.numero - b.numero);

  const [catalogo, botellas, lineas] = await Promise.all([
    traerCatalogo(sesion.sucursalId),
    traerBotellas(sesion.sucursalId),
    traerLineas(id),
  ]);

  const total = lineas.reduce((s, l) => s + l.importe, 0);

  return {
    sesion,
    bancos,
    cabecera,
    catalogo,
    botellas,
    lineas,
    total,
    bancosLibres,
    bancosPropios,
  };
}
