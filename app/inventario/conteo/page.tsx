import Link from "next/link";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import { traerInventario } from "@/lib/datos";
import Hoja from "./hoja";

export const metadata = { title: "Conteo físico · Puerta 89" };

export default async function Conteo() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");
  if (sesion.rol === "mesero") redirect("/barra");

  const items = await traerInventario(sesion.sucursalId);

  return (
    <main className="min-h-dvh bg-crema">
      <header
        className="flex items-center gap-4 px-5 py-3 text-crema"
        style={{ backgroundColor: sesion.sucursalColor }}
      >
        <Link
          href="/inventario"
          className="rounded-sm border border-crema/40 px-3 py-2 text-sm"
        >
          ← Inventario
        </Link>
        <div>
          <p className="text-[11px] tracking-widest uppercase opacity-75">
            {sesion.sucursalNombre}
          </p>
          <p className="text-lg font-medium">Conteo físico</p>
        </div>
      </header>
      <div className="mx-auto max-w-lg px-4 py-5">
        <Hoja items={items} />
      </div>
    </main>
  );
}
