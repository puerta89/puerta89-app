"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MiembroEquipo } from "@/lib/datos";
import { altaEmpleado, cambiarCodigo, cambiarAlta } from "./acciones";

const PUESTOS = [
  { valor: "mesero", texto: "Mesero" },
  { valor: "gerente", texto: "Gerente" },
  { valor: "dueno", texto: "Dueño" },
];

const comoPuesto = (r: string) =>
  r === "dueno" ? "Dueño" : r === "gerente" ? "Gerente" : "Mesero";

export default function Equipo({ equipo }: { equipo: MiembroEquipo[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState("mesero");
  const [codigo, setCodigo] = useState("");
  const [miCodigo, setMiCodigo] = useState("");

  const [editando, setEditando] = useState<MiembroEquipo | null>(null);
  const [nuevoCodigo, setNuevoCodigo] = useState("");

  function correr(fn: () => Promise<{ error: string } | null>, aviso: string, limpiar?: () => void) {
    setError(null);
    setListo(null);
    empezar(async () => {
      const r = await fn();
      if (r?.error) setError(r.error);
      else {
        setListo(aviso);
        limpiar?.();
        router.refresh();
      }
    });
  }

  const soloDigitos = (v: string) => v.replace(/\D/g, "").slice(0, 4);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-sm border border-vino/15 bg-white px-5 py-5">
        <h2 className="font-display text-2xl text-vino">Dar de alta a alguien</h2>
        <p className="text-sm text-tinta-2">
          El código que le pongas es con el que va a entrar. Díselo en persona,
          no por mensaje. Se guarda cifrado: ni yo ni nadie lo puede leer
          después, solo cambiarlo.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre"
            className="flex-1 rounded-sm border border-vino/25 px-3 py-3 outline-none focus:border-vino"
          />
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            className="rounded-sm border border-vino/25 bg-white px-3 py-3 outline-none focus:border-vino"
          >
            {PUESTOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.texto}
              </option>
            ))}
          </select>
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          Su código nuevo
          <input
            inputMode="numeric"
            value={codigo}
            onChange={(e) => setCodigo(soloDigitos(e.target.value))}
            placeholder="····"
            className="rounded-sm border border-vino/25 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-vino"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          Tu código, para autorizar
          <input
            inputMode="numeric"
            value={miCodigo}
            onChange={(e) => setMiCodigo(soloDigitos(e.target.value))}
            placeholder="····"
            className="rounded-sm border border-vino/25 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-vino"
          />
        </label>

        <button
          type="button"
          disabled={
            ocupado || !nombre.trim() || codigo.length !== 4 || miCodigo.length !== 4
          }
          onClick={() =>
            correr(
              () => altaEmpleado(miCodigo, nombre, rol, codigo),
              `${nombre.trim()} ya puede entrar con su código.`,
              () => {
                setNombre("");
                setCodigo("");
              },
            )
          }
          className="rounded-sm bg-vino px-4 py-3.5 font-medium text-crema disabled:opacity-40"
        >
          {ocupado ? "Guardando..." : "Dar de alta"}
        </button>
      </div>

      {error && (
        <p className="rounded-sm bg-vino/10 px-4 py-3 text-sm text-vino">{error}</p>
      )}
      {listo && (
        <p className="rounded-sm bg-[#EAEFE4] px-4 py-3 text-sm text-[#556B4A]">
          {listo}
        </p>
      )}

      <div className="rounded-sm border border-vino/15 bg-white">
        {equipo.map((m) => (
          <div
            key={m.empleado_id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-vino/10 px-5 py-3.5 last:border-b-0"
          >
            <div className={m.activo ? "" : "opacity-50"}>
              <p className="font-medium">
                {m.nombre}
                {!m.activo && " · dado de baja"}
              </p>
              <p className="text-xs text-tinta-2">
                {comoPuesto(m.rol)}
                {m.cuentas_abiertas > 0 &&
                  ` · ${m.cuentas_abiertas} ${m.cuentas_abiertas === 1 ? "cuenta abierta" : "cuentas abiertas"}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditando(m);
                  setNuevoCodigo("");
                }}
                className="rounded-sm border border-vino/25 px-3 py-2 text-xs text-vino"
              >
                Cambiar su código
              </button>
              <button
                type="button"
                disabled={ocupado || miCodigo.length !== 4}
                onClick={() =>
                  correr(
                    () => cambiarAlta(miCodigo, m.empleado_id, !m.activo),
                    m.activo ? `${m.nombre} ya no puede entrar.` : `${m.nombre} vuelve a entrar.`,
                  )
                }
                className="rounded-sm border border-vino/25 px-3 py-2 text-xs text-vino disabled:opacity-30"
              >
                {m.activo ? "Dar de baja" : "Reactivar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-tinta-2">
        Para dar de baja o reactivar, escribe tu código arriba primero. Nadie se
        borra nunca: se da de baja, para que sus tickets viejos sigan teniendo
        nombre.
      </p>

      {editando && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-tinta/50 sm:items-center sm:p-6">
          <div className="w-full max-w-md rounded-t-lg bg-crema sm:rounded-lg">
            <div className="flex items-start justify-between gap-3 border-b border-vino/15 px-4 py-3">
              <div>
                <p className="font-medium">Cambiar el código de {editando.nombre}</p>
                <p className="text-xs text-tinta-2">
                  El anterior deja de servir en cuanto guardes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditando(null)}
                className="rounded-sm border border-vino/25 px-3 py-1.5 text-sm text-vino"
              >
                Cerrar
              </button>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <input
                inputMode="numeric"
                value={nuevoCodigo}
                onChange={(e) => setNuevoCodigo(soloDigitos(e.target.value))}
                placeholder="Código nuevo"
                className="rounded-sm border border-vino/25 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-vino"
              />
              <input
                inputMode="numeric"
                value={miCodigo}
                onChange={(e) => setMiCodigo(soloDigitos(e.target.value))}
                placeholder="Tu código"
                className="rounded-sm border border-vino/25 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-vino"
              />
              <button
                type="button"
                disabled={ocupado || nuevoCodigo.length !== 4 || miCodigo.length !== 4}
                onClick={() =>
                  correr(
                    () => cambiarCodigo(miCodigo, editando.empleado_id, nuevoCodigo),
                    `El código de ${editando.nombre} quedó cambiado.`,
                    () => setEditando(null),
                  )
                }
                className="rounded-sm bg-vino px-4 py-3.5 font-medium text-crema disabled:opacity-40"
              >
                {ocupado ? "Guardando..." : "Cambiar el código"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
