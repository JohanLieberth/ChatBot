/**
 * Pagos.gs - Payments registration and balance calculations
 */

/**
 * Registers a payment against an order.
 */
function registrarPago(ordenId, importe, concepto) {
  checkRole(["Administrador", "Recepcion"]);

  return withLock(function() {
    var ss = getDbSpreadsheet();
    ordenId = String(ordenId || "").trim();
    var importeNum = parseNumber(importe);
    concepto = String(concepto || "").trim();

    if (!ordenId || importeNum <= 0) {
      throw new Error("El ID de orden y un importe mayor a cero son obligatorios.");
    }

    var ordenes = getSheetObjects("OrdenServicio");
    var ord = ordenes.filter(function(o) { return String(o.OrdenID) === ordenId; })[0];

    if (!ord) {
      throw new Error("La orden " + ordenId + " no existe.");
    }

    var pagosSheet = ss.getSheetByName("Pagos");
    var pagoId = getNextId("Pagos", "PAG");
    var nowStr = formatDate(new Date(), "yyyy-MM-dd HH:mm:ss");

    pagosSheet.appendRow([
      pagoId,
      ordenId,
      nowStr,
      importeNum,
      concepto || "Abono a servicio"
    ]);

    recalculateOrderTotals(ordenId);

    return {
      success: true,
      message: "Pago de " + formatCurrency(importeNum) + " registrado para la orden " + ordenId
    };
  });
}
