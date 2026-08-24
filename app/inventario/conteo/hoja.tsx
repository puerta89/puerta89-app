"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemInventario } from "@/lib/datos";
import { registrarConteo, type Diferencia } from "../acciones";

const cifra = (n: number) =>
  n.toLocaleString("es-MX", { maximumFractionDigits: 2 });

export default function Hoja({ items }: { items: ItemInventario[] }) {
  const router = useRouter();
  const [contado, setContado] = useState<Record<string, string>>({});
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Diferencia[] | null>(null);
  const [ocupado, empezar] = useTransition();

  const cuantos = Object.values(contado).filter((v) => v.trim() !== "").length;

  function guardar() {
    setError(null);
    const lista = items
      .filter((i) => {
        const v = contado[i.producto_id ?? i.presentacion_id!];
        return v !== undefined && v.trim() !== "" && Number.isFinite(Number(v));
      })
      .map((i) => ({
        producto_id: i.producto_id,
        presentacion_id: i.presentacion_id,
        contado: Number(contado[i.producto_id ?? i.presentacion_id!]),
      }));

    empezar(async () => {
      const r = await registrarConteo(codigo, lista);
      if ("error" in r) setError(r.error);
      else {
        setResultado(r.diferencias);
        setContado({});
        setCodigo("");
        router.refresh();
      }
    });
  }

  if (resultado) {
    const conDiferencia = resultado.filter((d) => d.diferencia !== 0);
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-sm border border-vino/15 bg-white px-5 py-5">
          <h2 className="font-display text-2xl text-vino">Así quedó</h2>
          <p className="mt-1 mb-4 text-sm text-tinta-2">
            {conDiferencia.length === 0
              ? "Todo cuadró exacto. Eso casi nunca pasa — buena señal."
              : `${conDiferencia.length} ${conDiferencia.length === 1 ? "cosa no cuadró" : "cosas no cuadraron"}. Esa diferencia es el dato más útil que tienes: es lo que se fue sin registrarse.`}
          </p>
          <ul>
            {resultado.map((d) => (
              <li
                key={d.nombre}
                className="flex justify-between gap-3 border-b border-vino/10 py-2 text-sm last:border-b-0"
              >
                <span>{d.nombre}</span>
                <span className="flex gap-4 tabular-nums">
                  <span className="text-tinta-2">
                    creía {cifra(d.esperaba)} · había {cifra(d.habia)}
                  </span>
                  <span
                    className={
                      d.diferencia === 0
                        ? "text-[#556B4A]"
                        : d.diferencia < 0
                          ? "text-vino"
                          : "text-[#9C6A1E]"
                    }
                  >
                    {d.diferencia > 0 ? "+" : ""}
                    {cifra(d.diferencia)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => router.push("/inventario")}
          className="rounded-sm bg-vino px-4 py-4 font-medium text-crema"
        >
          Volver al inventario
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-tinta-2">
        Cuenta lo que de verdad hay y escríbelo. Lo que dejes vacío no se toca.
        La diferencia contra lo que el sistema creía queda registrada.
      </p>

      <div className="overflow-hidden rounded-sm border border-vino/15 bg-white">
        {items.map((i) => {
          const clave = i.producto_id ?? i.presentacion_id!;
          return (
            <label
              key={clave}
              className="flex items-center justify-between gap-3 border-b border-vino/10 px-4 py-2.5 text-sm last:border-b-0"
            >
              <span className="flex-1">
                {i.nombre}
                <span className="block text-xs text-tinta-2">
                  el sistema cree que hay {cifra(i.cantidad)} {i.unidad}
                </span>
              </span>
              <input
                inputMode="decimal"
                value={contado[clave] ?? ""}
                onChange={(e) =>
                  setContado((p) => ({ ...p, [clave]: e.target.value }))
                }
                placeholder="—"
                className="w-24 rounded-sm border border-vino/25 px-3 py-2 text-right tabular-nums outline-none focus:border-vino"
              />
            </label>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-sm border border-vino/15 bg-white px-5 py-5">
        <p className="text-sm">
          Vas a guardar <strong>{cuantos}</strong>{" "}
          {cuantos === 1 ? "conteo" : "conteos"}.
        </p>
        <input
          inputMode="numeric"
          maxLength={4}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="Código del dueño"
          className="rounded-sm border border-vino/25 px-3 py-3 text-center text-xl tracking-[0.4em] outline-none focus:border-vino"
        />
        <button
          type="button"
          disabled={ocupado || cuantos === 0 || codigo.length !== 4}
          onClick={guardar}
          className="rounded-sm bg-vino px-4 py-4 text-lg font-medium text-crema disabled:opacity-40"
        >
          {ocupado ? "Guardando..." : "Cerrar el conteo"}
        </button>
      </div>

      {error && (
        <p className="rounded-sm bg-vino/10 px-4 py-3 text-sm text-vino">{error}</p>
      )}
    </div>
  );
}
