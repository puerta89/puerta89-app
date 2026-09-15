"use client";

import { useEffect } from "react";
import Arco from "@/app/arco";

/** Red de seguridad para cualquier error que truene al cargar una pantalla
 * (por ejemplo, un tropiezo momentáneo pidiéndole datos a la base). Sin
 * este archivo, Next.js muestra su propia pantalla genérica —prácticamente
 * en blanco, con un número de "digest"— y la única forma de salir de ahí
 * es recargar a mano. Con este archivo, en cambio, se ve un mensaje en
 * español con un botón que reintenta sin recargar toda la página. */
export default function ErrorGlobal({
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
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-vino px-6 py-12 text-center">
      <Arco className="w-12 text-rosa-claro" />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl italic text-crema">
          Algo no cargó bien
        </h1>
        <p className="max-w-sm text-sm text-rosa">
          Puede haber sido un tropiezo de conexión. Intenta de nuevo — si
          sigue igual, sal y vuelve a entrar con tu código.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-sm bg-rosa-claro px-5 py-2.5 text-sm font-medium text-vino"
        >
          Reintentar
        </button>
        <a
          href="/barra"
          className="rounded-sm border border-rosa-claro/40 px-5 py-2.5 text-sm text-crema"
        >
          Ir a la barra
        </a>
      </div>
      {error.digest && (
        <p className="text-xs text-rosa/60">Código: {error.digest}</p>
      )}
    </main>
  );
}
