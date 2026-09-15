"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** La "ventana" de cobrar que pide Mercedes: al picarle a Cobrar aparece
 * encima, en vez de navegar a otra pantalla completa — como el "Charge"
 * de Loyverse. Vive detrás de una ruta interceptada (ver app/@modal), así
 * que la URL sí cambia a /cuenta/[id]/cobrar pero lo que estaba atrás
 * (el mapa, o la cuenta) sigue ahí. */
export default function VentanaCobro({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  function cerrar() {
    router.back();
  }

  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") cerrar();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/50 p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={cerrar}
        className="absolute inset-0"
      />
      <div className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-lg bg-crema shadow-2xl sm:rounded-lg">
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-vino/15 bg-crema px-5 py-3">
          <p className="font-display text-xl text-vino">{titulo}</p>
          <button
            type="button"
            onClick={cerrar}
            className="rounded-sm border border-vino/25 px-3 py-1.5 text-sm text-vino"
          >
            ✕ Cerrar
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
