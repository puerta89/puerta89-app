import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import { salir } from "../entrar/acciones";

export const metadata = { title: "Barra · Puerta 89" };

export default async function Barra() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");

  return (
    <main className="min-h-dvh bg-crema">
      {/* La franja de arriba dice DÓNDE estás. Color propio de cada sucursal. */}
      <header
        className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-crema"
        style={{ backgroundColor: sesion.sucursalColor }}
      >
        <div>
          <p className="text-xs tracking-widest uppercase opacity-75">
            Sucursal
          </p>
          <p className="text-xl font-medium">{sesion.sucursalNombre}</p>
        </div>
        <div className="text-right">
          <p className="text-xs tracking-widest uppercase opacity-75">
            {sesion.rol === "dueno" ? "Dueño" : sesion.rol}
          </p>
          <p className="text-xl font-medium">{sesion.nombre}</p>
        </div>
      </header>

      <div className="mx-auto flex max-w-xl flex-col gap-5 px-6 py-16 text-center">
        <h2 className="font-display text-4xl text-vino">Estás dentro</h2>
        <p className="text-tinta-2">
          Aquí va a ir el mapa de la barra con los 15 bancos. Todavía no está
          construido — esta pantalla existe para comprobar que el código de
          entrada funciona y que reconoce quién eres y en qué sucursal estás.
        </p>
        <form action={salir} className="mt-4">
          <button
            type="submit"
            className="rounded-sm border border-vino/30 px-6 py-3 text-vino transition-colors hover:bg-vino/5"
          >
            Salir
          </button>
        </form>
      </div>
    </main>
  );
}
