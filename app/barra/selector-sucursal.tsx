"use client";

import { useState, useTransition } from "react";
import type { SucursalDisponible } from "@/lib/datos";
import { cambiarSucursal } from "./acciones";

export default function SelectorSucursal({
  sucursales,
  actual,
}: {
  sucursales: SucursalDisponible[];
  actual: string;
}) {
  const [ocupado, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function elegir(id: string) {
    setError(null);
    empezar(async () => {
      const r = await cambiarSucursal(id);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] tracking-widest uppercase opacity-75">Sucursal</p>
      <div className="flex gap-1.5">
        {sucursales.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={ocupado || s.id === actual}
            onClick={() => elegir(s.id)}
            className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-opacity disabled:cursor-default ${
              s.id === actual
                ? "bg-crema/25"
                : "border border-crema/40 opacity-80 hover:opacity-100"
            }`}
          >
            {s.nombre}
            {!s.activa && <span className="ml-1 text-[10px] opacity-70">(nueva)</span>}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-crema/90">{error}</p>}
    </div>
  );
}
