import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/server";
import { traerCatalogo, traerBotellas, traerLineas } from "@/lib/datos";
import Reloj from "../../reloj";
import Comanda from "./comanda";

export const metadata = { title: "Cuenta · Puerta 89" };

export default async function Cuenta({ params }: PageProps<"/cuenta/[id]">) {
  const { id } = await params;
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

  return (
    <main className="min-h-dvh bg-crema">
      <header
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-crema"
        style={{ backgroundColor: sesion.sucursalColor }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/barra"
            className="rounded-sm border border-crema/40 px-3 py-2 text-sm"
          >
            ← Mapa
          </Link>
          <div>
            <p className="text-[11px] tracking-widest uppercase opacity-75">
              {bancos.length === 1 ? "Banco" : "Bancos"}
            </p>
            <p className="text-lg font-medium">{bancos.join(" · ")}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] tracking-widest uppercase opacity-75">
            {cabecera.personas}{" "}
            {cabecera.personas === 1 ? "persona" : "personas"} · abrió{" "}
            {cabecera.mesero}
          </p>
          <p className="text-lg font-medium">
            <Reloj desde={cabecera.abierto_en} />
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-4">
        <Comanda
          ticketId={id}
          catalogo={catalogo}
          botellas={botellas}
          lineas={lineas}
          total={total}
          estado={cabecera.ticket_estado}
          bancosLibres={bancosLibres}
          bancosPropios={bancosPropios}
        />
      </div>
    </main>
  );
}
