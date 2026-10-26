/**
 * NFC.gs - Module for binding, unbinding, and querying NFC UIDs
 */

/**
 * Binds an NFC UID to a client's phone number.
 */
function vincularNFC(uid, telefono, reasignar) {
  checkRole(["Administrador", "Recepcion"]);

  return withLock(function() {
    var ss = getDbSpreadsheet();
    uid = String(uid || "").trim().toUpperCase();
    telefono = String(telefono || "").replace(/\D/g, "");

    if (!uid || !telefono) {
      throw new Error("El UID de la tarjeta NFC y el teléfono son obligatorios.");
    }

    var nfcSheet = ss.getSheetByName("NFC");
    var listNfc = getSheetObjects("NFC");

    var existingUid = listNfc.filter(function(n) { return String(n.UID).toUpperCase() === uid; })[0];

    if (existingUid && String(existingUid.TelefonoCliente) !== telefono) {
      if (!reasignar) {
        throw new Error("El UID " + uid + " ya está vinculado al teléfono " + existingUid.TelefonoCliente + ". ¿Desea reasignarlo?");
      } else {
        // Reassign existing row
        updateCellInSheet(nfcSheet, "NFC_ID", existingUid.NFC_ID, "TelefonoCliente", telefono);
        return { success: true, message: "Tarjeta NFC reasignada exitosamente al teléfono " + telefono + "." };
      }
    }

    if (existingUid && String(existingUid.TelefonoCliente) === telefono) {
      return { success: true, message: "Esta tarjeta NFC ya estaba vinculada a este cliente." };
    }

    // New binding
    var nfcId = getNextId("NFC", "NFC");
    nfcSheet.appendRow([
      nfcId,
      uid,
      telefono
    ]);

    return { success: true, message: "Tarjeta NFC vinculada exitosamente al teléfono " + telefono + "." };
  });
}

/**
 * Unbinds an NFC card by NFC_ID.
 */
function desvincularNFC(nfcId) {
  checkRole(["Administrador", "Recepcion"]);

  return withLock(function() {
    var ss = getDbSpreadsheet();
    var nfcSheet = ss.getSheetByName("NFC");
    deleteRowsMatching(nfcSheet, "NFC_ID", nfcId);
    return { success: true, message: "Tarjeta NFC desvinculada exitosamente." };
  });
}

/**
 * Gets full client profile by phone for NFC/User Management tab in Admin.
 */
function getInfoClienteNFC(telefono) {
  checkRole(["Administrador", "Recepcion"]);
  telefono = String(telefono || "").replace(/\D/g, "");

  if (!telefono) {
    throw new Error("Ingrese un número de teléfono para buscar.");
  }

  var clientes = getSheetObjects("Clientes");
  var cliente = clientes.filter(function(c) { return String(c.Telefono) === telefono; })[0];

  if (!cliente) {
    throw new Error("No se encontró ningún cliente registrado con el teléfono " + telefono);
  }

  var ordenes = getSheetObjects("OrdenServicio").filter(function(o) {
    return String(o.Telefono) === telefono && String(o.Eliminada).toLowerCase() !== "si";
  });

  var nfcs = getSheetObjects("NFC").filter(function(n) {
    return String(n.TelefonoCliente) === telefono;
  });

  var saldoPuntos = getSaldoPuntosCliente(telefono);
  var movsPuntos = getSheetObjects("MovimientosPuntos").filter(function(m) {
    return String(m.TelefonoCliente || m.Telefono) === telefono;
  }).map(function(m) {
    return {
      MovimientoID: m.MovimientoID,
      Fecha: formatDate(m.Fecha),
      Puntos: parseNumber(m.Puntos),
      Concepto: m.Concepto
    };
  });

  return {
    Cliente: cliente,
    Ordenes: ordenes.map(function(o) {
      return {
        OrdenID: o.OrdenID,
        Fecha: formatDate(o.FechaHoraRecepcion || o.FechaRecepcion),
        EstatusGeneral: o.EstatusGeneral,
        TotalFinal: parseNumber(o.TotalFinal)
      };
    }),
    NFCs: nfcs,
    SaldoPuntos: saldoPuntos,
    MovimientosPuntos: movsPuntos
  };
}
