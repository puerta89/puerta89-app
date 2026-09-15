/** Cómo mostrar el banco/mesa en el encabezado — una cuenta puede no
 * tener ninguno todavía (para llevar, o comanda tomada antes de sentarse
 * a algún lado). Sin imports de servidor a propósito, para poder usarse
 * tanto desde páginas de servidor como desde componentes de cliente. */
export function etiquetaBancos(bancos: number[]) {
  if (bancos.length === 0) return { titulo: "Sin mesa", valor: "Para llevar" };
  return {
    titulo: bancos.length === 1 ? "Banco" : "Bancos",
    valor: bancos.join(" · "),
  };
}
