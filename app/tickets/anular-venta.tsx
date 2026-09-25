"use client";

import { useState, useTransition } from "react";
import { anularVenta } from "./acciones";

/** Botón de "Anular venta" dentro de cada recibo cobrado. Pide confirmar
 * (y un motivo opcional) antes de hacer nada. */
export default function AnularVenta({ folio }: { folio: number }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="self-start rounded-sm border border-vino/25 px-3 py-1.5 text-xs text-vino"
      >
        Anular esta venta
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-vino/25 bg-vino/5 p-3">
      <p className="text-xs text-vino">
        Se anula como si nunca hubiera pasado: el inventario regresa y el pago
        se borra. Queda anotado quién lo hizo.
      </p>
      <input
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo (opcional)"
        className="rounded-sm border border-vino/25 bg-white px-3 py-2 text-sm outline-none focus:border-vino"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={ocupado}
          onClick={() =>
            empezar(async () => {
              setError(null);
              try {
                const r = await anularVenta(folio, motivo);
                if (r?.error) setError(r.error);
              } catch {
                setError("Se cortó la conexión. Revisa si ya se anuló antes de repetir.");
              }
            })
          }
          className="rounded-sm bg-vino px-3 py-1.5 text-xs font-medium text-crema disabled:opacity-40"
        >
          {ocupado ? "Anulando..." : "Sí, anular"}
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => setAbierto(false)}
          className="rounded-sm border border-vino/25 px-3 py-1.5 text-xs text-vino"
        >
          No
        </button>
      </div>
      {error && <p className="text-xs text-vino">{error}</p>}
    </div>
  );
}
