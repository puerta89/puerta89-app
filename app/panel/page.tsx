import Link from "next/link";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import {
  traerPanel,
  traerDesglose,
  traerBancosPanel,
  traerSucursalesPanel,
  rango,
  type Desglose,
} from "@/lib/datos";

export const metadata = { title: "Panel · Puerta 89" };

const pesos = (n: number) =>
  (n ?? 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });
const exacto = (n: number) =>
  (n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const PERIODOS = [
  { dias: 1, texto: "Hoy" },
  { dias: 7, texto: "7 días" },
  { dias: 30, texto: "30 días" },
];

export default async function Panel({ searchParams }: PageProps<"/panel">) {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");
  if (sesion.rol === "mesero") redirect("/barra");

  const q = await searchParams;
  const dias = Number(q?.dias) || 7;
  const { desde, hasta } = rango(dias);

  const [resumen, categorias, productos, meseros, horas, bancos, sucursales] =
    await Promise.all([
      traerPanel(sesion.sucursalId, desde, hasta),
      traerDesglose(sesion.sucursalId, desde, hasta, "categoria"),
      traerDesglose(sesion.sucursalId, desde, hasta, "producto"),
      traerDesglose(sesion.sucursalId, desde, hasta, "mesero"),
      traerDesglose(sesion.sucursalId, desde, hasta, "hora"),
      traerBancosPanel(sesion.sucursalId, desde, hasta),
      traerSucursalesPanel(desde, hasta),
    ]);

  const vacio = resumen.tickets === 0;

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
              Panel · {sesion.sucursalNombre}
            </p>
            <p className="text-lg font-medium">
              {dias === 1 ? "Hoy" : `Últimos ${dias} días`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {PERIODOS.map((p) => (
            <Link
              key={p.dias}
              href={`/panel?dias=${p.dias}`}
              className={`rounded-sm px-4 py-2 text-sm ${
                p.dias === dias
                  ? "bg-crema text-vino"
                  : "border border-crema/40"
              }`}
            >
              {p.texto}
            </Link>
          ))}
          <Link
            href="/gastos"
            className="rounded-sm border border-crema/40 px-4 py-2 text-sm"
          >
            Gastos
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-5">
        {vacio ? (
          <p className="rounded-sm border border-vino/15 bg-white px-5 py-12 text-center text-sm text-tinta-2">
            No hay cuentas cerradas en este periodo. En cuanto cobren la primera,
            aquí van a aparecer los números.
          </p>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Cifra titulo="Venta" valor={pesos(resumen.ventas)} />
              <Cifra
                titulo="Utilidad bruta"
                valor={pesos(resumen.utilidad_bruta)}
                pie={`${resumen.margen}% de margen`}
              />
              <Cifra
                titulo="Ticket promedio"
                valor={pesos(resumen.ticket_promedio)}
                pie={`${resumen.tickets} ${resumen.tickets === 1 ? "cuenta" : "cuentas"}`}
              />
              <Cifra
                titulo="Permanencia"
                valor={`${resumen.permanencia_min} min`}
                pie="promedio por cuenta"
              />
              <Cifra
                titulo="Efectivo"
                valor={pesos(resumen.efectivo)}
                pie={`tarjeta ${pesos(resumen.tarjeta)}`}
              />
              <Cifra titulo="Propinas" valor={pesos(resumen.propinas)} />
            </section>

            {/* De la utilidad bruta a la real */}
            <section className="rounded-sm border border-vino/15 bg-white px-5 py-5">
              <h2 className="font-display text-2xl text-vino">
                De lo que vendes a lo que te queda
              </h2>
              <div className="mt-3">
                <Renglon texto="Venta" monto={resumen.ventas} />
                <Renglon texto="Lo que costó el producto" monto={-resumen.costo} />
                <Renglon texto="Utilidad bruta" monto={resumen.utilidad_bruta} fuerte />
                <Renglon texto="Mermas" monto={-resumen.mermas} />
                <Renglon texto="Gastos" monto={-resumen.gastos} />
                <div
                  className={`mt-2 flex items-center justify-between border-t-2 pt-3 text-lg font-medium ${
                    resumen.utilidad_real < 0
                      ? "border-vino text-vino"
                      : "border-tinta"
                  }`}
                >
                  <span>Lo que de verdad te queda</span>
                  <span className="tabular-nums">{exacto(resumen.utilidad_real)}</span>
                </div>
              </div>
              {resumen.mermas > resumen.utilidad_bruta && resumen.mermas > 0 && (
                <p className="mt-3 rounded-sm bg-vino/10 px-4 py-3 text-sm text-vino">
                  Las mermas se comieron toda la utilidad del periodo. Vale la
                  pena revisar qué se perdió.
                </p>
              )}
              {resumen.cancelado > 0 && (
                <p className="mt-3 text-xs text-tinta-2">
                  Además se cancelaron {exacto(resumen.cancelado)} en productos que
                  ya estaban pedidos. Eso no es pérdida, pero conviene verlo.
                </p>
              )}
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <Barras titulo="Por categoría" datos={categorias} />
              <Barras titulo="Lo que más se vende" datos={productos.slice(0, 8)} />
              <Barras titulo="Por mesero" datos={meseros} />
              <Barras
                titulo="Por hora"
                datos={[...horas].sort((a, b) =>
                  a.etiqueta.localeCompare(b.etiqueta),
                )}
                ordenado
              />
            </div>

            {bancos.length > 0 && (
              <section className="rounded-sm border border-vino/15 bg-white px-5 py-5">
                <h2 className="font-display text-2xl text-vino">
                  Qué bancos venden más
                </h2>
                <p className="mb-3 text-sm text-tinta-2">
                  Sirve para decidir cómo acomodar CDMX usando lo que ya saben de
                  Puebla.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-vino/15 text-left text-xs tracking-wider text-tinta-2 uppercase">
                        <th className="py-2 font-medium">Banco</th>
                        <th className="py-2 font-medium">Zona</th>
                        <th className="py-2 text-right font-medium">Cuentas</th>
                        <th className="py-2 text-right font-medium">Venta</th>
                        <th className="py-2 text-right font-medium">Se quedan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bancos.map((b) => (
                        <tr key={b.banco} className="border-b border-vino/10 last:border-b-0">
                          <td className="py-2">{b.banco}</td>
                          <td className="py-2 text-tinta-2">{b.zona}</td>
                          <td className="py-2 text-right tabular-nums">{b.cuentas}</td>
                          <td className="py-2 text-right tabular-nums">{pesos(b.venta)}</td>
                          <td className="py-2 text-right tabular-nums text-tinta-2">
                            {b.permanencia_min} min
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {sucursales.length > 1 && (
          <section className="rounded-sm border border-vino/15 bg-white px-5 py-5">
            <h2 className="font-display text-2xl text-vino">Las dos sucursales</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {sucursales.map((s) => (
                <div
                  key={s.sucursal}
                  className="rounded-sm border-l-4 bg-surface px-4 py-3"
                  style={{ borderLeftColor: s.color }}
                >
                  <p className="font-medium">{s.sucursal}</p>
                  <p className="text-2xl tabular-nums">{pesos(s.ventas)}</p>
                  <p className="text-xs text-tinta-2">
                    utilidad {pesos(s.utilidad)} · {s.tickets} cuentas · ticket{" "}
                    {pesos(s.ticket_promedio)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Cifra({
  titulo,
  valor,
  pie,
}: {
  titulo: string;
  valor: string;
  pie?: string;
}) {
  return (
    <div className="rounded-sm border border-vino/15 bg-white px-4 py-4">
      <p className="text-[10.5px] tracking-widest text-tinta-2 uppercase">
        {titulo}
      </p>
      <p className="font-display text-3xl tabular-nums">{valor}</p>
      {pie && <p className="mt-1 text-xs text-tinta-2">{pie}</p>}
    </div>
  );
}

function Renglon({
  texto,
  monto,
  fuerte,
}: {
  texto: string;
  monto: number;
  fuerte?: boolean;
}) {
  return (
    <div
      className={`flex justify-between border-b border-vino/10 py-2 text-sm ${
        fuerte ? "font-medium" : ""
      }`}
    >
      <span className={fuerte ? "" : "text-tinta-2"}>{texto}</span>
      <span className="tabular-nums">{exacto(monto)}</span>
    </div>
  );
}

function Barras({
  titulo,
  datos,
  ordenado,
}: {
  titulo: string;
  datos: Desglose[];
  ordenado?: boolean;
}) {
  if (datos.length === 0) return null;
  const tope = Math.max(...datos.map((d) => d.venta), 1);
  return (
    <section className="rounded-sm border border-vino/15 bg-white px-5 py-5">
      <h2 className="mb-3 font-display text-2xl text-vino">{titulo}</h2>
      <ul className="flex flex-col gap-2.5">
        {datos.map((d) => (
          <li key={d.etiqueta} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
            <span className="text-sm">{d.etiqueta}</span>
            <span className="text-sm tabular-nums">{pesos(d.venta)}</span>
            <span className="col-span-2 h-2 rounded-full bg-rosa-claro/40">
              <span
                className="block h-2 rounded-full bg-vino"
                style={{ width: `${Math.max(2, (d.venta / tope) * 100)}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
      {!ordenado && (
        <p className="mt-3 text-xs text-tinta-2">De mayor a menor venta.</p>
      )}
    </section>
  );
}
