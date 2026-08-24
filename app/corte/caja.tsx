"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Empleado, MovimientoCaja, ResumenDia } from "@/lib/datos";
import { abrirCaja, moverEfectivo, cerrarCaja } from "./acciones";

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function Caja({
  fecha,
  resumen,
  movimientos,
  equipo,
  sugeridos,
  propinas,
}: {
  fecha: string;
  resumen: ResumenDia | null;
  movimientos: MovimientoCaja[];
  equipo: Empleado[];
  sugeridos: string[];
  propinas: { nombre: string; monto: number }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  function correr(fn: () => Promise<{ error: string } | null>) {
    setError(null);
    empezar(async () => {
      const r = await fn();
      if (r?.error) setError(r.error);
      else router.refresh();
    });
  }

  const aviso = error && (
    <p className="rounded-sm bg-vino/10 px-4 py-3 text-sm text-vino">{error}</p>
  );

  /* ── La caja del día todavía no se abre ── */
  if (!resumen) {
    return (
      <Abrir fecha={fecha} correr={correr} ocupado={ocupado} aviso={aviso} />
    );
  }

  const cerrado = resumen.estado === "cerrado";

  return (
    <div className="flex flex-col gap-4">
      <Numeros resumen={resumen} />

      {!cerrado && (
        <Movimientos
          corteId={resumen.corte_id}
          movimientos={movimientos}
          correr={correr}
          ocupado={ocupado}
        />
      )}

      {cerrado ? (
        <Cerrado resumen={resumen} propinas={propinas} />
      ) : (
        <Cerrar
          corteId={resumen.corte_id}
          esperado={resumen.efectivo_esperado}
          equipo={equipo}
          sugeridos={sugeridos}
          correr={correr}
          ocupado={ocupado}
        />
      )}

      {aviso}
    </div>
  );
}

function Abrir({
  fecha,
  correr,
  ocupado,
  aviso,
}: {
  fecha: string;
  correr: (fn: () => Promise<{ error: string } | null>) => void;
  ocupado: boolean;
  aviso: React.ReactNode;
}) {
  const [fondo, setFondo] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-sm border border-vino/15 bg-white px-5 py-5">
        <h2 className="font-display text-2xl text-vino">Abrir la caja</h2>
        <p className="text-sm text-tinta-2">
          ¿Con cuánto efectivo arranca el día? Es el fondo para dar cambio.
        </p>
        <input
          inputMode="decimal"
          value={fondo}
          onChange={(e) => setFondo(e.target.value)}
          placeholder="0"
          className="rounded-sm border border-vino/25 px-4 py-3 text-xl tabular-nums outline-none focus:border-vino"
        />
        <button
          type="button"
          disabled={ocupado}
          onClick={() => correr(() => abrirCaja(fecha, Number(fondo) || 0))}
          className="rounded-sm bg-vino px-4 py-4 font-medium text-crema disabled:opacity-50"
        >
          {ocupado ? "Abriendo..." : "Abrir el día"}
        </button>
      </div>
      {aviso}
    </div>
  );
}

