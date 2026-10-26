/**
 * setup.gs - Schema initialization, schema cleanup/migrations, and Apps Script UI menu.
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("BitFix")
    .addItem("Inicializar sistema", "setupSchema")
    .addItem("Limpiar esquema", "cleanupSchema")
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
 * Ensures sheets, headers, config, admins, and runs cleanupSchema().
 */
function setupSchema() {
  return withLock(function() {
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

    // 1. Ensure sheets with updated target schema
    ensureSheet("Equipos", ["EquipoID", "TelefonoCliente", "Tipo", "Marca", "Modelo", "No.Serie"]);
    ensureSheet("OrdenServicio", [
      "OrdenID", "Telefono", "FechaRecepcion", "EstatusGeneral",
      "FechaHoraRecepcion", "CostoEstimado", "TotalFinal",
      "Eliminada", "FechaEliminacion", "AdminID_Elimino"
    ]);
    ensureSheet("Servicios", [
      "ServicioID", "DetalleID", "Diagnostico", "Solucion", "GarantiaDias",
      "CostoDiagnostico", "CostoFinal", "FallaReportada", "ListoParaRecoleccion"
    ]);
    ensureSheet("DetalleOrden", [
      "DetalleID", "OrdenID", "EquipoID", "Estatus", "FechaLiberacion", "Entregado", "TecnicoAsignadoID"
    ]);
    ensureSheet("UsuariosPortal", [
      "UsuarioID", "Telefono", "Nombre", "Activo", "PasswordHash", "FechaRegistro"
    ]);
    ensureSheet("Admins", ["AdminID", "Nombre", "Rol", "Telefono", "Activo", "Email"]);
    ensureSheet("Clientes", ["Telefono", "Nombre", "Correo", "TipoCliente"]);
    ensureSheet("Asignaciones", ["AsignacionID", "ServicioID", "TecnicoID", "FechaAsignacion", "Estatus", "HorasInvertidas"]);
    ensureSheet("ActividadesTecnico", ["ActividadID", "TecnicoID", "ServicioID", "Fecha", "Accion", "Minutos"]);
    ensureSheet("HistorialServicio", ["HistorialID", "ServicioID", "FechaHora", "EstatusAnterior", "EstatusNuevo", "UsuarioID", "Notas"]);
    ensureSheet("Pagos", ["PagoID", "OrdenID", "Fecha", "Importe", "Concepto"]);
    ensureSheet("NFC", ["NFC_ID", "UID", "TelefonoCliente"]);
    ensureSheet("MovimientosPuntos", ["MovimientoID", "TelefonoCliente", "Fecha", "Puntos", "Concepto"]);
    ensureSheet("SaldoPuntos", ["Telefono", "Saldo"]);
    ensureSheet("Talleres", ["Telefono", "NombreComercial"]);
    ensureSheet("NotificacionesLog", [
      "NotifID", "FechaHora", "Telefono", "OrdenID", "Tipo", "Destinatario", "Asunto", "Estado", "MensajeError"
    ]);
    ensureSheet("EtiquetasImpresas", [
      "EtiquetaID", "OrdenID", "DetalleID", "Tipo", "FechaHora", "AdminID"
    ]);

    // 2. Ensure sakurazukamori21@gmail.com is present in Admins
    var adminSheet = ss.getSheetByName("Admins");
    var adminsData = getSheetObjects("Admins");
    var targetEmail = "sakurazukamori21@gmail.com";
    var existsAdmin = adminsData.filter(function(a) {
      return String(a.Email).toLowerCase() === targetEmail.toLowerCase();
    })[0];

    if (!existsAdmin) {
      var nextAdminId = getNextId("Admins", "ADM");
      adminSheet.appendRow([nextAdminId, "Admin Sakurazukamori", "Administrador", "", "Si", targetEmail]);
    }

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

    // Run cleanup migrations
    cleanupSchemaInternal(ss);

    return { success: true, message: "Esquema e inicialización completada con éxito." };
  });
}

/**
 * Cleanup / Migration function to fix duplicate sheets and columns.
 */
