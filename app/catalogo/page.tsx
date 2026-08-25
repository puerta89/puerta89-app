import Link from "next/link";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import { traerCategorias } from "@/lib/datos";
import Nuevo from "./nuevo";

export const metadata = { title: "Catálogo · Puerta 89" };

export default async function Pagina() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");
  if (sesion.rol === "mesero") redirect("/barra");

  const categorias = await traerCategorias();

  return (
    <main className="min-h-dvh bg-crema">
      <header
        className="flex items-center gap-4 px-5 py-3 text-crema"
        style={{ backgroundColor: sesion.sucursalColor }}
      >
        <Link
          href="/barra"
          className="rounded-sm border border-crema/40 px-3 py-2 text-sm"
        >
          ← Mapa
        </Link>
        <div>
          <p className="text-[11px] tracking-widest uppercase opacity-75">
            {sesion.sucursalNombre}
          </p>
          <p className="text-lg font-medium">Agregar al menú</p>
        </div>
      </header>
      <div className="mx-auto max-w-lg px-4 py-5">
        <Nuevo categorias={categorias} />
      </div>
    </main>
  );
}
