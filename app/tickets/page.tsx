import Link from "next/link";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import {
  traerTicketsPeriodo,
  traerCortesDelPeriodo,
  hoyEnMexico,
  rango,
} from "@/lib/datos";
import ListaRecibos from "./lista";
import TablaCortes from "./cortes";

export const metadata = { title: "Tickets · Puerta 89" };

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default async function Tickets({
  searchParams,
}: PageProps<"/tickets">) {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");
  // El mesero no tiene nada que hacer aquí.
  if (sesion.rol === "mesero") redirect("/barra");

  const hoy = hoyEnMexico();
  const q = await searchParams;
  const desde = typeof q?.desde === "string" && q.desde ? q.desde : hoy;
  const hasta = typeof q?.hasta === "string" && q.hasta ? q.hasta : hoy;

  const atajos = [
    { texto: "Hoy", ...rango(1) },
    { texto: "7 días", ...rango(7) },
    { texto: "30 días", ...rango(30) },
  ];

  const [recibos, cortes] = await Promise.all([
    traerTicketsPeriodo(sesion.sucursalId, desde, hasta),
    traerCortesDelPeriodo(sesion.sucursalId, desde, hasta),
  ]);

  const totalVenta = recibos.reduce((s, r) => s + r.total, 0);
  const totalPropina = recibos.reduce((s, r) => s + r.propina, 0);

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
              Tickets · {sesion.sucursalNombre}
            </p>
            <p className="text-lg font-medium">
              {desde === hasta ? desde : `${desde} al ${hasta}`}
            </p>
          </div>
        </div>
        <a
          href={`/panel/exportar?desde=${desde}&hasta=${hasta}`}
          className="rounded-sm border border-current/40 px-4 py-2 text-sm"
        >
          Descargar Excel
        </a>
      </header>

      <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-5">
        <section className="flex flex-wrap items-end gap-3 rounded-sm border border-vino/15 bg-white px-5 py-4">
          <form className="flex flex-wrap items-end gap-3" action="/tickets">
            <label className="flex flex-col gap-1 text-xs text-tinta-2">
              Desde
              <input
                type="date"
                name="desde"
                defaultValue={desde}
                max={hoy}
                className="rounded-sm border border-vino/25 px-3 py-2 text-sm outline-none focus:border-vino"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-tinta-2">
              Hasta
              <input
                type="date"
                name="hasta"
                defaultValue={hasta}
                max={hoy}
                className="rounded-sm border border-vino/25 px-3 py-2 text-sm outline-none focus:border-vino"
              />
            </label>
            <button
              type="submit"
              className="rounded-sm bg-vino px-4 py-2 text-sm font-medium text-crema"
            >
              Ver
            </button>
          </form>
          <div className="ml-auto flex flex-wrap gap-2">
            {atajos.map((a) => (
              <Link
                key={a.texto}
                href={`/tickets?desde=${a.desde}&hasta=${a.hasta}`}
                className={`rounded-full px-3 py-1.5 text-xs ${
                  desde === a.desde && hasta === a.hasta
                    ? "bg-vino text-crema"
                    : "border border-vino/25 text-vino"
                }`}
              >
                {a.texto}
              </Link>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Cifra titulo="Recibos" valor={String(recibos.length)} />
          <Cifra titulo="Venta" valor={pesos(totalVenta)} />
          <Cifra titulo="Propina en cuentas" valor={pesos(totalPropina)} />
        </section>

        <TablaCortes cortes={cortes} />

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-2xl text-vino">Recibos</h2>
            <p className="text-xs text-tinta-2">
              Toca uno para ver qué se pidió. La propina de cada uno es la
              que el mesero capturó al cobrar esa cuenta — distinta de la
              propina de tarjeta que el dueño escribe a mano al cerrar el
              día (tabla de arriba).
            </p>
          </div>
          <ListaRecibos recibos={recibos} />
        </section>
      </div>
    </main>
  );
}

function Cifra({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-sm border border-vino/15 bg-white px-4 py-4">
      <p className="text-[10.5px] tracking-widest text-tinta-2 uppercase">
        {titulo}
      </p>
      <p className="font-display text-3xl tabular-nums">{valor}</p>
    </div>
  );
}
