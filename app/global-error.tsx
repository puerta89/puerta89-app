"use client";

import { useEffect } from "react";

/** Red de seguridad de último recurso: solo se activa si el layout raíz
 * mismo (app/layout.tsx) truena, algo que en la práctica casi nunca
 * debería pasar. Next.js exige que este archivo traiga su propio
 * <html>/<body> porque reemplaza al layout entero — por eso usa estilos
 * en línea en vez de las clases de Tailwind (no se puede confiar en que
 * globals.css ya esté disponible aquí). */
export default function ErrorRaiz({
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
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          padding: 24,
          textAlign: "center",
          backgroundColor: "#781727",
          color: "#fbf6f6",
          fontFamily: "Georgia, serif",
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontStyle: "italic", margin: 0 }}>
            Puerta 89 no pudo cargar
          </h1>
          <p style={{ maxWidth: 320, fontSize: 14, color: "#ac5b67" }}>
            Intenta de nuevo. Si sigue igual, cierra esto y vuelve a
            entrar con tu código.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          style={{
            borderRadius: 2,
            backgroundColor: "#f4b3b3",
            color: "#781727",
            border: "none",
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
        {error.digest && (
          <p style={{ fontSize: 12, color: "rgba(172,91,103,0.6)" }}>
            Código: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
