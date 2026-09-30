"use client";

import { useState, useTransition } from "react";
import type { LineaTicket } from "@/lib/datos";
import { lineasDeVenta, devolverLineas } from "./acciones";

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/** Botón "Devolver algo" dentro de cada recibo cobrado: a diferencia de
 * anular la venta completa, aquí se eligen nada más los renglones que el
 * cliente regresó (o que se cobraron mal) — el resto de la cuenta sigue
 * en pie. */
export default function DevolverVenta({ folio }: { folio: number }) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [lineas, setLineas] = useState<LineaTicket[]>([]);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [metodo, setMetodo] = useState<"efectivo" | "tarjeta">("efectivo");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  async function abrir() {
    setAbierto(true);
    setCargando(true);
    setError(null);
    const r = await lineasDeVenta(folio);
    setCargando(false);
    if ("error" in r) {
      setError(r.error);
      return;
    }
    setTicketId(r.ticketId);
    setLineas(r.lineas);
    setElegidas(new Set());
  }

  function alternar(id: string) {
    setElegidas((s) => {
      const copia = new Set(s);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });
  }

  const monto = lineas
    .filter((l) => elegidas.has(l.linea_id))
    .reduce((s, l) => s + l.importe, 0);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={abrir}
        className="self-start rounded-sm border border-vino/25 px-3 py-1.5 text-xs text-vino"
      >
        Devolver algo
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-vino/25 bg-vino/5 p-3">
      {cargando && <p className="text-xs text-tinta-2">Cargando...</p>}

      {!cargando && lineas.length > 0 && (
        <>
          <p className="text-xs text-vino">Elige qué se devuelve:</p>
          <ul className="flex flex-col gap-1">
            {lineas.map((l) => (
              <li key={l.linea_id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={elegidas.has(l.linea_id)}
                    onChange={() => alternar(l.linea_id)}
                  />
                  <span className="flex-1">
                    {l.cantidad}× {l.producto}
                    {l.presentacion !== "Única" && ` · ${l.presentacion}`}
                  </span>
                  <span className="tabular-nums">{pesos(l.importe)}</span>
                </label>
              </li>
            ))}
          </ul>

          {elegidas.size > 0 && (
            <>
              <p className="text-sm">
                Se regresan <span className="font-medium">{pesos(monto)}</span>{" "}
                y su inventario.
              </p>
              <div className="flex gap-2 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={metodo === "efectivo"}
                    onChange={() => setMetodo("efectivo")}
                  />
                  Efectivo
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={metodo === "tarjeta"}
                    onChange={() => setMetodo("tarjeta")}
                  />
                  Tarjeta
                </label>
              </div>
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo (opcional)"
                className="rounded-sm border border-vino/25 bg-white px-3 py-2 text-sm outline-none focus:border-vino"
              />
            </>
          )}
        </>
      )}

      {!cargando && lineas.length === 0 && !error && (
        <p className="text-xs text-tinta-2">
          Ya no queda nada de esta venta por devolver.
        </p>
      )}

      <div className="flex gap-2">
        {elegidas.size > 0 && (
          <button
            type="button"
            disabled={ocupado || !ticketId}
            onClick={() =>
              empezar(async () => {
                setError(null);
                try {
                  const r = await devolverLineas(
                    ticketId!,
                    [...elegidas],
                    metodo,
                    motivo,
                  );
                  if (r?.error) setError(r.error);
                  else setAbierto(false);
                } catch {
                  setError(
                    "Se cortó la conexión. Revisa si ya se devolvió antes de repetir.",
                  );
                }
              })
            }
            className="rounded-sm bg-vino px-3 py-1.5 text-xs font-medium text-crema disabled:opacity-40"
          >
            {ocupado ? "Devolviendo..." : "Confirmar devolución"}
          </button>
        )}
        <button
          type="button"
          disabled={ocupado}
          onClick={() => setAbierto(false)}
          className="rounded-sm border border-vino/25 px-3 py-1.5 text-xs text-vino"
        >
          Cerrar
        </button>
      </div>
      {error && <p className="text-xs text-vino">{error}</p>}
    </div>
  );
}
