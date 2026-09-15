"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearOrdenSinMesa } from "../barra/acciones";

/** El único lugar donde se crea una cuenta sin mesa — a propósito
 * detrás de un botón de verdad (Server Action disparada por un clic),
 * nunca por solo aterrizar en una pantalla o por un prefetch. */
export default function NuevaOrdenBoton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  function crear() {
    setError(null);
    empezar(async () => {
      const r = await crearOrdenSinMesa();
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.push(`/cuenta/${r.ticketId}`);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={ocupado}
        onClick={crear}
        className="rounded-sm bg-vino px-5 py-4 text-left font-medium text-crema disabled:opacity-50"
      >
        {ocupado ? "Creando..." : "+ Nueva orden"}
      </button>
      {error && (
        <p className="rounded-sm bg-vino/10 px-4 py-2 text-sm text-vino">{error}</p>
      )}
    </div>
  );
}
