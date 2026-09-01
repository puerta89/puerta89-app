import Link from "next/link";
import { obtenerCuenta } from "./datos-cuenta";
import Reloj from "../../reloj";
import Comanda from "./comanda";

export const metadata = { title: "Cuenta · Puerta 89" };

export default async function Cuenta({ params }: PageProps<"/cuenta/[id]">) {
  const { id } = await params;
  const {
    sesion,
    bancos,
    cabecera,
    catalogo,
    botellas,
    lineas,
    total,
    bancosLibres,
    bancosPropios,
  } = await obtenerCuenta(id);

  return (
    <main className="min-h-dvh bg-crema">
      <header
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
        style={{ backgroundColor: sesion.sucursalColor, color: sesion.sucursalColorTexto }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/barra"
            className="rounded-sm border border-current/40 px-3 py-2 text-sm"
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
          rol={sesion.rol}
          bancosLibres={bancosLibres}
          bancosPropios={bancosPropios}
        />
      </div>
    </main>
  );
}
