"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemInventario } from "@/lib/datos";
import { registrarCompra, nuevoProveedor, type LineaCompra } from "../acciones";

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

type Renglon = LineaCompra & { nombre: string; unidad: string };

export default function Formulario({
  items,
  proveedores,
  hoy,
}: {
  items: ItemInventario[];
  proveedores: { id: string; nombre: string }[];
  hoy: string;
}) {
  const router = useRouter();
  const [proveedor, setProveedor] = useState("");
  const [nuevoProv, setNuevoProv] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [folio, setFolio] = useState("");
  const [renglones, setRenglones] = useState<Renglon[]>([]);
  const [busca, setBusca] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  const total = renglones.reduce((s, r) => s + r.cantidad * r.costo_unitario, 0);

  const encontrados = busca.trim()
    ? items
        .filter((i) => i.nombre.toLowerCase().includes(busca.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  function agregar(i: ItemInventario) {
    const clave = i.producto_id ?? i.presentacion_id;
    if (renglones.some((r) => (r.producto_id ?? r.presentacion_id) === clave)) return;
    setRenglones((p) => [
      ...p,
      {
        producto_id: i.producto_id,
        presentacion_id: i.presentacion_id,
        cantidad: 1,
        // arranca con lo último que costó, o con el catálogo
        costo_unitario: i.costo_promedio || i.costo_catalogo || 0,
        nombre: i.nombre,
        unidad: i.unidad,
      },
    ]);
    setBusca("");
  }

  function cambiar(idx: number, campo: "cantidad" | "costo_unitario", valor: string) {
    setRenglones((p) =>
      p.map((r, k) => (k === idx ? { ...r, [campo]: Number(valor) || 0 } : r)),
    );
  }

  function correr(fn: () => Promise<{ error: string } | null>, alTerminar?: () => void) {
    setError(null);
    empezar(async () => {
      const r = await fn();
      if (r?.error) setError(r.error);
      else {
        alTerminar?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-sm border border-vino/15 bg-white px-5 py-5">
        <label className="flex flex-col gap-1.5 text-sm">
          Proveedor
          <select
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            className="rounded-sm border border-vino/25 bg-white px-3 py-3 outline-none focus:border-vino"
          >
            <option value="">Sin especificar</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={nuevoProv}
            onChange={(e) => setNuevoProv(e.target.value)}
            placeholder="O da de alta uno nuevo"
            className="flex-1 rounded-sm border border-vino/25 px-3 py-3 text-sm outline-none focus:border-vino"
          />
          <button
            type="button"
            disabled={ocupado || !nuevoProv.trim()}
            onClick={() =>
              correr(() => nuevoProveedor(nuevoProv), () => setNuevoProv(""))
            }
            className="rounded-sm border border-vino/30 px-4 py-3 text-sm text-vino disabled:opacity-40"
          >
            Agregar
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            Fecha
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-sm border border-vino/25 px-3 py-3 outline-none focus:border-vino"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            Folio de la factura o nota
            <input
              value={folio}
              onChange={(e) => setFolio(e.target.value)}
              placeholder="Opcional"
              className="rounded-sm border border-vino/25 px-3 py-3 outline-none focus:border-vino"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-sm border border-vino/15 bg-white px-5 py-5">
        <label className="flex flex-col gap-1.5 text-sm">
          ¿Qué llegó?
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Escribe el nombre del producto"
            className="rounded-sm border border-vino/25 px-3 py-3 outline-none focus:border-vino"
          />
        </label>

        {encontrados.length > 0 && (
          <ul className="rounded-sm border border-vino/15">
            {encontrados.map((i) => (
              <li key={i.producto_id ?? i.presentacion_id}>
                <button
                  type="button"
                  onClick={() => agregar(i)}
                  className="flex w-full items-center justify-between gap-3 border-b border-vino/10 px-3 py-3 text-left text-sm last:border-b-0 active:bg-rosa-claro/25"
                >
                  <span>{i.nombre}</span>
                  <span className="text-xs text-tinta-2">{i.categoria}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {renglones.length > 0 && (
          <ul className="flex flex-col gap-3 border-t border-vino/10 pt-3">
            {renglones.map((r, idx) => (
              <li key={r.producto_id ?? r.presentacion_id} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{r.nombre}</span>
                  <button
                    type="button"
                    onClick={() => setRenglones((p) => p.filter((_, k) => k !== idx))}
                    className="text-xs text-vino underline"
                  >
                    quitar
                  </button>
                </div>
                <div className="flex gap-2">
                  <label className="flex flex-1 flex-col gap-1 text-xs text-tinta-2">
                    Cuántos {r.unidad}
                    <input
                      inputMode="decimal"
                      value={r.cantidad}
                      onChange={(e) => cambiar(idx, "cantidad", e.target.value)}
                      className="rounded-sm border border-vino/25 px-3 py-2.5 text-base tabular-nums outline-none focus:border-vino"
                    />
                  </label>
                  <label className="flex flex-1 flex-col gap-1 text-xs text-tinta-2">
                    Costo de cada uno
                    <input
                      inputMode="decimal"
                      value={r.costo_unitario}
                      onChange={(e) => cambiar(idx, "costo_unitario", e.target.value)}
                      className="rounded-sm border border-vino/25 px-3 py-2.5 text-base tabular-nums outline-none focus:border-vino"
                    />
                  </label>
                  <span className="self-end pb-2.5 text-sm tabular-nums">
                    {pesos(r.cantidad * r.costo_unitario)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between border-t-2 border-tinta pt-3 text-lg font-medium">
          <span>Total de la compra</span>
          <span className="tabular-nums">{pesos(total)}</span>
        </div>

        <button
          type="button"
          disabled={ocupado || renglones.length === 0}
          onClick={() =>
            correr(
              () =>
                registrarCompra(
                  proveedor || null,
                  fecha,
                  folio,
                  renglones.map(({ nombre, unidad, ...l }) => {
                    void nombre;
                    void unidad;
                    return l;
                  }),
                ),
              () => router.push("/inventario"),
            )
          }
          className="rounded-sm bg-vino px-4 py-4 text-lg font-medium text-crema disabled:opacity-40"
        >
          {ocupado ? "Guardando..." : "Registrar la compra"}
        </button>

        <p className="text-xs text-tinta-2">
          Al guardar, el inventario sube y el costo real de cada producto se
          recalcula con lo que acabas de pagar.
        </p>
      </div>

      {error && (
        <p className="rounded-sm bg-vino/10 px-4 py-3 text-sm text-vino">{error}</p>
      )}
    </div>
  );
}
