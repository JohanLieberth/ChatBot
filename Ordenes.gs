/**
 * Ordenes.gs - CRUD for service orders, recalculating totals and status logic
 */

/**
 * Creates a new service order with multiple equipment items.
 */
function crearOrdenServicio(payload) {
  checkRole(["Administrador", "Recepcion"]);

  return withLock(function() {
    var ss = getDbSpreadsheet();
    var telefono = String(payload.Telefono || "").trim();
    var nombre = String(payload.Nombre || "").trim();
    var correo = String(payload.Correo || "").trim();
    var tipoCliente = payload.TipoCliente || "Cliente";
    var items = payload.items || []; // Array of { Tipo, Marca, Modelo, NoSerie, FallaReportada, TecnicoAsignadoID }

    if (!telefono || !nombre) {
      throw new Error("El teléfono y nombre del cliente son obligatorios.");
    }
    if (items.length === 0) {
      throw new Error("Debe incluir al menos un equipo en la orden.");
    }

    // 1. Ensure or update Clientes
    var clientesSheet = ss.getSheetByName("Clientes");
    var clientesData = getSheetObjects("Clientes");
    var clienteExistente = clientesData.filter(function(c) { return String(c.Telefono) === telefono; })[0];

    if (!clienteExistente) {
      clientesSheet.appendRow([telefono, nombre, correo, tipoCliente]);
    } else {
      // Update email/name if provided
      var rows = clientesSheet.getDataRange().getValues();
      for (var r = 1; r < rows.length; r++) {
        if (String(rows[r][0]) === telefono) {
          if (nombre) clientesSheet.getRange(r + 1, 2).setValue(nombre);
          if (correo) clientesSheet.getRange(r + 1, 3).setValue(correo);
          if (tipoCliente) clientesSheet.getRange(r + 1, 4).setValue(tipoCliente);
          break;
        }
      }
    }

    // 2. Insert OrdenServicio
    var ordenId = getNextId("OrdenServicio", "OS");
    var nowStr = formatDate(new Date(), "yyyy-MM-dd HH:mm:ss");
    var ordenSheet = ss.getSheetByName("OrdenServicio");

    // Schema: OrdenID, Telefono, FechaRecepcion, EstatusGeneral, FechaHoraRecepcion, CostoEstimado, TotalFinal, Eliminada, FechaEliminacion, AdminID_Elimino
    ordenSheet.appendRow([
      ordenId,
      telefono,
      formatDate(new Date(), "yyyy-MM-dd"),
      "Abierta",
      nowStr,
      0, // CostoEstimado placeholder
      0, // TotalFinal placeholder
      "No", "", ""
    ]);

    var totalEstimado = 0;

    // 3. Insert Equipos, DetalleOrden, Servicios, Asignaciones
    var equiposSheet = ss.getSheetByName("Equipos");
    var detalleSheet = ss.getSheetByName("DetalleOrden");
    var serviciosSheet = ss.getSheetByName("Servicios");
    var asignacionesSheet = ss.getSheetByName("Asignaciones");
    var historialSheet = ss.getSheetByName("HistorialServicio");

    items.forEach(function(item) {
      var equipoId = getNextId("Equipos", "EQ");
      equiposSheet.appendRow([
        equipoId,
        telefono,
        item.Tipo || "Consola",
        item.Marca || "",
        item.Modelo || "",
        item.NoSerie || ""
      ]);

      var detalleId = getNextId("DetalleOrden", "DET");
      var techId = item.TecnicoAsignadoID || "ADM001";
      detalleSheet.appendRow([
        detalleId,
        ordenId,
        equipoId,
        "Diagnostico",
        "", // FechaLiberacion
        "No", // Entregado
        techId
      ]);

      var servicioId = getNextId("Servicios", "SRV");
      var costoDiag = parseNumber(item.CostoDiagnostico || 0);
      totalEstimado += costoDiag;

      serviciosSheet.appendRow([
        servicioId,
        detalleId,
        "Pendiente de diagnóstico", // Diagnostico
        "Pendiente", // Solucion
        90, // GarantiaDias
        costoDiag,
        0, // CostoFinal
        item.FallaReportada || "",
        "No" // ListoParaRecoleccion
      ]);

      var asigId = getNextId("Asignaciones", "ASG");
      asignacionesSheet.appendRow([
        asigId,
        servicioId,
        techId,
        nowStr,
        "Asignado",
        0
      ]);

      var histId = getNextId("HistorialServicio", "HIS");
      historialSheet.appendRow([
        histId,
        servicioId,
        nowStr,
        "-",
        "Diagnostico",
        "ADMIN",
        "Creación de orden " + ordenId
      ]);
    });

    // 4. Update CostoEstimado on OrdenServicio
    recalculateOrderTotals(ordenId);

    // 5. Send reception email
    enviarCorreo_(telefono, ordenId, "RecepcionEquipo", {
      Nombre: nombre,
      OrdenID: ordenId,
      Equipo: items.map(function(i) { return i.Marca + " " + i.Modelo; }).join(", ")
    });

    return { success: true, ordenId: ordenId };
  });
}

