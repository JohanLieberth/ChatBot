/**
 * setup.gs - Schema initialization, configuration seeding, and Apps Script UI menu.
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("BitFix")
    .addItem("Inicializar sistema", "setupSchema")
    .addItem("Abrir Web App", "abrirWebApp")
    .addToUi();
}

function abrirWebApp() {
  var url = ScriptApp.getService().getUrl();
  if (url) {
    var html = HtmlService.createHtmlOutput(
      '<script>window.open("' + url + '", "_blank");google.script.host.close();</script>'
    ).setWidth(300).setHeight(100);
    SpreadsheetApp.getUi().showModalDialog(html, "Abriendo BitFix Web App");
  } else {
    SpreadsheetApp.getUi().alert("Debes desplegar el script como Web App primero.");
  }
}

/**
 * Idempotent schema initialization function.
 * Adds missing columns to existing sheets, creates new required sheets, and seeds default configuration & points tables.
 */
function setupSchema() {
  withLock(function() {
    var ss = getDbSpreadsheet();

    // Helper to ensure sheet exists
    function ensureSheet(sheetName, headers) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(headers);
      } else {
        ensureHeaders(sheet, headers);
      }
      return sheet;
    }

    // Helper to ensure specific headers exist at exact column positions or appended
    function ensureHeaders(sheet, expectedHeaders) {
      var lastCol = sheet.getLastColumn();
      var currentHeaders = [];
      if (lastCol > 0) {
        currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
          return String(h).trim();
        });
      } else {
        sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
        return;
      }

      expectedHeaders.forEach(function(header) {
        if (currentHeaders.indexOf(header) === -1) {
          currentHeaders.push(header);
          sheet.getRange(1, currentHeaders.length).setValue(header);
        }
      });
    }

    // 1. Check and update existing sheets with new required columns
    // Equipos: Equipos.NoSerie (col F)
    ensureSheet("Equipos", ["EquipoID", "Telefono", "Tipo", "Marca", "Modelo", "NoSerie"]);

    // OrdenServicio: OrdenServicio.FechaHoraRecepcion (col E), OrdenServicio.CostoEstimado (col F), OrdenServicio.TotalFinal (col G), OrdenServicio.Eliminada, FechaEliminacion, AdminID_Elimino
    ensureSheet("OrdenServicio", [
      "OrdenID", "Telefono", "FechaRecepcion", "EstatusGeneral",
      "FechaHoraRecepcion", "CostoEstimado", "TotalFinal",
      "Eliminada", "FechaEliminacion", "AdminID_Elimino"
    ]);

    // Servicios: Servicios.CostoDiagnostico (col F), Servicios.CostoFinal (col G), Servicios.FallaReportada (col H), Servicios.ListoParaRecoleccion (col I)
    ensureSheet("Servicios", [
      "ServicioID", "DetalleID", "Diagnostico", "Solucion", "GarantiaDias",
      "CostoDiagnostico", "CostoFinal", "FallaReportada", "ListoParaRecoleccion"
    ]);

    // DetalleOrden: DetalleOrden.TecnicoAsignadoID (col G)
    ensureSheet("DetalleOrden", [
      "DetalleID", "OrdenID", "EquipoID", "Estatus", "FechaLiberacion", "Entregado", "TecnicoAsignadoID"
    ]);

    // UsuariosPortal: UsuariosPortal.PasswordHash (col E), UsuariosPortal.FechaRegistro (col F)
    ensureSheet("UsuariosPortal", [
      "UsuarioID", "Telefono", "Nombre", "Activo", "PasswordHash", "FechaRegistro"
    ]);

    // Admins: ensure Email column exists
    ensureSheet("Admins", ["AdminID", "Nombre", "Rol", "Telefono", "Activo", "Email"]);

    // Ensure other base sheets exist if not created yet
    ensureSheet("Clientes", ["Telefono", "Nombre", "Correo", "TipoCliente"]);
    ensureSheet("Asignaciones", ["AsignacionID", "ServicioID", "TecnicoID", "FechaAsignacion", "Estatus", "HorasInvertidas"]);
    ensureSheet("ActividadesTecnico", ["ActividadID", "TecnicoID", "ServicioID", "Fecha", "Accion", "Minutos"]);
    ensureSheet("HistorialServicio", ["HistorialID", "ServicioID", "FechaHora", "EstatusAnterior", "EstatusNuevo", "UsuarioID", "Notas"]);
    ensureSheet("Pagos", ["PagoID", "OrdenID", "Fecha", "Importe", "Concepto"]);
    ensureSheet("NFC", ["NFC_ID", "UID", "TelefonoCliente"]);
    ensureSheet("MovimientosPuntos", ["MovimientoID", "Telefono", "Fecha", "Puntos", "Concepto"]);
    ensureSheet("SaldoPuntos", ["Telefono", "Saldo"]);
    ensureSheet("Talleres", ["Telefono", "NombreComercial", "RFC", "Direccion"]);

    // 2. Create new required sheets
    ensureSheet("NotificacionesLog", [
      "NotifID", "FechaHora", "Telefono", "OrdenID", "Tipo", "Destinatario", "Asunto", "Estado", "MensajeError"
    ]);

    ensureSheet("EtiquetasImpresas", [
      "EtiquetaID", "OrdenID", "DetalleID", "Tipo", "FechaHora", "AdminID"
    ]);

    // 3. Seed Configuracion sheet
    var configSheet = ensureSheet("Configuracion", ["Parametro", "Valor"]);
    var configData = getSheetObjects("Configuracion");
    var configMap = {};
    configData.forEach(function(row) {
      if (row.Parametro) configMap[row.Parametro] = row.Valor;
    });

    var defaultConfig = {
      "URLPortal": "https://script.google.com/macros/s/DEPLOYMENT_ID/exec",
      "DireccionTaller": "Av. Principal #123, Col. Centro, Cancún, Q.R. Tel: 998-000-0000",
      "VideoBienvenida": "https://www.w3schools.com/html/mov_bbb.mp4",
      "TplAsunto_Bienvenida": "Bienvenido a BitFix - Cuenta activada",
      "TplCuerpo_Bienvenida": "Hola {{Nombre}},\n\nTu cuenta en el portal BitFix ha sido registrada con éxito.\nPuedes consultar el avance de tus equipos en nuestro portal.",
      "TplAsunto_RecepcionEquipo": "BitFix - Recepción de equipo {{OrdenID}}",
      "TplCuerpo_RecepcionEquipo": "Hola {{Nombre}},\n\nHemos recibido tu equipo para revisión.\nOrden ID: {{OrdenID}}\nEquipo: {{Equipo}}\n\nPuedes darle seguimiento en el portal BitFix.",
      "TplAsunto_ListoRecoleccion": "BitFix - Tu equipo está listo para recolección",
      "TplCuerpo_ListoRecoleccion": "Hola {{Nombre}},\n\nTu equipo ({{Equipo}}, S/N: {{NoSerie}}) correspondiente al servicio {{ServicioID}} de la orden {{OrdenID}} ya está listo para recolección en nuestro taller.\n\nDirección del taller:\n{{DireccionTaller}}\n\nConsulta el portal para más información: {{URLPortal}}",
      "TplAsunto_ReenvioManual": "BitFix - Actualización de tu servicio {{ServicioID}}",
      "TplCuerpo_ReenvioManual": "Hola {{Nombre}},\n\nTe enviamos una actualización sobre tu orden {{OrdenID}} y servicio {{ServicioID}}.",
      "TplAsunto_CambioEstatus": "BitFix - Cambio de estatus en orden {{OrdenID}}",
      "TplCuerpo_CambioEstatus": "Hola {{Nombre}},\n\nEl estatus de tu servicio {{ServicioID}} ha cambiado a: {{EstatusNuevo}}."
    };

    Object.keys(defaultConfig).forEach(function(param) {
      if (configMap[param] === undefined) {
        configSheet.appendRow([param, defaultConfig[param]]);
      }
    });

    // 4. Seed TablaPuntos sheet
    var puntosSheet = ensureSheet("TablaPuntos", ["Accion", "Puntos"]);
    var puntosData = getSheetObjects("TablaPuntos");
    var puntosMap = {};
    puntosData.forEach(function(row) {
      if (row.Accion) puntosMap[row.Accion] = row.Puntos;
    });

    var defaultPuntos = {
      "Servicio Mayor": 10,
      "Referido": 25,
      "Servicio Menor": 5
    };

    Object.keys(defaultPuntos).forEach(function(accion) {
      if (puntosMap[accion] === undefined) {
        puntosSheet.appendRow([accion, defaultPuntos[accion]]);
      }
    });
  });

  return { success: true, message: "Esquema e inicialización completada con éxito." };
}