function Numeros({ resumen }: { resumen: ResumenDia }) {
  const filas: [string, number, string?][] = [
    ["Fondo con el que abrió", resumen.fondo_inicial],
    ["Ventas en efectivo", resumen.ventas_efectivo],
    ["Entradas de efectivo", resumen.entradas],
    ["Salidas de efectivo", -resumen.salidas],
  ];
  return (
    <div className="rounded-sm border border-vino/15 bg-white px-5 py-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-2xl text-vino">Cómo va el día</h2>
        <span className="text-sm text-tinta-2">
          {resumen.tickets} {resumen.tickets === 1 ? "cuenta" : "cuentas"}
        </span>
      </div>
      {filas.map(([texto, valor]) => (
        <div
          key={texto}
          className="flex justify-between border-b border-vino/10 py-2 text-sm"
        >
          <span className="text-tinta-2">{texto}</span>
          <span className="tabular-nums">{pesos(valor)}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t-2 border-tinta py-3 text-lg font-medium">
        <span>Debería haber en caja</span>
        <span className="tabular-nums">{pesos(resumen.efectivo_esperado)}</span>
      </div>
      <p className="text-sm text-tinta-2">
        Con tarjeta entraron {pesos(resumen.ventas_tarjeta)}. Ese dinero no está
        en la caja, llega al banco.
      </p>
    </div>
  );
}

function Movimientos({
  corteId,
  movimientos,
  correr,
  ocupado,
}: {
  corteId: string;
  movimientos: MovimientoCaja[];
  correr: (fn: () => Promise<{ error: string } | null>) => void;
  ocupado: boolean;
}) {
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");

  function registrar(tipo: "entrada" | "salida") {
    correr(async () => {
      const r = await moverEfectivo(corteId, tipo, Number(monto) || 0, concepto);
      if (!r) {
        setMonto("");
        setConcepto("");
      }
      return r;
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-vino/15 bg-white px-5 py-5">
      <h2 className="font-display text-2xl text-vino">Efectivo que entra o sale</h2>
      <p className="text-sm text-tinta-2">
        Si sacaste dinero para comprar algo, o metiste cambio, anótalo aquí. Si
        no, la caja no va a cuadrar en la noche.
      </p>

      {movimientos.length > 0 && (
        <ul className="border-t border-vino/10 pt-2">
          {movimientos.map((m) => (
            <li key={m.id} className="flex justify-between gap-3 py-1.5 text-sm">
              <span>{m.concepto}</span>
              <span
                className={`tabular-nums ${m.tipo === "salida" ? "text-vino" : "text-[#556B4A]"}`}
              >
                {m.tipo === "salida" ? "−" : "+"}
                {pesos(m.monto)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          inputMode="decimal"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="Cuánto"
          className="w-full rounded-sm border border-vino/25 px-3 py-3 tabular-nums outline-none focus:border-vino sm:w-32"
        />
        <input
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="De qué fue"
          className="flex-1 rounded-sm border border-vino/25 px-3 py-3 outline-none focus:border-vino"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={ocupado}
          onClick={() => registrar("salida")}
          className="rounded-sm border-2 border-vino px-4 py-3 text-sm font-medium text-vino disabled:opacity-50"
        >
          Salió
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => registrar("entrada")}
          className="rounded-sm border-2 border-[#556B4A] px-4 py-3 text-sm font-medium text-[#556B4A] disabled:opacity-50"
        >
          Entró
        </button>
      </div>
    </div>
  );
}

function Cerrar({
  corteId,
  esperado,
  equipo,
  sugeridos,
  correr,
  ocupado,
}: {
  corteId: string;
  esperado: number;
  equipo: Empleado[];
  sugeridos: string[];
  correr: (fn: () => Promise<{ error: string } | null>) => void;
  ocupado: boolean;
}) {
  const [contado, setContado] = useState("");
  const [propTarjeta, setPropTarjeta] = useState("");
  const [turno, setTurno] = useState<string[]>(sugeridos);
  const [codigo, setCodigo] = useState("");

  const hayConteo = contado.trim() !== "" && Number.isFinite(Number(contado));
  const sobrante = hayConteo
    ? Math.round((Number(contado) - esperado) * 100) / 100
    : null;
  // La regla: el sobrante es la propina en efectivo.
  const propEfectivo = sobrante !== null ? Math.max(0, sobrante) : 0;
  const totalPropina = propEfectivo + (Number(propTarjeta) || 0);
  const cada = turno.length > 0 ? totalPropina / turno.length : 0;

  return (
    <div className="flex flex-col gap-4 rounded-sm border border-vino/15 bg-white px-5 py-5">
      <h2 className="font-display text-2xl text-vino">Cerrar el día</h2>

      <label className="flex flex-col gap-1.5 text-sm">
        Cuenta el efectivo de la caja y escribe cuánto hay
        <input
          inputMode="decimal"
          value={contado}
          onChange={(e) => setContado(e.target.value)}
          placeholder={pesos(esperado)}
          className="rounded-sm border border-vino/25 px-4 py-3 text-xl tabular-nums outline-none focus:border-vino"
        />
      </label>

      {sobrante !== null && (
        <div
          className={`rounded-sm px-4 py-3 text-sm ${
            sobrante < 0
              ? "bg-vino/10 text-vino"
              : "bg-[#EAEFE4] text-[#556B4A]"
          }`}
        >
          {sobrante < 0 ? (
            <>
              <strong>Faltan {pesos(Math.abs(sobrante))}.</strong> Eso no es
              propina: es un descuadre. Vale la pena revisar antes de cerrar.
            </>
          ) : sobrante === 0 ? (
            <>La caja cuadra exacto. No hubo propina en efectivo.</>
          ) : (
            <>
              <strong>Sobran {pesos(sobrante)}</strong>, que se toman como
              propina en efectivo.
            </>
          )}
        </div>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        Propina con tarjeta, según la terminal del banco
        <input
          inputMode="decimal"
          value={propTarjeta}
          onChange={(e) => setPropTarjeta(e.target.value)}
          placeholder="0"
          className="rounded-sm border border-vino/25 px-4 py-3 text-xl tabular-nums outline-none focus:border-vino"
        />
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1">¿Quiénes estuvieron en el turno?</legend>
        {equipo.map((e) => (
          <label key={e.empleado_id} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={turno.includes(e.empleado_id)}
              onChange={(ev) =>
                setTurno((prev) =>
                  ev.target.checked
                    ? [...prev, e.empleado_id]
                    : prev.filter((x) => x !== e.empleado_id),
                )
              }
              className="size-5 accent-[#781727]"
            />
            {e.nombre}
            <span className="text-xs text-tinta-2">
              {e.rol === "dueno" ? "dueño" : e.rol}
            </span>
          </label>
        ))}
      </fieldset>

      {turno.length > 0 && totalPropina > 0 && (
        <div className="rounded-sm bg-surface-2 bg-rosa-claro/25 px-4 py-3 text-sm">
          Propina total {pesos(totalPropina)} entre {turno.length}:{" "}
          <strong>{pesos(cada)}</strong> para cada quien.
        </div>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        Código del dueño
        <input
          inputMode="numeric"
          maxLength={4}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="····"
          className="rounded-sm border border-vino/25 px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-vino"
        />
      </label>

      <button
        type="button"
        disabled={ocupado || !hayConteo || codigo.length !== 4 || turno.length === 0}
        onClick={() =>
          correr(() =>
            cerrarCaja(
              corteId,
              codigo,
              Number(contado),
              propEfectivo,
              Number(propTarjeta) || 0,
              turno,
            ),
          )
        }
        className="rounded-sm bg-vino px-4 py-4 text-lg font-medium text-crema disabled:opacity-40"
      >
        {ocupado ? "Cerrando..." : "Cerrar el día"}
      </button>
    </div>
  );
}

function Cerrado({
  resumen,
  propinas,
}: {
  resumen: ResumenDia;
  propinas: { nombre: string; monto: number }[];
}) {
  const sobrante =
    (resumen.efectivo_contado ?? 0) - resumen.efectivo_esperado;
  return (
    <div className="flex flex-col gap-4 rounded-sm border border-[#556B4A]/40 bg-[#EAEFE4]/40 px-5 py-5">
      <h2 className="font-display text-2xl text-[#556B4A]">El día ya cerró</h2>

      <div className="flex justify-between text-sm">
        <span className="text-tinta-2">Se contaron</span>
        <span className="tabular-nums">
          {pesos(resumen.efectivo_contado ?? 0)}
        </span>
      </div>
      <div className="flex justify-between border-b border-vino/10 pb-3 text-sm">
        <span className="text-tinta-2">
          {sobrante < 0 ? "Faltaron" : "Sobraron"}
        </span>
        <span
          className={`tabular-nums ${sobrante < 0 ? "text-vino" : "text-[#556B4A]"}`}
        >
          {pesos(Math.abs(sobrante))}
        </span>
      </div>

      {propinas.length > 0 && (
        <>
          <p className="text-sm text-tinta-2">Propina que le tocó a cada quien</p>
          <ul>
            {propinas.map((p) => (
              <li
                key={p.nombre}
                className="flex justify-between border-b border-vino/10 py-2 text-sm last:border-b-0"
              >
                <span>{p.nombre}</span>
                <span className="tabular-nums">{pesos(p.monto)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
