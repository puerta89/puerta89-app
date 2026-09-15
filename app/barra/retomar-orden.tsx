"use client";

import { useEffect } from "react";

/** Cuando un mesero vuelve a /barra y ya traía una orden en curso (sin
 * mesa), se le manda derecho a seguir armándola. Navegación DURA a
 * propósito, no redirect() de servidor ni router.push: si /barra se
 * alcanzó con una navegación de cliente (por ejemplo, el "← Atrás" de
 * /tickets-abiertos), esas quedan atrapadas por la ruta interceptada de
 * app/@modal y aparece el panel angosto en vez de la comanda completa —
 * daba la sensación de estar en un loop, viendo solo el botón "Cerrar". */
export default function RetomarOrden({ ticketId }: { ticketId: string }) {
  useEffect(() => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/cuenta/${ticketId}`;
  }, [ticketId]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-crema px-4">
      <p className="text-sm text-tinta-2">Retomando tu orden...</p>
    </main>
  );
}
