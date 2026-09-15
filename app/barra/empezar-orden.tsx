"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { crearOrdenSinMesa } from "./acciones";

/** Lo que ve un mesero al entrar a /barra sin traer ya una orden en
 * curso: nada que picar, se crea la cuenta sola (sin mesa) y se entra
 * directo a tomar el pedido. Corre como efecto de cliente — no como
 * ruta — para que crear la cuenta solo pase por una acción de verdad del
 * navegador, nunca por un prefetch de Next.js. */
export default function EmpezarOrden() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const yaPedido = useRef(false);

  useEffect(() => {
    // Evita duplicar la cuenta si el efecto se vuelve a correr (React
    // StrictMode en desarrollo, o un remount rápido).
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
      router.replace(`/cuenta/${r.ticketId}`);
    })();

    return () => {
      vivo = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-crema px-4">
      {error ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="rounded-sm bg-vino/10 px-5 py-4 text-sm text-vino">
            No se pudo empezar la orden: {error}
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
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
