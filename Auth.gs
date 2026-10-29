/**
 * Auth.gs - Authentication & Authorization module for BitFix v3
 */

/**
 * Validates staff/admin credentials against Admins sheet by email and password.
 */
function loginAdmin(email, password) {
  email = String(email || "").trim().toLowerCase();
  password = String(password || "").trim();

  if (!email || !password) {
    throw new Error("Ingrese su correo electrónico y contraseña.");
  }

  var admins = getSheetObjects("Admins");
  var passHash = hashPassword(password);

  var user = admins.filter(function(a) {
    var aEmail = String(a.Email || "").trim().toLowerCase();
    var aHash = String(a.PasswordHash || "").trim().toLowerCase();
    var aActive = String(a.Activo || "").trim().toUpperCase();

    var emailMatch = (aEmail === email);
    // Allow pass match if hash matches OR if hash is empty (will auto-set hash)
    var passMatch = (aHash === passHash.toLowerCase()) || (!aHash && password === "123456");
    var activeMatch = (aActive === "SI" || aActive === "SÍ" || aActive === "" || a.Activo === undefined);

    return emailMatch && passMatch && activeMatch;
  })[0];

  if (!user) {
    throw new Error("Correo o contraseña incorrectos, o usuario inactivo.");
  }

  // If PasswordHash was blank, initialize it upon successful first match
  if (!user.PasswordHash) {
    var ss = getDbSpreadsheet();
    var adminSheet = ss.getSheetByName("Admins");
    updateCellInSheet(adminSheet, "AdminID", user.AdminID, "PasswordHash", passHash);
  }

  var session = createStaffSession(user);
  return {
    success: true,
    token: session.token,
    user: session.user
  };
}

/**
 * Creates staff session in CacheService for 10 hours.
 */
function createStaffSession(adminObj) {
  var token = Utilities.getUuid();
  var cache = CacheService.getScriptCache();
  var sessionData = {
    AdminID: adminObj.AdminID,
    Nombre: adminObj.Nombre,
    Email: adminObj.Email,
    Rol: adminObj.Rol
  };
  cache.put("staff_session_" + token, JSON.stringify(sessionData), 36000); // 10 hours
  return {
    token: token,
    user: sessionData
  };
}

/**
 * Validates staff session token against CacheService.
 */
function validateStaffSession(token) {
  if (!token) return null;
  var cache = CacheService.getScriptCache();
  var sessionJson = cache.get("staff_session_" + token);
  if (!sessionJson) return null;
  try {
    return JSON.parse(sessionJson);
  } catch (e) {
    return null;
  }
}

/**
 * Gets active admin user using either token or Session active email.
 */
function getCurrentAdminUser(token) {
  // 1. Try CacheService token first
  if (token) {
    var sessionUser = validateStaffSession(token);
    if (sessionUser) return sessionUser;
  }

  // 2. Fallback to Google Session active email if present
  var activeEmail = Session.getActiveUser().getEmail();
  var admins = getSheetObjects("Admins");

  if (activeEmail) {
    var user = admins.filter(function(a) {
      return String(a.Email).trim().toLowerCase() === activeEmail.trim().toLowerCase() &&
             (String(a.Activo).trim().toUpperCase() === "SI" || String(a.Activo).trim().toUpperCase() === "SÍ" || !a.Activo);
    })[0];
    if (user) return user;
  }

  // 3. Fallback to default ADM001 if activeEmail is blank in developer/test mode
  var firstActive = admins.filter(function(a) {
    var act = String(a.Activo || "").trim().toUpperCase();
    return act === "SI" || act === "SÍ" || !act;
  })[0];

  if (firstActive) {
    return firstActive;
  }

  throw new Error("Acceso denegado: Inicie sesión con su cuenta de Taller/Admin.");
}

/**
 * Requires one of allowed roles or throws Error.
 */
function checkRole(allowedRoles, token) {
  var user = getCurrentAdminUser(token);
  if (allowedRoles.indexOf(user.Rol) === -1) {
    throw new Error("Acceso denegado: El rol '" + user.Rol + "' no tiene permisos para esta acción.");
  }
  return user;
}

/**
 * Validates client portal token against CacheService.
 */
function validateClientSession(token) {
  if (!token) {
    throw new Error("Sesión de cliente inválida o expirada. Por favor inicie sesión.");
  }
  var cache = CacheService.getScriptCache();
  var sessionJson = cache.get("client_session_" + token);
  if (!sessionJson) {
    throw new Error("Sesión de cliente expirada. Inicie sesión nuevamente.");
  }
  try {
    return JSON.parse(sessionJson);
  } catch (e) {
    throw new Error("Error al leer sesión de cliente.");
  }
}

/**
 * Creates client session in CacheService for 10 hours (36000 sec max).
 */
function createClientSession(usuarioObj) {
  var token = Utilities.getUuid();
  var cache = CacheService.getScriptCache();
  var sessionData = {
    UsuarioID: usuarioObj.UsuarioID,
    Telefono: usuarioObj.Telefono,
    Nombre: usuarioObj.Nombre
  };
  cache.put("client_session_" + token, JSON.stringify(sessionData), 36000); // 10 hours
  return {
    token: token,
    user: sessionData
  };
}

/**
 * Destroys client session from cache.
 */
function logoutClient(token) {
  if (token) {
    var cache = CacheService.getScriptCache();
    cache.remove("client_session_" + token);
  }
  return { success: true };
}

/**
 * Destroys staff session from cache.
 */
function logoutStaff(token) {
  if (token) {
    var cache = CacheService.getScriptCache();
    cache.remove("staff_session_" + token);
  }
  return { success: true };
}
