"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Categoria, Insumo } from "@/lib/datos";
import { crearVino, crearSaborHelado, crearSimple, type IngredienteReceta } from "./acciones";

type Tipo = "vino" | "helado" | "simple";

const UNIDADES = ["pieza", "rebanada", "kg", "gramo", "litro", "mililitro", "botella", "bolsa"];

type FilaIngrediente = {
  clave: number;
  modo: "existente" | "nuevo";
  insumoId: string;
  nombreNuevo: string;
  unidadNueva: string;
  cantidad: string;
  costoUnitario: string;
  // Para un ingrediente nuevo que se compra en paquete (una bolsa que
  // rinde varias rebanadas/piezas): en vez de dividir a mano, se captura
  // el costo del paquete completo y cuánto rinde, y el costo por unidad
  // se calcula solo.
  modoCosto: "unitario" | "paquete";
  costoPaquete: string;
  rinde: string;
};

const PRECIOS_VINO: Record<string, { copa: number; botella: number }> = {
  Tinto: { copa: 200, botella: 800 },
  Blanco: { copa: 150, botella: 600 },
  Rosado: { copa: 150, botella: 600 },
  Naranja: { copa: 180, botella: 720 },
};

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function Nuevo({
  categorias,
  insumos,
}: {
  categorias: Categoria[];
  insumos: Insumo[];
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>("vino");
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  function correr(fn: () => Promise<{ error: string } | null>, mensaje: string) {
    setError(null);
    setHecho(null);
    empezar(async () => {
      const r = await fn();
      if (r?.error) setError(r.error);
      else {
        setHecho(mensaje);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-tinta-2">
        Elige qué tipo de cosa es. El sistema ya sabe cómo se vende y le pone
        los precios de catálogo — tú solo dices el nombre y el costo.
      </p>

      <div className="flex gap-2">
        {(
          [
            { v: "vino" as const, texto: "Vino" },
            { v: "helado" as const, texto: "Sabor de helado" },
            { v: "simple" as const, texto: "Otra cosa" },
          ]
        ).map((op) => (
          <button
            key={op.v}
            type="button"
            onClick={() => {
              setTipo(op.v);
              setError(null);
              setHecho(null);
            }}
            className={`rounded-full px-4 py-2 text-sm transition-colors ${
              op.v === tipo ? "bg-vino text-crema" : "border border-vino/25 text-vino"
            }`}
          >
            {op.texto}
          </button>
        ))}
      </div>

      <div className="rounded-sm border border-vino/15 bg-white p-4">
        {tipo === "vino" && (
          <FormVino
            ocupado={ocupado}
            onCrear={(nombre, tipoVino, costo) =>
              correr(
                () => crearVino(nombre, tipoVino, costo),
                `Se agregó "${nombre}" al menú de Vinos.`,
              )
            }
          />
        )}
        {tipo === "helado" && (
          <FormHelado
            ocupado={ocupado}
            onCrear={(nombre, costo) =>
              correr(
                () => crearSaborHelado(nombre, costo),
                `Se agregó "${nombre}" al menú de Helados.`,
              )
            }
          />
        )}
        {tipo === "simple" && (
          <FormSimple
            categorias={categorias}
            insumos={insumos}
            ocupado={ocupado}
            onCrear={(nombre, categoriaId, precio, costo, ingredientes) =>
              correr(
                () => crearSimple(nombre, categoriaId, precio, costo, ingredientes),
                `Se agregó "${nombre}" al menú.`,
              )
            }
          />
        )}
      </div>

      {error && (
        <p className="rounded-sm bg-vino/10 px-4 py-3 text-sm text-vino">{error}</p>
      )}
      {hecho && (
        <p className="rounded-sm bg-[#556B4A]/10 px-4 py-3 text-sm text-[#556B4A]">
          {hecho}
        </p>
      )}
    </div>
  );
}

function FormVino({
  ocupado,
  onCrear,
}: {
  ocupado: boolean;
  onCrear: (nombre: string, tipoVino: string, costoBotella: number) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [tipoVino, setTipoVino] = useState("Tinto");
  const [costo, setCosto] = useState("");

  const precios = PRECIOS_VINO[tipoVino];
  const valido = nombre.trim().length > 0 && Number(costo) > 0;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm">
        Nombre del vino
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="ej. Temporada (Membrillo)"
          className="rounded-sm border border-vino/25 px-3 py-3 outline-none focus:border-vino"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        Tipo
        <div className="flex flex-wrap gap-2">
          {Object.keys(PRECIOS_VINO).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipoVino(t)}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                t === tipoVino ? "bg-vino text-crema" : "border border-vino/25 text-vino"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        ¿Cuánto cuesta la botella?
        <input
          inputMode="decimal"
          value={costo}
          onChange={(e) => setCosto(e.target.value)}
          placeholder="ej. 250"
          className="rounded-sm border border-vino/25 px-3 py-3 tabular-nums outline-none focus:border-vino"
        />
      </label>

      <p className="text-xs text-tinta-2">
        Se va a vender en {pesos(precios.copa)} la copa y {pesos(precios.botella)}{" "}
        la botella (precio fijo de {tipoVino.toLowerCase()}s).
      </p>

      <button
        type="button"
        disabled={ocupado || !valido}
        onClick={() => onCrear(nombre.trim(), tipoVino, Number(costo))}
        className="rounded-sm bg-vino px-4 py-3 text-sm font-medium text-crema disabled:opacity-40"
      >
        {ocupado ? "Agregando..." : "Agregar al menú"}
      </button>
    </div>
  );
}

function FormHelado({
  ocupado,
  onCrear,
}: {
  ocupado: boolean;
  onCrear: (nombre: string, costoBote: number) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [costo, setCosto] = useState("");
  const valido = nombre.trim().length > 0 && Number(costo) > 0;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm">
        Nombre del sabor
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="ej. Temporada (Rompope)"
          className="rounded-sm border border-vino/25 px-3 py-3 outline-none focus:border-vino"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        ¿Cuánto cuesta el bote de 5 litros?
        <input
          inputMode="decimal"
          value={costo}
          onChange={(e) => setCosto(e.target.value)}
          placeholder="ej. 140"
          className="rounded-sm border border-vino/25 px-3 py-3 tabular-nums outline-none focus:border-vino"
        />
      </label>

      <p className="text-xs text-tinta-2">
        Se va a vender igual que los demás sabores: 1 Bola $70, 2 Bolas $110,
        Medio Litro $160, Litro $280.
      </p>

      <button
        type="button"
        disabled={ocupado || !valido}
        onClick={() => onCrear(nombre.trim(), Number(costo))}
        className="rounded-sm bg-vino px-4 py-3 text-sm font-medium text-crema disabled:opacity-40"
      >
        {ocupado ? "Agregando..." : "Agregar al menú"}
      </button>
    </div>
  );
}

let siguienteClave = 1;

function FormSimple({
  categorias,
  insumos,
  ocupado,
  onCrear,
}: {
  categorias: Categoria[];
  insumos: Insumo[];
  ocupado: boolean;
  onCrear: (
    nombre: string,
    categoriaId: string,
    precio: number,
    costo: number,
    ingredientes: IngredienteReceta[],
  ) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const [ingredientes, setIngredientes] = useState<FilaIngrediente[]>([]);

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
        // Si viene de paquete, el costo por unidad se recalcula solo
        // cada vez que cambia el costo del paquete o cuánto rinde.
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

  // La cantidad y el costo por unidad de un renglón siempre se refieren a
  // la MISMA unidad en la que ese ingrediente se mide en inventario (ej.
  // los sabores de helado se llevan en litros, no en bolas).
  function unidadDe(f: FilaIngrediente) {
    if (f.modo === "nuevo") return f.unidadNueva;
    return insumos.find((i) => i.id === f.insumoId)?.unidad_base ?? "";
  }

  // Al elegir un insumo que ya existe, se toma su costo promedio actual
  // como punto de partida (se puede corregir a mano si no aplica).
  function elegirInsumoExistente(clave: number, insumoId: string) {
    const insumo = insumos.find((i) => i.id === insumoId);
    cambiarIngrediente(clave, {
      insumoId,
      costoUnitario: insumo ? String(insumo.costo_promedio) : "",
    });
  }

  const ingredientesValidos = ingredientes.every((f) => {
    if (!(Number(f.cantidad) > 0)) return false;
    if (f.modo === "nuevo" && f.modoCosto === "paquete") {
      if (!(Number(f.costoPaquete) > 0) || !(Number(f.rinde) > 0)) return false;
    } else if (!(Number(f.costoUnitario) >= 0)) {
      return false;
    }
    return f.modo === "existente" ? !!f.insumoId : f.nombreNuevo.trim().length > 0;
  });

  // Con ingredientes, el costo se calcula solo (cantidad x costo de cada
  // uno) — así no hay que hacer la cuenta a mano.
  const hayIngredientes = ingredientes.length > 0;
  const costoCalculado = ingredientes.reduce(
    (suma, f) => suma + Number(f.cantidad || 0) * Number(f.costoUnitario || 0),
    0,
  );

  const valido =
    nombre.trim().length > 0 &&
    categoriaId &&
    Number(precio) > 0 &&
    (hayIngredientes ? ingredientesValidos : Number(costo) >= 0);

  function enviar() {
    const lista: IngredienteReceta[] = ingredientes.map((f) =>
      f.modo === "existente"
        ? { insumo_id: f.insumoId, cantidad: Number(f.cantidad) }
        : {
            insumo_nombre: f.nombreNuevo.trim(),
            insumo_unidad: f.unidadNueva,
            cantidad: Number(f.cantidad),
          },
    );
    const costoFinal = hayIngredientes ? costoCalculado : Number(costo);
    onCrear(nombre.trim(), categoriaId, Number(precio), costoFinal, lista);
    setIngredientes([]);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-tinta-2">
        Para lo que se vende tal cual (una bebida, un snack, algo de merch sin
        tallas...), o algo que lleva varios ingredientes de inventario (por
        ejemplo un botanero que lleva embutido, arúgula y aceite preparado).
      </p>

      <label className="flex flex-col gap-1.5 text-sm">
        Nombre
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="ej. Té helado"
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

      <label className="flex flex-col gap-1.5 text-sm">
        Precio de venta
        <input
          inputMode="decimal"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          placeholder="ej. 50"
          className="rounded-sm border border-vino/25 px-3 py-3 tabular-nums outline-none focus:border-vino"
        />
      </label>

      {hayIngredientes ? (
        <div className="flex flex-col gap-1.5 text-sm">
          <span>Lo que te cuesta</span>
          <p className="rounded-sm border border-vino/15 bg-rosa-claro/15 px-3 py-3 tabular-nums">
            {pesos(costoCalculado)}
            <span className="ml-2 text-xs font-normal text-tinta-2">
              calculado solo, según los ingredientes de abajo
            </span>
          </p>
        </div>
      ) : (
        <label className="flex flex-col gap-1.5 text-sm">
          Lo que te cuesta
          <input
            inputMode="decimal"
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            placeholder="ej. 20"
            className="rounded-sm border border-vino/25 px-3 py-3 tabular-nums outline-none focus:border-vino"
          />
        </label>
      )}

      <div className="flex flex-col gap-2 border-t border-vino/15 pt-3">
        <p className="text-sm font-medium">
          Ingredientes de inventario (opcional)
        </p>
        <p className="text-xs text-tinta-2">
          Agrega los que quieras — cada uno se resta solo cuando se venda esto,
          y en cuanto agregas uno el costo de arriba se calcula solo. Si un
          ingrediente todavía no existe, escribe su nombre, elige en qué se
          mide y cuánto cuesta esa unidad; se crea al guardar.
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
              <div className="flex flex-col gap-2">
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
                    Sé lo que cuesta cada {f.unidadNueva || "unidad"}
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
              </div>
            )}

            <div className="flex gap-2">
              <label className="flex-1 text-xs text-tinta-2">
                Cuánto se usa por venta, en {unidadDe(f) || "..."}
                <input
                  inputMode="decimal"
                  value={f.cantidad}
                  onChange={(e) => cambiarIngrediente(f.clave, { cantidad: e.target.value })}
                  placeholder="ej. 3"
                  className="mt-1 w-full rounded-sm border border-vino/25 px-3 py-2.5 text-sm tabular-nums text-tinta outline-none focus:border-vino"
                />
              </label>

              {f.modo === "nuevo" && f.modoCosto === "paquete" ? (
                <>
                  <label className="w-36 text-xs text-tinta-2">
                    ¿Cuánto cuesta el paquete?
                    <input
                      inputMode="decimal"
                      value={f.costoPaquete}
                      onChange={(e) => cambiarIngrediente(f.clave, { costoPaquete: e.target.value })}
                      placeholder="ej. 125"
                      className="mt-1 w-full rounded-sm border border-vino/25 px-3 py-2.5 text-sm tabular-nums text-tinta outline-none focus:border-vino"
                    />
                  </label>
                  <label className="w-36 text-xs text-tinta-2">
                    ¿De cuántas {unidadDe(f) || "unidades"} rinde el paquete?
                    <input
                      inputMode="decimal"
                      value={f.rinde}
                      onChange={(e) => cambiarIngrediente(f.clave, { rinde: e.target.value })}
                      placeholder="ej. 30"
                      className="mt-1 w-full rounded-sm border border-vino/25 px-3 py-2.5 text-sm tabular-nums text-tinta outline-none focus:border-vino"
                    />
                  </label>
                </>
              ) : (
                <label className="w-40 text-xs text-tinta-2">
                  Costo de 1 {unidadDe(f) || "unidad"} completa
                  <input
                    inputMode="decimal"
                    value={f.costoUnitario}
                    onChange={(e) => cambiarIngrediente(f.clave, { costoUnitario: e.target.value })}
                    placeholder="ej. 140"
                    className="mt-1 w-full rounded-sm border border-vino/25 px-3 py-2.5 text-sm tabular-nums text-tinta outline-none focus:border-vino"
                  />
                </label>
              )}
            </div>

            {f.modo === "nuevo" && f.modoCosto === "paquete" && Number(f.costoUnitario) > 0 && (
              <p className="text-xs text-tinta-2">
                Cada {unidadDe(f)} te sale en {pesos(Number(f.costoUnitario))}.
              </p>
            )}
            {Number(f.cantidad) > 0 && Number(f.costoUnitario) >= 0 && (
              <p className="text-xs text-tinta-2">
                {Number(f.cantidad)} {unidadDe(f)} × {pesos(Number(f.costoUnitario))} ={" "}
                {pesos(Number(f.cantidad) * Number(f.costoUnitario))}
              </p>
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

      <button
        type="button"
        disabled={ocupado || !valido}
        onClick={enviar}
        className="rounded-sm bg-vino px-4 py-3 text-sm font-medium text-crema disabled:opacity-40"
      >
        {ocupado ? "Agregando..." : "Agregar al menú"}
      </button>
    </div>
  );
}
