import Link from "next/link";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import { traerGastos, rango, hoyEnMexico } from "@/lib/datos";
import Formulario from "./formulario";

export const metadata = { title: "Gastos · Puerta 89" };

export default async function Gastos() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");
  if (sesion.rol === "mesero") redirect("/barra");

  const { desde, hasta } = rango(60);
  const gastos = await traerGastos(sesion.sucursalId, desde, hasta);

  return (
    <main className="min-h-dvh bg-crema">
      <header
        className="flex items-center gap-4 px-5 py-3"
        style={{ backgroundColor: sesion.sucursalColor, color: sesion.sucursalColorTexto }}
      >
        <Link
          href="/panel"
          className="rounded-sm border border-current/40 px-3 py-2 text-sm"
        >
          ← Panel
        </Link>
        <div>
          <p className="text-[11px] tracking-widest uppercase opacity-75">
            {sesion.sucursalNombre}
          </p>
          <p className="text-lg font-medium">Gastos</p>
        </div>
      </header>
      <div className="mx-auto max-w-lg px-4 py-5">
        <Formulario gastos={gastos} hoy={hoyEnMexico()} />
      </div>
    </main>
  );
}
