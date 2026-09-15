"use client";

import { useEffect, useRef, useState } from "react";
import { crearOrdenSinMesa } from "./acciones";

/** Lo que ve un mesero al entrar a /barra sin traer ya una orden en
 * curso: nada que picar, se crea la cuenta sola (sin mesa) y entra
 * directo a la comanda — categorías listas para empezar, como Loyverse.
 *
 * Corre como efecto de cliente — no como página/ruta a la que se pueda
 * navegar — para que crear la cuenta pase solo por una acción de verdad
 * del navegador, nunca por un prefetch de Next.js (así falló la primera
 * versión: /barra/nueva-orden era una ruta GET, y el prefetch automático
 * de cualquier <Link> hacia /barra la disparaba sola).
 *
 * Usa una navegación DURA (location.href) a propósito y no router.push:
 * un push sería una transición de cliente, y esas SÍ quedan atrapadas
 * por la ruta interceptada de app/@modal — se vería el ticket como un
 * panel angosto encima de esta pantalla de "Preparando...", en vez de la
 * página completa de la comanda, que es lo que aquí sí se quiere. */
export default function EmpezarOrden() {
  const [error, setError] = useState<string | null>(null);
  const yaPedido = useRef(false);

  useEffect(() => {
    if (yaPedido.current) return;
    yaPedido.current = true;

    let vivo = true;
    (async () => {
      const r = await crearOrdenSinMesa();
      if (!vivo) return;
      if ("error" in r) {
        setError(r.error);
        yaPedido.current = false;
        return;
      }
      // A propósito una navegación dura y no router.push: ver el
      // comentario de arriba (evita el panel angosto de app/@modal).
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/cuenta/${r.ticketId}`;
    })();

    return () => {
      vivo = false;
    };
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-crema px-4">
      {error ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="rounded-sm bg-vino/10 px-5 py-4 text-sm text-vino">
            No se pudo empezar la orden: {error}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-sm border border-vino/25 px-4 py-2 text-sm text-vino"
          >
            Volver a intentar
          </button>
        </div>
      ) : (
        <p className="text-sm text-tinta-2">Preparando tu orden...</p>
      )}
    </main>
  );
}
