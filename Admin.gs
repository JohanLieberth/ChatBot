/**
 * Admin.gs - Endpoints for Admin Panel
 */

/**
 * Gets main listing of orders with filters and concatenated details.
 */
function getAdminOrdenes(filters) {
  checkRole(["Administrador", "Recepcion"]);
  filters = filters || {};

  var ordenes = getSheetObjects("OrdenServicio");
  var clientes = getSheetObjects("Clientes");
  var detalles = getSheetObjects("DetalleOrden");
  var equipos = getSheetObjects("Equipos");
  var servicios = getSheetObjects("Servicios");
  var asignaciones = getSheetObjects("Asignaciones");

  // Exclude soft-deleted orders unless specified
  ordenes = ordenes.filter(function(o) { return String(o.Eliminada).toLowerCase() !== "si"; });

  var result = ordenes.map(function(ord) {
    var cliente = clientes.filter(function(c) { return String(c.Telefono) === String(ord.Telefono); })[0] || {};
    var orderDetalles = detalles.filter(function(d) { return String(d.OrdenID) === String(ord.OrdenID); });

    var items = orderDetalles.map(function(det) {
      var eq = equipos.filter(function(e) { return String(e.EquipoID) === String(det.EquipoID); })[0] || {};
      var srv = servicios.filter(function(s) { return String(s.DetalleID) === String(det.DetalleID); })[0] || {};
      var techs = asignaciones
        .filter(function(a) { return String(a.ServicioID) === String(srv.ServicioID); })
        .map(function(a) { return a.TecnicoID; });

      var noSerieVal = eq["No.Serie"] || eq.NoSerie || "";

      return {
        DetalleID: det.DetalleID,
        MarcaModelo: (eq.Marca || "") + " " + (eq.Modelo || ""),
        NoSerie: noSerieVal,
        Technicians: techs,
        CostoFinal: parseNumber(srv.CostoFinal)
      };
    });

    var equiposConcat = items.map(function(i) { return i.MarcaModelo; }).filter(Boolean).join(" · ");
    var seriesConcat = items.map(function(i) { return i.NoSerie; }).filter(Boolean).join(", ");

    var allTechs = [];
    items.forEach(function(i) {
      i.Technicians.forEach(function(t) {
        if (allTechs.indexOf(t) === -1) allTechs.push(t);
      });
    });
    if (allTechs.length === 0 && orderDetalles.length > 0) {
      orderDetalles.forEach(function(d) {
        if (d.TecnicoAsignadoID && allTechs.indexOf(d.TecnicoAsignadoID) === -1) {
          allTechs.push(d.TecnicoAsignadoID);
        }
      });
    }

    var totalCalc = parseNumber(ord.TotalFinal);
    if (totalCalc === 0) {
      totalCalc = items.reduce(function(sum, i) { return sum + i.CostoFinal; }, 0);
    }

    return {
      OrdenID: ord.OrdenID,
      FechaHora: formatDate(ord.FechaHoraRecepcion || ord.FechaRecepcion),
      ClienteNombre: cliente.Nombre || "Cliente",
      ClienteTelefono: cliente.Telefono || "",
      ClienteTipo: cliente.TipoCliente || "Cliente",
      EquiposConcat: equiposConcat || "Sin equipos",
      SeriesConcat: seriesConcat || "N/A",
      TecnicoIDConcat: allTechs.join(", ") || "Sin asignar",
      EstatusGeneral: ord.EstatusGeneral || "Abierta",
      TotalFinal: totalCalc,
      TotalFormatted: formatCurrency(totalCalc)
    };
  });

  // Apply search query
  if (filters.search) {
    var q = String(filters.search).toLowerCase();
    result = result.filter(function(row) {
      return row.OrdenID.toLowerCase().indexOf(q) !== -1 ||
             row.ClienteNombre.toLowerCase().indexOf(q) !== -1 ||
             row.ClienteTelefono.indexOf(q) !== -1 ||
             row.SeriesConcat.toLowerCase().indexOf(q) !== -1 ||
             row.EquiposConcat.toLowerCase().indexOf(q) !== -1;
    });
  }

  // Apply Estatus filter
  if (filters.estatus) {
    result = result.filter(function(row) { return row.EstatusGeneral === filters.estatus; });
  }

  // Apply TipoCliente filter
  if (filters.tipoCliente) {
    result = result.filter(function(row) { return row.ClienteTipo === filters.tipoCliente; });
  }

  // Apply Técnico filter
  if (filters.tecnicoId) {
    result = result.filter(function(row) { return row.TecnicoIDConcat.indexOf(filters.tecnicoId) !== -1; });
  }

  return result.reverse(); // Newest first
}

/**
 * Gets full modal view of an order with details, payments, and history.
 */
