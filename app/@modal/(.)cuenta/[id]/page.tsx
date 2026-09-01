import { obtenerCuenta } from "@/app/cuenta/[id]/datos-cuenta";
import Comanda from "@/app/cuenta/[id]/comanda";
import PanelCuenta from "@/app/cuenta/[id]/panel-cuenta";

export const metadata = { title: "Cuenta · Puerta 89" };

/** Intercepta la navegación a /cuenta/[id] cuando viene de dentro de la
 * app (o sea, del mapa de la barra) y la muestra como un panel lateral en
 * vez de mandar a una página completa. Si en cambio se entra por URL
 * directa o se recarga, Next.js ignora este archivo y usa la página
 * completa de verdad (app/cuenta/[id]/page.tsx). */
export default async function CuentaEnPanel({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const {
    sesion,
    bancos,
    cabecera,
    catalogo,
    botellas,
    lineas,
    total,
    bancosLibres,
    bancosPropios,
  } = await obtenerCuenta(id);

  return (
    <PanelCuenta
      bancos={bancos}
      personas={cabecera.personas}
      mesero={cabecera.mesero}
      abiertoEn={cabecera.abierto_en}
      color={sesion.sucursalColor}
      colorTexto={sesion.sucursalColorTexto}
    >
      <Comanda
        ticketId={id}
        catalogo={catalogo}
        botellas={botellas}
        lineas={lineas}
        total={total}
        estado={cabecera.ticket_estado}
        rol={sesion.rol}
        bancosLibres={bancosLibres}
        bancosPropios={bancosPropios}
      />
    </PanelCuenta>
  );
}