function cleanupSchema() {
  return withLock(function() {
    var ss = getDbSpreadsheet();
    cleanupSchemaInternal(ss);
    return { success: true, message: "Limpieza de esquema completada." };
  });
}

/**
 * Internal idempotently executed cleanup migration.
 */
function cleanupSchemaInternal(ss) {
  // Task 2: Remove duplicate 'Cliente' sheet if exists (migrating unique rows to 'Clientes')
  var clienteSheet = ss.getSheetByName("Cliente");
  var clientesSheet = ss.getSheetByName("Clientes");
  if (clienteSheet && clientesSheet) {
    var clienteObjs = getSheetObjects("Cliente");
    var clientesObjs = getSheetObjects("Clientes");
    var existingTels = clientesObjs.map(function(c) { return String(c.Telefono); });

    clienteObjs.forEach(function(row) {
      var tel = String(row.Telefono || row["Teléfono"] || "").trim();
      if (tel && existingTels.indexOf(tel) === -1) {
        clientesSheet.appendRow([
          tel,
          row.Nombre || "",
          row.Correo || "",
          row.TipoCliente || "Cliente"
        ]);
        existingTels.push(tel);
      }
    });
    ss.deleteSheet(clienteSheet);
  }

  // Task 3: MovimientosPuntos - Migrate 'Teléfono'/'Telefono' to 'TelefonoCliente', remove 'Teléfono'/'Telefono' column
  var movSheet = ss.getSheetByName("MovimientosPuntos");
  if (movSheet) {
    migrateAndRemoveColumn(movSheet, ["Teléfono", "Telefono"], "TelefonoCliente");
  }

  // Task 4: Talleres - Remove 'RFC' and 'Dirección'/'Direccion' columns
  var talleresSheet = ss.getSheetByName("Talleres");
  if (talleresSheet) {
    removeColumnsByName(talleresSheet, ["RFC", "Dirección", "Direccion"]);
  }

  // Task 5: Equipos - Migrate 'Teléfono'/'Telefono' -> 'TelefonoCliente' and 'NoSerie' -> 'No.Serie', remove 'Teléfono'/'Telefono' and 'NoSerie'
  var equiposSheet = ss.getSheetByName("Equipos");
  if (equiposSheet) {
    migrateAndRemoveColumn(equiposSheet, ["Teléfono", "Telefono"], "TelefonoCliente");
    migrateAndRemoveColumn(equiposSheet, ["NoSerie"], "No.Serie");
  }
}

/**
 * Helper to migrate values from source columns to a target column, then remove source columns.
 */
function migrateAndRemoveColumn(sheet, sourceColNames, targetColName) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 1) return;

  var headers = data[0].map(function(h) { return String(h).trim(); });
  var targetIdx = headers.indexOf(targetColName);

  // If target column doesn't exist, append it
  if (targetIdx === -1) {
    sheet.getRange(1, headers.length + 1).setValue(targetColName);
    targetIdx = headers.length;
    headers.push(targetColName);
  }

  sourceColNames.forEach(function(sourceColName) {
    var sourceIdx = headers.indexOf(sourceColName);
    if (sourceIdx !== -1 && sourceIdx !== targetIdx) {
      // Copy values for all data rows
      for (var r = 1; r < data.length; r++) {
        var sourceVal = data[r][sourceIdx];
        var targetVal = sheet.getRange(r + 1, targetIdx + 1).getValue();
        if ((targetVal === "" || targetVal === null || targetVal === undefined) && sourceVal !== "" && sourceVal !== null) {
          sheet.getRange(r + 1, targetIdx + 1).setValue(sourceVal);
        }
      }
    }
  });

  // Delete source columns from right to left
  removeColumnsByName(sheet, sourceColNames);
}

/**
 * Helper to delete specified columns by name from a sheet.
 */
function removeColumnsByName(sheet, colNamesToRemove) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return;

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h).trim(); });

  for (var c = headers.length - 1; c >= 0; c--) {
    if (colNamesToRemove.indexOf(headers[c]) !== -1) {
      sheet.deleteColumn(c + 1);
    }
  }
}
