import Link from "next/link";
import { obtenerCuenta } from "./datos-cuenta";
import { etiquetaBancos } from "./etiqueta-bancos";
import Reloj from "../../reloj";
import Comanda from "./comanda";
import { salir } from "../../entrar/acciones";

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
        className="flex flex-col gap-2 px-5 py-3"
        style={{ backgroundColor: sesion.sucursalColor, color: sesion.sucursalColorTexto }}
      >
        {/* Fila 1: de qué banco/mesa es, y las acciones de arriba a la
            derecha. Nunca en una sola línea ni con flex-wrap — en
            celular no cabían y todo se veía descuadrado. */}
        <div className="flex items-start justify-between gap-3">
          {sesion.rol === "mesero" ? (
            <div>
              <p className="text-[11px] tracking-widest uppercase opacity-75">
                {etiquetaBancos(bancos).titulo}
              </p>
              <p className="text-lg font-medium">{etiquetaBancos(bancos).valor}</p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link
                href="/barra"
                className="rounded-sm border border-current/40 px-3 py-2 text-sm"
              >
                ← Mapa
              </Link>
              <div>
                <p className="text-[11px] tracking-widest uppercase opacity-75">
                  {etiquetaBancos(bancos).titulo}
                </p>
                <p className="text-lg font-medium">{etiquetaBancos(bancos).valor}</p>
              </div>
            </div>
          )}

          {sesion.rol === "mesero" && (
            <div className="flex shrink-0 flex-col gap-1.5">
              <form action={salir}>
                <button
                  type="submit"
                  className="w-full rounded-sm border border-current/40 px-3 py-1.5 text-xs"
                >
                  Salir
                </button>
              </form>
              <Link
                href="/tickets-abiertos"
                className="rounded-sm border border-current/40 px-3 py-1.5 text-center text-xs"
              >
                Tickets abiertos
              </Link>
            </div>
          )}
        </div>

        {/* Fila 2: quién y desde cuándo — una sola línea chica, sin
            competir por espacio con los botones de arriba. */}
        <p className="text-xs opacity-75">
          {cabecera.personas} {cabecera.personas === 1 ? "persona" : "personas"} ·
          abrió {cabecera.mesero ?? "—"} · <Reloj desde={cabecera.abierto_en} />
        </p>
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
