/**
 * Notificaciones.gs - Centralized email notifications and logging module
 */

/**
 * Public GAS endpoint to trigger manual email resends from Admin UI.
 */
function reenviarCorreoManual(telefono, ordenId, overrides) {
  checkRole(["Administrador", "Recepcion"]);
  overrides = overrides || {};
  overrides.EsReenvioManual = true;
  return enviarCorreo_(telefono, ordenId, "ReenvioManual", overrides);
}

/**
 * Main email dispatch function (internal helper).
 */
function enviarCorreo_(telefono, ordenId, tipo, overrides) {
  overrides = overrides || {};
  telefono = String(telefono || "").replace(/\D/g, "");

  var ss = getDbSpreadsheet();
  var clientes = getSheetObjects("Clientes");
  var cliente = clientes.filter(function(c) { return String(c.Telefono) === telefono; })[0];

  var destinatario = overrides.Destinatario || (cliente ? cliente.Correo : "");
  if (!destinatario) {
    logNotificacion_(telefono, ordenId, tipo, "", "", "Error", "El cliente no tiene correo registrado.");
    return { success: false, message: "El cliente no tiene un correo electrónico registrado." };
  }

  // Idempotency check for auto notification ListoRecoleccion
  if (tipo === "ListoRecoleccion" && !overrides.EsReenvioManual) {
    var logs = getSheetObjects("NotificacionesLog");
    var yaEnviado = logs.some(function(l) {
      return String(l.OrdenID) === String(ordenId) &&
             String(l.Tipo) === "ListoRecoleccion" &&
             String(l.Estado) === "Enviado";
    });
    if (yaEnviado) {
      return { success: true, message: "Notificación 'Listo para Recolección' ya enviada previamente." };
    }
  }

  // Load config templates
  var config = getSheetObjects("Configuracion");
  var configMap = {};
  config.forEach(function(row) {
    if (row.Parametro) configMap[row.Parametro] = row.Valor;
  });

  var tplAsuntoKey = "TplAsunto_" + tipo;
  var tplCuerpoKey = "TplCuerpo_" + tipo;

  var asunto = overrides.Asunto || configMap[tplAsuntoKey] || ("BitFix - Actualización " + ordenId);
  var cuerpo = overrides.Cuerpo || configMap[tplCuerpoKey] || ("Hola {{Nombre}},\n\nTu orden {{OrdenID}} ha sido actualizada.");

  // Replacement tokens map
  var placeholders = {
    "{{Nombre}}": overrides.Nombre || (cliente ? cliente.Nombre : "Cliente"),
    "{{OrdenID}}": ordenId || "",
    "{{ServicioID}}": overrides.ServicioID || "",
    "{{Equipo}}": overrides.Equipo || "",
    "{{NoSerie}}": overrides.NoSerie || "N/A",
    "{{DireccionTaller}}": configMap["DireccionTaller"] || "BitFix Taller",
    "{{URLPortal}}": configMap["URLPortal"] || "#",
    "{{EstatusNuevo}}": overrides.EstatusNuevo || ""
  };

  Object.keys(placeholders).forEach(function(key) {
    var val = placeholders[key];
    asunto = asunto.split(key).join(val);
    cuerpo = cuerpo.split(key).join(val);
  });

  try {
    var htmlCuerpo = cuerpo.replace(/\n/g, "<br>");
    GmailApp.sendEmail(destinatario, asunto, cuerpo, { htmlBody: htmlCuerpo });
    logNotificacion_(telefono, ordenId, tipo, destinatario, asunto, "Enviado", "");
    return { success: true, message: "Correo enviado correctamente a " + destinatario };
  } catch (err) {
    var errMsg = err ? err.toString() : "Error desconocido al enviar correo.";
    logNotificacion_(telefono, ordenId, tipo, destinatario, asunto, "Error", errMsg);
    return { success: false, message: errMsg };
  }
}

/**
 * Triggers automated "Listo para Recolección" email notification.
 */
function notificarListoRecoleccion(servicioId, ordenId) {
  var servicios = getSheetObjects("Servicios");
  var srv = servicios.filter(function(s) { return String(s.ServicioID) === String(servicioId); })[0];
  if (!srv) return;

  var detalles = getSheetObjects("DetalleOrden");
  var det = detalles.filter(function(d) { return String(d.DetalleID) === String(srv.DetalleID); })[0];
  if (!det) return;

  var equipos = getSheetObjects("Equipos");
  var eq = equipos.filter(function(e) { return String(e.EquipoID) === String(det.EquipoID); })[0] || {};

  var ordenes = getSheetObjects("OrdenServicio");
  var ord = ordenes.filter(function(o) { return String(o.OrdenID) === String(ordenId); })[0];
  if (!ord) return;

  enviarCorreo_(ord.Telefono, ordenId, "ListoRecoleccion", {
    ServicioID: servicioId,
    Equipo: (eq.Marca || "") + " " + (eq.Modelo || ""),
    NoSerie: eq.NoSerie || "N/A"
  });
}

/**
 * Logs notification status into NotificacionesLog sheet.
 */
function logNotificacion_(telefono, ordenId, tipo, destinatario, asunto, estado, errorMsg) {
  try {
    var ss = getDbSpreadsheet();
    var logSheet = ss.getSheetByName("NotificacionesLog");
    var notifId = getNextId("NotificacionesLog", "NTF");
    var nowStr = formatDate(new Date(), "yyyy-MM-dd HH:mm:ss");

    logSheet.appendRow([
      notifId,
      nowStr,
      telefono || "",
      ordenId || "",
      tipo || "General",
      destinatario || "",
      asunto || "",
      estado || "Desconocido",
      errorMsg || ""
    ]);
  } catch (e) {
    Logger.log("Error logging notification: " + e.message);
  }
}
