"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Gasto } from "@/lib/datos";
import { nuevoGasto } from "./acciones";

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const CATEGORIAS = ["Renta", "Nómina", "Luz", "Agua", "Insumos", "Publicidad", "Otros"];

export default function Formulario({
  gastos,
  hoy,
}: {
  gastos: Gasto[];
  hoy: string;
}) {
  const router = useRouter();
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [recurrente, setRecurrente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  const total = gastos.reduce((s, g) => s + g.monto, 0);

  function guardar() {
    setError(null);
    empezar(async () => {
      const r = await nuevoGasto(categoria, concepto, Number(monto) || 0, fecha, recurrente);
      if (r?.error) setError(r.error);
      else {
        setConcepto("");
        setMonto("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-sm border border-vino/15 bg-white px-5 py-5">
        <h2 className="font-display text-2xl text-vino">Anotar un gasto</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="rounded-sm border border-vino/25 bg-white px-3 py-3 outline-none focus:border-vino"
          >
            {CATEGORIAS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="De qué fue"
            className="flex-1 rounded-sm border border-vino/25 px-3 py-3 outline-none focus:border-vino"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="Cuánto"
            className="rounded-sm border border-vino/25 px-3 py-3 tabular-nums outline-none focus:border-vino sm:w-40"
          />
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="flex-1 rounded-sm border border-vino/25 px-3 py-3 outline-none focus:border-vino"
          />
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={recurrente}
            onChange={(e) => setRecurrente(e.target.checked)}
            className="size-5 accent-[#781727]"
          />
          Se paga todos los meses
        </label>
        <button
          type="button"
          disabled={ocupado || !concepto.trim() || !(Number(monto) > 0)}
          onClick={guardar}
          className="rounded-sm bg-vino px-4 py-3.5 font-medium text-crema disabled:opacity-40"
        >
          {ocupado ? "Guardando..." : "Anotar el gasto"}
        </button>
        {error && (
          <p className="rounded-sm bg-vino/10 px-4 py-3 text-sm text-vino">{error}</p>
        )}
      </div>

      <div className="rounded-sm border border-vino/15 bg-white px-5 py-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl text-vino">Del periodo</h2>
          <span className="text-lg tabular-nums">{pesos(total)}</span>
        </div>
        {gastos.length === 0 ? (
          <p className="py-8 text-center text-sm text-tinta-2">
            Todavía no hay gastos anotados.
          </p>
        ) : (
          <ul className="mt-3">
            {gastos.map((g) => (
              <li
                key={g.id}
                className="flex items-baseline justify-between gap-3 border-b border-vino/10 py-2.5 text-sm last:border-b-0"
              >
                <span>
                  {g.concepto}
                  <span className="block text-xs text-tinta-2">
                    {g.categoria} · {g.fecha}
                    {g.recurrente && " · cada mes"}
                  </span>
                </span>
                <span className="tabular-nums">{pesos(g.monto)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
