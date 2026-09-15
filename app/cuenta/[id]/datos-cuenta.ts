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
  // mapa_barra parte DE los bancos, así que una cuenta sin mesa (para
  // llevar, o que todavía no se sienta a ningún lado) nunca aparecería
  // ahí — se busca la cuenta por su propio id con ticket_cabecera, y
  // mapa_barra queda solo para armar la lista de bancos libres/propios.
  const [{ data: mapa }, { data: cabRows }] = await Promise.all([
    supabase.rpc("mapa_barra", { p_sucursal: sesion.sucursalId }),
    supabase.rpc("ticket_cabecera", {
      p_sucursal: sesion.sucursalId,
      p_ticket: id,
    }),
  ]);

  const cab = cabRows?.[0];
  if (!cab) notFound();

  const bancos: number[] = cab.bancos ?? [];
  const cabecera = {
    personas: cab.personas as number,
    mesero: cab.mesero as string | null,
    abierto_en: cab.abierto_en as string,
    ticket_estado: cab.estado as "abierto" | "por_cobrar",
  };

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
