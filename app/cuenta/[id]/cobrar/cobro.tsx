"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Pago } from "@/lib/datos";
import {
  agregarPago,
  quitarPago,
  cerrarCuenta,
} from "../acciones";

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function Cobro({
  ticketId,
  total,
  pagos,
}: {
  ticketId: string;
  total: number;
  pagos: Pago[];
}) {
  const router = useRouter();
  const pagado = pagos.reduce((s, p) => s + p.monto, 0);
  const falta = Math.round((total - pagado) * 100) / 100;

  const [monto, setMonto] = useState("");
  const [propina, setPropina] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  function correr(fn: () => Promise<{ error: string } | null>, alCerrar?: () => void) {
    setError(null);
    empezar(async () => {
      const r = await fn();
      if (r?.error) setError(r.error);
      else {
        alCerrar?.();
        router.refresh();
      }
    });
  }

  function cobrar(metodo: "efectivo" | "tarjeta") {
    // Si no escriben monto, se cobra todo lo que falta.
    const n = monto.trim() === "" ? falta : Number(monto);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Ese monto no se entiende.");
      return;
    }
    correr(
      () => agregarPago(ticketId, metodo, n, null),
      () => setMonto(""),
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <div className="rounded-sm border border-vino/15 bg-white px-5 py-5">
        <div className="flex items-baseline justify-between">
          <span className="text-tinta-2">Total de la cuenta</span>
          <span className="text-2xl font-medium tabular-nums">{pesos(total)}</span>
        </div>

        {pagos.length > 0 && (
          <ul className="mt-4 border-t border-vino/10 pt-3">
            {pagos.map((p) => (
              <li
                key={p.pago_id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="capitalize">{p.metodo}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{pesos(p.monto)}</span>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => correr(() => quitarPago(ticketId, p.pago_id))}
                    className="rounded-sm border border-vino/25 px-2.5 py-1 text-xs text-vino disabled:opacity-40"
                  >
                    Quitar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div
          className={`mt-4 flex items-baseline justify-between border-t-2 pt-3 text-lg font-medium ${
            falta <= 0 ? "border-[#556B4A] text-[#556B4A]" : "border-tinta"
          }`}
        >
          <span>{falta <= 0 ? "Cubierta" : "Falta"}</span>
          <span className="tabular-nums">{pesos(Math.max(0, falta))}</span>
        </div>
      </div>

      {falta > 0 && (
        <div className="flex flex-col gap-3 rounded-sm border border-vino/15 bg-white px-5 py-5">
          <label className="text-sm text-tinta-2" htmlFor="monto">
            ¿Cuánto? Si lo dejas vacío se cobra todo lo que falta.
          </label>
          <input
            id="monto"
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder={pesos(falta)}
            className="rounded-sm border border-vino/25 px-4 py-3 text-xl tabular-nums outline-none focus:border-vino"
          />
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => cobrar("efectivo")}
              className="rounded-sm border-2 border-vino px-4 py-4 font-medium text-vino disabled:opacity-50"
            >
              Efectivo
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => cobrar("tarjeta")}
              className="rounded-sm bg-vino px-4 py-4 font-medium text-crema disabled:opacity-50"
            >
              Tarjeta
            </button>
          </div>
          <p className="text-xs text-tinta-2">
            La tarjeta se cobra en la terminal del banco. Aquí solo se anota
            con qué se pagó.
          </p>
        </div>
      )}

      {falta <= 0 && (
        <div className="flex flex-col gap-3 rounded-sm border border-vino/15 bg-white px-5 py-5">
          <label className="text-sm text-tinta-2" htmlFor="propina">
            Propina, si la dejaron en la app (opcional)
          </label>
          <input
            id="propina"
            inputMode="decimal"
            value={propina}
            onChange={(e) => setPropina(e.target.value)}
            placeholder="0"
            className="rounded-sm border border-vino/25 px-4 py-3 text-xl tabular-nums outline-none focus:border-vino"
          />
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              correr(
                () => cerrarCuenta(ticketId, Number(propina) || 0),
                () => router.push("/barra"),
              )
            }
            className="rounded-sm bg-vino px-4 py-4 text-lg font-medium text-crema disabled:opacity-50"
          >
            {ocupado ? "Cerrando..." : "Cerrar la cuenta"}
          </button>
          <p className="text-xs text-tinta-2">
            Al cerrar, los bancos quedan libres y la cuenta ya no se puede
            cambiar.
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-sm bg-vino/10 px-4 py-3 text-sm text-vino">{error}</p>
      )}
    </div>
  );
}
