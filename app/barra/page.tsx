import Link from "next/link";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/server";
import { traerMapa, traerSucursalesDisponibles } from "@/lib/datos";
import { salir } from "../entrar/acciones";
import Mapa from "./mapa";
import SelectorSucursal from "./selector-sucursal";

export const metadata = { title: "Barra · Puerta 89" };

export default async function Barra() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");

  // El mesero no ve el mapa. Si ya traía una orden sin guardar la
  // retoma; si no, esta pantalla es nada más "Tickets abiertos" y
  // "Salir" — tomar una orden nueva se hace desde ahí (un botón que sí
  // hay que picar), no algo que pase solo al aterrizar aquí: eso fue
  // justo lo que causó el bug de cuentas vacías creándose con el
  // prefetch de Next.js.
  if (sesion.rol === "mesero") {
    if (sesion.ordenActualId) {
      const supabase = supabaseServidor();
      const { data } = await supabase.rpc("ticket_cabecera", {
        p_sucursal: sesion.sucursalId,
        p_ticket: sesion.ordenActualId,
      });
      const cab = data?.[0];
      if (cab && (cab.bancos ?? []).length === 0) {
        redirect(`/cuenta/${sesion.ordenActualId}`);
      }
    }

    return (
      <main className="flex min-h-dvh flex-col bg-crema">
        <header
          className="flex items-center justify-between px-5 py-3"
          style={{ backgroundColor: sesion.sucursalColor, color: sesion.sucursalColorTexto }}
        >
          <div>
            <p className="text-[11px] tracking-widest uppercase opacity-75">
              {sesion.rol}
            </p>
            <p className="text-lg font-medium">{sesion.nombre}</p>
          </div>
          <form action={salir}>
            <button
              type="submit"
              className="rounded-sm border border-current/40 px-4 py-2 text-sm"
            >
              Salir
            </button>
          </form>
        </header>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4">
          <Link
            href="/tickets-abiertos"
            className="rounded-sm bg-vino px-5 py-6 text-center text-lg font-medium text-crema"
          >
            Tickets abiertos
          </Link>
        </div>
      </main>
    );
  }

  const [zonas, sucursales] = await Promise.all([
    traerMapa(sesion.sucursalId),
    sesion.puedeCambiarSucursal
      ? traerSucursalesDisponibles(sesion.empleadoId)
      : Promise.resolve([]),
  ]);

  return (
    <main className="min-h-dvh bg-crema">
      {/* La franja de arriba dice DÓNDE estás, con el color de la sucursal. */}
      <header
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
        style={{ backgroundColor: sesion.sucursalColor, color: sesion.sucursalColorTexto }}
      >
        {sesion.puedeCambiarSucursal ? (
          <SelectorSucursal sucursales={sucursales} actual={sesion.sucursalId} />
        ) : (
          <div>
            <p className="text-[11px] tracking-widest uppercase opacity-75">
              Sucursal
            </p>
            <p className="text-lg font-medium">{sesion.sucursalNombre}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="text-right">
            <p className="text-[11px] tracking-widest uppercase opacity-75">
              {sesion.rol === "dueno" ? "Dueño" : sesion.rol}
            </p>
            <p className="text-lg font-medium">{sesion.nombre}</p>
          </div>
          {/* Solo dueño/gerente llegan hasta aquí — al mesero ya se le
              mandó a tomar el pedido, más arriba. */}
          <Link
            href="/corte"
            className="rounded-sm border border-current/40 px-4 py-2 text-sm"
          >
            Corte
          </Link>
          <Link
            href="/tickets"
            className="rounded-sm border border-current/40 px-4 py-2 text-sm"
          >
            Tickets
          </Link>
          <Link
            href="/inventario"
            className="rounded-sm border border-current/40 px-4 py-2 text-sm"
          >
            Inventario
          </Link>
          <Link
            href="/panel"
            className="rounded-sm border border-current/40 px-4 py-2 text-sm"
          >
            Panel
          </Link>
          <Link
            href="/catalogo"
            className="rounded-sm border border-current/40 px-4 py-2 text-sm"
          >
            Menú
          </Link>
          {sesion.rol === "dueno" && (
            <Link
              href="/equipo"
              className="rounded-sm border border-current/40 px-4 py-2 text-sm"
            >
              Equipo
            </Link>
          )}
          <form action={salir}>
            <button
              type="submit"
              className="rounded-sm border border-current/40 px-4 py-2 text-sm"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-5">
        <Mapa zonas={zonas} empleadoId={sesion.empleadoId} />
      </div>
    </main>
  );
}
