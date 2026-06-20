/************************************************************
 * KLIENT KONNECT — DEALS + ORDERS WEB APP
 * (PRODUCTION SAFE + DEBUG LOGS + ES5 SAFE)
 *
 * GET:
 *  - returns validation dropdown arrays from "Deal Validation Tables"
 *
 * POST (text/plain or application/json):
 *  - { action: "updateDeal", data: {...} }   -> append to Deals sheet (log row)
 *  - { action: "createOrder", data: {...} }  -> upload files + append to Orders sheet
 *                                             + stamp Deal row with Order ID (log row)
 *  - { action: "updateOrder", data: {...} }  -> upload files (if any) + append to Orders sheet (log row)
 *
 * BACKWARD COMPATIBILITY:
 *  - If payload has NO action, treat it as updateDeal (old workflow)
 *
 * IMPORTANT:
 *  - appendRowByHeaders_ reads headers every time (order table changes safe)
 *  - file fields support legacy FILE_FIELDS + new fileObj.folderId
 *
 * DEBUGGING:
 *  - Writes debug logs to sheet: "WebApp Debug Log" (in ORDERS_SHEET_ID)
 ************************************************************/

/*************** CONFIG ***************/
var VALIDATION_SHEET_ID = "1YxYSLVuBrNOp8fYdA3s1dLzR3KFW0IaVMUvJ2AvY4aQ";
var VALIDATION_TAB_NAME = "Deal Validation Tables";

// Deals
var DEALS_SHEET_ID = "1GoZiI3HMDA_Ohkr50wwQlCiYWnT5EcNgDW3dWiZAJU4";
var DEALS_TAB_NAME = "Form responses 1";

// Orders
var ORDERS_SHEET_ID = "11hW2rcd5x4gmXFn2AO03FgOQ0Ec8wd3Ot8yTbAh7P2k";
var ORDERS_TAB_NAME = "Form responses 1";

// Debug log sheet (in Orders spreadsheet)
var DEBUG_SHEET_NAME = "WebApp Debug Log";

// Default upload folder (NEW)
var DEFAULT_UPLOAD_FOLDER_ID =
  "1NxWIZserHmgDu3HpWS1tTy050qh9XW1bgOPrccHMVQ9Vve74t4NWuoUf-DQOT93IU5MyxZ1N";

// Legacy per-field folders (still supported)
var FOLDER_ATTACH_BOQ = "1dXI9vWhur61T3jktX_kII0pAmdkj7kVYS7LSNG_6FajzRPIB4d6CArAGMOW53IlhajJ-rxJe";
var FOLDER_ATTACH_DRAWING = "1s8FA4XSOEsfNOq5l_qBqp_ZmjNsky6t3FYXGFGnK9V3kpCKNYDelljSes9irK-QIuKi4FdQM";
var FOLDER_ATTACH_PO = "17S79ELNAjYSoFxD3lJ-sytYQWGjCClkO37lEC2zACEGpdUVF8EqwA-AUq-V3xANzv4ZyKkls";
var FOLDER_PROFORMA = "1BEqgU_qkd4l5KHfltHZOWHR91go8XZUy";

// File-field header mapping (legacy)
var FILE_FIELDS = {
  "Attach Purchase Order": FOLDER_ATTACH_PO,
  "Attach Drawing": FOLDER_ATTACH_DRAWING,
  "Attach BOQ": FOLDER_ATTACH_BOQ,
  "Proforma Invoice": FOLDER_PROFORMA
};

// Optional aliases (if your Orders sheet header names change)
var FILE_FIELD_ALIASES = {
  // "PO Attachment": "Attach Purchase Order"
};

/*************** HELPERS ***************/
function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function text_(str) {
  return ContentService
    .createTextOutput(String(str))
    .setMimeType(ContentService.MimeType.TEXT);
}

function nowTimestamp_() {
  var now = new Date();
  return Utilities.formatDate(now, Session.getScriptTimeZone(), "dd-MM-yyyy HH:mm:ss");
}

function safeJsonParse_(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

/*************** DEBUG LOGGING ***************/
function ensureDebugSheet_() {
  var ss = SpreadsheetApp.openById(ORDERS_SHEET_ID);
  var sh = ss.getSheetByName(DEBUG_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(DEBUG_SHEET_NAME);

  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "Timestamp",
      "Action",
      "Stage",
      "Message",
      "Order ID",
      "Deal Name",
      "Field",
      "File Name",
      "File Size",
      "Folder ID",
      "Result",
      "Error",
      "Raw Payload (short)"
    ]);
    sh.setFrozenRows(1);
  }

  return sh;
}

