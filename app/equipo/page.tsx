import Link from "next/link";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import { traerEquipo } from "@/lib/datos";
import Equipo from "./lista";

export const metadata = { title: "Equipo · Puerta 89" };

export default async function Pagina() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");
  if (sesion.rol !== "dueno") redirect("/barra");

  const equipo = await traerEquipo(sesion.sucursalId);

  return (
    <main className="min-h-dvh bg-crema">
      <header
        className="flex items-center gap-4 px-5 py-3"
        style={{ backgroundColor: sesion.sucursalColor, color: sesion.sucursalColorTexto }}
      >
        <Link
          href="/barra"
          className="rounded-sm border border-current/40 px-3 py-2 text-sm"
        >
          ← Mapa
        </Link>
        <div>
          <p className="text-[11px] tracking-widest uppercase opacity-75">
            {sesion.sucursalNombre}
          </p>
          <p className="text-lg font-medium">Quién puede entrar</p>
        </div>
      </header>
      <div className="mx-auto max-w-lg px-4 py-5">
        <Equipo equipo={equipo} />
      </div>
    </main>
  );
}
