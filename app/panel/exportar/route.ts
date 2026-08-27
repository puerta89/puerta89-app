import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { leerSesion } from "@/lib/sesion";
import {
  traerPanel,
  traerDesglose,
  traerBancosPanel,
  traerSucursalesPanel,
  traerMeses,
  traerMesesGrupo,
  traerGastos,
  traerVentasLineas,
  traerTicketsPeriodo,
  hoyEnMexico,
  type Desglose,
} from "@/lib/datos";

// Antes de que exista el negocio: sirve como "sin piso de fecha" para
// cuando no se elige ningún rango — mismo valor que usa /panel.
const SIN_PISO = "2000-01-01";

const PESOS = '"$"#,##0.00';

function hojaDesglose(wb: ExcelJS.Workbook, titulo: string, datos: Desglose[]) {
  if (datos.length === 0) return;
  const h = wb.addWorksheet(titulo);
  h.columns = [
    { header: titulo, key: "etiqueta", width: 30 },
    { header: "Venta", key: "venta", width: 16 },
    { header: "Utilidad", key: "utilidad", width: 16 },
    { header: "Unidades", key: "unidades", width: 12 },
  ];
  h.addRows(datos);
  h.getColumn("venta").numFmt = PESOS;
  h.getColumn("utilidad").numFmt = PESOS;
  h.getRow(1).font = { bold: true };
}

