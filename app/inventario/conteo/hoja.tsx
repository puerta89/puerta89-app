"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LineaConteo } from "@/lib/datos";
import {
  crearConteo,
  guardarItemConteo,
  cancelarConteo,
  completarConteo,
  type Diferencia,
} from "../acciones";

const cifra = (n: number) =>
  n.toLocaleString("es-MX", { maximumFractionDigits: 2 });

type Estatus = "idle" | "guardando" | "guardado" | "error";

/** El conteo físico es un DOCUMENTO que vive en la base desde que se
 * empieza: cada número que se escribe se guarda solo (un ratito después
 * de dejar de teclear), así que si se cierra la pestaña, se duerme la
 * tablet o se va el internet a medias, nada se pierde — se puede
 * retomar exactamente donde se quedó, incluso desde otro aparato. */
export default function Hoja({
  conteoInicial,
}: {
  conteoInicial: { conteoId: string; creadoEn: string; creadoPor: string; lineas: LineaConteo[] } | null;
}) {
  const router = useRouter();
  const [ocupado, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!conteoInicial) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-sm border border-vino/15 bg-white px-5 py-8 text-center">
          <p className="mb-4 text-sm text-tinta-2">
            No hay ningún conteo en progreso. Al empezar uno, se guarda solo
            conforme vas escribiendo — puedes dejarlo a medias y seguirle
            después, aunque sea desde otro aparato.
          </p>
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              empezar(async () => {
                setError(null);
                const r = await crearConteo();
                if ("error" in r) setError(r.error);
                else router.refresh();
              })
            }
            className="rounded-sm bg-vino px-5 py-3 font-medium text-crema disabled:opacity-50"
          >
            {ocupado ? "Empezando..." : "Empezar conteo"}
          </button>
        </div>
        {error && (
          <p className="rounded-sm bg-vino/10 px-4 py-3 text-sm text-vino">{error}</p>
        )}
      </div>
    );
  }

  return <ConteoEnProgreso conteo={conteoInicial} />;
}

