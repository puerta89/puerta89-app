import Link from "next/link";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import {
  traerResumenDia,
  traerEmpleados,
  traerMeserosDelDia,
  traerMovimientosCaja,
  traerPropinasCorte,
  traerCortesAbiertosAntes,
  traerTicketsPeriodo,
  hoyEnMexico,
} from "@/lib/datos";
import Caja from "./caja";
import Recibos from "./recibos";

export const metadata = { title: "Corte del día · Puerta 89" };

function sumarDias(fecha: string, dias: number) {
  const d = new Date(fecha + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export default async function Corte({
  searchParams,
}: PageProps<"/corte">) {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");
  // El mesero no tiene nada que hacer aquí.
  if (sesion.rol === "mesero") redirect("/barra");

  const hoy = hoyEnMexico();
  const q = await searchParams;
  const pedida = typeof q?.fecha === "string" ? q.fecha : "";
  // Nada de fechas inventadas ni de adelantarse al día de hoy.
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(pedida) && pedida <= hoy ? pedida : hoy;
  const esHoy = fecha === hoy;

  const [resumen, equipo, delDia, recibos, pendientes] = await Promise.all([
    traerResumenDia(sesion.sucursalId, fecha),
    traerEmpleados(sesion.sucursalId),
    traerMeserosDelDia(sesion.sucursalId, fecha),
    traerTicketsPeriodo(sesion.sucursalId, fecha, fecha),
    // El aviso solo se muestra parado en hoy (más abajo), pero pedirlo
    // siempre es más simple que condicionar la consulta misma.
    traerCortesAbiertosAntes(sesion.sucursalId, hoy),
  ]);

  const [movimientos, propinas] = resumen
    ? await Promise.all([
        traerMovimientosCaja(resumen.corte_id),
        resumen.estado === "cerrado"
          ? traerPropinasCorte(resumen.corte_id)
          : Promise.resolve([]),
      ])
    : [[], []];

  return (
    <main className="min-h-dvh bg-crema">
      <header
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
        style={{ backgroundColor: sesion.sucursalColor, color: sesion.sucursalColorTexto }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/barra"
            className="rounded-sm border border-current/40 px-3 py-2 text-sm"
          >
            ← Mapa
          </Link>
          <div>
            <p className="text-[11px] tracking-widest uppercase opacity-75">
              Corte del día · {sesion.sucursalNombre}
            </p>
            <p className="text-lg font-medium">
              {new Date(fecha + "T12:00:00").toLocaleDateString("es-MX", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {!esHoy && " · viendo un día anterior"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/corte?fecha=${sumarDias(fecha, -1)}`}
            className="rounded-sm border border-current/40 px-3 py-2 text-sm"
            aria-label="Día anterior"
          >
            ← Día
          </Link>
          {!esHoy && (
            <Link
              href="/corte"
              className="rounded-sm border border-current/40 px-3 py-2 text-sm"
            >
              Hoy
            </Link>
          )}
          {!esHoy && (
            <Link
              href={`/corte?fecha=${sumarDias(fecha, 1)}`}
              className="rounded-sm border border-current/40 px-3 py-2 text-sm"
              aria-label="Día siguiente"
            >
              Día →
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
        {esHoy && pendientes.length > 0 && (
          <div className="flex flex-col gap-2 rounded-sm border-2 border-[#9C6A1E] bg-[#9C6A1E]/10 px-5 py-4 text-sm">
            <p className="font-medium text-[#9C6A1E]">
              {pendientes.length === 1
                ? "Hay un día que se quedó sin cerrar."
                : `Hay ${pendientes.length} días que se quedaron sin cerrar.`}
            </p>
            <p className="text-tinta-2">
              Nadie contó la caja ni repartió la propina de esos días — no se
              cierran solos. Hay que entrar y cerrarlos a mano.
            </p>
            <div className="flex flex-wrap gap-2">
              {pendientes.map((f) => (
                <Link
                  key={f}
                  href={`/corte?fecha=${f}`}
                  className="rounded-sm border border-[#9C6A1E] px-3 py-1.5 font-medium text-[#9C6A1E]"
                >
                  Cerrar el {new Date(f + "T12:00:00").toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                  })}
                </Link>
              ))}
            </div>
          </div>
        )}

        <Caja
          fecha={fecha}
          resumen={resumen}
          movimientos={movimientos}
          equipo={equipo}
          sugeridos={delDia.map((m) => m.empleado_id)}
          propinas={propinas}
        />

        <Recibos recibos={recibos} />
      </div>
    </main>
  );
}
