"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Reloj from "../../reloj";

/** El panel lateral con el que se abre una cuenta desde el mapa de la
 * barra — "como un tipo ticket" que se desliza del lado derecho, para
 * que el mesero no tenga que dejar el mapa ni picarle varias cosas.
 * Vive detrás de una ruta interceptada (ver app/@modal), así que la URL
 * sí cambia a /cuenta/[id] pero el mapa sigue de fondo. */
export default function PanelCuenta({
  bancos,
  personas,
  mesero,
  abiertoEn,
  color,
  colorTexto,
  children,
}: {
  bancos: number[];
  personas: number;
  mesero: string;
  abiertoEn: string;
  color: string;
  colorTexto: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  function cerrar() {
    router.back();
  }

  // Que no se pueda arrastrar el mapa de fondo mientras el panel está abierto.
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
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={cerrar}
        className="absolute inset-0 bg-tinta/50"
      />
      <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-crema shadow-2xl sm:w-[85vw]">
        <header
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
          style={{ backgroundColor: color, color: colorTexto }}
        >
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={cerrar}
              className="rounded-sm border border-current/40 px-3 py-2 text-sm"
            >
              ✕ Cerrar
            </button>
            <div>
              <p className="text-[11px] tracking-widest uppercase opacity-75">
                {bancos.length === 1 ? "Banco" : "Bancos"}
              </p>
              <p className="text-lg font-medium">{bancos.join(" · ")}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] tracking-widest uppercase opacity-75">
              {personas} {personas === 1 ? "persona" : "personas"} · abrió{" "}
              {mesero}
            </p>
            <p className="text-lg font-medium">
              <Reloj desde={abiertoEn} />
            </p>
          </div>
        </header>

        <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
