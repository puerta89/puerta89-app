import Link from "next/link";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import { traerMapa } from "@/lib/datos";
import { salir } from "../entrar/acciones";
import Mapa from "./mapa";

export const metadata = { title: "Barra · Puerta 89" };

export default async function Barra() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");

  const zonas = await traerMapa(sesion.sucursalId);

  return (
    <main className="min-h-dvh bg-crema">
      {/* La franja de arriba dice DÓNDE estás, con el color de la sucursal. */}
      <header
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-crema"
        style={{ backgroundColor: sesion.sucursalColor }}
      >
        <div>
          <p className="text-[11px] tracking-widest uppercase opacity-75">
            Sucursal
          </p>
          <p className="text-lg font-medium">{sesion.sucursalNombre}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] tracking-widest uppercase opacity-75">
              {sesion.rol === "dueno" ? "Dueño" : sesion.rol}
            </p>
            <p className="text-lg font-medium">{sesion.nombre}</p>
          </div>
          {sesion.rol !== "mesero" && (
            <Link
              href="/corte"
              className="rounded-sm border border-crema/40 px-4 py-2 text-sm"
            >
              Corte
            </Link>
          )}
          {sesion.rol !== "mesero" && (
            <Link
              href="/inventario"
              className="rounded-sm border border-crema/40 px-4 py-2 text-sm"
            >
              Inventario
            </Link>
          )}
          {sesion.rol !== "mesero" && (
            <Link
              href="/panel"
              className="rounded-sm border border-crema/40 px-4 py-2 text-sm"
            >
              Panel
            </Link>
          )}
          <form action={salir}>
            <button
              type="submit"
              className="rounded-sm border border-crema/40 px-4 py-2 text-sm"
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
