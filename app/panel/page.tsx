import Link from "next/link";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import {
  traerPanel,
  traerDesglose,
  traerBancosPanel,
  traerSucursalesPanel,
  traerMeses,
  traerMesesGrupo,
  rango,
  hoyEnMexico,
  type Desglose,
  type MesPanel,
  type MesGrupo,
} from "@/lib/datos";

export const metadata = { title: "Panel · Puerta 89" };

// Antes de que exista el negocio: sirve como "sin piso de fecha" para
// cuando no se elige ningún rango, sin tener que inventar una fecha real.
const SIN_PISO = "2000-01-01";

const pesos = (n: number) =>
  (n ?? 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });
const exacto = (n: number) =>
  (n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default async function Panel({ searchParams }: PageProps<"/panel">) {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");
  if (sesion.rol === "mesero") redirect("/barra");

  const q = await searchParams;
  const hoy = hoyEnMexico();
  // Sin selección: se ve todo lo que haya, de principio a fin.
  const desde = typeof q?.desde === "string" && q.desde ? q.desde : SIN_PISO;
  const hasta = typeof q?.hasta === "string" && q.hasta ? q.hasta : hoy;
  const esTodo = desde === SIN_PISO;

  const atajos = [
    { texto: "Hoy", ...rango(1) },
    { texto: "7 días", ...rango(7) },
    { texto: "30 días", ...rango(30) },
    { texto: "Todo", desde: SIN_PISO, hasta: hoy },
  ];

  const [resumen, categorias, productos, meseros, horas, bancos, sucursales, meses, mesesGrupo] =
    await Promise.all([
      traerPanel(sesion.sucursalId, desde, hasta),
      traerDesglose(sesion.sucursalId, desde, hasta, "categoria"),
      traerDesglose(sesion.sucursalId, desde, hasta, "producto"),
      traerDesglose(sesion.sucursalId, desde, hasta, "mesero"),
      traerDesglose(sesion.sucursalId, desde, hasta, "hora"),
      traerBancosPanel(sesion.sucursalId, desde, hasta),
      traerSucursalesPanel(desde, hasta),
      // La estacionalidad siempre mira TODO el histórico, sin importar
      // qué rango esté eligiendo el dueño arriba: sirve para planear con
      // tiempo, no solo para ver cómo va el periodo de hoy.
      traerMeses(sesion.sucursalId),
      traerMesesGrupo(sesion.sucursalId),
    ]);

  const vacio = resumen.tickets === 0;

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
              Panel · {sesion.sucursalNombre}
            </p>
            <p className="text-lg font-medium">
              {esTodo ? "Todo el histórico" : `${desde} al ${hasta}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/panel/exportar?desde=${desde}&hasta=${hasta}`}
            className="rounded-sm border border-current/40 px-4 py-2 text-sm"
          >
            Descargar Excel
          </a>
          <Link
            href="/gastos"
            className="rounded-sm border border-current/40 px-4 py-2 text-sm"
          >
            Gastos
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-5">
        <section className="flex flex-wrap items-end gap-3 rounded-sm border border-vino/15 bg-white px-5 py-4">
          <form className="flex flex-wrap items-end gap-3" action="/panel">
            <label className="flex flex-col gap-1 text-xs text-tinta-2">
              Desde
              <input
                type="date"
                name="desde"
                defaultValue={esTodo ? "" : desde}
                className="rounded-sm border border-vino/25 px-3 py-2 text-sm outline-none focus:border-vino"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-tinta-2">
              Hasta
              <input
                type="date"
                name="hasta"
                defaultValue={hasta}
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
                href={`/panel?desde=${a.desde}&hasta=${a.hasta}`}
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
                <Renglon texto="Gastos" monto={-resumen.gastos} href="/gastos" />
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

        {meses.length > 1 && (
          <section className="rounded-sm border border-vino/15 bg-white px-5 py-5">
            <h2 className="font-display text-2xl text-vino">
              Meses fuertes y flojos
            </h2>
            <p className="mb-3 text-sm text-tinta-2">
              Todo lo que se ha registrado desde que abrieron, sin importar el
              rango de arriba. Sirve para pedir con anticipación: si un mes
              siempre repunta, ya sabes cuándo empezar a surtir.
            </p>
            <GraficaMeses meses={meses} />
          </section>
        )}

        {mesesGrupo.length > 0 && (
          <section className="rounded-sm border border-vino/15 bg-white px-5 py-5">
            <h2 className="font-display text-2xl text-vino">
              Qué se vende más según la época
            </h2>
            <p className="mb-3 text-sm text-tinta-2">
              El vino se parte por tipo, no por categoría genérica: así se ve,
              por ejemplo, si el blanco sube en los meses de calor y el tinto en
              los de frío.
            </p>
            <TablaEstacional datos={mesesGrupo} />
          </section>
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
  href,
}: {
  texto: string;
  monto: number;
  fuerte?: boolean;
  href?: string;
}) {
  const clases = `flex justify-between border-b border-vino/10 py-2 text-sm ${
    fuerte ? "font-medium" : ""
  }`;
  const contenido = (
    <>
      <span className={fuerte ? "" : "text-tinta-2"}>
        {texto}
        {href && " →"}
      </span>
      <span className="tabular-nums">{exacto(monto)}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`${clases} hover:bg-rosa-claro/15`}>
        {contenido}
      </Link>
    );
  }
  return <div className={clases}>{contenido}</div>;
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

const MESES_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function etiquetaMes(iso: string) {
  const [anio, mes] = iso.split("-");
  return `${MESES_ES[Number(mes) - 1]} ${anio}`;
}

function GraficaMeses({ meses }: { meses: MesPanel[] }) {
  const tope = Math.max(...meses.map((m) => m.ventas), 1);
  const promedio = meses.reduce((s, m) => s + m.ventas, 0) / meses.length;
  return (
    <div className="overflow-x-auto">
      <ul className="flex min-w-[560px] flex-col gap-2">
        {meses.map((m) => {
          const fuerte = m.ventas >= promedio * 1.15;
          const flojo = m.ventas <= promedio * 0.85;
          return (
            <li
              key={m.mes}
              className="grid grid-cols-[84px_1fr_auto] items-center gap-3 text-sm"
            >
              <span className="text-tinta-2">{etiquetaMes(m.mes)}</span>
              <span className="h-4 rounded-full bg-rosa-claro/40">
                <span
                  className={`block h-4 rounded-full ${
                    fuerte ? "bg-[#556B4A]" : flojo ? "bg-[#9C6A1E]" : "bg-vino"
                  }`}
                  style={{ width: `${Math.max(2, (m.ventas / tope) * 100)}%` }}
                />
              </span>
              <span className="w-24 text-right tabular-nums">{pesos(m.ventas)}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex gap-4 text-xs text-tinta-2">
        <span className="flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-full bg-[#556B4A]" /> mes fuerte
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-full bg-[#9C6A1E]" /> mes flojo
        </span>
      </div>
    </div>
  );
}

const GRUPOS_ESTACION = ["Tinto", "Blanco", "Rosado", "Naranja", "Helados"];

function TablaEstacional({ datos }: { datos: MesGrupo[] }) {
  const meses = [...new Set(datos.map((d) => d.mes))].sort();
  const porCelda = new Map(datos.map((d) => [`${d.mes}|${d.grupo}`, d.ventas]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-vino/15 text-left text-xs tracking-wider text-tinta-2 uppercase">
            <th className="py-2 font-medium">Mes</th>
            {GRUPOS_ESTACION.map((g) => (
              <th key={g} className="py-2 text-right font-medium">
                {g}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {meses.map((mes) => {
            const valores = GRUPOS_ESTACION.map((g) => porCelda.get(`${mes}|${g}`) ?? 0);
            const max = Math.max(...valores, 1);
            return (
              <tr key={mes} className="border-b border-vino/10 last:border-b-0">
                <td className="py-2 text-tinta-2">{etiquetaMes(mes)}</td>
                {GRUPOS_ESTACION.map((g, i) => (
                  <td
                    key={g}
                    className={`py-2 text-right tabular-nums ${
                      valores[i] === max && valores[i] > 0 ? "font-medium text-vino" : ""
                    }`}
                  >
                    {valores[i] > 0 ? pesos(valores[i]) : "—"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-tinta-2">
        En negrita, el que más vendió ese mes entre estos cinco.
      </p>
    </div>
  );
}
