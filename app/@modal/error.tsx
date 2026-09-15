"use client";

import { useEffect } from "react";

/** Boundary propio para el slot @modal (panel lateral de la cuenta y
 * ventana de cobro) — un error ahí NO lo atrapa app/error.tsx, porque en
 * el layout raíz {modal} se dibuja aparte de {children}. Sin este
 * archivo, un tropiezo abriendo el panel (ej. "estaba cobrando y...")
 * tronaba en blanco sin ninguna forma de cerrarlo salvo recargar toda la
 * página. Se muestra como una tarjeta encima del mapa, no como toma de
 * pantalla completa, para no tapar la pantalla de atrás que sí sigue
 * viva. */
export default function ErrorModal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-sm bg-crema px-6 py-8 text-center">
        <h1 className="font-display text-2xl italic text-vino">
          No se pudo abrir
        </h1>
        <p className="text-sm text-tinta-2">
          Puede haber sido un tropiezo de conexión. Intenta de nuevo.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-sm bg-vino px-5 py-2.5 text-sm font-medium text-crema"
          >
            Reintentar
          </button>
          <a
            href="/barra"
            className="rounded-sm border border-vino/30 px-5 py-2.5 text-sm text-vino"
          >
            Cerrar
          </a>
        </div>
      </div>
    </div>
  );
}
