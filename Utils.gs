/**
 * Utils.gs - Generic utilities for BitFix v3 GAS application
 */

/**
 * Returns the active spreadsheet instance.
 */
function getDbSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Lock wrapper to execute functions safely in concurrent environments.
 */
function withLock(callback) {
  var lock = LockService.getScriptLock();
  var acquired = false;
  try {
    acquired = lock.tryLock(30000);
  } catch (e) {
    acquired = false;
  }
  if (!acquired) {
    throw new Error("No se pudo obtener el bloqueo del sistema. Por favor reintente.");
  }
  try {
    return callback();
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {
      // Ignore release error
    }
  }
}

/**
 * Generates the next sequential ID for a given sheet and prefix.
 * e.g., getNextId('OrdenServicio', 'OS') => 'OS003'
 */
function getNextId(sheetName, prefix) {
  var ss = getDbSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return prefix + "001";
  }

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return prefix + "001";
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var maxNum = 0;
  var regex = new RegExp("^" + prefix + "(\\d+)$", "i");

  for (var i = 0; i < values.length; i++) {
    var val = String(values[i][0]).trim();
    var match = val.match(regex);
    if (match) {
      var num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  var nextNum = maxNum + 1;
  var numStr = String(nextNum);
  while (numStr.length < 3) {
    numStr = "0" + numStr;
  }
  return prefix + numStr;
}

/**
 * Computes SHA-256 hash string for password storage/verification.
 */
function hashPassword(str) {
  if (!str) return "";
  var rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    str,
    Utilities.Charset.UTF_8
  );
  var txtHash = "";
  for (var i = 0; i < rawHash.length; i++) {
    var byteVal = rawHash[i];
    if (byteVal < 0) byteVal += 256;
    var byteStr = byteVal.toString(16);
    if (byteStr.length == 1) byteStr = "0" + byteStr;
    txtHash += byteStr;
  }
  return txtHash;
}

/**
 * Formats date object or date string according to timezone.
 */
function formatDate(dateObj, pattern) {
  if (!dateObj) return "";
  var d = (dateObj instanceof Date) ? dateObj : new Date(dateObj);
  if (isNaN(d.getTime())) return String(dateObj);
  var timeZone = Session.getScriptTimeZone() || "America/Mexico_City";
  var fmt = pattern || "dd/MM/yyyy HH:mm";
  return Utilities.formatDate(d, timeZone, fmt);
}

/**
 * Helper to parse row data as object using header array.
 */
function rowToObject(headers, row) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    var key = headers[i];
    if (key) {
      obj[key] = row[i] !== undefined ? row[i] : "";
    }
  }
  return obj;
}

/**
 * Helper to get all data from a sheet as an array of objects.
 */
function getSheetObjects(sheetName) {
  var ss = getDbSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var result = [];

  for (var r = 1; r < data.length; r++) {
    result.push(rowToObject(headers, data[r]));
  }
  return result;
}

/**
 * Parses currency or number safely.
 */
function parseNumber(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  var cleaned = String(val).replace(/[^0-9.-]+/g, "");
  var n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * Formats a number as USD / MXN currency string.
 */
function formatCurrency(val) {
  var n = parseNumber(val);
  return "$" + n.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, "$&,");
}

/**
 * Sanitizes input string to avoid basic injection or XSS.
 */
function sanitizeText(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
