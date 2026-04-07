/**
 * CONFIGURACIÓN DE LA APLICACIÓN
 */
const CONFIG = {
  // Google Sheets
  SHEET_ID: '', // SE DEBE COMPLETAR AL DESPLEGAR

  // AppSheet
  APPSHEET_APP_ID: '', // SE DEBE COMPLETAR AL DESPLEGAR
  APPSHEET_ACCESS_KEY: '', // SE DEBE COMPLETAR AL DESPLEGAR

  // Google Maps (opcional, puede usar OSM gratuito)
  MAPS_API_KEY: '', // SE DEBE COMPLETAR AL DESPLEGAR

  // Email
  EMAIL_INSTITUTO: 'mujeres.seguras@merida.gob.mx',
  EMAIL_COPIA: 'coordinador@instituto.gob.mx',

  // Límites
  MAX_SUCURSALES: 10,
  EMPRESA_ID_PREFIX: 'EMP-MER-'
};

/**
 * ESTRUCTURA DE LA BASE DE DATOS (Google Sheets)
 *
 * Hoja: "Empresas"
 * Columnas: ID_Empresa, RFC, Representante_Legal, Telefono, Email, Fecha_Registro, Estatus_Actual
 *
 * Hoja: "Sucursales"
 * Columnas: ID_Sucursal, ID_Empresa, Nombre, Direccion, Latitud, Longitud, Horario, Telefono_Local, Responsable, Cargo
 *
 * Hoja: "Capacitaciones"
 * Columnas: ID_Capacitacion, ID_Empresa, Fecha, Tipo, Asistentes, Evidencia_URL
 *
 * Hoja: "Plan_Trabajo"
 * Columnas: ID_Plan, ID_Empresa, Actividad, Fecha_Compromiso, Responsable, Estatus
 *
 * Hoja: "Estatus_Insignia"
 * Columnas: ID_Estatus, ID_Empresa, Estatus, Fecha_Actualizacion
 *
 * Hoja: "Logs_Webhook"
 * Columnas: ID_Log, Fecha, Payload, Resultado
 */

/**
 * Función principal que sirve la interfaz HTML
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  template.preId = e.parameter.preId || '';
  template.empresaId = e.parameter.empresaId || '';

  return template.evaluate()
    .setTitle('Registro Insignia Mujeres Seguras')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Función para incluir archivos HTML (CSS/JS) en el template principal
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Recibe webhooks de AppSheet
 * Se encarga de actualizar el estatus local basado en cambios en AppSheet
 */
function doPost(e) {
  try {
    // Validación básica de seguridad (CORS / Token si se configura)
    const data = JSON.parse(e.postData.contents);
    logWebhook(data);

    // Procesar actualización de AppSheet
    if (data.Action === 'Edit' || data.Action === 'update_status') {
      actualizarEstatusLocal(data);
    }

    return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    console.error('Error en Webhook:', err);
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Valida el RFC con el formato oficial del SAT
 */
function validarRFC(rfc) {
  const re = /^([A-ZÑ&]{3,4}) ?(?:- ?)?(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])) ?(?:- ?)?([A-Z\d]{2})([A\d])$/;
  return re.test(rfc.toUpperCase());
}

/**
 * Geocodificación usando Google Maps Services
 */
function geocodificarDireccion(direccion) {
  try {
    const response = Maps.newGeocoder().geocode(direccion);
    if (response.status === 'OK') {
      const result = response.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formatted_address: result.formatted_address
      };
    }
    return null;
  } catch (e) {
    console.error('Error en geocodificación:', e);
    return null;
  }
}

/**
 * Procesa el registro completo de la empresa y sus sucursales
 */