/**
 * Recalculates Totals and general Estatus for an order.
 */
function recalculateOrderTotals(ordenId) {
  var ss = getDbSpreadsheet();
  var ordenSheet = ss.getSheetByName("OrdenServicio");
  var detalles = getSheetObjects("DetalleOrden").filter(function(d) {
    return String(d.OrdenID) === String(ordenId);
  });
  var servicios = getSheetObjects("Servicios");

  var totalFinal = 0;
  var costoEstimado = 0;
  var allEntregado = detalles.length > 0;
  var anyEntregado = false;
  var anyCancelado = false;
  var allCancelado = detalles.length > 0;

  detalles.forEach(function(det) {
    var srv = servicios.filter(function(s) { return String(s.DetalleID) === String(det.DetalleID); })[0];
    if (srv) {
      if (det.Estatus !== "Cancelado") {
        totalFinal += parseNumber(srv.CostoFinal);
        costoEstimado += parseNumber(srv.CostoDiagnostico);
      }
    }

    if (det.Estatus === "Entregado") {
      anyEntregado = true;
    } else {
      allEntregado = false;
    }

    if (det.Estatus === "Cancelado") {
      anyCancelado = true;
    } else {
      allCancelado = false;
    }
  });

  var estatusGeneral = "Abierta";
  if (allCancelado) {
    estatusGeneral = "Cancelada";
  } else if (allEntregado) {
    estatusGeneral = "Cerrada";
  } else if (anyEntregado) {
    estatusGeneral = "Entregado Parcial";
  } else if (detalles.some(function(d) { return d.Estatus !== "Diagnostico"; })) {
    estatusGeneral = "En Proceso";
  }

  // Update OrdenServicio row
  var rows = ordenSheet.getDataRange().getValues();
  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][0]) === String(ordenId)) {
      ordenSheet.getRange(r + 1, 4).setValue(estatusGeneral); // EstatusGeneral
      ordenSheet.getRange(r + 1, 6).setValue(costoEstimado);  // CostoEstimado
      ordenSheet.getRange(r + 1, 7).setValue(totalFinal);     // TotalFinal
      break;
    }
  }

  return { totalFinal: totalFinal, costoEstimado: costoEstimado, estatusGeneral: estatusGeneral };
}

/**
 * Public quick status query by ServicioID without sensitive user data.
 */
function consultarServicioRapido(servicioId) {
  servicioId = String(servicioId || "").trim().toUpperCase();
  if (!servicioId) {
    throw new Error("Proporcione un ID de Servicio válido (ej. SRV001).");
  }

  var servicios = getSheetObjects("Servicios");
  var srv = servicios.filter(function(s) { return String(s.ServicioID).toUpperCase() === servicioId; })[0];

  if (!srv) {
    throw new Error("No se encontró ningún servicio con el ID: " + servicioId);
  }

  var detalles = getSheetObjects("DetalleOrden");
  var det = detalles.filter(function(d) { return String(d.DetalleID) === String(srv.DetalleID); })[0];

  var equipos = getSheetObjects("Equipos");
  var eq = det ? equipos.filter(function(e) { return String(e.EquipoID) === String(det.EquipoID); })[0] : null;

  var asignaciones = getSheetObjects("Asignaciones");
  var techs = asignaciones
    .filter(function(a) { return String(a.ServicioID) === String(srv.ServicioID); })
    .map(function(a) { return a.TecnicoID; });

  var clientes = getSheetObjects("Clientes");
  var ordenes = getSheetObjects("OrdenServicio");
  var targetOrden = det ? ordenes.filter(function(o) { return String(o.OrdenID) === String(det.OrdenID); })[0] : null;
  var cliente = targetOrden ? clientes.filter(function(c) { return String(c.Telefono) === String(targetOrden.Telefono); })[0] : null;

  return {
    ServicioID: srv.ServicioID,
    OrdenID: det ? det.OrdenID : "N/A",
    ClienteNombre: cliente ? cliente.Nombre : "Cliente",
    Equipo: eq ? ((eq.Marca || "") + " " + (eq.Modelo || "")) : "N/A",
    NoSerie: eq ? eq.NoSerie : "N/A",
    Diagnostico: srv.Diagnostico || "Pendiente",
    Solucion: srv.Solucion || "Pendiente",
    Estatus: det ? det.Estatus : "En proceso",
    TecnicoAsignado: Array.from(new Set(techs)).join(", ") || (det ? det.TecnicoAsignadoID : "Sin asignar"),
    CostoFinal: parseNumber(srv.CostoFinal) > 0 ? formatCurrency(srv.CostoFinal) : "Pendiente",
    FechaLiberacion: det ? formatDate(det.FechaLiberacion) : "Pendiente"
  };
}
