/**
 * Auth.gs - Authentication & Authorization module for BitFix v3
 */

/**
 * Validates Google Session active user email against Admins sheet.
 * Returns admin object with roles or throws error if unauthorized.
 */
function getCurrentAdminUser() {
  var activeEmail = Session.getActiveUser().getEmail();
  var admins = getSheetObjects("Admins");

  if (!activeEmail) {
    throw new Error("Acceso denegado: No se detectó una sesión activa de Google con correo electrónico.");
  }

  var user = admins.filter(function(a) {
    return String(a.Email).toLowerCase() === activeEmail.toLowerCase() && String(a.Activo).toUpperCase() === "SI";
  })[0];

  if (!user) {
    throw new Error("Acceso denegado: El correo '" + activeEmail + "' no está autorizado en la tabla Admins.");
  }

  return user;
}

/**
 * Requires one of allowed roles or throws Error.
 */
function checkRole(allowedRoles) {
  var user = getCurrentAdminUser();
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
