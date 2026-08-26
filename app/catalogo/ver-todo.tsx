"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemCatalogoCompleto } from "@/lib/datos";
import { cambiarPrecio } from "./acciones";

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function VerTodo({ catalogo }: { catalogo: ItemCatalogoCompleto[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState<ItemCatalogoCompleto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  const filtrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return catalogo;
    return catalogo.filter(
      (i) =>
        i.producto.toLowerCase().includes(q) ||
        i.categoria.toLowerCase().includes(q) ||
        i.presentacion.toLowerCase().includes(q),
    );
  }, [catalogo, busqueda]);

  const porCategoria = useMemo(() => {
    const grupos = new Map<string, ItemCatalogoCompleto[]>();
    for (const item of filtrado) {
      const lista = grupos.get(item.categoria) ?? [];
      lista.push(item);
      grupos.set(item.categoria, lista);
    }
    return [...grupos.entries()];
  }, [filtrado]);

  function guardarPrecio(precio: number, costo: number) {
    if (!abierto) return;
    setError(null);
    empezar(async () => {
      const r = await cambiarPrecio(abierto.presentacion_id, precio, costo);
      if (r?.error) setError(r.error);
      else {
        setAbierto(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar un producto..."
        className="rounded-sm border border-vino/25 px-3 py-2.5 text-sm outline-none focus:border-vino"
      />

      {porCategoria.length === 0 ? (
        <p className="rounded-sm border border-vino/15 bg-white px-5 py-10 text-center text-sm text-tinta-2">
          No hay nada que coincida con esa búsqueda.
        </p>
      ) : (
        porCategoria.map(([categoria, items]) => (
          <div key={categoria} className="rounded-sm border border-vino/15 bg-white">
            <p className="border-b border-vino/15 px-4 py-2.5 text-sm font-medium text-vino">
              {categoria}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-vino/15 text-left text-xs tracking-wider text-tinta-2 uppercase">
                    <th className="px-4 py-2 font-medium">Producto</th>
                    <th className="px-3 py-2 text-right font-medium">Precio</th>
                    <th className="px-3 py-2 text-right font-medium">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr
                      key={i.presentacion_id}
                      onClick={() => setAbierto(i)}
                      className={`cursor-pointer border-b border-vino/10 last:border-b-0 active:bg-rosa-claro/25 ${
                        !i.activo ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        {i.producto}
                        <span className="text-tinta-2">
                          {" "}
                          · {i.presentacion}
                          {!i.activo && " · inactivo"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {i.precio === null ? (
                          <span className="text-[#9C6A1E]">sin precio aquí</span>
                        ) : (
                          pesos(i.precio)
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-tinta-2">
                        {i.costo === null ? "—" : pesos(i.costo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      <p className="text-xs text-tinta-2">
        Pica cualquier renglón para cambiarle el precio o el costo. Lo anterior
        no se borra: queda guardado como historial, para que las ventas ya
        hechas conserven su precio real.
      </p>

      {abierto && (
        <PanelPrecio
          item={abierto}
          cerrar={() => setAbierto(null)}
          guardar={guardarPrecio}
          ocupado={ocupado}
          error={error}
        />
      )}
    </div>
  );
}

function PanelPrecio({
  item,
  cerrar,
  guardar,
  ocupado,
  error,
}: {
  item: ItemCatalogoCompleto;
  cerrar: () => void;
  guardar: (precio: number, costo: number) => void;
  ocupado: boolean;
  error: string | null;
}) {
  const [precio, setPrecio] = useState(item.precio === null ? "" : String(item.precio));
  const [costo, setCosto] = useState(item.costo === null ? "" : String(item.costo));
  const valido = Number(precio) > 0 && Number(costo) >= 0;

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-tinta/50 sm:items-center sm:p-6">
      <div className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-lg bg-crema sm:rounded-lg">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-vino/15 bg-crema px-4 py-3">
          <div>
            <p className="font-medium">{item.producto}</p>
            <p className="text-xs text-tinta-2">{item.presentacion}</p>
          </div>
          <button
            type="button"
            onClick={cerrar}
            className="rounded-sm border border-vino/25 px-3 py-1.5 text-sm text-vino"
          >
            Cerrar
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <label className="flex flex-col gap-1.5 text-sm">
            Precio de venta
            <input
              inputMode="decimal"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="rounded-sm border border-vino/25 px-3 py-3 tabular-nums outline-none focus:border-vino"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            Lo que cuesta
            <input
              inputMode="decimal"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
              className="rounded-sm border border-vino/25 px-3 py-3 tabular-nums outline-none focus:border-vino"
            />
          </label>

          {error && (
            <p className="rounded-sm bg-vino/10 px-4 py-3 text-sm text-vino">{error}</p>
          )}

          <button
            type="button"
            disabled={ocupado || !valido}
            onClick={() => guardar(Number(precio), Number(costo))}
            className="rounded-sm bg-vino px-4 py-3 text-sm font-medium text-crema disabled:opacity-40"
          >
            {ocupado ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
