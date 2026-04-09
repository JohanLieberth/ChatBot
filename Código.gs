/**
 * Google Apps Script Backend for "Mujeres Seguras" Registration System
 */

function doGet(e) {
  var page = e.parameter.page || 'Index';
  return HtmlService.createTemplateFromFile(page)
      .evaluate()
      .setTitle('Sistema Mujeres Seguras')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * DATABASE OPERATIONS
 */

function getSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    // Create sheet if it doesn't exist (initial setup)
    sheet = ss.insertSheet(sheetName);
    const headers = getHeadersForSheet(sheetName);
    if (headers) {
      sheet.appendRow(headers);
    }
  }
  return sheet;
}

function getHeadersForSheet(sheetName) {
  const headers = {
    'Empresas_Registradas': ['Folio', 'RFC', 'Razon_Social', 'Representante_Legal', 'Email', 'Telefono', 'Fecha_Registro', 'Estatus', 'QR_URL', 'Fecha_Ultima_Modificacion', 'Token_Acceso'],
    'Sucursales': ['ID_Sucursal', 'Folio_Empresa', 'Nombre_Sucursal', 'Direccion', 'Latitud', 'Longitud', 'Horario_Texto', 'Horario_JSON', 'Telefono_Local', 'Responsable', 'Cargo', 'Fecha_Registro'],
    'Compromisos_Sucursales': ['ID_Sucursal', 'Protocolo_Acoso', 'Dictamen_PC', 'Area_Seguimiento', 'NOM_25', 'NOM_35', 'Fecha_Verificacion'],
    'Compromisos_Generales': ['Folio_Empresa', 'Acceso_Temporal', 'Espacio_Privado', 'Telefono_Emergencia', 'Internet_Autoridades', 'Distintivo_Visible', 'Fecha_Aceptacion'],
    'Plan_Trabajo': ['ID_Actividad', 'Folio_Empresa', 'Nombre_Actividad', 'Descripcion', 'Responsable', 'Fecha_Inicio', 'Fecha_Compromiso', 'Estatus', 'URL_Evidencias', 'Fecha_Registro_Actividad', 'Ultima_Modificacion'],
    'Usuarios_Admin': ['Email_Admin', 'Nombre', 'Rol', 'Permisos_JSON', 'Fecha_Creacion', 'Activo'],
    'Log_Cambios_Estatus': ['ID_Log', 'Folio_Empresa', 'Estatus_Anterior', 'Estatus_Nuevo', 'Cambiado_Por', 'Fecha_Cambio', 'Comentario']
  };
  return headers[sheetName];
}

/**
 * REGISTRATION PROCESS
 */
function processRegistration(formData) {
  try {
    const rfc = formData.fiscalData.rfc.toUpperCase();

    // Check if RFC already exists
    if (checkRFCExists(rfc)) {
      throw new Error('El RFC ya se encuentra registrado.');
    }

    const folio = generateFolio(rfc);
    const timestamp = new Date();

    // 1. Save Company
    const empresaSheet = getSheet('Empresas_Registradas');
    empresaSheet.appendRow([
      folio,
      rfc,
      formData.fiscalData.razonSocial,
      formData.fiscalData.representante,
      formData.fiscalData.email,
      formData.fiscalData.telefono,
      timestamp,
      'En revisión',
      '', // QR_URL will be set later if needed
      timestamp,
      Utilities.getUuid()
    ]);

    // 2. Save Branches and their Commitments
    const sucursalesSheet = getSheet('Sucursales');
    const compSucSheet = getSheet('Compromisos_Sucursales');

    formData.branches.forEach((branch, index) => {
      const branchId = folio + '-S' + (index + 1);
      sucursalesSheet.appendRow([
        branchId,
        folio,
        branch.nombre,
        branch.direccion,
        branch.lat,
        branch.lng,
        branch.horarioTexto,
        JSON.stringify(branch.horarioEstructurado),
        branch.telefono,
        branch.responsable,
        branch.cargo,
        timestamp
      ]);

      const branchComp = branch.compromisos;
      compSucSheet.appendRow([
        branchId,
        branchComp.protocolo,
        branchComp.proteccionCivil,
        branchComp.areaSeguimiento,
        branchComp.nom25,
        branchComp.nom35,
        timestamp
      ]);
    });

    // 3. Save General Commitments
    const compGenSheet = getSheet('Compromisos_Generales');
    const genComp = formData.generalCommitments;
    compGenSheet.appendRow([
      folio,
      genComp.accesoTemporal,
      genComp.espacioPrivado,
      genComp.telefonoEmergencia,
      genComp.internetAutoridades,
      genComp.distintivoVisible,
      timestamp
    ]);

    // 4. Send Email
    sendConfirmationEmail(formData.fiscalData.email, folio, formData.fiscalData.razonSocial);

    return {
      success: true,
      folio: folio,
      message: 'Registro completado exitosamente.'
    };
  } catch (error) {
    return {
      success: false,
      message: error.toString()
    };
  }
}

function checkRFCExists(rfc) {
  const sheet = getSheet('Empresas_Registradas');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const data = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  rfc = rfc.toUpperCase().trim();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0].toString().toUpperCase().trim() === rfc) return true;
  }
  return false;
}

