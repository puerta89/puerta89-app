import type { TicketPeriodo } from "@/lib/datos";

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/** Todos los recibos cerrados de un día, con lo que dejó cada uno — para
 * poder revisar qué quedó y cuánta propina hubo, no nada más el total del
 * día. Mercedes: "que le aparezcan todos los recibos y la caja porque
 * cuando cierras no sabes lo que quedaba y las propinas no las puedes
 * revisar". */
export default function Recibos({ recibos }: { recibos: TicketPeriodo[] }) {
  if (recibos.length === 0) {
    return (
      <div className="rounded-sm border border-vino/15 bg-white px-5 py-8 text-center text-sm text-tinta-2">
        Todavía no se cierra ningún recibo este día.
      </div>
    );
  }

  const totalPropina = recibos.reduce((s, r) => s + r.propina, 0);

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-vino/15 bg-white px-5 py-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl text-vino">Recibos del día</h2>
        <span className="text-sm text-tinta-2">
          {recibos.length} {recibos.length === 1 ? "recibo" : "recibos"}
        </span>
      </div>
      <p className="-mt-2 text-xs text-tinta-2">
        Toca un recibo para ver qué se pidió. La propina de cada uno es la
        que el mesero capturó al cobrar — sirve para comparar contra lo que
        se reparte al cerrar el día, más abajo.
      </p>

      <div className="flex flex-col divide-y divide-vino/10">
        {recibos.map((r) => (
          <details key={r.folio} className="group py-2.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
              <span className="flex flex-col">
                <span>
                  {r.hora} · {r.mesero ?? "—"}
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

      {totalPropina > 0 && (
        <div className="flex justify-between border-t-2 border-tinta pt-3 text-sm font-medium">
          <span>Propina total capturada en las cuentas</span>
          <span className="tabular-nums">{pesos(totalPropina)}</span>
        </div>
      )}
    </div>
  );
}