function logDebug_(entry) {
  try {
    var sh = ensureDebugSheet_();
    var rawShort = "";

    try {
      if (entry && entry.raw) {
        rawShort = JSON.stringify(entry.raw);
        if (rawShort.length > 300) rawShort = rawShort.slice(0, 300);
      }
    } catch (eJson) {
      rawShort = "RAW_JSON_ERROR";
    }

    sh.appendRow([
      nowTimestamp_(),
      (entry && entry.action) || "",
      (entry && entry.stage) || "",
      (entry && entry.message) || "",
      (entry && entry.orderId) || "",
      (entry && entry.dealName) || "",
      (entry && entry.field) || "",
      (entry && entry.fileName) || "",
      (entry && entry.fileSize) || "",
      (entry && entry.folderId) || "",
      (entry && entry.result) || "",
      (entry && entry.error) || "",
      rawShort
    ]);
  } catch (e) {
    Logger.log("Debug log failure: " + e.toString());
  }
}

/*************** FILE HELPERS ***************/
function isFileHeader_(header) {
  if (FILE_FIELDS[header]) return true;
  var canonical = FILE_FIELD_ALIASES[header];
  if (canonical && FILE_FIELDS[canonical]) return true;
  return false;
}

function canonicalFileHeader_(header) {
  if (FILE_FIELDS[header]) return header;
  var canonical = FILE_FIELD_ALIASES[header];
  if (canonical && FILE_FIELDS[canonical]) return canonical;
  return header;
}

function resolveFolderId_(fieldName, fileObj) {
  var fromObj = "";
  if (fileObj && typeof fileObj === "object" && fileObj.folderId) {
    fromObj = String(fileObj.folderId).trim();
  }
  if (fromObj) return fromObj;

  var legacy = FILE_FIELDS[fieldName] ? String(FILE_FIELDS[fieldName]).trim() : "";
  if (legacy) return legacy;

  return String(DEFAULT_UPLOAD_FOLDER_ID || "").trim();
}

function uploadFileObject_(fileObj, folderId, prefix, label, context) {
  context = context || {};
  var orderId = context.orderId || "";
  var dealName = context.dealName || "";

  try {
    // If fileObj missing, don't touch fileObj.name/size
    if (!fileObj || typeof fileObj !== "object") {
      logDebug_({
        action: "upload",
        stage: "skip",
        message: "No file object provided",
        orderId: orderId,
        dealName: dealName,
        field: label,
        folderId: folderId,
        result: "SKIPPED"
      });
      return "";
    }

    var base64 = fileObj.base64 || "";

    if (!base64) {
      logDebug_({
        action: "upload",
        stage: "skip",
        message: "No base64 in file object (empty or too large marker)",
        orderId: orderId,
        dealName: dealName,
        field: label,
        fileName: fileObj.name ? String(fileObj.name) : "",
        fileSize: fileObj.size ? String(fileObj.size) : "",
        folderId: folderId,
        result: "SKIPPED"
      });
      return "";
    }

    logDebug_({
      action: "upload",
      stage: "begin",
      message: "Starting file upload",
      orderId: orderId,
      dealName: dealName,
      field: label,
      fileName: fileObj.name ? String(fileObj.name) : "",
      fileSize: fileObj.size ? String(fileObj.size) : "",
      folderId: folderId
    });

    var bytes = Utilities.base64Decode(base64);
    var contentType = fileObj.type || "application/octet-stream";
    var originalName = (fileObj.name || "file").toString();

    var safePrefix = prefix ? String(prefix).trim() : "UPLOAD";
    var safeLabel = label ? String(label).trim() : "";
    var stampedName = safeLabel
      ? (safePrefix + " - " + safeLabel + " - " + originalName)
      : (safePrefix + " - " + originalName);

    var blob = Utilities.newBlob(bytes, contentType, stampedName);
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(blob);
    var url = file.getUrl();

    logDebug_({
      action: "upload",
      stage: "success",
      message: "File uploaded successfully",
      orderId: orderId,
      dealName: dealName,
      field: label,
      fileName: fileObj.name ? String(fileObj.name) : "",
      fileSize: fileObj.size ? String(fileObj.size) : "",
      folderId: folderId,
      result: url
    });

    return url;
  } catch (err) {
    logDebug_({
      action: "upload",
      stage: "error",
      message: "Upload failed",
      orderId: orderId,
      dealName: dealName,
      field: label,
      fileName: (fileObj && fileObj.name) ? String(fileObj.name) : "",
      fileSize: (fileObj && fileObj.size) ? String(fileObj.size) : "",
      folderId: folderId,
      error: (err && err.toString) ? err.toString() : String(err),
      raw: { label: label, folderId: folderId }
    });
    throw err;
  }
}