function generateFolio(rfc) {
  const year = new Date().getFullYear();
  const shortRfc = rfc.substring(0, 6);
  const timestamp = Math.floor(Date.now() / 1000);
  return `MS-${year}-${shortRfc}-${timestamp}`;
}

function sendConfirmationEmail(email, folio, razonSocial) {
  const subject = `Confirmación de Registro - Mujeres Seguras - ${folio}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px;">
      <h2 style="color: #6B2C91;">¡Registro Exitoso!</h2>
      <p>Estimado/a representante de <strong>${razonSocial}</strong>,</p>
      <p>Su registro en el programa "Mujeres Seguras" ha sido recibido correctamente.</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
        <span style="font-size: 14px; color: #666;">Su Folio de Registro es:</span><br>
        <strong style="font-size: 24px; color: #6B2C91;">${folio}</strong>
      </div>
      <p><strong>Siguientes pasos:</strong></p>
      <ol>
        <li>Su solicitud entrará en un proceso de revisión por parte de nuestro equipo.</li>
        <li>Podrá acceder a su panel de empresa utilizando su RFC para dar seguimiento y cargar su plan de trabajo.</li>
        <li>Recibirá notificaciones por este medio sobre cualquier cambio en su estatus.</li>
      </ol>
      <p>Conserve este correo y su folio para futuras referencias.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #999; text-align: center;">Este es un mensaje automático, por favor no responda a este correo.</p>
    </div>
  `;

  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: htmlBody
  });
}

/**
 * RE-ENTRY AND WORK PLAN
 */
function getEmpresaBranches(folio) {
  const sheet = getSheet('Sucursales');
  const data = sheet.getDataRange().getValues();
  const branches = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === folio) {
      branches.push({
        nombre: data[i][2],
        direccion: data[i][3],
        lat: data[i][4],
        lng: data[i][5],
        telefono: data[i][8],
        responsable: data[i][9]
      });
    }
  }
  return branches;
}

function validateRFC(rfc) {
  const userEmail = Session.getActiveUser().getEmail() || 'anonymous';
  const props = PropertiesService.getUserProperties();
  const attemptsKey = 'login_attempts_' + userEmail;
  const lastAttemptKey = 'last_attempt_' + userEmail;

  let attempts = parseInt(props.getProperty(attemptsKey) || '0');
  const lastAttempt = parseInt(props.getProperty(lastAttemptKey) || '0');
  const now = Date.now();

  // Reset attempts after 15 minutes
  if (now - lastAttempt > 15 * 60 * 1000) {
    attempts = 0;
  }

  if (attempts >= 3) {
    return { success: false, message: 'Demasiados intentos. Intente de nuevo en 15 minutos.' };
  }

  props.setProperty(attemptsKey, (attempts + 1).toString());
  props.setProperty(lastAttemptKey, now.toString());

  const sheet = getSheet('Empresas_Registradas');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1].toUpperCase() === rfc.toUpperCase()) {
      return {
        success: true,
        empresa: {
          folio: data[i][0],
          rfc: data[i][1],
          razonSocial: data[i][2],
          estatus: data[i][7]
        }
      };
    }
  }
  return { success: false, message: 'RFC no encontrado. Verifique o regístrese.' };
}

function getWorkPlan(folio) {
  const sheet = getSheet('Plan_Trabajo');
  const data = sheet.getDataRange().getValues();
  const plan = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === folio) {
      plan.push({
        id: data[i][0],
        nombre: data[i][2],
        descripcion: data[i][3],
        responsable: data[i][4],
        fechaInicio: data[i][5],
        fechaCompromiso: data[i][6],
        estatus: data[i][7],
        evidencias: data[i][8]
      });
    }
  }
  return plan;
}

function saveWorkPlanActivity(activity) {
  const sheet = getSheet('Plan_Trabajo');
  const id = 'ACT-' + Utilities.getUuid().substring(0, 8);
  const timestamp = new Date();

  sheet.appendRow([
    id,
    activity.folio,
    activity.nombre,
    activity.descripcion,
    activity.responsable,
    activity.fechaInicio,
    activity.fechaCompromiso,
    activity.estatus || 'Planeado',
    activity.evidenciasUrl || '',
    timestamp,
    timestamp
  ]);

  return { success: true, id: id };
}

function uploadFile(data, fileName, folderName) {
  let rootFolder;
  const folders = DriveApp.getFoldersByName('Mujeres_Seguras_Evidencias');
  if (folders.hasNext()) {
    rootFolder = folders.next();
  } else {
    rootFolder = DriveApp.createFolder('Mujeres_Seguras_Evidencias');
  }

  let companyFolder;
  const companyFolders = rootFolder.getFoldersByName(folderName);
  if (companyFolders.hasNext()) {
    companyFolder = companyFolders.next();
  } else {
    companyFolder = rootFolder.createFolder(folderName);
  }

  const contentType = data.substring(5, data.indexOf(';'));
  const bytes = Utilities.base64Decode(data.substring(data.indexOf('base64,') + 7));
  const blob = Utilities.newBlob(bytes, contentType, fileName);
  const file = companyFolder.createFile(blob);

  return {
    url: file.getUrl(),
    id: file.getId()
  };
}
