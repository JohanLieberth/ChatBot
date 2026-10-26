/**
 * Puntos.gs - Points management (award, redeem, balance upsert)
 */

/**
 * Awards points to a client automatically upon service delivery.
 */
function otorgarPuntosPorServicio(servicioId) {
  return withLock(function() {
    var ss = getDbSpreadsheet();
    var servicios = getSheetObjects("Servicios");
    var srv = servicios.filter(function(s) { return String(s.ServicioID) === String(servicioId); })[0];
    if (!srv) return;

    var detalles = getSheetObjects("DetalleOrden");
    var det = detalles.filter(function(d) { return String(d.DetalleID) === String(srv.DetalleID); })[0];
    if (!det) return;

    var ordenes = getSheetObjects("OrdenServicio");
    var ord = ordenes.filter(function(o) { return String(o.OrdenID) === String(det.OrdenID); })[0];
    if (!ord) return;

    var telefono = ord.Telefono;
    if (!telefono) return;

    // Check if points already granted for this servicioId
    var movs = getSheetObjects("MovimientosPuntos");
    var yaOtorgado = movs.some(function(m) {
      return String(m.Concepto).indexOf(servicioId) !== -1 && String(m.Telefono) === String(telefono);
    });

    if (yaOtorgado) return;

    // Get points rule from TablaPuntos
    var tablaPuntos = getSheetObjects("TablaPuntos");
    var rule = tablaPuntos.filter(function(p) { return String(p.Accion).toLowerCase() === "servicio mayor"; })[0];
    var puntosNum = rule ? parseNumber(rule.Puntos) : 10;

    var movSheet = ss.getSheetByName("MovimientosPuntos");
    var movId = getNextId("MovimientosPuntos", "MOV");
    var nowStr = formatDate(new Date(), "yyyy-MM-dd HH:mm:ss");

    movSheet.appendRow([
      movId,
      telefono,
      nowStr,
      puntosNum,
      "Puntos por entrega de servicio " + servicioId
    ]);

    recalcularSaldoPuntos(telefono);
  });
}

/**
 * Registers manual points addition or redemption/canje.
 */
function registrarMovimientoPuntos(telefono, puntos, concepto) {
  checkRole(["Administrador", "Recepcion"]);

  return withLock(function() {
    var ss = getDbSpreadsheet();
    telefono = String(telefono || "").replace(/\D/g, "");
    var puntosNum = parseNumber(puntos);
    concepto = String(concepto || "").trim();

    if (!telefono || puntosNum === 0 || !concepto) {
      throw new Error("Teléfono, cantidad de puntos distinta de cero y concepto son obligatorios.");
    }

    var saldoActual = getSaldoPuntosCliente(telefono);
    if (puntosNum < 0 && (saldoActual + puntosNum) < 0) {
      throw new Error("Saldo insuficiente. Saldo actual: " + saldoActual + " puntos.");
    }

    var movSheet = ss.getSheetByName("MovimientosPuntos");
    var movId = getNextId("MovimientosPuntos", "MOV");
    var nowStr = formatDate(new Date(), "yyyy-MM-dd HH:mm:ss");

    movSheet.appendRow([
      movId,
      telefono,
      nowStr,
      puntosNum,
      concepto
    ]);

    var nuevoSaldo = recalcularSaldoPuntos(telefono);

    return {
      success: true,
      message: "Movimiento de puntos registrado.",
      nuevoSaldo: nuevoSaldo
    };
  });
}

/**
 * Gets materialized point balance for a client phone number.
 */
function getSaldoPuntosCliente(telefono) {
  telefono = String(telefono || "").replace(/\D/g, "");
  var saldos = getSheetObjects("SaldoPuntos");
  var row = saldos.filter(function(s) { return String(s.Telefono) === telefono; })[0];
  return row ? parseNumber(row.Saldo) : 0;
}

/**
 * Recalculates total balance and upserts in SaldoPuntos sheet.
 */
function recalcularSaldoPuntos(telefono) {
  telefono = String(telefono || "").replace(/\D/g, "");
  var movs = getSheetObjects("MovimientosPuntos").filter(function(m) { return String(m.Telefono) === telefono; });
  var totalSaldo = movs.reduce(function(sum, m) { return sum + parseNumber(m.Puntos); }, 0);

  var ss = getDbSpreadsheet();
  var saldoSheet = ss.getSheetByName("SaldoPuntos");
  var saldosData = saldoSheet.getDataRange().getValues();
  var found = false;

  for (var r = 1; r < saldosData.length; r++) {
    if (String(saldosData[r][0]) === telefono) {
      saldoSheet.getRange(r + 1, 2).setValue(totalSaldo);
      found = true;
      break;
    }
  }

  if (!found) {
    saldoSheet.appendRow([telefono, totalSaldo]);
  }

  return totalSaldo;
}
