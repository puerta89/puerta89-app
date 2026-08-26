import Link from "next/link";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import { traerInventario } from "@/lib/datos";
import Lista from "./lista";

export const metadata = { title: "Inventario · Puerta 89" };

export default async function Inventario() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");
  if (sesion.rol === "mesero") redirect("/barra");

  const items = await traerInventario(sesion.sucursalId);

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
              Inventario · {sesion.sucursalNombre}
            </p>
            <p className="text-lg font-medium">{items.length} cosas que se cuentan</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/inventario/compra"
            className="rounded-sm border border-current/40 px-4 py-2 text-sm"
          >
            Registrar compra
          </Link>
          <Link
            href="/inventario/conteo"
            className="rounded-sm border border-current/40 px-4 py-2 text-sm"
          >
            Conteo físico
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-5">
        <Lista items={items} />
      </div>
    </main>
  );
}
