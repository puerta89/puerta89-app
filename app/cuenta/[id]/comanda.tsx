"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Botella, ItemCatalogo, LineaTicket } from "@/lib/datos";
import {
  agregarLinea,
  abrirBotella,
  cancelarLinea,
  pedirCuenta,
} from "./acciones";

const TIPOS_VINO = ["tinto", "blanco", "rosado", "naranja"] as const;
const TAMANOS_HELADO = ["1 Bola", "2 Bolas", "Medio Litro", "Litro"];

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

type Pendiente =
  | { tipo: "vino-copa"; vino: string; precio: number }
  | { tipo: "vino-botella"; vino: string; precio: number }
  | { tipo: "helado"; tamano: string; cuantos: number; precio: number }
  | null;

export default function Comanda({
  ticketId,
  catalogo,
  botellas,
  lineas,
  total,
  estado,
}: {
  ticketId: string;
  catalogo: ItemCatalogo[];
  botellas: Botella[];
  lineas: LineaTicket[];
  total: number;
  estado: "abierto" | "por_cobrar";
}) {
  const router = useRouter();
  const categorias = useMemo(
    () => [...new Set(catalogo.map((i) => i.categoria))],
    [catalogo],
  );
  const [categoria, setCategoria] = useState(categorias[0] ?? "");
  const [pendiente, setPendiente] = useState<Pendiente>(null);
  const [sabores, setSabores] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<LineaTicket | null>(null);
  const [codigoJefe, setCodigoJefe] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ocupado, empezar] = useTransition();

  const sabores_helado = useMemo(
    () =>
      [...new Map(
        catalogo.filter((i) => i.es_sabor_helado).map((i) => [i.producto_id, i]),
      ).values()],
    [catalogo],
  );

  /** Precio de un tipo de vino en cierta presentación (todos valen igual). */
  function precioVino(tipo: string, pres: string) {
    return catalogo.find(
      (i) => i.tipo_vino === tipo && i.presentacion === pres,
    )?.precio;
  }

  /** La presentación concreta de una etiqueta. */
  function presentacionDe(productoId: string, pres: string) {
    return catalogo.find(
      (i) => i.producto_id === productoId && i.presentacion === pres,
    )?.presentacion_id;
  }

  function correr(fn: () => Promise<{ error: string } | null>) {
    setError(null);
    empezar(async () => {
      const r = await fn();
      if (r?.error) setError(r.error);
      else {
        setPendiente(null);
        setSabores([]);
        setQuitando(null);
        setCodigoJefe("");
        setMotivo("");
        router.refresh();
      }
    });
  }

  function agregarSimple(item: ItemCatalogo) {
    correr(() => agregarLinea(ticketId, item.presentacion_id, 1, null, null));
  }

  const etiquetasPorTipo = (tipo: string) =>
    [...new Map(
      catalogo
        .filter((i) => i.tipo_vino === tipo && i.presentacion === "Botella")
        .map((i) => [i.producto_id, i]),
    ).values()];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
      {/* ─────────── MENÚ ─────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {categorias.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                c === categoria
                  ? "bg-vino text-crema"
                  : "border border-vino/25 text-vino"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categoria === "Vinos" &&
            TIPOS_VINO.flatMap((tipo) =>
              ["Copa", "Botella"].map((pres) => {
                const precio = precioVino(tipo, pres);
                if (precio === undefined) return null;
                return (
                  <Tarjeta
                    key={`${tipo}-${pres}`}
                    titulo={tipo}
                    abajo={`${pres} · ${pesos(precio)}`}
                    onClick={() =>
                      setPendiente({
                        tipo: pres === "Copa" ? "vino-copa" : "vino-botella",
                        vino: tipo,
                        precio,
                      })
                    }
                  />
                );
              }),
            )}

          {categoria === "Helados" &&
            TAMANOS_HELADO.map((t) => {
              const item = catalogo.find(
                (i) => i.es_sabor_helado && i.presentacion === t,
              );
              if (!item) return null;
              return (
                <Tarjeta
                  key={t}
                  titulo={t}
                  abajo={`${pesos(item.precio)}${item.es_para_llevar ? " · para llevar" : ""}`}
                  onClick={() =>
                    setPendiente({
                      tipo: "helado",
                      tamano: t,
                      cuantos: t === "2 Bolas" ? 2 : 1,
                      precio: item.precio,
                    })
                  }
                />
              );
            })}

          {categoria !== "Vinos" &&
            categoria !== "Helados" &&
            catalogo
              .filter((i) => i.categoria === categoria)
              .map((i) => (
                <Tarjeta
                  key={i.presentacion_id}
                  titulo={i.producto}
                  abajo={`${i.presentacion === "Única" ? "" : i.presentacion + " · "}${pesos(i.precio)}`}
                  onClick={() => agregarSimple(i)}
                />
              ))}
        </div>
      </section>

      {/* ─────────── LA CUENTA ─────────── */}
      <section className="flex flex-col rounded-sm border border-vino/15 bg-white">
        <div className="flex-1 px-4 py-3">
          {lineas.length === 0 ? (
            <p className="py-10 text-center text-sm text-tinta-2">
              Todavía no han pedido nada.
            </p>
          ) : (
            <ul>
              {lineas.map((l) => (
                <li key={l.linea_id} className="border-b border-vino/10 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setQuitando(l)}
                  className="flex w-full gap-3 py-2.5 text-left text-sm active:bg-rosa-claro/30"
                >
                  <span className="w-7 shrink-0 text-tinta-2 tabular-nums">
                    {l.cantidad}×
                  </span>
                  <span className="flex-1">
                    {l.producto}
                    {l.presentacion !== "Única" && ` · ${l.presentacion}`}
                    {(l.etiqueta || l.sabores) && (
                      <small className="block text-xs text-tinta-2">
                        {l.sabores ?? l.etiqueta}
                      </small>
                    )}
                  </span>
                  <span className="tabular-nums">{pesos(l.importe)}</span>
                </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t-2 border-tinta px-4 py-3 text-lg font-medium">
          <span>Total</span>
          <span className="tabular-nums">{pesos(total)}</span>
        </div>

        {lineas.length > 0 && (
          <div className="flex gap-2 px-4 pb-4">
            {estado === "abierto" && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => correr(() => pedirCuenta(ticketId))}
                className="flex-1 rounded-sm border border-vino/30 px-4 py-3 text-sm text-vino disabled:opacity-50"
              >
                Pidieron la cuenta
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push(`/cuenta/${ticketId}/cobrar`)}
              className="flex-1 rounded-sm bg-vino px-4 py-3 font-medium text-crema"
            >
              Cobrar
            </button>
          </div>
        )}
      </section>

      {error && (
        <p className="rounded-sm bg-vino/10 px-4 py-3 text-sm text-vino lg:col-span-2">
          {error}
        </p>
      )}

      {/* ─────────── ¿DE CUÁL BOTELLA? ─────────── */}
      {pendiente?.tipo === "vino-copa" && (
        <Hoja
          titulo={`¿De cuál ${pendiente.vino}?`}
          sub={`Copa · ${pesos(pendiente.precio)}`}
          cerrar={() => setPendiente(null)}
        >
          {botellas
            .filter((b) => b.tipo_vino === pendiente.vino)
            .map((b) => (
              <Opcion
                key={b.botella_id}
                titulo={b.etiqueta}
                abajo={`quedan ${b.copas_restantes} ${b.copas_restantes === 1 ? "copa" : "copas"}`}
                etiqueta={b.copas_restantes <= 1 ? "ÚLTIMA" : "ABIERTA"}
                tono={b.copas_restantes <= 1 ? "aviso" : "bien"}
                disabled={ocupado}
                onClick={() =>
                  correr(() =>
                    agregarLinea(
                      ticketId,
                      presentacionDe(b.producto_id, "Copa")!,
                      1,
                      b.botella_id,
                      null,
                    ),
                  )
                }
              />
            ))}

          <p className="px-4 pt-4 pb-1 text-xs tracking-widest text-tinta-2 uppercase">
            Destapar una nueva
          </p>
          {etiquetasPorTipo(pendiente.vino).map((e) => (
            <Opcion
              key={e.producto_id}
              titulo={e.producto}
              abajo="se destapa y quedan 6 copas"
              etiqueta="NUEVA"
              tono="marca"
              disabled={ocupado}
              onClick={() => correr(() => abrirBotella(ticketId, e.producto_id))}
            />
          ))}
        </Hoja>
      )}

      {/* ─────────── BOTELLA COMPLETA ─────────── */}
      {pendiente?.tipo === "vino-botella" && (
        <Hoja
          titulo={`¿Cuál ${pendiente.vino}?`}
          sub={`Botella · ${pesos(pendiente.precio)}`}
          cerrar={() => setPendiente(null)}
        >
          {etiquetasPorTipo(pendiente.vino).map((e) => (
            <Opcion
              key={e.producto_id}
              titulo={e.producto}
              disabled={ocupado}
              onClick={() =>
                correr(() =>
                  agregarLinea(ticketId, e.presentacion_id, 1, null, null),
                )
              }
            />
          ))}
        </Hoja>
      )}

      {/* ─────────── QUITAR UN RENGLÓN ─────────── */}
      {quitando && (
        <Hoja
          titulo="Quitar de la cuenta"
          sub={`${quitando.cantidad}× ${quitando.producto} · ${pesos(quitando.importe)}`}
          cerrar={() => {
            setQuitando(null);
            setCodigoJefe("");
            setMotivo("");
          }}
        >
          <div className="flex flex-col gap-4 p-4">
            <label className="flex flex-col gap-1.5 text-sm">
              ¿Por qué?
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Se equivocó el mesero, se cayó la copa..."
                className="rounded-sm border border-vino/25 px-3 py-3 outline-none focus:border-vino"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              Código del dueño
              <input
                inputMode="numeric"
                maxLength={4}
                value={codigoJefe}
                onChange={(e) =>
                  setCodigoJefe(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="····"
                className="rounded-sm border border-vino/25 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-vino"
              />
            </label>

            <p className="text-xs text-tinta-2">
              Nada se borra. Queda anotado qué se quitó, quién lo pidió y quién
              lo autorizó.
            </p>

            <button
              type="button"
              disabled={ocupado || codigoJefe.length !== 4 || !motivo.trim()}
              onClick={() =>
                correr(() =>
                  cancelarLinea(ticketId, quitando.linea_id, codigoJefe, motivo),
                )
              }
              className="rounded-sm bg-vino px-4 py-3.5 font-medium text-crema disabled:opacity-40"
            >
              {ocupado ? "Quitando..." : "Quitar"}
            </button>
          </div>
        </Hoja>
      )}

      {/* ─────────── SABORES DE HELADO ─────────── */}
      {pendiente?.tipo === "helado" && (
        <Hoja
          titulo={
            pendiente.cuantos === 2
              ? `Elige 2 sabores (${sabores.length} de 2)`
              : "Elige el sabor"
          }
          sub={`${pendiente.tamano} · ${pesos(pendiente.precio)}`}
          cerrar={() => {
            setPendiente(null);
            setSabores([]);
          }}
        >
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
            {sabores_helado.map((s) => {
              const veces = sabores.filter((x) => x === s.producto_id).length;
              return (
                <button
                  key={s.producto_id}
                  type="button"
                  disabled={ocupado}
                  onClick={() => {
                    const nuevo = [...sabores, s.producto_id];
                    if (nuevo.length < pendiente.cuantos) {
                      setSabores(nuevo);
                      return;
                    }
                    const pres = presentacionDe(nuevo[0], pendiente.tamano)!;
                    correr(() =>
                      agregarLinea(ticketId, pres, 1, null, nuevo),
                    );
                  }}
                  className={`rounded-sm border px-3 py-4 text-sm ${
                    veces > 0
                      ? "border-vino bg-rosa-claro text-vino"
                      : "border-vino/20 text-tinta"
                  }`}
                >
                  {s.producto}
                  {veces > 1 && ` ×${veces}`}
                </button>
              );
            })}
          </div>
        </Hoja>
      )}
    </div>
  );
}

function Tarjeta({
  titulo,
  abajo,
  onClick,
}: {
  titulo: string;
  abajo: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-20 flex-col justify-center gap-0.5 rounded-sm border border-vino/20 bg-white px-3 py-3 text-left transition-colors active:bg-rosa-claro/40"
    >
      <span className="text-sm font-medium capitalize">{titulo}</span>
      <span className="text-xs text-vino tabular-nums">{abajo}</span>
    </button>
  );
}

function Hoja({
  titulo,
  sub,
  cerrar,
  children,
}: {
  titulo: string;
  sub: string;
  cerrar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-tinta/50 p-0 sm:items-center sm:p-6">
      <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-lg bg-crema sm:rounded-lg">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-vino/15 bg-crema px-4 py-3">
          <div>
            <p className="font-medium">{titulo}</p>
            <p className="text-xs text-tinta-2">{sub}</p>
          </div>
          <button
            type="button"
            onClick={cerrar}
            className="rounded-sm border border-vino/25 px-3 py-1.5 text-sm text-vino"
          >
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Opcion({
  titulo,
  abajo,
  etiqueta,
  tono = "bien",
  disabled,
  onClick,
}: {
  titulo: string;
  abajo?: string;
  etiqueta?: string;
  tono?: "bien" | "aviso" | "marca";
  disabled?: boolean;
  onClick: () => void;
}) {
  const tonos = {
    bien: "bg-[#EAEFE4] text-[#556B4A]",
    aviso: "bg-[#F7EEDC] text-[#9C6A1E]",
    marca: "bg-rosa-claro/50 text-vino",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 border-b border-vino/10 px-4 py-3.5 text-left last:border-b-0 disabled:opacity-50"
    >
      <span>
        <span className="block text-sm font-medium">{titulo}</span>
        {abajo && <span className="block text-xs text-tinta-2">{abajo}</span>}
      </span>
      {etiqueta && (
        <span className={`rounded-full px-2.5 py-1 text-[10px] tracking-wider ${tonos[tono]}`}>
          {etiqueta}
        </span>
      )}
    </button>
  );
}
