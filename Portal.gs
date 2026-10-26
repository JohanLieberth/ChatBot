/**
 * Portal.gs - Client portal registration, login, and dashboard
 */

/**
 * Registers a new client portal user.
 */
function registrarClientePortal(payload) {
  var telefono = String(payload.Telefono || "").replace(/\D/g, "");
  var nombre = String(payload.Nombre || "").trim();
  var correo = String(payload.Correo || "").trim();
  var password = String(payload.Password || "").trim();

  if (!telefono || telefono.length !== 10) {
    throw new Error("El teléfono debe contener exactamente 10 dígitos.");
  }
  if (!nombre || !correo || !password) {
    throw new Error("Todos los campos (Nombre, Correo, Password) son obligatorios.");
  }

  return withLock(function() {
    var ss = getDbSpreadsheet();

    // Check if phone already registered in UsuariosPortal
    var usuarios = getSheetObjects("UsuariosPortal");
    var userExist = usuarios.filter(function(u) { return String(u.Telefono) === telefono; })[0];
    if (userExist) {
      throw new Error("El teléfono " + telefono + " ya tiene un usuario en el portal. Por favor inicie sesión.");
    }

    // Ensure Clientes record
    var clientesSheet = ss.getSheetByName("Clientes");
    var clientes = getSheetObjects("Clientes");
    var clientExist = clientes.filter(function(c) { return String(c.Telefono) === telefono; })[0];
    if (!clientExist) {
      clientesSheet.appendRow([telefono, nombre, correo, "Cliente"]);
    }

    // Insert UsuariosPortal
    var usuariosSheet = ss.getSheetByName("UsuariosPortal");
    var usuarioId = getNextId("UsuariosPortal", "UP");
    var passHash = hashPassword(password);
    var nowStr = formatDate(new Date(), "yyyy-MM-dd HH:mm:ss");

    var newUsuario = {
      UsuarioID: usuarioId,
      Telefono: telefono,
      Nombre: nombre,
      Activo: "Si",
      PasswordHash: passHash,
      FechaRegistro: nowStr
    };

    usuariosSheet.appendRow([
      usuarioId,
      telefono,
      nombre,
      "Si",
      passHash,
      nowStr
    ]);

    // Send Welcome Email
    enviarCorreo_(telefono, "", "Bienvenida", { Nombre: nombre });

    // Auto-create session
    var session = createClientSession(newUsuario);

    return {
      success: true,
      message: "Registro exitoso. Bienvenido a BitFix.",
      token: session.token,
      user: session.user
    };
  });
}

/**
 * Client portal login.
 */
function loginClientePortal(telefono, password) {
  telefono = String(telefono || "").replace(/\D/g, "");
  password = String(password || "").trim();

  if (!telefono || !password) {
    throw new Error("Ingrese su teléfono y contraseña.");
  }

  var usuarios = getSheetObjects("UsuariosPortal");
  var passHash = hashPassword(password);

  var user = usuarios.filter(function(u) {
    return String(u.Telefono) === telefono && String(u.PasswordHash) === passHash && String(u.Activo).toUpperCase() === "SI";
  })[0];

  if (!user) {
    throw new Error("Teléfono o contraseña incorrectos.");
  }

  var session = createClientSession(user);
  return {
    success: true,
    token: session.token,
    user: session.user
  };
}

/**
 * Gets Client Dashboard data (equipments, orders, points, NFC, payments).
 */
function getDashboardCliente(token) {
  var session = validateClientSession(token);
  var telefono = session.Telefono;

  var clientes = getSheetObjects("Clientes");
  var cliente = clientes.filter(function(c) { return String(c.Telefono) === telefono; })[0] || {};

  var ordenes = getSheetObjects("OrdenServicio").filter(function(o) {
    return String(o.Telefono) === telefono && String(o.Eliminada).toLowerCase() !== "si";
  });

  var ordenIds = ordenes.map(function(o) { return String(o.OrdenID); });

  var detalles = getSheetObjects("DetalleOrden").filter(function(d) {
    return ordenIds.indexOf(String(d.OrdenID)) !== -1;
  });

  var equipos = getSheetObjects("Equipos");
  var servicios = getSheetObjects("Servicios");

  var misEquipos = detalles.map(function(det) {
    var eq = equipos.filter(function(e) { return String(e.EquipoID) === String(det.EquipoID); })[0] || {};
    var srv = servicios.filter(function(s) { return String(s.DetalleID) === String(det.DetalleID); })[0] || {};
    var noSerieVal = eq["No.Serie"] || eq.NoSerie || "N/A";

    return {
      OrdenID: det.OrdenID,
      DetalleID: det.DetalleID,
      ServicioID: srv.ServicioID || "N/A",
      Equipo: (eq.Marca || "") + " " + (eq.Modelo || ""),
      NoSerie: noSerieVal,
      Estatus: det.Estatus,
      Diagnostico: srv.Diagnostico || "Pendiente",
      Solucion: srv.Solucion || "Pendiente",
      FechaLiberacion: formatDate(det.FechaLiberacion),
      CostoFinal: parseNumber(srv.CostoFinal) > 0 ? formatCurrency(srv.CostoFinal) : "Pendiente"
    };
  });

  // Saldo Puntos & History
  var saldos = getSheetObjects("SaldoPuntos");
  var saldoRow = saldos.filter(function(s) { return String(s.Telefono) === telefono; })[0];
  var saldoActual = saldoRow ? parseNumber(saldoRow.Saldo) : 0;

  var movs = getSheetObjects("MovimientosPuntos").filter(function(m) {
    return String(m.TelefonoCliente || m.Telefono) === telefono;
  });

  var acumulado = 0;
  var historialPuntos = movs.map(function(m) {
    var p = parseNumber(m.Puntos);
    acumulado += p;
    return {
      MovimientoID: m.MovimientoID,
      Fecha: formatDate(m.Fecha),
      Puntos: p,
      Concepto: m.Concepto,
      SaldoAcumulado: acumulado
    };
  }).reverse();

  // NFC UID
  var nfcs = getSheetObjects("NFC");
  var nfcRow = nfcs.filter(function(n) { return String(n.TelefonoCliente) === telefono; })[0];

  // Payments
  var pagos = getSheetObjects("Pagos").filter(function(p) {
    return ordenIds.indexOf(String(p.OrdenID)) !== -1;
  }).map(function(p) {
    return {
      PagoID: p.PagoID,
      OrdenID: p.OrdenID,
      Fecha: formatDate(p.Fecha),
      Importe: parseNumber(p.Importe),
      Concepto: p.Concepto
    };
  });

  return {
    Cliente: {
      Telefono: cliente.Telefono || telefono,
      Nombre: cliente.Nombre || session.Nombre,
      Correo: cliente.Correo || ""
    },
    Equipos: misEquipos,
    SaldoPuntos: saldoActual,
    HistorialPuntos: historialPuntos,
    NFC_UID: nfcRow ? nfcRow.UID : "Sin vincular",
    Pagos: pagos
  };
}
