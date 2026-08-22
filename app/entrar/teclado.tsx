"use client";

import { useActionState, useState } from "react";
import { entrarConCodigo, type ResultadoEntrada } from "./acciones";

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function Teclado() {
  const [codigo, setCodigo] = useState("");
  const [resultado, enviar, enviando] = useActionState<
    ResultadoEntrada,
    FormData
  >(entrarConCodigo, null);

  // Al picar Entrar el código se borra en el acto: el formulario ya tomó lo
  // que necesitaba. Así, si no era de nadie, el mesero vuelve a teclear sin
  // picar "Borrar" cuatro veces.
  function alEnviar(datos: FormData) {
    setCodigo("");
    enviar(datos);
  }

  // Se actualiza a partir del valor anterior, no del que se leyó al dibujar.
  // Si no, al teclear rápido los toques se pisan entre ellos y se pierden.
  function teclear(n: string) {
    if (enviando) return;
    setCodigo((prev) => (prev.length >= 4 ? prev : prev + n));
  }

  function borrar() {
    if (enviando) return;
    setCodigo((prev) => prev.slice(0, -1));
  }

  const completo = codigo.length === 4;

  return (
    <form action={alEnviar} className="flex flex-col items-center gap-8">
      <input type="hidden" name="codigo" value={codigo} />

      {/* Los cuatro puntos del código */}
      <div className="flex gap-4" aria-live="polite">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`size-4 rounded-full border-2 border-rosa transition-colors ${
              i < codigo.length ? "bg-rosa" : "bg-transparent"
            }`}
          />
        ))}
      </div>

      <p
        className={`h-5 text-sm ${resultado?.error ? "text-rosa-claro" : "text-transparent"}`}
        role="status"
      >
        {resultado?.error ?? "."}
      </p>

      <div className="grid grid-cols-3 gap-3">
        {TECLAS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => teclear(n)}
            disabled={enviando}
            className="size-20 rounded-full border border-rosa/40 text-3xl text-crema transition-colors active:bg-rosa/30 disabled:opacity-40 sm:size-24"
          >
            {n}
          </button>
        ))}

        <button
          type="button"
          onClick={borrar}
          disabled={enviando || codigo.length === 0}
          className="size-20 rounded-full text-base text-rosa transition-colors active:bg-rosa/20 disabled:opacity-30 sm:size-24"
        >
          Borrar
        </button>

        <button
          type="button"
          onClick={() => teclear("0")}
          disabled={enviando}
          className="size-20 rounded-full border border-rosa/40 text-3xl text-crema transition-colors active:bg-rosa/30 disabled:opacity-40 sm:size-24"
        >
          0
        </button>

        <button
          type="submit"
          disabled={!completo || enviando}
          className="size-20 rounded-full bg-crema text-base font-medium text-vino transition-opacity disabled:opacity-25 sm:size-24"
        >
          {enviando ? "..." : "Entrar"}
        </button>
      </div>
    </form>
  );
}
