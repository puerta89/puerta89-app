"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemInventario } from "@/lib/datos";
import { fijarMinimo, registrarMerma, cambiarActivo, fijarRendimiento } from "./acciones";

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const cifra = (n: number) =>
  n.toLocaleString("es-MX", { maximumFractionDigits: 2 });

export default function Lista({ items }: { items: ItemInventario[] }) {
  const router = useRouter();
  const [vista, setVista] = useState<"pedir" | "todo">("pedir");
  const [abierto, setAbierto] = useState<ItemInventario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  const activos = useMemo(() => items.filter((i) => i.activo), [items]);
  const inactivos = useMemo(() => items.filter((i) => !i.activo), [items]);
  // El merch (gorras, hoodies, playeras por talla) se separa del resto:
  // no se agota al mismo ritmo que vino/helado y mezclado confunde.
  const merch = useMemo(() => activos.filter((i) => i.categoria === "Merch"), [activos]);
  const activosSinMerch = useMemo(
    () => activos.filter((i) => i.categoria !== "Merch"),
    [activos],
  );

  const porPedir = useMemo(
    () =>
      activos
        .filter((i) => i.sugerido > 0 || (i.minimo > 0 && i.cantidad <= i.minimo))
        .sort((a, b) => (a.dias_restantes ?? 999) - (b.dias_restantes ?? 999)),
    [activos],
  );

  const mostrar = vista === "pedir" ? porPedir : activosSinMerch;

  function correr(fn: () => Promise<{ error: string } | null>) {
    setError(null);
    empezar(async () => {
      const r = await fn();
      if (r?.error) setError(r.error);
      else {
        setAbierto(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(["pedir", "todo"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVista(v)}
            className={`rounded-full px-4 py-2 text-sm transition-colors ${
              v === vista ? "bg-vino text-crema" : "border border-vino/25 text-vino"
            }`}
          >
            {v === "pedir" ? `Qué pedir (${porPedir.length})` : "Todo el inventario"}
          </button>
        ))}
      </div>

      {mostrar.length === 0 ? (
        <p className="rounded-sm border border-vino/15 bg-white px-5 py-10 text-center text-sm text-tinta-2">
          {vista === "pedir"
            ? "No hay nada por pedir. Todo alcanza."
            : "Todavía no hay nada en el inventario."}
        </p>
      ) : (
        <TablaItems items={mostrar} onAbrir={setAbierto} />
      )}

      {vista === "todo" && merch.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-tinta-2">Merch</p>
          <TablaItems items={merch} onAbrir={setAbierto} />
        </div>
      )}

      <p className="text-xs text-tinta-2">
        «Al día» es lo que se consume en promedio, sacado de las ventas de las
        últimas 4 semanas. «Alcanza» son los días que quedan a ese ritmo (o,
        si es un insumo compartido, cuántas unidades más rinde). Pica
        cualquier renglón para fijarle un mínimo, registrar una merma, o
        desactivarlo.
      </p>

      {inactivos.length > 0 && (
        <details className="rounded-sm border border-vino/15 bg-white">
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-tinta-2">
            Inactivos / de temporada ({inactivos.length})
          </summary>
          <div className="overflow-x-auto border-t border-vino/15">
            <table className="w-full min-w-[420px] text-sm">
              <tbody>
                {inactivos.map((i) => (
                  <tr
                    key={i.producto_id ?? i.presentacion_id}
                    onClick={() => setAbierto(i)}
                    className="cursor-pointer border-b border-vino/10 last:border-b-0 active:bg-rosa-claro/25"
                  >
                    <td className="px-4 py-3">
                      {i.nombre}
                      <span className="block text-xs text-tinta-2">{i.categoria}</span>
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-tinta-2">
                      Toca para reactivar
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {error && (
        <p className="rounded-sm bg-vino/10 px-4 py-3 text-sm text-vino">{error}</p>
      )}

      {abierto && (
        <Panel
          item={abierto}
          cerrar={() => setAbierto(null)}
          correr={correr}
          ocupado={ocupado}
        />
      )}
    </div>
  );
}

function TablaItems({
  items,
  onAbrir,
}: {
  items: ItemInventario[];
  onAbrir: (item: ItemInventario) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-sm border border-vino/15 bg-white">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-vino/15 text-left text-xs tracking-wider text-tinta-2 uppercase">
            <th className="px-4 py-3 font-medium">Producto</th>
            <th className="px-3 py-3 text-right font-medium">Hay</th>
            <th className="px-3 py-3 text-right font-medium">Al día</th>
            <th className="px-3 py-3 text-right font-medium">Alcanza</th>
            <th className="px-3 py-3 text-right font-medium">Pedir</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const bajo = i.minimo > 0 && i.cantidad <= i.minimo;
            const urgente = i.dias_restantes !== null && i.dias_restantes <= 3;
            return (
              <tr
                key={i.producto_id ?? i.presentacion_id}
                onClick={() => onAbrir(i)}
                className="cursor-pointer border-b border-vino/10 last:border-b-0 active:bg-rosa-claro/25"
              >
                <td className="px-4 py-3">
                  {i.nombre}
                  <span className="block text-xs text-tinta-3 text-tinta-2">
                    {i.categoria}
                    {i.vinculados && <> · para {i.vinculados}</>}
                    {i.costo_promedio > 0 &&
                      Math.abs(i.costo_promedio - i.costo_catalogo) > 0.5 && (
                        <> · te cuesta {pesos(i.costo_promedio)}, el catálogo dice {pesos(i.costo_catalogo)}</>
                      )}
                  </span>
                </td>
                <td
                  className={`px-3 py-3 text-right tabular-nums ${
                    i.cantidad < 0 ? "text-vino" : bajo ? "text-[#9C6A1E]" : ""
                  }`}
                >
                  {cifra(i.cantidad)}
                  <span className="block text-xs text-tinta-2">{i.unidad}</span>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-tinta-2">
                  {i.consumo_dia > 0 ? cifra(i.consumo_dia) : "—"}
                </td>
                <td
                  className={`px-3 py-3 text-right tabular-nums ${urgente ? "text-vino" : "text-tinta-2"}`}
                >
                  {i.alcanza_unidades !== null
                    ? `${cifra(i.alcanza_unidades)} u`
                    : i.dias_restantes === null
                      ? "—"
                      : `${cifra(i.dias_restantes)} d`}
                </td>
                <td className="px-3 py-3 text-right font-medium tabular-nums">
                  {i.sugerido > 0 ? cifra(i.sugerido) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Panel({
  item,
  cerrar,
  correr,
  ocupado,
}: {
  item: ItemInventario;
  cerrar: () => void;
  correr: (fn: () => Promise<{ error: string } | null>) => void;
  ocupado: boolean;
}) {
  const [minimo, setMinimo] = useState(String(item.minimo || ""));
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [rinde, setRinde] = useState(String(item.rinde_configurado ?? ""));

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-tinta/50 sm:items-center sm:p-6">
      <div className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-lg bg-crema sm:rounded-lg">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-vino/15 bg-crema px-4 py-3">
          <div>
            <p className="font-medium">{item.nombre}</p>
            <p className="text-xs text-tinta-2">
              Hay {cifra(item.cantidad)} {item.unidad}
            </p>
          </div>
          <button
            type="button"
            onClick={cerrar}
            className="rounded-sm border border-vino/25 px-3 py-1.5 text-sm text-vino"
          >
            Cerrar
          </button>
        </div>

        {item.vinculados && (
          <div className="flex flex-col gap-3 border-b border-vino/15 p-4">
            <p className="text-sm font-medium">
              Se usa para: {item.vinculados}
            </p>
            <label className="flex flex-col gap-1.5 text-sm">
              ¿Cuántas unidades rinde 1 {item.unidad}?
              <input
                inputMode="decimal"
                value={rinde}
                onChange={(e) => setRinde(e.target.value)}
                placeholder="ej. 20"
                className="rounded-sm border border-vino/25 px-3 py-3 tabular-nums outline-none focus:border-vino"
              />
            </label>
            <button
              type="button"
              disabled={ocupado || !(Number(rinde) > 0)}
              onClick={() =>
                correr(() => fijarRendimiento(item.producto_id!, Number(rinde)))
              }
              className="rounded-sm border-2 border-vino px-4 py-3 text-sm font-medium text-vino disabled:opacity-50"
            >
              Guardar el rendimiento
            </button>
            {item.alcanza_unidades !== null && (
              <p className="text-xs text-tinta-2">
                Con lo que hay ahora, alcanza para {cifra(item.alcanza_unidades)}.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 border-b border-vino/15 p-4">
          <label className="flex flex-col gap-1.5 text-sm">
            Avisarme cuando queden menos de
            <input
              inputMode="decimal"
              value={minimo}
              onChange={(e) => setMinimo(e.target.value)}
              placeholder="0"
              className="rounded-sm border border-vino/25 px-3 py-3 tabular-nums outline-none focus:border-vino"
            />
          </label>
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              correr(() =>
                fijarMinimo(item.producto_id, item.presentacion_id, Number(minimo) || 0),
              )
            }
            className="rounded-sm border-2 border-vino px-4 py-3 text-sm font-medium text-vino disabled:opacity-50"
          >
            Guardar el mínimo
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm font-medium">Registrar una merma</p>
          <p className="text-xs text-tinta-2">
            Producto que se perdió: se rompió, se echó a perder, se derramó. Sale
            del inventario y queda anotado.
          </p>
          <input
            inputMode="decimal"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder={`Cuántos ${item.unidad}`}
            className="rounded-sm border border-vino/25 px-3 py-3 tabular-nums outline-none focus:border-vino"
          />
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Qué pasó"
            className="rounded-sm border border-vino/25 px-3 py-3 outline-none focus:border-vino"
          />
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
            disabled={
              ocupado || !(Number(cantidad) > 0) || !motivo.trim() || codigo.length !== 4
            }
            onClick={() =>
              correr(() =>
                registrarMerma(
                  codigo,
                  item.producto_id,
                  item.presentacion_id,
                  Number(cantidad),
                  motivo,
                ),
              )
            }
            className="rounded-sm bg-vino px-4 py-3 font-medium text-crema disabled:opacity-40"
          >
            {ocupado ? "Guardando..." : "Registrar la merma"}
          </button>
        </div>

        {item.producto_id && (
          <div className="flex flex-col gap-2 border-t border-vino/15 p-4">
            <p className="text-sm font-medium">
              {item.activo ? "Está activo" : "Está inactivo"}
            </p>
            <p className="text-xs text-tinta-2">
              {item.activo
                ? "Aparece en el menú y en este inventario. Desactívalo si ya se acabó la temporada."
                : "Ya no aparece en el menú ni aquí arriba. Reactívalo cuando vuelva la temporada."}
            </p>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => correr(() => cambiarActivo(item.producto_id!, !item.activo))}
              className="rounded-sm border-2 border-vino px-4 py-3 text-sm font-medium text-vino disabled:opacity-50"
            >
              {item.activo ? "Desactivar (fin de temporada)" : "Reactivar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
