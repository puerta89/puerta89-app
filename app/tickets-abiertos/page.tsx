import Link from "next/link";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import { traerTicketsAbiertos } from "@/lib/datos";
import Reloj from "../reloj";

export const metadata = { title: "Tickets abiertos · Puerta 89" };

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/** Todas las cuentas en curso, con mesa o sin ella — para que un mesero
 * pueda retomar cualquiera sin depender del mapa (que ya no ve). */
export default async function TicketsAbiertos() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");

  const tickets = await traerTicketsAbiertos(sesion.sucursalId);

  return (
    <main className="min-h-dvh bg-crema">
      <header
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
        style={{ backgroundColor: sesion.sucursalColor, color: sesion.sucursalColorTexto }}
      >
        <Link
          href="/barra"
          className="rounded-sm border border-current/40 px-3 py-2 text-sm"
        >
          ← Atrás
        </Link>
        <p className="text-lg font-medium">Tickets abiertos</p>
      </header>

      <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-5">
        {tickets.length === 0 ? (
          <p className="rounded-sm border border-vino/15 bg-white px-5 py-10 text-center text-sm text-tinta-2">
            No hay ninguna cuenta abierta ahorita.
          </p>
        ) : (
          tickets.map((t) => (
            <Link
              key={t.ticket_id}
              href={`/cuenta/${t.ticket_id}`}
              className="flex items-center justify-between gap-3 rounded-sm border border-vino/15 bg-white px-5 py-4 active:bg-rosa-claro/20"
            >
              <div>
                <p className="font-medium text-vino">
                  {t.bancos.length > 0
                    ? `${t.bancos.length === 1 ? "Banco" : "Bancos"} ${t.bancos.join(" · ")}`
                    : "Para llevar · sin mesa"}
                  {t.estado === "por_cobrar" && " · pidió la cuenta"}
                </p>
                <p className="text-xs text-tinta-2">
                  {t.mesero ?? "—"} · {t.personas}{" "}
                  {t.personas === 1 ? "persona" : "personas"} ·{" "}
                  <Reloj desde={t.abierto_en} />
                </p>
              </div>
              <span className="tabular-nums font-medium">{pesos(t.total)}</span>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
