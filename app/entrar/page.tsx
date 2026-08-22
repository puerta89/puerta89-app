import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import Arco from "../arco";
import Teclado from "./teclado";

export const metadata = { title: "Entrar · Puerta 89" };

export default async function Entrar() {
  if (await leerSesion()) redirect("/barra");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-vino px-6 py-12">
      <div className="flex flex-col items-center gap-3">
        <Arco className="w-14 text-rosa-claro" />
        <h1 className="font-display text-5xl italic text-crema">
          Puerta<sup className="text-[0.4em] not-italic">89</sup>
        </h1>
        <p className="text-sm tracking-widest text-rosa uppercase">
          Tu código
        </p>
      </div>

      <Teclado />
    </main>
  );
}
