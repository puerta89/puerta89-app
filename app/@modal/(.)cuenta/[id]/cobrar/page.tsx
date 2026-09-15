import { obtenerCobro } from "@/app/cuenta/[id]/cobrar/datos-cobro";
import { etiquetaBancos } from "@/app/cuenta/[id]/etiqueta-bancos";
import Cobro from "@/app/cuenta/[id]/cobrar/cobro";
import VentanaCobro from "@/app/cuenta/[id]/cobrar/ventana-cobro";

export const metadata = { title: "Cobrar · Puerta 89" };

/** Intercepta /cuenta/[id]/cobrar cuando se llega picándole a "Cobrar"
 * desde dentro de la app y lo muestra como ventana encima, en vez de una
 * página completa. Una URL directa o un refresh sigue mostrando la
 * página completa de verdad (app/cuenta/[id]/cobrar/page.tsx). */
export default async function CobrarEnVentana({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { bancos, pagos, total, personas } = await obtenerCobro(id);

  return (
    <VentanaCobro titulo={`Cobrar · ${etiquetaBancos(bancos).valor}`}>
      <Cobro ticketId={id} total={total} pagos={pagos} personas={personas} />
    </VentanaCobro>
  );
}
