"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Categoria } from "@/lib/datos";
import { crearVino, crearSaborHelado, crearSimple } from "./acciones";

type Tipo = "vino" | "helado" | "simple";

const PRECIOS_VINO: Record<string, { copa: number; botella: number }> = {
  Tinto: { copa: 200, botella: 800 },
  Blanco: { copa: 150, botella: 600 },
  Rosado: { copa: 150, botella: 600 },
  Naranja: { copa: 180, botella: 720 },
};

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function Nuevo({ categorias }: { categorias: Categoria[] }) {
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
            ocupado={ocupado}
            onCrear={(nombre, categoriaId, precio, costo) =>
              correr(
                () => crearSimple(nombre, categoriaId, precio, costo),
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

function FormSimple({
  categorias,
  ocupado,
  onCrear,
}: {
  categorias: Categoria[];
  ocupado: boolean;
  onCrear: (nombre: string, categoriaId: string, precio: number, costo: number) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const valido =
    nombre.trim().length > 0 && categoriaId && Number(precio) > 0 && Number(costo) >= 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-tinta-2">
        Para lo que se vende tal cual (una bebida, un snack, algo de merch sin
        tallas...) sin nada especial que descontar.
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

      <button
        type="button"
        disabled={ocupado || !valido}
        onClick={() => onCrear(nombre.trim(), categoriaId, Number(precio), Number(costo))}
        className="rounded-sm bg-vino px-4 py-3 text-sm font-medium text-crema disabled:opacity-40"
      >
        {ocupado ? "Agregando..." : "Agregar al menú"}
      </button>
    </div>
  );
}
