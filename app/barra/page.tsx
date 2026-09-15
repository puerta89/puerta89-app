import Link from "next/link";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/server";
import { traerMapa, traerSucursalesDisponibles } from "@/lib/datos";
import { salir } from "../entrar/acciones";
import Mapa from "./mapa";
import SelectorSucursal from "./selector-sucursal";
import EmpezarOrden from "./empezar-orden";
import RetomarOrden from "./retomar-orden";

export const metadata = { title: "Barra · Puerta 89" };

export default async function Barra() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");

  // El mesero no ve el mapa: cae directo a la comanda (categorías
  // listas para empezar, como Loyverse). Si ya traía una orden sin
  // guardar la retoma; si no, se le crea una sola. Ninguno de los dos
  // casos usa redirect() de servidor — siempre una navegación DURA desde
  // un componente de cliente (EmpezarOrden / RetomarOrden), porque
  // /barra se puede alcanzar con una navegación de cliente (el "← Atrás"
  // de /tickets-abiertos, o un prefetch de Next.js), y esas quedan
  // atrapadas por la ruta interceptada de app/@modal en vez de llegar a
  // la página completa.
  if (sesion.rol === "mesero") {
    if (sesion.ordenActualId) {
      const supabase = supabaseServidor();
      const { data } = await supabase.rpc("ticket_cabecera", {
        p_sucursal: sesion.sucursalId,
        p_ticket: sesion.ordenActualId,
      });
      const cab = data?.[0];
      if (cab && (cab.bancos ?? []).length === 0) {
        return <RetomarOrden ticketId={sesion.ordenActualId} />;
      }
    }
    return <EmpezarOrden />;
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
