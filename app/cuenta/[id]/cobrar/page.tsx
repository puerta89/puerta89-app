import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { leerSesion } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/server";
import { traerLineas, traerPagos } from "@/lib/datos";
import Cobro from "./cobro";

export const metadata = { title: "Cobrar · Puerta 89" };

export default async function Cobrar({
  params,
}: PageProps<"/cuenta/[id]/cobrar">) {
  const { id } = await params;
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");

  const supabase = supabaseServidor();
  const { data: mapa } = await supabase.rpc("mapa_barra", {
    p_sucursal: sesion.sucursalId,
  });
  const suyos = (mapa ?? []).filter(
    (r: { ticket_id: string | null }) => r.ticket_id === id,
  );
  if (suyos.length === 0) notFound();

  const bancos = suyos
    .map((r: { numero: number }) => r.numero)
    .sort((a: number, b: number) => a - b);

  const [lineas, pagos] = await Promise.all([traerLineas(id), traerPagos(id)]);
  const total = lineas.reduce((s, l) => s + l.importe, 0);
  const personas: number = suyos[0].personas ?? 1;

  return (
    <main className="min-h-dvh bg-crema">
      <header
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
        style={{ backgroundColor: sesion.sucursalColor, color: sesion.sucursalColorTexto }}
      >
        <div className="flex items-center gap-4">
          <Link
            href={`/cuenta/${id}`}
            className="rounded-sm border border-current/40 px-3 py-2 text-sm"
          >
            ← Cuenta
          </Link>
          <div>
            <p className="text-[11px] tracking-widest uppercase opacity-75">
              Cobrando {bancos.length === 1 ? "el banco" : "los bancos"}
            </p>
            <p className="text-lg font-medium">{bancos.join(" · ")}</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-6">
        <Cobro ticketId={id} total={total} pagos={pagos} personas={personas} />
      </div>
    </main>
  );
}