function getDetalleOrdenCompleto(ordenId) {
  checkRole(["Administrador", "Recepcion", "Tecnico"]);

  var ordenes = getSheetObjects("OrdenServicio");
  var ord = ordenes.filter(function(o) { return String(o.OrdenID) === String(ordenId); })[0];
  if (!ord) throw new Error("Orden no encontrada.");

  var clientes = getSheetObjects("Clientes");
  var cliente = clientes.filter(function(c) { return String(c.Telefono) === String(ord.Telefono); })[0] || {};

  var detalles = getSheetObjects("DetalleOrden").filter(function(d) { return String(d.OrdenID) === String(ordenId); });
  var equipos = getSheetObjects("Equipos");
  var servicios = getSheetObjects("Servicios");
  var asignaciones = getSheetObjects("Asignaciones");
  var pagos = getSheetObjects("Pagos").filter(function(p) { return String(p.OrdenID) === String(ordenId); });
  var historial = getSheetObjects("HistorialServicio");

  var items = detalles.map(function(det) {
    var eq = equipos.filter(function(e) { return String(e.EquipoID) === String(det.EquipoID); })[0] || {};
    var srv = servicios.filter(function(s) { return String(s.DetalleID) === String(det.DetalleID); })[0] || {};
    var techs = asignaciones
      .filter(function(a) { return String(a.ServicioID) === String(srv.ServicioID); })
      .map(function(a) { return a.TecnicoID; });

    var srvHist = historial.filter(function(h) { return String(h.ServicioID) === String(srv.ServicioID); });
    var noSerieVal = eq["No.Serie"] || eq.NoSerie || "N/A";

    return {
      DetalleID: det.DetalleID,
      EquipoID: eq.EquipoID,
      Tipo: eq.Tipo,
      Marca: eq.Marca,
      Modelo: eq.Modelo,
      NoSerie: noSerieVal,
      Estatus: det.Estatus,
      ServicioID: srv.ServicioID,
      Diagnostico: srv.Diagnostico,
      Solucion: srv.Solucion,
      GarantiaDias: srv.GarantiaDias,
      CostoDiagnostico: parseNumber(srv.CostoDiagnostico),
      CostoFinal: parseNumber(srv.CostoFinal),
      FallaReportada: srv.FallaReportada,
      ListoParaRecoleccion: srv.ListoParaRecoleccion,
      TecnicoAsignadoID: det.TecnicoAsignadoID,
      TecnicosAsignados: Array.from(new Set(techs)),
      FechaLiberacion: formatDate(det.FechaLiberacion),
      Entregado: det.Entregado,
      Historial: srvHist.map(function(h) {
        return {
          FechaHora: formatDate(h.FechaHora),
          EstatusAnterior: h.EstatusAnterior,
          EstatusNuevo: h.EstatusNuevo,
          UsuarioID: h.UsuarioID,
          Notas: h.Notas
        };
      })
    };
  });

  var totalPagado = pagos.reduce(function(sum, p) { return sum + parseNumber(p.Importe); }, 0);
  var totalFinal = parseNumber(ord.TotalFinal);
  if (totalFinal === 0) {
    totalFinal = items.reduce(function(sum, i) { return sum + i.CostoFinal; }, 0);
  }

  return {
    OrdenID: ord.OrdenID,
    FechaHoraRecepcion: formatDate(ord.FechaHoraRecepcion || ord.FechaRecepcion),
    EstatusGeneral: ord.EstatusGeneral,
    Cliente: {
      Telefono: cliente.Telefono,
      Nombre: cliente.Nombre,
      Correo: cliente.Correo,
      TipoCliente: cliente.TipoCliente || "Cliente"
    },
    Items: items,
    Pagos: pagos.map(function(p) {
      return {
        PagoID: p.PagoID,
        Fecha: formatDate(p.Fecha),
        Importe: parseNumber(p.Importe),
        Concepto: p.Concepto
      };
    }),
    TotalFinal: totalFinal,
    TotalPagado: totalPagado,
    SaldoPendiente: totalFinal - totalPagado
  };
}

/**
 * Gets list of active technicians for dropdown selects.
 */
function getTecnicosActivos() {
  var admins = getSheetObjects("Admins");
  return admins.filter(function(a) {
    return (a.Rol === "Tecnico" || a.Rol === "Administrador") && String(a.Activo).toUpperCase() === "SI";
  }).map(function(a) {
    return { AdminID: a.AdminID, Nombre: a.Nombre, Rol: a.Rol };
  });
}

/**
 * Deletes an order (soft-delete by default, or hard-delete if requested & no payments exist).
 */
function eliminarOrden(ordenId, hardDelete, confirmId) {
  var user = checkRole(["Administrador"]);

  if (String(confirmId).trim() !== String(ordenId).trim()) {
    throw new Error("El ID de confirmación no coincide con la orden a eliminar.");
  }

  return withLock(function() {
    var ss = getDbSpreadsheet();
    var ordenSheet = ss.getSheetByName("OrdenServicio");
    var nowStr = formatDate(new Date(), "yyyy-MM-dd HH:mm:ss");

    var pagos = getSheetObjects("Pagos").filter(function(p) { return String(p.OrdenID) === String(ordenId); });

    if (hardDelete) {
      if (pagos.length > 0) {
        throw new Error("No se puede eliminar definitivamente una orden que ya tiene pagos registrados.");
      }

      // Hard delete from OrdenServicio
      deleteRowsMatching(ordenSheet, "OrdenID", ordenId);
      return { success: true, message: "Orden " + ordenId + " eliminada definitivamente." };
    } else {
      // Soft delete
      var rows = ordenSheet.getDataRange().getValues();
      for (var r = 1; r < rows.length; r++) {
        if (String(rows[r][0]) === String(ordenId)) {
          ordenSheet.getRange(r + 1, 8).setValue("Si"); // Eliminada
          ordenSheet.getRange(r + 1, 9).setValue(nowStr); // FechaEliminacion
          ordenSheet.getRange(r + 1, 10).setValue(user.AdminID); // AdminID_Elimino
          break;
        }
      }

      return { success: true, message: "Orden " + ordenId + " desactivada (soft-delete)." };
    }
  });
}

/**
 * Helper to hard delete rows matching column key value.
 */
function deleteRowsMatching(sheet, keyColName, keyValue) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var idx = headers.indexOf(keyColName);
  if (idx === -1) return;

  for (var r = data.length - 1; r >= 1; r--) {
    if (String(data[r][idx]) === String(keyValue)) {
      sheet.deleteRow(r + 1);
    }
  }
}
