"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Pago } from "@/lib/datos";
import {
  cobrarYCerrar,
  quitarPago,
  cerrarCuenta,
} from "../acciones";

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/** Reparte un total entre N personas, en centavos, para que sume exacto
 * (el resto de centavos se reparte entre los primeros, no se lo lleva
 * todo el último). Es solo el punto de partida — cada parte se puede
 * ajustar a mano después, porque no siempre se divide parejo. */
function dividirEntre(total: number, n: number): number[] {
  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / n);
  const resto = centavos - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < resto ? 1 : 0)) / 100);
}

export default function Cobro({
  ticketId,
  total,
  pagos,
  personas,
}: {
  ticketId: string;
  total: number;
  pagos: Pago[];
  personas: number;
}) {
  const router = useRouter();
  const pagado = pagos.reduce((s, p) => s + p.monto, 0);
  const falta = Math.round((total - pagado) * 100) / 100;

  const [monto, setMonto] = useState("");
  const [propina, setPropina] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const [cerrando, setCerrando] = useState(false);
  // Si algo tarda más de la cuenta (internet flojo), se avisa en vez de
  // dejar la pantalla congelada sin explicación.
  const [lento, setLento] = useState(false);

  useEffect(() => {
    if (!ocupado && !cerrando) return;
    const t = setTimeout(() => setLento(true), 10000);
    return () => {
      clearTimeout(t);
      setLento(false);
    };
  }, [ocupado, cerrando]);

  // ── Dividir la cuenta entre varias personas (estilo Loyverse: elige
  // entre cuántos, arranca parejo, y cada parte se puede ajustar a
  // mano) ────────────────────────────────────────────────────────────
  const [entreN, setEntreN] = useState(Math.max(2, personas));
  const [plan, setPlan] = useState<number[] | null>(null);
  const [pagadas, setPagadas] = useState<Set<number>>(new Set());
  const yaSeCobroAlguna = pagadas.size > 0;

  function dividirDesde(n: number) {
    const partes = dividirEntre(falta, n);
    setPlan(partes);
    // Si a alguien le toca $0 (falta muy chica repartida entre muchos), no
    // hay nada que cobrarle — se marca de una vez, para no ofrecerle un
    // botón que el servidor siempre va a rechazar.
    setPagadas(new Set(partes.flatMap((p, i) => (p <= 0 ? [i] : []))));
  }

  function cambiarN(delta: number) {
    if (yaSeCobroAlguna) return;
    setEntreN((n) => {
      const nuevo = Math.max(2, n + delta);
      if (plan) dividirDesde(nuevo);
      return nuevo;
    });
  }

  function actualizarParte(i: number, texto: string) {
    setPlan((p) => {
      if (!p) return p;
      const n = Number(texto);
      const copia = [...p];
      copia[i] = Number.isFinite(n) && n >= 0 ? n : 0;
      return copia;
    });
  }

  function quitarDivision() {
    setPlan(null);
    setPagadas(new Set());
  }

  /** Guarda un pago y, si con él queda cubierto el total, la cuenta se
   * cierra en la MISMA llamada (cobrar_y_cerrar) — nadie tiene que picarle
   * "Cerrar" aparte, y no puede quedar a medias. Mercedes: "en automático
   * se tiene que cerrar la pestaña, porque luego se traba o se pierde
   * tiempo". Devuelve true si el pago se guardó.
   *
   * Nunca deja la pantalla bloqueada: pase lo que pase (error, se cortó
   * el internet), los botones vuelven a quedar disponibles. */
  async function guardarPago(metodo: "efectivo" | "tarjeta", n: number) {
    setError(null);
    try {
      const r = await cobrarYCerrar(ticketId, metodo, n, Number(propina) || 0);
      if ("error" in r) {
        setError(r.error);
        return false;
      }
      if (r.cerrada) {
        setCerrando(true);
        // Navegación dura, no router.push: si esto se abrió como ventana
        // (app/@modal), un push a /barra puede quedar atrapado en ese
        // mismo árbol interceptado. Con location.href se sale limpio.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/barra";
        return true;
      }
      router.refresh();
      return true;
    } catch {
      setError(
        "Se cortó la conexión. Revisa arriba si el pago ya aparece antes de volver a cobrar — si ya está, no lo repitas.",
      );
      router.refresh();
      return false;
    }
  }

  function cobrarParte(i: number, metodo: "efectivo" | "tarjeta") {
    if (!plan || !(plan[i] > 0)) return;
    setError(null);
    const parteMonto = plan[i];
    empezar(async () => {
      if (await guardarPago(metodo, parteMonto)) {
        setPagadas((p) => new Set(p).add(i));
      }
    });
  }

  function quitar(pagoId: string) {
    setError(null);
    empezar(async () => {
      const r = await quitarPago(ticketId, pagoId);
      if (r?.error) setError(r.error);
      else router.refresh();
    });
  }

  function cobrar(metodo: "efectivo" | "tarjeta") {
    // Si no escriben monto, se cobra todo lo que falta.
    const n = monto.trim() === "" ? falta : Number(monto);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Ese monto no se entiende.");
      return;
    }
    empezar(async () => {
      if (await guardarPago(metodo, n)) setMonto("");
    });
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <div className="rounded-sm border border-vino/15 bg-white px-5 py-5">
        <div className="flex items-baseline justify-between">
          <span className="text-tinta-2">Total de la cuenta</span>
          <span className="text-2xl font-medium tabular-nums">{pesos(total)}</span>
        </div>

        {pagos.length > 0 && (
          <ul className="mt-4 border-t border-vino/10 pt-3">
            {pagos.map((p) => (
              <li
                key={p.pago_id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="capitalize">{p.metodo}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{pesos(p.monto)}</span>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => quitar(p.pago_id)}
                    className="rounded-sm border border-vino/25 px-2.5 py-1 text-xs text-vino disabled:opacity-40"
                  >
                    Quitar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div
          className={`mt-4 flex items-baseline justify-between border-t-2 pt-3 text-lg font-medium ${
            falta <= 0 ? "border-[#556B4A] text-[#556B4A]" : "border-tinta"
          }`}
        >
          <span>{falta <= 0 ? "Cubierta" : "Falta"}</span>
          <span className="tabular-nums">{pesos(Math.max(0, falta))}</span>
        </div>
      </div>

      {falta > 0 && (
        <>
          <label
            className="flex flex-col gap-1.5 rounded-sm border border-vino/15 bg-white px-5 py-4 text-sm text-tinta-2"
            htmlFor="propina"
          >
            Propina, si la dejaron en la app (opcional)
            <input
              id="propina"
              inputMode="decimal"
              value={propina}
              onChange={(e) => setPropina(e.target.value)}
              placeholder="0"
              className="rounded-sm border border-vino/25 px-4 py-3 text-xl tabular-nums text-tinta outline-none focus:border-vino"
            />
            <span className="text-xs">
              En cuanto se cubra el total, la cuenta se cierra sola con esta
              propina.
            </span>
          </label>

          <div className="flex flex-col gap-3 rounded-sm border border-vino/15 bg-white px-5 py-5">
            <p className="text-sm text-tinta-2">¿Se divide entre varias personas?</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={entreN <= 2 || yaSeCobroAlguna}
                  onClick={() => cambiarN(-1)}
                  className="flex size-9 items-center justify-center rounded-full border-2 border-vino/30 text-lg text-vino disabled:opacity-30"
                  aria-label="Una persona menos"
                >
                  −
                </button>
                <span className="w-24 text-center text-sm tabular-nums">
                  {entreN} {entreN === 1 ? "persona" : "personas"}
                </span>
                <button
                  type="button"
                  disabled={yaSeCobroAlguna}
                  onClick={() => cambiarN(1)}
                  className="flex size-9 items-center justify-center rounded-full border-2 border-vino/30 text-lg text-vino disabled:opacity-30"
                  aria-label="Una persona más"
                >
                  +
                </button>
              </div>
              {!plan ? (
                <button
                  type="button"
                  onClick={() => dividirDesde(entreN)}
                  className="rounded-sm border border-vino/25 px-4 py-2 text-sm text-vino"
                >
                  Dividir
                </button>
              ) : (
                <button
                  type="button"
                  onClick={quitarDivision}
                  className="rounded-sm px-2 text-sm text-vino underline"
                >
                  Quitar división
                </button>
              )}
            </div>

            {plan && (
              <div className="flex flex-col gap-2 border-t border-vino/10 pt-3">
                {plan.map((parte, i) => {
                  const pagada = pagadas.has(i);
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between gap-3 rounded-sm border px-3 py-2.5 text-sm ${
                        pagada ? "border-[#556B4A]/30 bg-[#556B4A]/10" : "border-vino/15"
                      }`}
                    >
                      <span className="text-tinta-2">Persona {i + 1}</span>
                      {pagada ? (
                        <>
                          <span className="tabular-nums font-medium">{pesos(parte)}</span>
                          <span className="text-xs text-[#556B4A]">Pagó ✓</span>
                        </>
                      ) : (
                        <>
                          <input
                            inputMode="decimal"
                            value={parte}
                            onChange={(e) => actualizarParte(i, e.target.value)}
                            className="w-24 rounded-sm border border-vino/25 px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-vino"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={ocupado || cerrando}
                              onClick={() => cobrarParte(i, "efectivo")}
                              className="rounded-sm border border-vino/25 px-3 py-1.5 text-xs text-vino disabled:opacity-40"
                            >
                              Efectivo
                            </button>
                            <button
                              type="button"
                              disabled={ocupado || cerrando}
                              onClick={() => cobrarParte(i, "tarjeta")}
                              className="rounded-sm bg-vino px-3 py-1.5 text-xs text-crema disabled:opacity-40"
                            >
                              Tarjeta
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                <p className="text-xs text-tinta-2">
                  Cada parte arranca pareja, pero se puede cambiar el monto antes
                  de cobrarla — no siempre le toca lo mismo a cada quien. Cada
                  quien paga lo suyo por separado, se va sumando arriba.
                </p>
              </div>
            )}

            <label className="border-t border-vino/10 pt-3 text-sm text-tinta-2" htmlFor="monto">
              O cobra un monto libre. Si lo dejas vacío se cobra todo lo que falta.
            </label>
            <input
              id="monto"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder={pesos(falta)}
              className="rounded-sm border border-vino/25 px-4 py-3 text-xl tabular-nums outline-none focus:border-vino"
            />
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={ocupado || cerrando}
                onClick={() => cobrar("efectivo")}
                className="rounded-sm border-2 border-vino px-4 py-4 font-medium text-vino disabled:opacity-50"
              >
                Efectivo
              </button>
              <button
                type="button"
                disabled={ocupado || cerrando}
                onClick={() => cobrar("tarjeta")}
                className="rounded-sm bg-vino px-4 py-4 font-medium text-crema disabled:opacity-50"
              >
                Tarjeta
              </button>
            </div>
            <p className="text-xs text-tinta-2">
              La tarjeta se cobra en la terminal del banco. Aquí solo se anota
              con qué se pagó.
            </p>
          </div>
        </>
      )}

      {cerrando && (
        <p className="rounded-sm bg-[#556B4A]/10 px-4 py-3 text-center text-sm font-medium text-[#556B4A]">
          Cubierta — cerrando la cuenta...
        </p>
      )}

      {/* Se llega aquí casi nunca: solo si ya estaba cubierta desde antes
          (por ejemplo, se recargó la página justo cuando se iba a cerrar
          sola) y hace falta un botón de emergencia para terminar. */}
      {falta <= 0 && !cerrando && (
        <div className="flex flex-col gap-3 rounded-sm border border-vino/15 bg-white px-5 py-5">
          <label className="flex flex-col gap-1.5 text-sm text-tinta-2" htmlFor="propina">
            Propina, si la dejaron en la app (opcional)
            <input
              id="propina"
              inputMode="decimal"
              value={propina}
              onChange={(e) => setPropina(e.target.value)}
              placeholder="0"
              className="rounded-sm border border-vino/25 px-4 py-3 text-xl tabular-nums text-tinta outline-none focus:border-vino"
            />
          </label>
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              empezar(async () => {
                setError(null);
                setCerrando(true);
                try {
                  const r = await cerrarCuenta(ticketId, Number(propina) || 0);
                  if (r?.error) {
                    setError(r.error);
                    setCerrando(false);
                    return;
                  }
                  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                  window.location.href = "/barra";
                } catch {
                  setError("Se cortó la conexión. Intenta de nuevo.");
                  setCerrando(false);
                }
              })
            }
            className="rounded-sm bg-vino px-4 py-4 text-lg font-medium text-crema disabled:opacity-50"
          >
            Cerrar la cuenta
          </button>
          <p className="text-xs text-tinta-2">
            Al cerrar, los bancos quedan libres y la cuenta ya no se puede
            cambiar.
          </p>
        </div>
      )}

      {lento && (
        <p className="rounded-sm bg-rosa-claro/30 px-4 py-3 text-sm text-vino">
          Está tardando más de lo normal — puede ser el internet. Espera unos
          segundos; si no avanza, revisa la conexión y cierra esta ventana
          para ver si el pago ya quedó.
        </p>
      )}

      {error && (
        <p className="rounded-sm bg-vino/10 px-4 py-3 text-sm text-vino">{error}</p>
      )}
    </div>
  );
}