/*************** SHEET APPEND ***************/
function appendRowByHeaders_(spreadsheetId, sheetName, dataObj, opts) {
  opts = opts || {};
  var uploadPrefix = opts.uploadPrefix || "UPLOAD";
  var ctx = opts.context || {};

  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error("Sheet not found: " + sheetName + " in " + spreadsheetId);

  var headers = getHeaders_(sh);
  var ts = nowTimestamp_();

  var row = headers.map(function (hRaw) {
    var h = String(hRaw);

    if (h === "Timestamp") return ts;

    var val = (dataObj && Object.prototype.hasOwnProperty.call(dataObj, h)) ? dataObj[h] : "";

    // alias fallback (for file fields)
    if ((val === "" || val == null) && FILE_FIELD_ALIASES[h]) {
      var canon = FILE_FIELD_ALIASES[h];
      if (dataObj && Object.prototype.hasOwnProperty.call(dataObj, canon)) {
        val = dataObj[canon];
      }
    }

    if (isFileHeader_(h)) {
      if (val && typeof val === "object") {
        var canonHeader = canonicalFileHeader_(h);
        var folderId = resolveFolderId_(canonHeader, val);
        var label = val.label || h;
        var url = uploadFileObject_(val, folderId, uploadPrefix, label, ctx);
        return url || "";
      }
      return (val != null) ? val : "";
    }

    return (val != null) ? val : "";
  });

  sh.appendRow(row);
  return { ok: true, headers: headers, timestamp: ts };
}

/*************** ACTION HANDLERS ***************/
function handleUpdateDeal_(payload) {
  var data = (payload && payload.data) ? payload.data : {};
  var dealsResult = appendRowByHeaders_(DEALS_SHEET_ID, DEALS_TAB_NAME, data, {
    uploadPrefix: "DEAL-UPDATE"
  });
  return { ok: true, dealsAppendedAt: dealsResult.timestamp };
}

function handleCreateOrder_(payload) {
  var data = (payload && payload.data) ? payload.data : {};
  var orderId = data["Order ID"] || "";
  if (!orderId) throw new Error("Missing Order ID in createOrder payload.");

  var accountId = data["Account ID"] || "";
  var dealName = data["Deal Name"] || "";

  var prefix =
    "ORD " + orderId +
    (dealName ? " - " + dealName : "") +
    (accountId ? " - " + accountId : "");

  logDebug_({
    action: "createOrder",
    stage: "start",
    message: "Order creation started",
    orderId: orderId,
    dealName: dealName,
    raw: { keys: Object.keys(data || {}).slice(0, 50) }
  });

  // 1) Orders append (+ uploads)
  var ordersResult = appendRowByHeaders_(ORDERS_SHEET_ID, ORDERS_TAB_NAME, data, {
    uploadPrefix: prefix,
    context: { orderId: orderId, dealName: dealName }
  });

  logDebug_({
    action: "createOrder",
    stage: "orders_appended",
    message: "Orders row appended",
    orderId: orderId,
    dealName: dealName,
    result: ordersResult.timestamp
  });

  // 2) Deals stamp (blank attachments)
  var stampData = {};
  var k;
  for (k in data) {
    if (Object.prototype.hasOwnProperty.call(data, k)) stampData[k] = data[k];
  }

  Object.keys(FILE_FIELDS).forEach(function (ff) { stampData[ff] = ""; });
  Object.keys(FILE_FIELD_ALIASES).forEach(function (alias) { stampData[alias] = ""; });

  var dealsStampResult = appendRowByHeaders_(DEALS_SHEET_ID, DEALS_TAB_NAME, stampData, {
    uploadPrefix: "DEAL-STAMP",
    context: { orderId: orderId, dealName: dealName }
  });

  logDebug_({
    action: "createOrder",
    stage: "deals_stamped",
    message: "Deals row stamped",
    orderId: orderId,
    dealName: dealName,
    result: dealsStampResult.timestamp
  });

  return {
    ok: true,
    orderId: orderId,
    ordersAppendedAt: ordersResult.timestamp,
    dealsStampedAt: dealsStampResult.timestamp
  };
}

