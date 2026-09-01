import type { TicketPeriodo } from "@/lib/datos";

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/** Todos los recibos cerrados del rango elegido, con lo que dejó cada
 * uno — para poder revisar qué quedó y cuánta propina hubo, no nada más
 * el total del periodo. */
export default function ListaRecibos({ recibos }: { recibos: TicketPeriodo[] }) {
  if (recibos.length === 0) {
    return (
      <div className="rounded-sm border border-vino/15 bg-white px-5 py-8 text-center text-sm text-tinta-2">
        No hay recibos cerrados en este periodo.
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-vino/10 rounded-sm border border-vino/15 bg-white px-5 py-2">
      {recibos.map((r) => (
        <details key={r.folio} className="group py-2.5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
            <span className="flex flex-col">
              <span>
                {r.fecha} · {r.hora} · {r.mesero ?? "—"}
                {r.bancos && ` · banco ${r.bancos}`}
              </span>
              {r.propina > 0 && (
                <span className="text-xs text-tinta-2">
                  propina {pesos(r.propina)}
                </span>
              )}
            </span>
            <span className="tabular-nums font-medium">{pesos(r.total)}</span>
          </summary>
          <div className="mt-2 flex flex-col gap-1 pl-1 text-xs text-tinta-2">
            {r.articulos && <p>{r.articulos}</p>}
            <p>
              {r.personas} {r.personas === 1 ? "persona" : "personas"} ·{" "}
              {r.permanencia_min} min en mesa
            </p>
            <p>
              {r.efectivo > 0 && `efectivo ${pesos(r.efectivo)}`}
              {r.efectivo > 0 && r.tarjeta > 0 && " · "}
              {r.tarjeta > 0 && `tarjeta ${pesos(r.tarjeta)}`}
              {r.descuento > 0 && ` · descuento ${pesos(r.descuento)}`}
            </p>
          </div>
        </details>
      ))}
    </div>
  );
}
