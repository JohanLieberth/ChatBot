/**
 * Code.gs - Main entry point and template routing for BitFix v3
 */

/**
 * Main Web App HTTP GET endpoint handler.
 * Routes page requests: home, admin, admin_usuarios, tecnico, portal, portal_registro, login, comprobante, etiqueta.
 */
function doGet(e) {
  e = e || {};
  var page = (e.parameter && e.parameter.page) ? e.parameter.page.toLowerCase() : "home";

  // Direct standalone render for ticket printing or labels
  if (page === "comprobante" || page === "etiqueta") {
    return renderPrintView(page, e.parameter);
  }

  // Handle tab=usuarios parameter when page=admin or missing
  if (e.parameter && String(e.parameter.tab).toLowerCase() === "usuarios") {
    page = "admin_usuarios";
  }

  // Get current script execution Web App URL
  var scriptUrl = "";
  try {
    scriptUrl = ScriptApp.getService().getUrl();
  } catch (err) {
    scriptUrl = "";
  }

  var validPages = ["home", "admin", "admin_usuarios", "tecnico", "portal", "portal_registro", "login"];
  if (validPages.indexOf(page) === -1) {
    page = "home";
  }

  var template = HtmlService.createTemplateFromFile("index");
  template.page = page;
  template.params = JSON.stringify(e.parameter || {});
  template.scriptUrl = scriptUrl;

  return template.evaluate()
    .setTitle("BitFix v3 - Taller de Reparaciones")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper to include standard partial HTML files inside templates.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Render specialized print views without the index shell wrapper.
 */
function renderPrintView(viewName, params) {
  var ordenId = params.ordenId || "";
  var detalleId = params.detalleId || "";
  var servicioId = params.servicioId || "";

  var template = HtmlService.createTemplateFromFile(viewName);
  template.data = getPrintData(ordenId, detalleId, servicioId);

  return template.evaluate()
    .setTitle(viewName === "comprobante" ? "Comprobante BitFix" : "Etiqueta BitFix")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Fetches print data for thermal ticket or labels.
 */
function getPrintData(ordenId, detalleId, servicioId) {
  var ss = getDbSpreadsheet();
  var ordenes = getSheetObjects("OrdenServicio");
  var detalles = getSheetObjects("DetalleOrden");
  var equipos = getSheetObjects("Equipos");
  var servicios = getSheetObjects("Servicios");
  var clientes = getSheetObjects("Clientes");
  var pagos = getSheetObjects("Pagos");
  var asignaciones = getSheetObjects("Asignaciones");

  // Find target orden
  var targetOrden = null;
  if (ordenId) {
    targetOrden = ordenes.filter(function(o) { return String(o.OrdenID) === String(ordenId); })[0];
  } else if (detalleId) {
    var det = detalles.filter(function(d) { return String(d.DetalleID) === String(detalleId); })[0];
    if (det) {
      targetOrden = ordenes.filter(function(o) { return String(o.OrdenID) === String(det.OrdenID); })[0];
    }
  } else if (servicioId) {
    var srv = servicios.filter(function(s) { return String(s.ServicioID) === String(servicioId); })[0];
    if (srv) {
      var det2 = detalles.filter(function(d) { return String(d.DetalleID) === String(srv.DetalleID); })[0];
      if (det2) {
        targetOrden = ordenes.filter(function(o) { return String(o.OrdenID) === String(det2.OrdenID); })[0];
      }
    }
  }

  if (!targetOrden) {
    return { error: "Orden o dispositivo no encontrado." };
  }

  var cliente = clientes.filter(function(c) { return String(c.Telefono) === String(targetOrden.Telefono); })[0] || {};

  // Filter details for this order
  var orderDetalles = detalles.filter(function(d) {
    return String(d.OrdenID) === String(targetOrden.OrdenID);
  });

  if (detalleId) {
    orderDetalles = orderDetalles.filter(function(d) { return String(d.DetalleID) === String(detalleId); });
  }

  var items = orderDetalles.map(function(det) {
    var eq = equipos.filter(function(e) { return String(e.EquipoID) === String(det.EquipoID); })[0] || {};
    var srv = servicios.filter(function(s) { return String(s.DetalleID) === String(det.DetalleID); })[0] || {};
    var techs = asignaciones
      .filter(function(a) { return String(a.ServicioID) === String(srv.ServicioID); })
      .map(function(a) { return a.TecnicoID; });
    var techStr = Array.from(new Set(techs)).join(", ") || det.TecnicoAsignadoID || "Sin asignar";
    var noSerieVal = eq["No.Serie"] || eq.NoSerie || "N/A";

    return {
      DetalleID: det.DetalleID,
      ServicioID: srv.ServicioID || "",
      Equipo: (eq.Marca || "") + " " + (eq.Modelo || ""),
      NoSerie: noSerieVal,
      FallaReportada: srv.FallaReportada || "N/A",
      Diagnostico: srv.Diagnostico || "Pendiente",
      Solucion: srv.Solucion || "Pendiente",
      GarantiaDias: srv.GarantiaDias || "0",
      CostoDiagnostico: srv.CostoDiagnostico || 0,
      CostoFinal: srv.CostoFinal || 0,
      Estatus: det.Estatus || "Recibido",
      TecnicoID: techStr
    };
  });

  var totalPagado = pagos
    .filter(function(p) { return String(p.OrdenID) === String(targetOrden.OrdenID); })
    .reduce(function(sum, p) { return sum + parseNumber(p.Importe); }, 0);

  var totalFinal = parseNumber(targetOrden.TotalFinal);
  if (totalFinal === 0) {
    totalFinal = items.reduce(function(sum, item) { return sum + parseNumber(item.CostoFinal); }, 0);
  }

  var saldo = totalFinal - totalPagado;

  return {
    OrdenID: targetOrden.OrdenID,
    FechaHoraRecepcion: formatDate(targetOrden.FechaHoraRecepcion || targetOrden.FechaRecepcion),
    ClienteNombre: cliente.Nombre || "Cliente General",
    ClienteTelefono: cliente.Telefono || "",
    TotalFinal: totalFinal,
    TotalPagado: totalPagado,
    Saldo: saldo,
    Items: items
  };
}
