"use client";

import { useMemo, useState } from "react";
import type { Categoria, Insumo, ItemCatalogoCompleto } from "@/lib/datos";
import EditarProducto from "./editar-producto";

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function VerTodo({
  catalogo,
  categorias,
  insumos,
}: {
  catalogo: ItemCatalogoCompleto[];
  categorias: Categoria[];
  insumos: Insumo[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState<ItemCatalogoCompleto | null>(null);

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

  const activos = useMemo(() => filtrado.filter((i) => i.activo), [filtrado]);
  const inactivos = useMemo(() => filtrado.filter((i) => !i.activo), [filtrado]);

  const porCategoria = useMemo(() => {
    const grupos = new Map<string, ItemCatalogoCompleto[]>();
    for (const item of activos) {
      const lista = grupos.get(item.categoria) ?? [];
      lista.push(item);
      grupos.set(item.categoria, lista);
    }
    return [...grupos.entries()];
  }, [activos]);

  return (
    <div className="flex flex-col gap-3">
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar un producto..."
        className="rounded-sm border border-vino/25 px-3 py-2.5 text-sm outline-none focus:border-vino"
      />

      {porCategoria.length === 0 && inactivos.length === 0 ? (
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
                      className="cursor-pointer border-b border-vino/10 last:border-b-0 active:bg-rosa-claro/25"
                    >
                      <td className="px-4 py-2.5">
                        {i.producto}
                        <span className="text-tinta-2"> · {i.presentacion}</span>
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
        Pica cualquier renglón para abrir el desglose completo — nombre,
        categoría, precio, costo e ingredientes — y cambiar lo que haga
        falta. Los precios no se borran: quedan de historial, para que las
        ventas ya hechas conserven su precio real.
      </p>

      {inactivos.length > 0 && (
        <details className="rounded-sm border border-vino/15 bg-white">
          <summary className="cursor-pointer px-4 py-2.5 text-sm text-tinta-2">
            Inactivos / de temporada ({inactivos.length})
          </summary>
          <div className="overflow-x-auto border-t border-vino/15">
            <table className="w-full min-w-[480px] text-sm">
              <tbody>
                {inactivos.map((i) => (
                  <tr
                    key={i.presentacion_id}
                    onClick={() => setAbierto(i)}
                    className="cursor-pointer border-b border-vino/10 opacity-60 last:border-b-0 active:bg-rosa-claro/25"
                  >
                    <td className="px-4 py-2.5">
                      {i.producto}
                      <span className="text-tinta-2">
                        {" "}
                        · {i.presentacion} · {i.categoria}
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
        </details>
      )}

      {abierto && (
        <EditarProducto
          item={abierto}
          categorias={categorias}
          insumos={insumos}
          catalogo={catalogo}
          cerrar={() => setAbierto(null)}
        />
      )}
    </div>
  );
}
