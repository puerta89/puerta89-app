"use client";

import { useEffect, useState } from "react";

function comoReloj(min: number) {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")} h`;
}

/** Cuánto lleva el cliente sentado. Avanza solo, sin recargar. */
export default function Reloj({ desde }: { desde: string }) {
  const [min, setMin] = useState<number | null>(null);

  useEffect(() => {
    const calcular = () =>
      setMin(Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 60000)));
    calcular();
    const t = setInterval(calcular, 30_000);
    return () => clearInterval(t);
  }, [desde]);

  return <span className="tabular-nums">{min === null ? "—" : comoReloj(min)}</span>;
}
