/**
 * Servicios.gs - Services, multi-technician assignments, status audit log
 */

/**
 * Updates service details, diagnosis, costs, and status.
 */
function actualizarDetalleServicio(payload) {
  var user = checkRole(["Administrador", "Recepcion", "Tecnico"]);

  return withLock(function() {
    var ss = getDbSpreadsheet();
    var detalleId = payload.DetalleId || payload.DetalleID;
    var servicioId = payload.ServicioId || payload.ServicioID;

    var detallesSheet = ss.getSheetByName("DetalleOrden");
    var serviciosSheet = ss.getSheetByName("Servicios");
    var historialSheet = ss.getSheetByName("HistorialServicio");

    var detalles = getSheetObjects("DetalleOrden");
    var servicios = getSheetObjects("Servicios");

    var det = detalles.filter(function(d) { return String(d.DetalleID) === String(detalleId); })[0];
    if (!det && servicioId) {
      var srvTemp = servicios.filter(function(s) { return String(s.ServicioID) === String(servicioId); })[0];
      if (srvTemp) {
        detalleId = srvTemp.DetalleID;
        det = detalles.filter(function(d) { return String(d.DetalleID) === String(detalleId); })[0];
      }
    }

    if (!det) {
      throw new Error("No se encontró el detalle de orden especificado.");
    }

    var srv = servicios.filter(function(s) { return String(s.DetalleID) === String(detalleId); })[0];
    if (!srv) {
      throw new Error("No se encontró el registro de servicio asociado.");
    }

    var estatusAnterior = det.Estatus;
    var estatusNuevo = payload.Estatus || estatusAnterior;

    // Technicians can only edit CostoDiagnostico and FallaReportada if status is Diagnostico
    if (user.Rol === "Tecnico") {
      if (payload.CostoDiagnostico !== undefined && estatusAnterior === "Diagnostico") {
        updateCellInSheet(serviciosSheet, "ServicioID", srv.ServicioID, "CostoDiagnostico", parseNumber(payload.CostoDiagnostico));
      }
      if (payload.FallaReportada !== undefined && estatusAnterior === "Diagnostico") {
        updateCellInSheet(serviciosSheet, "ServicioID", srv.ServicioID, "FallaReportada", payload.FallaReportada);
      }
    } else {
      // Admins can edit CostoFinal, CostoDiagnostico, FallaReportada, Diagnostico, Solucion, Garantia
      if (payload.CostoFinal !== undefined) updateCellInSheet(serviciosSheet, "ServicioID", srv.ServicioID, "CostoFinal", parseNumber(payload.CostoFinal));
      if (payload.CostoDiagnostico !== undefined) updateCellInSheet(serviciosSheet, "ServicioID", srv.ServicioID, "CostoDiagnostico", parseNumber(payload.CostoDiagnostico));
      if (payload.FallaReportada !== undefined) updateCellInSheet(serviciosSheet, "ServicioID", srv.ServicioID, "FallaReportada", payload.FallaReportada);
      if (payload.Diagnostico !== undefined) updateCellInSheet(serviciosSheet, "ServicioID", srv.ServicioID, "Diagnostico", payload.Diagnostico);
      if (payload.Solucion !== undefined) updateCellInSheet(serviciosSheet, "ServicioID", srv.ServicioID, "Solucion", payload.Solucion);
      if (payload.GarantiaDias !== undefined) updateCellInSheet(serviciosSheet, "ServicioID", srv.ServicioID, "GarantiaDias", payload.GarantiaDias);
    }

    // Update status if changed
    if (estatusNuevo !== estatusAnterior) {
      updateCellInSheet(detallesSheet, "DetalleID", det.DetalleID, "Estatus", estatusNuevo);

      // Audit log in HistorialServicio
      var nowStr = formatDate(new Date(), "yyyy-MM-dd HH:mm:ss");
      var histId = getNextId("HistorialServicio", "HIS");
      historialSheet.appendRow([
        histId,
        srv.ServicioID,
        nowStr,
        estatusAnterior,
        estatusNuevo,
        user.AdminID || "TECNICO",
        payload.Notas || "Cambio de estatus"
      ]);

      // If status is "Listo para Recoleccion"
      if (estatusNuevo === "Listo para Recoleccion") {
        updateCellInSheet(serviciosSheet, "ServicioID", srv.ServicioID, "ListoParaRecoleccion", "Si");
        notificarListoRecoleccion(srv.ServicioID, det.OrdenID);
      }

      // If status is "Entregado"
      if (estatusNuevo === "Entregado") {
        updateCellInSheet(detallesSheet, "DetalleID", det.DetalleID, "Entregado", "Si");
        updateCellInSheet(detallesSheet, "DetalleID", det.DetalleID, "FechaLiberacion", nowStr);
        otorgarPuntosPorServicio(srv.ServicioID);
      }
    }

    recalculateOrderTotals(det.OrdenID);

    return { success: true, message: "Servicio actualizado correctamente." };
  });
}

/**
 * Assigns a technician to a service.
 */
function asignarTecnicoServicio(servicioId, tecnicoId) {
  checkRole(["Administrador", "Recepcion"]);

  return withLock(function() {
    var ss = getDbSpreadsheet();
    var servicios = getSheetObjects("Servicios");
    var srv = servicios.filter(function(s) { return String(s.ServicioID) === String(servicioId); })[0];
    if (!srv) {
      throw new Error("Servicio no encontrado.");
    }

    var asignacionesSheet = ss.getSheetByName("Asignaciones");
    var asigId = getNextId("Asignaciones", "ASG");
    var nowStr = formatDate(new Date(), "yyyy-MM-dd HH:mm:ss");

    asignacionesSheet.appendRow([
      asigId,
      servicioId,
      tecnicoId,
      nowStr,
      "Asignado",
      0
    ]);

    // Update main technician in DetalleOrden if blank or needed
    var detallesSheet = ss.getSheetByName("DetalleOrden");
    updateCellInSheet(detallesSheet, "DetalleID", srv.DetalleID, "TecnicoAsignadoID", tecnicoId);

    return { success: true, message: "Técnico " + tecnicoId + " asignado a " + servicioId };
  });
}

/**
 * Helper to update a single cell in a sheet matching a primary key.
 */
function updateCellInSheet(sheet, keyColName, keyValue, targetColName, value) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var keyIndex = headers.indexOf(keyColName);
  var targetIndex = headers.indexOf(targetColName);

  if (keyIndex === -1 || targetIndex === -1) return;

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][keyIndex]) === String(keyValue)) {
      sheet.getRange(r + 1, targetIndex + 1).setValue(value);
      break;
    }
  }
}