function procesarRegistroCompleto(datos) {
  try {
    // Rate Limiting Básico
    if (!verificarRateLimit()) {
      throw new Error('Límite de registros excedido. Intente más tarde.');
    }

    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const empresaId = CONFIG.EMPRESA_ID_PREFIX + Utilities.getUuid().substring(0, 8);

    // 1. Guardar Empresa
    const sheetEmpresas = ss.getSheetByName('Empresas');
    sheetEmpresas.appendRow([
      empresaId,
      datos.fiscales.rfc,
      datos.fiscales.representante,
      datos.fiscales.telefono,
      datos.fiscales.email,
      new Date(),
      'Registrado - En revisión'
    ]);

    // 2. Guardar Sucursales
    const sheetSucursales = ss.getSheetByName('Sucursales');
    datos.sucursales.forEach((suc, index) => {
      sheetSucursales.appendRow([
        empresaId + '-S' + (index + 1),
        empresaId,
        suc.nombre,
        suc.direccion,
        suc.lat,
        suc.lng,
        suc.horario,
        suc.telefono,
        suc.responsable,
        suc.cargo
      ]);
    });

    // 3. Inicializar Estatus
    const sheetEstatus = ss.getSheetByName('Estatus_Insignia');
    sheetEstatus.appendRow([
      Utilities.getUuid(),
      empresaId,
      'Pendiente',
      new Date()
    ]);

    // 4. Sincronizar con AppSheet (Empresa y Sucursales)
    sincronizarConAppSheet({empresa: datos.fiscales, sucursales: datos.sucursales, id: empresaId});

    return {success: true, empresaId: empresaId};
  } catch (e) {
    return {success: false, error: e.toString()};
  }
}

function verificarRateLimit() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName('Logs_Webhook') || ss.insertSheet('Logs_Webhook');
  const userIP = "IP_GENERAL"; // En GAS es difícil obtener la IP real, se usa un log de tiempo
  const data = sheet.getDataRange().getValues();
  const now = new Date().getTime();
  const oneHour = 60 * 60 * 1000;

  const recentAttempts = data.filter(row => {
    const time = new Date(row[1]).getTime();
    return (now - time) < oneHour && row[2].includes('Registro');
  });

  return recentAttempts.length < 10; // Límite flexible para entorno demo
}

/**
 * Envía datos a la API de AppSheet (Empresas y Sucursales)
 */
function sincronizarConAppSheet(datos) {
  if (!CONFIG.APPSHEET_APP_ID || !CONFIG.APPSHEET_ACCESS_KEY) return;

  // 1. Sincronizar Empresa
  const urlEmpresa = `https://api.appsheet.com/api/v1/apps/${CONFIG.APPSHEET_APP_ID}/tables/Empresas/Action`;
  const payloadEmpresa = {
    "Action": "Add",
    "Properties": { "Locale": "es-MX" },
    "Rows": [{
      "ID_Empresa": datos.id,
      "RFC": datos.empresa.rfc,
      "Representante_Legal": datos.empresa.representante,
      "Telefono": datos.empresa.telefono,
      "Email": datos.empresa.email,
      "Estatus_Actual": "Registrado - En revisión"
    }]
  };

  // 2. Sincronizar Sucursales
  const urlSucursales = `https://api.appsheet.com/api/v1/apps/${CONFIG.APPSHEET_APP_ID}/tables/Sucursales/Action`;
  const payloadSucursales = {
    "Action": "Add",
    "Properties": { "Locale": "es-MX" },
    "Rows": datos.sucursales.map((suc, i) => ({
      "ID_Sucursal": datos.id + '-S' + (i+1),
      "ID_Empresa": datos.id,
      "Nombre": suc.nombre,
      "Direccion": suc.direccion,
      "Latitud": suc.lat,
      "Longitud": suc.lng,
      "Horario": suc.horario,
      "Telefono_Local": suc.telefono,
      "Responsable": suc.responsable,
      "Cargo": suc.cargo
    }))
  };

  const commonOptions = {
    'method': 'post',
    'contentType': 'application/json',
    'headers': { 'ApplicationAccessKey': CONFIG.APPSHEET_ACCESS_KEY },
    'muteHttpExceptions': true
  };

  try {
    UrlFetchApp.fetch(urlEmpresa, {...commonOptions, payload: JSON.stringify(payloadEmpresa)});
    UrlFetchApp.fetch(urlSucursales, {...commonOptions, payload: JSON.stringify(payloadSucursales)});
  } catch (e) {
    console.error('Error sincronizando con AppSheet:', e);
  }
}

/**
 * Obtiene el estatus actual y datos de seguimiento completo
 */
