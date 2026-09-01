import Link from "next/link";
import type { CorteDelPeriodo } from "@/lib/datos";

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const ETIQUETA_ESTADO: Record<CorteDelPeriodo["estado"], string> = {
  sin_abrir: "No se abrió",
  abierto: "Sigue abierta",
  cerrado: "Cerrada",
};

/** Cómo quedó (o cómo va) la caja de cada día del rango — para responder
 * directo "cuánto quedó la caja de ayer" o "cuánto fue de propina en
 * efectivo" sin tener que entrar día por día a /corte. Mercedes: "hasta
 * abajo del día en cuanto cerró la caja... actualmente no pueden ver en
 * cuánto quedó la caja del día anterior o cuánto es de propinas en
 * efectivo". */
export default function TablaCortes({ cortes }: { cortes: CorteDelPeriodo[] }) {
  return (
    <div className="rounded-sm border border-vino/15 bg-white px-5 py-5">
      <h2 className="mb-1 font-display text-2xl text-vino">Cómo cerró la caja</h2>
      <p className="mb-3 text-sm text-tinta-2">
        Un renglón por día. &ldquo;Sobra/falta&rdquo; y las propinas solo se
        saben hasta que alguien cierra el día en /corte.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-vino/15 text-left text-xs tracking-wider text-tinta-2 uppercase">
              <th className="py-2 font-medium">Día</th>
              <th className="py-2 font-medium">Estado</th>
              <th className="py-2 text-right font-medium">Esperado</th>
              <th className="py-2 text-right font-medium">Contado</th>
              <th className="py-2 text-right font-medium">Sobra/falta</th>
              <th className="py-2 text-right font-medium">Propina efectivo</th>
              <th className="py-2 text-right font-medium">Propina tarjeta</th>
              <th className="py-2 font-medium">Cerró</th>
            </tr>
          </thead>
          <tbody>
            {cortes.map((c) => (
              <tr key={c.fecha} className="border-b border-vino/10 last:border-b-0">
                <td className="py-2 whitespace-nowrap">{c.fecha}</td>
                <td className="py-2">
                  {c.estado === "abierto" ? (
                    <Link
                      href={`/corte?fecha=${c.fecha}`}
                      className="font-medium text-[#9C6A1E] underline"
                    >
                      {ETIQUETA_ESTADO[c.estado]} →
                    </Link>
                  ) : (
                    <span
                      className={c.estado === "sin_abrir" ? "text-tinta-2" : ""}
                    >
                      {ETIQUETA_ESTADO[c.estado]}
                    </span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {pesos(c.efectivo_esperado)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {c.efectivo_contado === null ? "—" : pesos(c.efectivo_contado)}
                </td>
                <td
                  className={`py-2 text-right tabular-nums ${
                    c.sobrante !== null && c.sobrante < 0 ? "text-vino" : ""
                  }`}
                >
                  {c.sobrante === null ? "—" : pesos(c.sobrante)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {c.propina_efectivo === null ? "—" : pesos(c.propina_efectivo)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {c.propina_tarjeta === null ? "—" : pesos(c.propina_tarjeta)}
                </td>
                <td className="py-2 text-tinta-2">{c.cerrado_por ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
