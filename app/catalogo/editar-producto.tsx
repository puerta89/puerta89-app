"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Categoria, Insumo, ItemCatalogoCompleto, DetalleProducto } from "@/lib/datos";
import {
  obtenerDetalleProducto,
  guardarProducto,
  cambiarActivoProducto,
  eliminarProducto,
  type IngredienteReceta,
  type PrecioAGuardar,
} from "./acciones";

const UNIDADES = ["pieza", "rebanada", "kg", "gramo", "litro", "mililitro", "botella", "bolsa"];
const TIPOS_VINO = ["tinto", "blanco", "rosado", "naranja"];

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

type FilaPresentacion = {
  presentacion_id: string;
  nombre: string;
  precio: string;
  costo: string;
};

type FilaIngrediente = {
  clave: number;
  modo: "existente" | "nuevo";
  insumoId: string;
  nombreNuevo: string;
  unidadNueva: string;
  cantidad: string;
  costoUnitario: string;
  modoCosto: "unitario" | "paquete";
  costoPaquete: string;
  rinde: string;
};

let siguienteClave = 1;

export default function EditarProducto({
  item,
  categorias,
  insumos,
  cerrar,
}: {
  item: ItemCatalogoCompleto;
  categorias: Categoria[];
  insumos: Insumo[];
  cerrar: () => void;
}) {
  const router = useRouter();
  const [detalle, setDetalle] = useState<DetalleProducto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);

  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [tipoVino, setTipoVino] = useState<string | null>(null);
  const [presentaciones, setPresentaciones] = useState<FilaPresentacion[]>([]);
  const [ingredientes, setIngredientes] = useState<FilaIngrediente[]>([]);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    obtenerDetalleProducto(item.producto_id).then((r) => {
      if (!vivo) return;
      if ("error" in r) {
        setError(r.error);
      } else {
        const d = r.detalle;
        setDetalle(d);
        setNombre(d.nombre);
        setCategoriaId(d.categoria_id);
        setTipoVino(d.tipo_vino);
        setPresentaciones(
          d.presentaciones.map((p) => ({
            presentacion_id: p.presentacion_id,
            nombre: p.nombre,
            precio: p.precio === null ? "" : String(p.precio),
            costo: p.costo === null ? "" : String(p.costo),
          })),
        );
        setIngredientes(
          d.ingredientes.map((i) => ({
            clave: siguienteClave++,
            modo: "existente" as const,
            insumoId: i.insumo_id,
            nombreNuevo: "",
            unidadNueva: i.unidad,
            cantidad: String(i.cantidad),
            costoUnitario: String(i.costo_promedio),
            modoCosto: "unitario" as const,
            costoPaquete: "",
            rinde: "",
          })),
        );
      }
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [item.producto_id]);

  const categoriaNombre = categorias.find((c) => c.id === categoriaId)?.nombre ?? "";
  const esVino = categoriaNombre === "Vinos" || tipoVino !== null;

  function unidadDe(f: FilaIngrediente) {
    if (f.modo === "nuevo") return f.unidadNueva;
    return insumos.find((i) => i.id === f.insumoId)?.unidad_base ?? "";
  }

  function agregarIngrediente() {
    const primero = insumos[0];
    setIngredientes((prev) => [
      ...prev,
      {
        clave: siguienteClave++,
        modo: insumos.length > 0 ? "existente" : "nuevo",
        insumoId: primero?.id ?? "",
        nombreNuevo: "",
        unidadNueva: "pieza",
        cantidad: "",
        costoUnitario: primero ? String(primero.costo_promedio) : "",
        modoCosto: "unitario",
        costoPaquete: "",
        rinde: "",
      },
    ]);
  }

  function quitarIngrediente(clave: number) {
    setIngredientes((prev) => prev.filter((f) => f.clave !== clave));
  }

  function cambiarIngrediente(clave: number, cambios: Partial<FilaIngrediente>) {
    setIngredientes((prev) =>
      prev.map((f) => {
        if (f.clave !== clave) return f;
        const actualizada = { ...f, ...cambios };
        if (
          actualizada.modoCosto === "paquete" &&
          Number(actualizada.costoPaquete) > 0 &&
          Number(actualizada.rinde) > 0
        ) {
          actualizada.costoUnitario = String(
            Number(actualizada.costoPaquete) / Number(actualizada.rinde),
          );
        }
        return actualizada;
      }),
    );
  }

  function elegirInsumoExistente(clave: number, insumoId: string) {
    const insumo = insumos.find((i) => i.id === insumoId);
    cambiarIngrediente(clave, {
      insumoId,
      costoUnitario: insumo ? String(insumo.costo_promedio) : "",
    });
  }

  function cambiarPresentacion(presentacionId: string, cambios: Partial<FilaPresentacion>) {
    setPresentaciones((prev) =>
      prev.map((p) => (p.presentacion_id === presentacionId ? { ...p, ...cambios } : p)),
    );
  }

  const hayIngredientes = ingredientes.length > 0;
  const costoCalculado = ingredientes.reduce(
    (suma, f) => suma + Number(f.cantidad || 0) * Number(f.costoUnitario || 0),
    0,
  );
  // Cuando hay ingredientes y el producto se vende "tal cual" (una sola
  // presentación), su costo se calcula solo — igual que al crearlo.
  const presentacionUnica = presentaciones.length === 1 ? presentaciones[0] : null;

  const ingredientesValidos = ingredientes.every((f) => {
    if (!(Number(f.cantidad) > 0)) return false;
    if (f.modo === "nuevo" && f.modoCosto === "paquete") {
      if (!(Number(f.costoPaquete) > 0) || !(Number(f.rinde) > 0)) return false;
    } else if (!(Number(f.costoUnitario) >= 0)) {
      return false;
    }
    return f.modo === "existente" ? !!f.insumoId : f.nombreNuevo.trim().length > 0;
  });

  const presentacionesValidas = presentaciones.every((p) => Number(p.precio) > 0);

  const valido =
    nombre.trim().length > 0 &&
    !!categoriaId &&
    presentacionesValidas &&
    (hayIngredientes ? ingredientesValidos : true);

  function guardar() {
    setError(null);
    const precios: PrecioAGuardar[] = presentaciones.map((p) => ({
      presentacion_id: p.presentacion_id,
      precio: Number(p.precio),
      costo: Number(p.costo || 0),
    }));
    const listaIngredientes: IngredienteReceta[] = ingredientes.map((f) =>
      f.modo === "existente"
        ? { insumo_id: f.insumoId, cantidad: Number(f.cantidad) }
        : {
            insumo_nombre: f.nombreNuevo.trim(),
            insumo_unidad: f.unidadNueva,
            cantidad: Number(f.cantidad),
          },
    );
    empezar(async () => {
      const r = await guardarProducto(
        item.producto_id,
        nombre.trim(),
        categoriaId,
        esVino ? tipoVino : null,
        precios,
        listaIngredientes,
      );
      if (r?.error) setError(r.error);
      else {
        router.refresh();
        cerrar();
      }
    });
  }

  function alternarActivo() {
    if (!detalle) return;
    setError(null);
    empezar(async () => {
      const r = await cambiarActivoProducto(item.producto_id, !detalle.activo);
      if (r?.error) setError(r.error);
      else {
        router.refresh();
        cerrar();
      }
    });
  }

  function confirmarEliminar() {
    setError(null);
    empezar(async () => {
      const r = await eliminarProducto(item.producto_id);
      if (r?.error) setError(r.error);
      else {
        router.refresh();
        cerrar();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-tinta/50 sm:items-center sm:p-6">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-lg bg-crema sm:rounded-lg">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-vino/15 bg-crema px-4 py-3">
          <div>
            <p className="font-medium">{item.producto}</p>
            <p className="text-xs text-tinta-2">
              {item.categoria}
              {detalle && !detalle.activo && " · inactivo"}
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

        {cargando ? (
          <p className="p-4 text-sm text-tinta-2">Cargando...</p>
        ) : !detalle ? (
          <p className="rounded-sm bg-vino/10 m-4 px-4 py-3 text-sm text-vino">{error}</p>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            <label className="flex flex-col gap-1.5 text-sm">
              Nombre
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="rounded-sm border border-vino/25 px-3 py-3 outline-none focus:border-vino"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              Categoría
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="rounded-sm border border-vino/25 px-3 py-3 outline-none focus:border-vino"
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>

            {esVino && (
              <label className="flex flex-col gap-1.5 text-sm">
                Tipo de vino
                <div className="flex flex-wrap gap-2">
                  {TIPOS_VINO.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipoVino(t)}
                      className={`rounded-full px-4 py-2 text-sm capitalize transition-colors ${
                        t === tipoVino ? "bg-vino text-crema" : "border border-vino/25 text-vino"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </label>
            )}

            <div className="flex flex-col gap-2 border-t border-vino/15 pt-3">
              <p className="text-sm font-medium">Precio y costo</p>
              {presentaciones.map((p) => {
                const esLaUnica = presentacionUnica?.presentacion_id === p.presentacion_id;
                const difiereDelCalculado =
                  hayIngredientes && esLaUnica && Number(p.costo || 0) !== costoCalculado;
                return (
                  <div key={p.presentacion_id} className="flex flex-col gap-1">
                    <div className="flex items-end gap-2">
                      <p className="w-24 shrink-0 text-xs text-tinta-2">{p.nombre}</p>
                      <label className="flex-1 text-xs text-tinta-2">
                        Precio
                        <input
                          inputMode="decimal"
                          value={p.precio}
                          onChange={(e) => cambiarPresentacion(p.presentacion_id, { precio: e.target.value })}
                          className="mt-1 w-full rounded-sm border border-vino/25 px-3 py-2.5 text-sm tabular-nums outline-none focus:border-vino"
                        />
                      </label>
                      <label className="flex-1 text-xs text-tinta-2">
                        Costo
                        <input
                          inputMode="decimal"
                          value={p.costo}
                          onChange={(e) => cambiarPresentacion(p.presentacion_id, { costo: e.target.value })}
                          className="mt-1 w-full rounded-sm border border-vino/25 px-3 py-2.5 text-sm tabular-nums outline-none focus:border-vino"
                        />
                      </label>
                    </div>
                    {difiereDelCalculado && (
                      <p className="pl-[6.5rem] text-xs text-tinta-2">
                        Según los ingredientes de abajo, esto te sale en{" "}
                        {pesos(costoCalculado)}.{" "}
                        <button
                          type="button"
                          onClick={() => cambiarPresentacion(p.presentacion_id, { costo: String(costoCalculado) })}
                          className="text-vino underline"
                        >
                          Usar este costo
                        </button>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 border-t border-vino/15 pt-3">
              <p className="text-sm font-medium">Ingredientes de inventario (opcional)</p>
              <p className="text-xs text-tinta-2">
                Agrega, edita o quita los que quieras — cada uno se resta solo cuando se
                venda esto. Si le quitas todos, el costo de arriba vuelve a ser manual.
              </p>

              {ingredientes.map((f) => (
                <div key={f.clave} className="flex flex-col gap-2 rounded-sm border border-vino/15 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => cambiarIngrediente(f.clave, { modo: "existente" })}
                        className={`rounded-full px-3 py-1.5 text-xs ${
                          f.modo === "existente"
                            ? "bg-vino text-crema"
                            : "border border-vino/25 text-vino"
                        }`}
                      >
                        Ya existe
                      </button>
                      <button
                        type="button"
                        onClick={() => cambiarIngrediente(f.clave, { modo: "nuevo" })}
                        className={`rounded-full px-3 py-1.5 text-xs ${
                          f.modo === "nuevo" ? "bg-vino text-crema" : "border border-vino/25 text-vino"
                        }`}
                      >
                        Es nuevo
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => quitarIngrediente(f.clave)}
                      className="text-xs text-vino underline"
                    >
                      Quitar
                    </button>
                  </div>

                  {f.modo === "existente" ? (
                    <select
                      value={f.insumoId}
                      onChange={(e) => elegirInsumoExistente(f.clave, e.target.value)}
                      className="rounded-sm border border-vino/25 px-3 py-2.5 text-sm outline-none focus:border-vino"
                    >
                      {insumos.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nombre} — se mide en {i.unidad_base}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={f.nombreNuevo}
                        onChange={(e) => cambiarIngrediente(f.clave, { nombreNuevo: e.target.value })}
                        placeholder="ej. Lomo embuchado"
                        className="flex-1 rounded-sm border border-vino/25 px-3 py-2.5 text-sm outline-none focus:border-vino"
                      />
                      <select
                        value={f.unidadNueva}
                        onChange={(e) => cambiarIngrediente(f.clave, { unidadNueva: e.target.value })}
                        className="rounded-sm border border-vino/25 px-2 py-2.5 text-sm outline-none focus:border-vino"
                      >
                        {UNIDADES.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <label className="flex-1 text-xs text-tinta-2">
                      Cuánto se usa por venta, en {unidadDe(f) || "..."}
                      <input
                        inputMode="decimal"
                        value={f.cantidad}
                        onChange={(e) => cambiarIngrediente(f.clave, { cantidad: e.target.value })}
                        className="mt-1 w-full rounded-sm border border-vino/25 px-3 py-2.5 text-sm tabular-nums text-tinta outline-none focus:border-vino"
                      />
                    </label>

                    {f.modo === "nuevo" && f.modoCosto === "paquete" ? (
                      <>
                        <label className="w-32 text-xs text-tinta-2">
                          Costo del paquete
                          <input
                            inputMode="decimal"
                            value={f.costoPaquete}
                            onChange={(e) => cambiarIngrediente(f.clave, { costoPaquete: e.target.value })}
                            className="mt-1 w-full rounded-sm border border-vino/25 px-3 py-2.5 text-sm tabular-nums text-tinta outline-none focus:border-vino"
                          />
                        </label>
                        <label className="w-32 text-xs text-tinta-2">
                          Rinde cuántas {unidadDe(f)}
                          <input
                            inputMode="decimal"
                            value={f.rinde}
                            onChange={(e) => cambiarIngrediente(f.clave, { rinde: e.target.value })}
                            className="mt-1 w-full rounded-sm border border-vino/25 px-3 py-2.5 text-sm tabular-nums text-tinta outline-none focus:border-vino"
                          />
                        </label>
                      </>
                    ) : (
                      <label className="w-36 text-xs text-tinta-2">
                        Costo de 1 {unidadDe(f) || "unidad"}
                        <input
                          inputMode="decimal"
                          value={f.costoUnitario}
                          onChange={(e) => cambiarIngrediente(f.clave, { costoUnitario: e.target.value })}
                          className="mt-1 w-full rounded-sm border border-vino/25 px-3 py-2.5 text-sm tabular-nums text-tinta outline-none focus:border-vino"
                        />
                      </label>
                    )}
                  </div>

                  {f.modo === "nuevo" && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => cambiarIngrediente(f.clave, { modoCosto: "unitario" })}
                        className={`rounded-full px-3 py-1.5 text-xs ${
                          f.modoCosto === "unitario"
                            ? "bg-vino text-crema"
                            : "border border-vino/25 text-vino"
                        }`}
                      >
                        Sé lo que cuesta cada {f.unidadNueva}
                      </button>
                      <button
                        type="button"
                        onClick={() => cambiarIngrediente(f.clave, { modoCosto: "paquete" })}
                        className={`rounded-full px-3 py-1.5 text-xs ${
                          f.modoCosto === "paquete"
                            ? "bg-vino text-crema"
                            : "border border-vino/25 text-vino"
                        }`}
                      >
                        Viene en un paquete que rinde varias
                      </button>
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={agregarIngrediente}
                className="rounded-sm border border-vino/25 px-4 py-2.5 text-sm text-vino"
              >
                + Agregar ingrediente
              </button>
            </div>

            {error && (
              <p className="rounded-sm bg-vino/10 px-4 py-3 text-sm text-vino">{error}</p>
            )}

            <button
              type="button"
              disabled={ocupado || !valido}
              onClick={guardar}
              className="rounded-sm bg-vino px-4 py-3 text-sm font-medium text-crema disabled:opacity-40"
            >
              {ocupado ? "Guardando..." : "Guardar cambios"}
            </button>

            <div className="flex flex-col gap-2 border-t border-vino/15 pt-3">
              <button
                type="button"
                disabled={ocupado}
                onClick={alternarActivo}
                className="rounded-sm border border-vino/25 px-4 py-3 text-sm text-vino disabled:opacity-40"
              >
                {detalle.activo ? "Desactivar (fin de temporada)" : "Reactivar"}
              </button>

              {detalle.puede_eliminar &&
                (confirmandoEliminar ? (
                  <div className="flex flex-col gap-2 rounded-sm border border-vino/25 bg-vino/5 p-3">
                    <p className="text-xs text-tinta-2">
                      Esto lo borra por completo, no queda ni como inactivo. ¿Seguro?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={confirmarEliminar}
                        className="flex-1 rounded-sm bg-vino px-4 py-2.5 text-sm font-medium text-crema disabled:opacity-40"
                      >
                        {ocupado ? "Eliminando..." : "Sí, eliminar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmandoEliminar(false)}
                        className="flex-1 rounded-sm border border-vino/25 px-4 py-2.5 text-sm text-vino"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmandoEliminar(true)}
                    className="text-xs text-vino underline"
                  >
                    Eliminar del menú por completo (nunca se ha vendido)
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