function obtenerEstatusInsignia(idEmpresa) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);

    // 1. Buscar estatus
    const sheetEstatus = ss.getSheetByName('Estatus_Insignia');
    const dataEstatus = sheetEstatus.getDataRange().getValues();
    const estatusRow = dataEstatus.find(row => row[1] === idEmpresa);

    // 2. Buscar capacitaciones
    const sheetCap = ss.getSheetByName('Capacitaciones');
    const dataCap = sheetCap.getDataRange().getValues();
    const capacitaciones = dataCap.filter(row => row[1] === idEmpresa).map(row => ({
      id: row[0],
      fecha: row[2] ? Utilities.formatDate(new Date(row[2]), "GMT-6", "dd/MM/yyyy") : 'Pendiente',
      tipo: row[3],
      asistentes: row[4],
      evidencia: row[5]
    }));

    // 3. Buscar Plan de Trabajo
    const sheetPlan = ss.getSheetByName('Plan_Trabajo');
    const dataPlan = sheetPlan.getDataRange().getValues();
    const planTrabajo = dataPlan.filter(row => row[1] === idEmpresa).map(row => ({
      actividad: row[2],
      fecha: row[3] ? Utilities.formatDate(new Date(row[3]), "GMT-6", "dd/MM/yyyy") : 'Pendiente',
      responsable: row[4],
      estatus: row[5]
    }));

    // 4. Buscar sucursales
    const sheetSuc = ss.getSheetByName('Sucursales');
    const dataSuc = sheetSuc.getDataRange().getValues();
    const sucursales = dataSuc.filter(row => row[1] === idEmpresa).map(row => ({
      nombre: row[2],
      direccion: row[3],
      lat: row[4],
      lng: row[5],
      horario: row[6],
      telefono: row[7],
      responsable: row[8],
      cargo: row[9],
      estatus: estatusRow ? estatusRow[2] : 'Registrado'
    }));

    return {
      idEmpresa: idEmpresa,
      estatus: estatusRow ? estatusRow[2] : 'En revisión',
      progreso: calcularProgreso(estatusRow ? estatusRow[2] : 'Registrado'),
      capacitaciones: capacitaciones,
      planTrabajo: planTrabajo,
      sucursales: sucursales
    };
  } catch (e) {
    console.error('Error obteniendo estatus:', e);
    return {error: e.toString()};
  }
}

function calcularProgreso(estatus) {
  const niveles = {
    'Registrado': 10,
    'En revisión': 25,
    'Capacitación programada': 50,
    'Capacitación completada': 75,
    'Insignia Otorgada': 100
  };
  return niveles[estatus] || 15;
}

function logWebhook(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName('Logs_Webhook');
    sheet.appendRow([Utilities.getUuid(), new Date(), JSON.stringify(data), 'PROCESADO']);
  } catch (e) {}
}

function actualizarEstatusLocal(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const idEmpresa = data.ID_Empresa || (data.Rows && data.Rows[0].ID_Empresa);
  const nuevoEstatus = data.Estatus_Actual || (data.Rows && data.Rows[0].Estatus_Actual);

  if (!idEmpresa || !nuevoEstatus) return;

  // Actualizar en Estatus_Insignia
  const sheet = ss.getSheetByName('Estatus_Insignia');
  const db = sheet.getDataRange().getValues();
  for (let i = 1; i < db.length; i++) {
    if (db[i][1] === idEmpresa) {
      sheet.getRange(i + 1, 3).setValue(nuevoEstatus);
      sheet.getRange(i + 1, 4).setValue(new Date());
      break;
    }
  }

  // Actualizar en Empresas
  const sheetEmp = ss.getSheetByName('Empresas');
  const dbEmp = sheetEmp.getDataRange().getValues();
  for (let i = 1; i < dbEmp.length; i++) {
    if (dbEmp[i][0] === idEmpresa) {
      sheetEmp.getRange(i + 1, 7).setValue(nuevoEstatus);
      break;
    }
  }
}

function logWebhook(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName('Logs_Webhook');
    sheet.appendRow([Utilities.getUuid(), new Date(), JSON.stringify(data), 'OK']);
  } catch (e) {}
}

function actualizarEstatusLocal(data) {
  // Lógica para actualizar las hojas locales basada en lo que envíe AppSheet
}

function generarCredencialPDF(idEmpresa) {
  // Simulación de generación de PDF
  return "https://example.com/credencial-" + idEmpresa + ".pdf";
}
