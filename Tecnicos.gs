/**
 * Tecnicos.gs - Endpoints for Technician Panel
 */

/**
 * Gets list of assigned service items for the logged-in technician.
 */
function getMisAsignacionesTecnico() {
  var user = checkRole(["Tecnico", "Administrador"]);
  var myTechId = user.AdminID;

  var detalles = getSheetObjects("DetalleOrden");
  var servicios = getSheetObjects("Servicios");
  var equipos = getSheetObjects("Equipos");
  var ordenes = getSheetObjects("OrdenServicio").filter(function(o) { return String(o.Eliminada).toLowerCase() !== "si"; });
  var clientes = getSheetObjects("Clientes");
  var asignaciones = getSheetObjects("Asignaciones");

  // Find all service IDs assigned to this technician
  var myServiceIds = asignaciones
    .filter(function(a) {
      return String(a.TecnicoID) === myTechId && ["Asignado", "En proceso", "Diagnostico"].indexOf(a.Estatus) !== -1;
    })
    .map(function(a) { return String(a.ServicioID); });

  // Map orders containing technician items
  var result = [];

  ordenes.forEach(function(ord) {
    var orderDetalles = detalles.filter(function(d) { return String(d.OrdenID) === String(ord.OrdenID); });
    var cliente = clientes.filter(function(c) { return String(c.Telefono) === String(ord.Telefono); })[0] || {};

    orderDetalles.forEach(function(det) {
      var srv = servicios.filter(function(s) { return String(s.DetalleID) === String(det.DetalleID); })[0] || {};
      var eq = equipos.filter(function(e) { return String(e.EquipoID) === String(det.EquipoID); })[0] || {};

      var isMine = (String(det.TecnicoAsignadoID) === myTechId) || (myServiceIds.indexOf(String(srv.ServicioID)) !== -1);

      if (isMine) {
        result.push({
          OrdenID: ord.OrdenID,
          DetalleID: det.DetalleID,
          ServicioID: srv.ServicioID || "",
          ClienteNombre: cliente.Nombre || "Cliente",
          ClienteTelefono: cliente.Telefono || "",
          Equipo: (eq.Marca || "") + " " + (eq.Modelo || ""),
          NoSerie: eq.NoSerie || "N/A",
          FallaReportada: srv.FallaReportada || "",
          Diagnostico: srv.Diagnostico || "",
          Solucion: srv.Solucion || "",
          CostoDiagnostico: parseNumber(srv.CostoDiagnostico),
          Estatus: det.Estatus,
          EsPropio: true
        });
      }
    });
  });

  return result;
}

/**
 * Registers time/minutes worked by technician.
 */
function registrarActividadTecnico(servicioId, accion, minutos) {
  var user = checkRole(["Tecnico", "Administrador"]);

  return withLock(function() {
    var ss = getDbSpreadsheet();
    var actSheet = ss.getSheetByName("ActividadesTecnico");
    var actId = getNextId("ActividadesTecnico", "ACT");
    var nowStr = formatDate(new Date(), "yyyy-MM-dd HH:mm:ss");

    actSheet.appendRow([
      actId,
      user.AdminID,
      servicioId,
      nowStr,
      accion || "Mantenimiento / Reparación",
      parseNumber(minutos)
    ]);

    // Update HorasInvertidas in Asignaciones if matching
    var asigSheet = ss.getSheetByName("Asignaciones");
    var asignaciones = getSheetObjects("Asignaciones");
    var asig = asignaciones.filter(function(a) {
      return String(a.ServicioID) === String(servicioId) && String(a.TecnicoID) === String(user.AdminID);
    })[0];

    if (asig) {
      var currentHours = parseNumber(asig.HorasInvertidas);
      var addedHours = parseNumber(minutos) / 60;
      updateCellInSheet(asigSheet, "AsignacionID", asig.AsignacionID, "HorasInvertidas", currentHours + addedHours);
    }

    return { success: true, message: "Actividad registrada correctamente." };
  });
}
