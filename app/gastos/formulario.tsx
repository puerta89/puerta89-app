"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Gasto } from "@/lib/datos";
import { nuevoGasto, editarGasto, eliminarGasto } from "./acciones";

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
  const [editando, setEditando] = useState<Gasto | null>(null);

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
              <li key={g.id} className="border-b border-vino/10 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setEditando(g)}
                  className="flex w-full items-baseline justify-between gap-3 py-2.5 text-left text-sm active:bg-rosa-claro/25"
                >
                  <span>
                    {g.concepto}
                    <span className="block text-xs text-tinta-2">
                      {g.categoria} · {g.fecha}
                      {g.recurrente && " · cada mes"}
                    </span>
                  </span>
                  <span className="tabular-nums">{pesos(g.monto)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-tinta-2">
          Pica cualquier gasto para moverlo, cambiarle el monto o borrarlo.
        </p>
      </div>

      {editando && (
        <PanelGasto gasto={editando} cerrar={() => setEditando(null)} />
      )}
    </div>
  );
}

function PanelGasto({ gasto, cerrar }: { gasto: Gasto; cerrar: () => void }) {
  const router = useRouter();
  const [categoria, setCategoria] = useState(gasto.categoria);
  const [concepto, setConcepto] = useState(gasto.concepto);
  const [monto, setMonto] = useState(String(gasto.monto));
  const [fecha, setFecha] = useState(gasto.fecha);
  const [recurrente, setRecurrente] = useState(gasto.recurrente);
  const [error, setError] = useState<string | null>(null);
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false);
  const [ocupado, empezar] = useTransition();

  const valido = concepto.trim().length > 0 && Number(monto) > 0;

  function guardar() {
    setError(null);
    empezar(async () => {
      const r = await editarGasto(gasto.id, categoria, concepto, Number(monto), fecha, recurrente);
      if (r?.error) setError(r.error);
      else {
        router.refresh();
        cerrar();
      }
    });
  }

  function borrar() {
    setError(null);
    empezar(async () => {
      const r = await eliminarGasto(gasto.id);
      if (r?.error) setError(r.error);
      else {
        router.refresh();
        cerrar();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-tinta/50 sm:items-center sm:p-6">
      <div className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-lg bg-crema sm:rounded-lg">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-vino/15 bg-crema px-4 py-3">
          <p className="font-medium">Editar gasto</p>
          <button
            type="button"
            onClick={cerrar}
            className="rounded-sm border border-vino/25 px-3 py-1.5 text-sm text-vino"
          >
            Cerrar
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
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

          {error && (
            <p className="rounded-sm bg-vino/10 px-4 py-3 text-sm text-vino">{error}</p>
          )}

          <button
            type="button"
            disabled={ocupado || !valido}
            onClick={guardar}
            className="rounded-sm bg-vino px-4 py-3.5 font-medium text-crema disabled:opacity-40"
          >
            {ocupado ? "Guardando..." : "Guardar cambios"}
          </button>

          {confirmandoBorrar ? (
            <div className="flex flex-col gap-2 rounded-sm border border-vino/25 bg-vino/5 p-3">
              <p className="text-sm text-tinta-2">¿Estás seguro? Se borra por completo.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={borrar}
                  className="flex-1 rounded-sm bg-vino px-4 py-2.5 text-sm font-medium text-crema disabled:opacity-40"
                >
                  {ocupado ? "Borrando..." : "Sí, borrar"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoBorrar(false)}
                  className="flex-1 rounded-sm border border-vino/25 px-4 py-2.5 text-sm text-vino"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmandoBorrar(true)}
              className="text-sm text-vino underline"
            >
              Borrar este gasto
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
