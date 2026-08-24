import Link from "next/link";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import { traerInventario, traerProveedores, hoyEnMexico } from "@/lib/datos";
import Formulario from "./formulario";

export const metadata = { title: "Registrar compra · Puerta 89" };

export default async function Compra() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");
  if (sesion.rol === "mesero") redirect("/barra");

  const [items, proveedores] = await Promise.all([
    traerInventario(sesion.sucursalId),
    traerProveedores(),
  ]);

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
          <p className="text-lg font-medium">Registrar una compra</p>
        </div>
      </header>
      <div className="mx-auto max-w-lg px-4 py-5">
        <Formulario items={items} proveedores={proveedores} hoy={hoyEnMexico()} />
      </div>
    </main>
  );
}