function handleUpdateOrder_(payload) {
  var data = (payload && payload.data) ? payload.data : {};
  var orderId = data["Order ID"] || "";
  if (!orderId) throw new Error("Missing Order ID in updateOrder payload.");

  var accountId = data["Account ID"] || "";
  var dealName = data["Deal Name"] || "";

  var prefix =
    "ORD-UPDATE " + orderId +
    (dealName ? " - " + dealName : "") +
    (accountId ? " - " + accountId : "");

  logDebug_({
    action: "updateOrder",
    stage: "start",
    message: "Order update started",
    orderId: orderId,
    dealName: dealName
  });

  var ordersResult = appendRowByHeaders_(ORDERS_SHEET_ID, ORDERS_TAB_NAME, data, {
    uploadPrefix: prefix,
    context: { orderId: orderId, dealName: dealName }
  });

  logDebug_({
    action: "updateOrder",
    stage: "success",
    message: "Order update appended",
    orderId: orderId,
    dealName: dealName,
    result: ordersResult.timestamp
  });

  return { ok: true, orderId: orderId, ordersAppendedAt: ordersResult.timestamp };
}

/*************** PAYLOAD READER ***************/
function readPayload_(e) {
  var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "";
  var parsed = safeJsonParse_(raw);
  if (parsed) return { payload: parsed, raw: raw };

  var action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : "";
  var data = {};
  if (e && e.parameter && e.parameter.data) {
    var maybe = safeJsonParse_(e.parameter.data);
    if (maybe) data = maybe;
  }

  if (action) return { payload: { action: action, data: data }, raw: raw };

  return { payload: null, raw: raw };
}

/*************** WEB APP ***************/
function doGet(e) {
  var ss = SpreadsheetApp.openById(VALIDATION_SHEET_ID);
  var sheet = ss.getSheetByName(VALIDATION_TAB_NAME);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var output = {};

  headers.forEach(function (header, i) {
    var list = data
      .slice(1)
      .map(function (row) { return row[i]; })
      .filter(function (val) { return val !== "" && val != null; });
    output[header] = list;
  });

  return json_(output);
}

function doPost(e) {
  // ✅ heartbeat: confirms requests are reaching this deployment
  try {
    logDebug_({
      action: "doPost",
      stage: "hit",
      message: "doPost invoked",
      raw: {
        hasPostData: !!(e && e.postData),
        type: (e && e.postData && e.postData.type) ? e.postData.type : "",
        len: (e && e.postData && e.postData.contents) ? e.postData.contents.length : 0
      }
    });
  } catch (ignore) {}

  try {
    var p = readPayload_(e);
    var payload = p.payload;
    var raw = p.raw;

    if (!payload) {
      logDebug_({
        action: "doPost",
        stage: "bad_payload",
        message: "Payload not parsed and no action provided",
        raw: { rawLen: raw ? raw.length : 0 }
      });
      return text_("Error: Bad payload (no action, not JSON).");
    }

    var action = (payload.action || "").toString().trim();

    // Legacy route: object body without action => treat as updateDeal
    if (!action) {
      logDebug_({
        action: "legacyUpdateDeal",
        stage: "route",
        message: "No action provided; treating as updateDeal (legacy)",
        raw: { rawLen: raw ? raw.length : 0 }
      });

      var resLegacy = handleUpdateDeal_({ data: payload });
      return text_(JSON.stringify({
        legacy: true,
        ok: resLegacy.ok,
        dealsAppendedAt: resLegacy.dealsAppendedAt
      }));
    }

    if (action === "updateDeal") return text_(JSON.stringify(handleUpdateDeal_(payload)));
    if (action === "createOrder") return text_(JSON.stringify(handleCreateOrder_(payload)));
    if (action === "updateOrder") return text_(JSON.stringify(handleUpdateOrder_(payload)));

    logDebug_({
      action: action,
      stage: "unknown_action",
      message: 'Unknown action "' + action + '"',
      raw: payload
    });
    return text_('Error: Unknown action "' + action + '"');
  } catch (err) {
    logDebug_({
      action: "doPost",
      stage: "catch",
      message: "doPost exception",
      error: (err && err.toString) ? err.toString() : String(err)
    });
    return text_("Error: " + err.toString());
  }
}

/*************** ADMIN TEST ***************/
function kk_reauth_test() {
  var ss = SpreadsheetApp.openById(ORDERS_SHEET_ID);
  var sh = ss.getSheetByName(DEBUG_SHEET_NAME) || ss.insertSheet(DEBUG_SHEET_NAME);
  sh.getRange(1, 1).setValue("AUTH OK @ " + new Date());

  var folder = DriveApp.getFolderById(DEFAULT_UPLOAD_FOLDER_ID);
  Logger.log("Drive folder name: " + folder.getName());
}

function testDriveAccess() {
  var f = DriveApp.getFolderById(DEFAULT_UPLOAD_FOLDER_ID);
  Logger.log(f.getName());
}