export async function GET(request: NextRequest) {
  const sesion = await leerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "Tu sesión venció. Vuelve a entrar." }, { status: 401 });
  }
  if (sesion.rol === "mesero") {
    return NextResponse.json({ error: "Esto solo lo puede ver el dueño o el gerente." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const hoy = hoyEnMexico();
  const desde = searchParams.get("desde") || SIN_PISO;
  const hasta = searchParams.get("hasta") || hoy;
  const esTodo = desde === SIN_PISO;

  const [resumen, ventasLineas, tickets, categorias, productos, meseros, horas, bancos, sucursales, meses, mesesGrupo, gastos] =
    await Promise.all([
      traerPanel(sesion.sucursalId, desde, hasta),
      // Solo tiene sentido con un piso de fecha real: "todo el histórico"
      // (desde 2000) generaría una fila por día-artículo de 1550+ tickets,
      // demasiado pesado y poco útil para pegar en un Excel.
      esTodo ? Promise.resolve([]) : traerVentasLineas(sesion.sucursalId, desde, hasta),
      esTodo ? Promise.resolve([]) : traerTicketsPeriodo(sesion.sucursalId, desde, hasta),
      traerDesglose(sesion.sucursalId, desde, hasta, "categoria"),
      traerDesglose(sesion.sucursalId, desde, hasta, "producto"),
      traerDesglose(sesion.sucursalId, desde, hasta, "mesero"),
      traerDesglose(sesion.sucursalId, desde, hasta, "hora"),
      traerBancosPanel(sesion.sucursalId, desde, hasta),
      traerSucursalesPanel(desde, hasta),
      traerMeses(sesion.sucursalId),
      traerMesesGrupo(sesion.sucursalId),
      traerGastos(sesion.sucursalId, desde, hasta),
    ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Puerta 89";
  wb.created = new Date();

  // ── Resumen ──────────────────────────────────────────────────────────
  const hResumen = wb.addWorksheet("Resumen");
  hResumen.columns = [
    { header: "Concepto", key: "c", width: 26 },
    { header: "Valor", key: "v", width: 20 },
  ];
  hResumen.addRows([
    { c: "Sucursal", v: sesion.sucursalNombre },
    { c: "Periodo", v: esTodo ? "Todo el histórico" : `${desde} al ${hasta}` },
    { c: "" , v: "" },
    { c: "Venta", v: resumen.ventas },
    { c: "Costo del producto", v: resumen.costo },
    { c: "Utilidad bruta", v: resumen.utilidad_bruta },
    { c: "Margen (%)", v: resumen.margen },
    { c: "Mermas", v: resumen.mermas },
    { c: "Gastos", v: resumen.gastos },
    { c: "Utilidad real", v: resumen.utilidad_real },
    { c: "" , v: "" },
    { c: "Tickets", v: resumen.tickets },
    { c: "Ticket promedio", v: resumen.ticket_promedio },
    { c: "Permanencia promedio (min)", v: resumen.permanencia_min },
    { c: "Efectivo", v: resumen.efectivo },
    { c: "Tarjeta", v: resumen.tarjeta },
    { c: "Propinas", v: resumen.propinas },
    { c: "Descuentos", v: resumen.descuentos },
    { c: "Cancelado", v: resumen.cancelado },
  ]);
  [4, 5, 6, 8, 9, 10, 15, 16, 17, 18, 19].forEach((fila) => {
    hResumen.getCell(`B${fila}`).numFmt = PESOS;
  });
  hResumen.getRow(1).font = { bold: true };

  // ── Ventas por artículo (mismo formato que "Informes → Ventas por
  //    artículo" de Loyverse, una fila por día + artículo) — para que se
  //    pueda pegar directo donde antes se pegaba el export de Loyverse. ──
  if (ventasLineas.length > 0) {
    const h = wb.addWorksheet("Ventas");
    h.columns = [
      { header: "Fecha", key: "fecha", width: 12 },
      { header: "Artículo", key: "articulo", width: 30 },
      { header: "Categoría", key: "categoria", width: 14 },
      { header: "Cantidad", key: "cantidad", width: 10 },
      { header: "Ventas brutas", key: "ventas_brutas", width: 14 },
      { header: "Ventas netas", key: "ventas_netas", width: 14 },
      { header: "Costo de los bienes", key: "costo", width: 16 },
      { header: "Beneficio bruto", key: "beneficio_bruto", width: 14 },
      { header: "Margen", key: "margen", width: 10 },
    ];
    h.addRows(ventasLineas);
    h.getColumn("ventas_brutas").numFmt = PESOS;
    h.getColumn("ventas_netas").numFmt = PESOS;
    h.getColumn("costo").numFmt = PESOS;
    h.getColumn("beneficio_bruto").numFmt = PESOS;
    h.getColumn("margen").numFmt = "0.0%";
    h.getRow(1).font = { bold: true };
  }

  // ── Tickets: una fila por cada cuenta cerrada (el recibo completo,
  //    no solo el resumen por artículo) — como el reporte de tickets
  //    individuales que antes se sacaba de Loyverse. ──────────────────
  if (tickets.length > 0) {
    const h = wb.addWorksheet("Tickets");
    h.columns = [
      { header: "Folio", key: "folio", width: 10 },
      { header: "Fecha", key: "fecha", width: 12 },
      { header: "Hora", key: "hora", width: 8 },
      { header: "Mesero", key: "mesero", width: 16 },
      { header: "Banco(s)", key: "bancos", width: 12 },
      { header: "Personas", key: "personas", width: 10 },
      { header: "Artículos", key: "articulos", width: 50 },
      { header: "Subtotal", key: "subtotal", width: 14 },
      { header: "Descuento", key: "descuento", width: 12 },
      { header: "Propina", key: "propina", width: 12 },
      { header: "Total", key: "total", width: 14 },
      { header: "Efectivo", key: "efectivo", width: 14 },
      { header: "Tarjeta", key: "tarjeta", width: 14 },
      { header: "Permanencia (min)", key: "permanencia_min", width: 16 },
    ];
    h.addRows(tickets);
    ["subtotal", "descuento", "propina", "total", "efectivo", "tarjeta"].forEach((col) => {
      h.getColumn(col).numFmt = PESOS;
    });
    h.getColumn("articulos").alignment = { wrapText: true, vertical: "top" };
    h.getRow(1).font = { bold: true };
  }

  // ── Desgloses ────────────────────────────────────────────────────────
  hojaDesglose(wb, "Por categoría", categorias);
  hojaDesglose(wb, "Por producto", productos);
  hojaDesglose(wb, "Por mesero", meseros);
  hojaDesglose(
    wb,
    "Por hora",
    [...horas].sort((a, b) => a.etiqueta.localeCompare(b.etiqueta)),
  );

  // ── Bancos ───────────────────────────────────────────────────────────
  if (bancos.length > 0) {
    const h = wb.addWorksheet("Bancos");
    h.columns = [
      { header: "Banco", key: "banco", width: 10 },
      { header: "Zona", key: "zona", width: 18 },
      { header: "Cuentas", key: "cuentas", width: 10 },
      { header: "Venta", key: "venta", width: 16 },
      { header: "Permanencia (min)", key: "permanencia_min", width: 18 },
    ];
    h.addRows(bancos);
    h.getColumn("venta").numFmt = PESOS;
    h.getRow(1).font = { bold: true };
  }

  // ── Gastos del periodo ───────────────────────────────────────────────
  if (gastos.length > 0) {
    const h = wb.addWorksheet("Gastos");
    h.columns = [
      { header: "Fecha", key: "fecha", width: 14 },
      { header: "Categoría", key: "categoria", width: 18 },
      { header: "Concepto", key: "concepto", width: 26 },
      { header: "Monto", key: "monto", width: 14 },
      { header: "Recurrente", key: "recurrente", width: 12 },
    ];
    h.addRows(
      gastos.map((g) => ({ ...g, recurrente: g.recurrente ? "Sí" : "No" })),
    );
    h.getColumn("monto").numFmt = PESOS;
    h.getRow(1).font = { bold: true };
  }

  // ── Meses (estacionalidad, siempre todo el histórico) ───────────────
  if (meses.length > 0) {
    const h = wb.addWorksheet("Meses");
    h.columns = [
      { header: "Mes", key: "mes", width: 12 },
      { header: "Ventas", key: "ventas", width: 16 },
      { header: "Utilidad", key: "utilidad", width: 16 },
      { header: "Tickets", key: "tickets", width: 10 },
      { header: "Ticket promedio", key: "ticket_promedio", width: 16 },
    ];
    h.addRows(meses);
    h.getColumn("ventas").numFmt = PESOS;
    h.getColumn("utilidad").numFmt = PESOS;
    h.getColumn("ticket_promedio").numFmt = PESOS;
    h.getRow(1).font = { bold: true };
  }

  // ── Estacionalidad por grupo de vino/helado ─────────────────────────
  if (mesesGrupo.length > 0) {
    const h = wb.addWorksheet("Estacionalidad");
    const grupos = [...new Set(mesesGrupo.map((m) => m.grupo))];
    const mesesUnicos = [...new Set(mesesGrupo.map((m) => m.mes))].sort();
    const porCelda = new Map(mesesGrupo.map((m) => [`${m.mes}|${m.grupo}`, m.ventas]));
    h.columns = [
      { header: "Mes", key: "mes", width: 12 },
      ...grupos.map((g) => ({ header: g, key: g, width: 14 })),
    ];
    mesesUnicos.forEach((mes) => {
      const fila: Record<string, unknown> = { mes };
      grupos.forEach((g) => {
        fila[g] = porCelda.get(`${mes}|${g}`) ?? 0;
      });
      h.addRow(fila);
    });
    grupos.forEach((g) => {
      h.getColumn(g).numFmt = PESOS;
    });
    h.getRow(1).font = { bold: true };
  }

  // ── Las dos sucursales juntas (solo si CDMX ya está activa) ─────────
  if (sucursales.length > 1) {
    const h = wb.addWorksheet("Sucursales");
    h.columns = [
      { header: "Sucursal", key: "sucursal", width: 14 },
      { header: "Ventas", key: "ventas", width: 16 },
      { header: "Utilidad", key: "utilidad", width: 16 },
      { header: "Tickets", key: "tickets", width: 10 },
      { header: "Ticket promedio", key: "ticket_promedio", width: 16 },
    ];
    h.addRows(sucursales);
    h.getColumn("ventas").numFmt = PESOS;
    h.getColumn("utilidad").numFmt = PESOS;
    h.getColumn("ticket_promedio").numFmt = PESOS;
    h.getRow(1).font = { bold: true };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const rangoArchivo = esTodo ? "todo" : `${desde}_${hasta}`;
  const nombreArchivo = `puerta89-${sesion.sucursalNombre.toLowerCase()}-${rangoArchivo}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
