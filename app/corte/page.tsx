import Link from "next/link";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import {
  traerResumenDia,
  traerEmpleados,
  traerMeserosDelDia,
  traerMovimientosCaja,
  traerPropinasCorte,
  hoyEnMexico,
} from "@/lib/datos";
import Caja from "./caja";

export const metadata = { title: "Corte del día · Puerta 89" };

export default async function Corte() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");
  // El mesero no tiene nada que hacer aquí.
  if (sesion.rol === "mesero") redirect("/barra");

  const fecha = hoyEnMexico();
  const [resumen, equipo, delDia] = await Promise.all([
    traerResumenDia(sesion.sucursalId, fecha),
    traerEmpleados(sesion.sucursalId),
    traerMeserosDelDia(sesion.sucursalId, fecha),
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
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-crema"
        style={{ backgroundColor: sesion.sucursalColor }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/barra"
            className="rounded-sm border border-crema/40 px-3 py-2 text-sm"
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
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6">
        <Caja
          fecha={fecha}
          resumen={resumen}
          movimientos={movimientos}
          equipo={equipo}
          sugeridos={delDia.map((m) => m.empleado_id)}
          propinas={propinas}
        />
      </div>
    </main>
  );
}
