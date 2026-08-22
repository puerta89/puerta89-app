"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { BancoDelMapa, ZonaDelMapa } from "@/lib/datos";
import { abrirCuenta } from "./acciones";

/* El plano se guarda en escala 0-100 para que no dependa del tamaño de la
   pantalla. Aquí se estira al lienzo del dibujo. */
const ANCHO = 1000;
const ALTO = 720;
const ex = (x: number) => (x / 100) * ANCHO;
const ey = (y: number) => (y / 100) * ALTO;

const RADIO = 27;

/** Contorno del local, tomado del plano de Puebla. */
const MUROS = "160,150 465,180 872,266 858,602 150,602";

function minutosDesde(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function comoReloj(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}:${String(min % 60).padStart(2, "0")} h`;
}

export default function Mapa({
  zonas,
  empleadoId,
}: {
  zonas: ZonaDelMapa[];
  empleadoId: string;
}) {
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [mirando, setMirando] = useState<BancoDelMapa | null>(null);
  const [personas, setPersonas] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [guardando, empezar] = useTransition();

  /* El reloj de permanencia tiene que avanzar solo. */
  const [, redibujar] = useState(0);
  useEffect(() => {
    const t = setInterval(() => redibujar((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const bancos = useMemo(
    () => zonas.flatMap((z) => z.bancos.map((b) => ({ ...b, zona: z.nombre }))),
    [zonas],
  );

  function picar(b: BancoDelMapa) {
    setError(null);
    if (b.ticket_id) {
      setElegidos([]);
      setMirando(b);
      return;
    }
    setMirando(null);
    setElegidos((prev) => {
      const nuevo = prev.includes(b.banco_id)
        ? prev.filter((id) => id !== b.banco_id)
        : [...prev, b.banco_id];
      setPersonas(Math.max(1, nuevo.length));
      return nuevo;
    });
  }

  function picarZona(zona: ZonaDelMapa) {
    setError(null);
    setMirando(null);
    const libres = zona.bancos.filter((b) => !b.ticket_id).map((b) => b.banco_id);
    const yaTodos = libres.every((id) => elegidos.includes(id));
    const nuevo = yaTodos ? [] : libres;
    setElegidos(nuevo);
    setPersonas(Math.max(1, nuevo.length));
  }

  function confirmar() {
    setError(null);
    empezar(async () => {
      const r = await abrirCuenta(empleadoId, elegidos, personas);
      if (r?.error) setError(r.error);
      else setElegidos([]);
    });
  }

  const libresPorZona = (z: ZonaDelMapa) =>
    z.bancos.filter((b) => !b.ticket_id).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Botones de zona, para cuando hay prisa y no quieres apuntar al banco */}
      <div className="flex flex-wrap gap-2">
        {zonas.map((z) => (
          <button
            key={z.id}
            type="button"
            onClick={() => picarZona(z)}
            disabled={libresPorZona(z) === 0}
            className="rounded-full border border-vino/25 px-4 py-2 text-sm text-vino transition-colors active:bg-vino/10 disabled:opacity-30"
          >
            {z.nombre}
            <span className="ml-2 text-tinta-2">{libresPorZona(z)} libres</span>
          </button>
        ))}
      </div>

      <div className="rounded-sm border border-vino/15 bg-white p-3">
        {/* La altura va limitada para que el mapa completo quepa en la tablet
            aunque salga la barra de abajo. Nadie debería hacer scroll para
            ver un banco. */}
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          className="mx-auto block h-auto max-h-[60vh] w-full"
          role="img"
          aria-label="Mapa de la barra"
        >
          <polygon
            points={MUROS}
            fill="#F8EDED"
            stroke="#2C0810"
            strokeWidth="4"
          />

          {/* La ventana que da a la calle */}
          <line
            x1="330"
            y1="602"
            x2="560"
            y2="602"
            stroke="#F8EDED"
            strokeWidth="9"
          />
          <line
            x1="330"
            y1="602"
            x2="560"
            y2="602"
            stroke="#AC5B67"
            strokeWidth="2.5"
            strokeDasharray="10 7"
          />

          <rect
            x="180"
            y="436"
            width="462"
            height="150"
            rx="4"
            fill="#781727"
          />
          <text
            x="411"
            y="524"
            textAnchor="middle"
            fill="#FBF6F6"
            fontSize="44"
            fontStyle="italic"
            fontFamily="var(--font-cormorant), Georgia, serif"
          >
            Barra
          </text>

          {bancos.map((b) => {
            const elegido = elegidos.includes(b.banco_id);
            const ocupado = Boolean(b.ticket_id);
            const porCobrar = b.ticket_estado === "por_cobrar";
            const mirandoEste = mirando?.banco_id === b.banco_id;

            const relleno = elegido
              ? "#F4B3B3"
              : porCobrar
                ? "#9C6A1E"
                : ocupado
                  ? "#781727"
                  : "#FFFFFF";
            const tinta = elegido || !ocupado ? "#781727" : "#FBF6F6";

            return (
              <g
                key={b.banco_id}
                onClick={() => picar(b)}
                className="cursor-pointer"
                role="button"
                aria-label={`Banco ${b.numero}${ocupado ? ", ocupado" : ", libre"}`}
              >
                <circle
                  cx={ex(b.pos_x)}
                  cy={ey(b.pos_y)}
                  r={RADIO}
                  fill={relleno}
                  stroke={mirandoEste ? "#2C0810" : "#781727"}
                  strokeWidth={elegido || mirandoEste ? 5 : 2.5}
                />
                <text
                  x={ex(b.pos_x)}
                  y={ey(b.pos_y) + 8}
                  textAnchor="middle"
                  fill={tinta}
                  fontSize="24"
                  fontWeight="500"
                >
                  {b.numero}
                </text>
                {b.abierto_en && (
                  <text
                    x={ex(b.pos_x)}
                    y={ey(b.pos_y) + RADIO + 22}
                    textAnchor="middle"
                    fill="#6E4A50"
                    fontSize="19"
                  >
                    {comoReloj(minutosDesde(b.abierto_en))}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-tinta-2">
        <Muestra color="#FFFFFF" borde>
          Libre
        </Muestra>
        <Muestra color="#F4B3B3">Elegido</Muestra>
        <Muestra color="#781727">Cuenta abierta</Muestra>
        <Muestra color="#9C6A1E">Pidió la cuenta</Muestra>
      </div>

      {error && (
        <p className="rounded-sm bg-vino/10 px-4 py-3 text-sm text-vino">
          {error}
        </p>
      )}

      {/* Barra de abajo: aparece sola cuando hay algo elegido */}
      {elegidos.length > 0 && (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-4 rounded-sm bg-vino px-5 py-4 text-crema">
          <p className="text-lg">
            {elegidos.length} {elegidos.length === 1 ? "banco" : "bancos"}
          </p>

          <div className="flex items-center gap-3">
            <span className="text-sm opacity-80">Personas</span>
            <button
              type="button"
              onClick={() => setPersonas((n) => Math.max(1, n - 1))}
              className="size-11 rounded-full border border-crema/40 text-xl"
              aria-label="Una persona menos"
            >
              −
            </button>
            <span className="w-8 text-center text-xl">{personas}</span>
            <button
              type="button"
              onClick={() => setPersonas((n) => n + 1)}
              className="size-11 rounded-full border border-crema/40 text-xl"
              aria-label="Una persona más"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={confirmar}
            disabled={guardando}
            className="rounded-sm bg-crema px-7 py-3 font-medium text-vino disabled:opacity-50"
          >
            {guardando ? "Abriendo..." : "Abrir cuenta"}
          </button>
        </div>
      )}

      {/* Al picar un banco ocupado, se ve de quién es */}
      {mirando && (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-4 rounded-sm border border-vino/20 bg-white px-5 py-4">
          <div>
            <p className="text-lg text-vino">Banco {mirando.numero}</p>
            <p className="text-sm text-tinta-2">
              {mirando.personas}{" "}
              {mirando.personas === 1 ? "persona" : "personas"} · abrió{" "}
              {mirando.mesero} ·{" "}
              {mirando.abierto_en && comoReloj(minutosDesde(mirando.abierto_en))}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMirando(null)}
            className="rounded-sm border border-vino/30 px-5 py-2.5 text-vino"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

function Muestra({
  color,
  borde,
  children,
}: {
  color: string;
  borde?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2">
      <i
        className="inline-block size-3 rounded-full"
        style={{
          backgroundColor: color,
          border: borde ? "2px solid #781727" : "none",
        }}
      />
      {children}
    </span>
  );
}