function ConteoEnProgreso({
  conteo,
}: {
  conteo: { conteoId: string; creadoEn: string; creadoPor: string; lineas: LineaConteo[] };
}) {
  const router = useRouter();
  const [contado, setContado] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      conteo.lineas
        .filter((l) => l.contado !== null)
        .map((l) => [l.producto_id ?? l.presentacion_id!, String(l.contado)]),
    ),
  );
  const [estatus, setEstatus] = useState<Record<string, Estatus>>({});
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Diferencia[] | null>(null);
  const [ocupado, empezar] = useTransition();
  const temporizadores = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Si se apaga o se navega con algo sin guardar todavía, que no sea
  // sorpresa — el navegador pregunta antes de cerrar.
  useEffect(() => {
    function avisar(e: BeforeUnloadEvent) {
      if (Object.values(estatus).some((s) => s === "guardando")) e.preventDefault();
    }
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [estatus]);

  const cuantos = Object.values(contado).filter((v) => v.trim() !== "").length;

  function escribir(clave: string, valor: string, linea: LineaConteo) {
    setContado((p) => ({ ...p, [clave]: valor }));
    setEstatus((p) => ({ ...p, [clave]: "idle" }));

    clearTimeout(temporizadores.current[clave]);
    temporizadores.current[clave] = setTimeout(() => {
      const n = Number(valor);
      if (valor.trim() === "" || !Number.isFinite(n) || n < 0) return;
      setEstatus((p) => ({ ...p, [clave]: "guardando" }));
      guardarItemConteo(conteo.conteoId, linea.producto_id, linea.presentacion_id, n).then(
        (r) => {
          setEstatus((p) => ({ ...p, [clave]: r?.error ? "error" : "guardado" }));
        },
      );
    }, 700);
  }

  if (resultado) {
    const conDiferencia = resultado.filter((d) => d.diferencia !== 0);
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-sm border border-vino/15 bg-white px-5 py-5">
          <h2 className="font-display text-2xl text-vino">Así quedó</h2>
          <p className="mt-1 mb-4 text-sm text-tinta-2">
            {conDiferencia.length === 0
              ? "Todo cuadró exacto. Eso casi nunca pasa — buena señal."
              : `${conDiferencia.length} ${conDiferencia.length === 1 ? "cosa no cuadró" : "cosas no cuadraron"}. Esa diferencia es el dato más útil que tienes: es lo que se fue sin registrarse.`}
          </p>
          <ul>
            {resultado.map((d) => (
              <li
                key={d.nombre}
                className="flex justify-between gap-3 border-b border-vino/10 py-2 text-sm last:border-b-0"
              >
                <span>{d.nombre}</span>
                <span className="flex gap-4 tabular-nums">
                  <span className="text-tinta-2">
                    creía {cifra(d.esperaba)} · había {cifra(d.habia)}
                  </span>
                  <span
                    className={
                      d.diferencia === 0
                        ? "text-[#556B4A]"
                        : d.diferencia < 0
                          ? "text-vino"
                          : "text-[#9C6A1E]"
                    }
                  >
                    {d.diferencia > 0 ? "+" : ""}
                    {cifra(d.diferencia)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => router.push("/inventario")}
          className="rounded-sm bg-vino px-4 py-4 font-medium text-crema"
        >
          Volver al inventario
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-tinta-2">
        Empezó {conteo.creadoPor} · {new Date(conteo.creadoEn).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
      </p>
      <p className="text-sm text-tinta-2">
        Cuenta lo que de verdad hay y escríbelo. Cada número se guarda solo —
        puedes cerrar esto y seguirle después, no se pierde nada. Lo que
        dejes vacío no se toca al cerrar el conteo.
      </p>

      <div className="overflow-hidden rounded-sm border border-vino/15 bg-white">
        {conteo.lineas.map((l) => {
          const clave = l.producto_id ?? l.presentacion_id!;
          const st = estatus[clave] ?? "idle";
          return (
            <label
              key={clave}
              className="flex items-center justify-between gap-3 border-b border-vino/10 px-4 py-2.5 text-sm last:border-b-0"
            >
              <span className="flex-1">
                {l.nombre}
                <span className="block text-xs text-tinta-2">
                  el sistema cree que hay {cifra(l.esperado)} {l.unidad}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {st === "guardando" && (
                  <span className="text-xs text-tinta-2">guardando...</span>
                )}
                {st === "guardado" && (
                  <span className="text-xs text-[#556B4A]">✓ guardado</span>
                )}
                {st === "error" && (
                  <span className="text-xs text-vino">no se guardó</span>
                )}
                <input
                  inputMode="decimal"
                  value={contado[clave] ?? ""}
                  onChange={(e) => escribir(clave, e.target.value, l)}
                  placeholder="—"
                  className="w-24 rounded-sm border border-vino/25 px-3 py-2 text-right tabular-nums outline-none focus:border-vino"
                />
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-sm border border-vino/15 bg-white px-5 py-5">
        <p className="text-sm">
          Vas a cerrar con <strong>{cuantos}</strong>{" "}
          {cuantos === 1 ? "conteo escrito" : "conteos escritos"}.
        </p>
        <input
          inputMode="numeric"
          maxLength={4}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="Código del dueño"
          className="rounded-sm border border-vino/25 px-3 py-3 text-center text-xl tracking-[0.5em] outline-none focus:border-vino"
        />
        <button
          type="button"
          disabled={ocupado || cuantos === 0 || codigo.length !== 4}
          onClick={() =>
            empezar(async () => {
              setError(null);
              const r = await completarConteo(conteo.conteoId, codigo);
              if ("error" in r) setError(r.error);
              else setResultado(r.diferencias);
            })
          }
          className="rounded-sm bg-vino px-4 py-4 text-lg font-medium text-crema disabled:opacity-40"
        >
          {ocupado ? "Cerrando..." : "Cerrar el conteo"}
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() =>
            empezar(async () => {
              setError(null);
              const r = await cancelarConteo(conteo.conteoId);
              if (r?.error) setError(r.error);
              else router.refresh();
            })
          }
          className="text-xs text-tinta-2 underline disabled:opacity-40"
        >
          Cancelar este conteo (no aplica nada)
        </button>
      </div>

      {error && (
        <p className="rounded-sm bg-vino/10 px-4 py-3 text-sm text-vino">{error}</p>
      )}
    </div>
  );
}
