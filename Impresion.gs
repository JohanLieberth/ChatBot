/**
 * Impresion.gs - Endpoints for printing tickets, labels, and auditing print logs
 */

/**
 * Registers an audit log entry for label/ticket prints.
 */
function registrarImpresion(ordenId, detalleId, tipo) {
  var user = checkRole(["Administrador", "Recepcion", "Tecnico"]);

  return withLock(function() {
    var ss = getDbSpreadsheet();
    var etiqSheet = ss.getSheetByName("EtiquetasImpresas");
    var etiqId = getNextId("EtiquetasImpresas", "ETQ");
    var nowStr = formatDate(new Date(), "yyyy-MM-dd HH:mm:ss");

    etiqSheet.appendRow([
      etiqId,
      ordenId || "",
      detalleId || "",
      tipo || "Comprobante",
      nowStr,
      user.AdminID || "TECNICO"
    ]);

    return { success: true };
  });
}
