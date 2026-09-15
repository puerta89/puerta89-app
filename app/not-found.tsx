import Arco from "@/app/arco";

/** Sin este archivo, una URL que no existe (o un enlace viejo) muestra la
 * pantalla de 404 genérica de Next.js — igual de en blanco que la de
 * error.tsx. Esta versión explica qué pasó en español y da un camino de
 * regreso. */
export default function NoEncontrado() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-vino px-6 py-12 text-center">
      <Arco className="w-12 text-rosa-claro" />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl italic text-crema">
          No encontramos esto
        </h1>
        <p className="max-w-sm text-sm text-rosa">
          El enlace puede estar viejo, o lo que buscabas ya se cerró o se
          movió.
        </p>
      </div>
      <a
        href="/barra"
        className="rounded-sm bg-rosa-claro px-5 py-2.5 text-sm font-medium text-vino"
      >
        Ir a la barra
      </a>
    </main>
  );
}
