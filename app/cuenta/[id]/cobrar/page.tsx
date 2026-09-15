import Link from "next/link";
import { obtenerCobro } from "./datos-cobro";
import { etiquetaBancos } from "../etiqueta-bancos";
import Cobro from "./cobro";

export const metadata = { title: "Cobrar · Puerta 89" };

export default async function Cobrar({
  params,
}: PageProps<"/cuenta/[id]/cobrar">) {
  const { id } = await params;
  const { sesion, bancos, pagos, total, personas } = await obtenerCobro(id);

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
              Cobrando · {etiquetaBancos(bancos).titulo}
            </p>
            <p className="text-lg font-medium">{etiquetaBancos(bancos).valor}</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-6">
        <Cobro ticketId={id} total={total} pagos={pagos} personas={personas} />
      </div>
    </main>
  );
}
