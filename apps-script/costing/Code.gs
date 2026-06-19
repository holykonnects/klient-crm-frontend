/************************************************************
 * RIDO COSTING ENGINE — MASTER BACKEND (UPDATED + FASTER)
 * Dynamic | No Hardcoding | Validation Driven
 *
 * ✅ INCLUDED (as before):
 * 1) Dynamic Cost Head columns in "Cost Sheet" synced from "Cost Validation" sheet headers
 * 2) Recompute head-wise totals + grand total into Cost Sheet row (by Cost Sheet ID)
 * 3) Entity dropdown endpoint (with SEARCH support):
 *    GET ?action=getEntities&type=Account|Deal|Project|Order&owner=...&role=...&q=...
 *    returns display:
 *    "Entity Name | Company | Mobile Number | Owner"
 *
 * ✅ PERFORMANCE UPGRADES (NEW):
 * A) Header sync runs ONLY when validation headers change (hash-based) + lock-protected
 * B) getCostSheets supports ?fields=... (lite fetch for faster table load/refresh)
 * C) getCostSheetDetails loads faster by scanning only ID column; optional 60s cache
 * D) recomputeCostSheetTotals reads ONLY required columns from line items (not full sheet)
 * E) addLineItem uses setValues instead of appendRow (faster)
 * F) Cache invalidation for modal details on POST mutations
 *
 * NOTE (NO-CORS APPROACH):
 * - For GET: JSONP supported via callback param.
 * - For POST from React, use fetch(..., mode:"no-cors", body: JSON.stringify(payload))
 ************************************************************/

const COSTING_SPREADSHEET_ID = '1S3pMki4TDiCBXdgkBGQ4qjyUUp9uo4mpMwQAUDvul6c';
const VALIDATION_SPREADSHEET_ID = '1YxYSLVuBrNOp8fYdA3s1dLzR3KFW0IaVMUvJ2AvY4aQ';

const COST_SHEET_TAB = 'Cost Sheet';
const COST_LINE_TAB = 'Cost Line Items';
const COST_VALIDATION_TAB = 'Cost Validation';
const EXPENSE_REQUESTS_TAB = 'Expense Requests';
/**
 * ENTITY SOURCES — NO ASSUMPTIONS:
 * Using ONLY what you provided.
 */
const ENTITY_SOURCES = {
  Account: {
    spreadsheetId: '1K9JT7C88oOVdAvapDOieWaiYj6Wd_XRZ1CCNiYzUhG8',
    sheetName: 'Qualified Leads'
  },
  Deal: {
    spreadsheetId: '1GoZiI3HMDA_Ohkr50wwQlCiYWnT5EcNgDW3dWiZAJU4',
    sheetName: 'Form responses 1'
  },
  Project: {
    spreadsheetId: '1L9yGqk0NCXDYAB7TeyOyXBEhSMs1f1aU0jbDOWzr9_s',
    sheetName: 'Project'
  },
  Order: {
    spreadsheetId: '11hW2rcd5x4gmXFn2AO03FgOQ0Ec8wd3Ot8yTbAh7P2k',
    sheetName: 'Form responses 1'
  }
};

/**
 * Validation headers we must ignore as "head columns"
 * Everything else in Cost Validation headers becomes a head column in Cost Sheet.
 */
const IGNORE_VALIDATION_HEADERS = {
  'Cost Heads': true,
  'Payment Status': true,
  'Active': true
};

/* =================== HELPERS =================== */

function log_(tag, obj) {
  try {
    Logger.log('[COST][' + tag + '] ' + JSON.stringify(obj));
  } catch (e) {
    Logger.log('[COST][' + tag + '] (unstringifiable)');
  }
}

function cache_() { return CacheService.getScriptCache(); }
function props_() { return PropertiesService.getScriptProperties(); }

function openSheet_(spreadsheetId, sheetName) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet not found: ' + sheetName);
  return sh;
}

function getHeaders_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(h => String(h || '').trim());
}

/**
 * ✅ Cached headers for speed (non-destructive)
 */
function getHeadersCached_(spreadsheetId, sheetName, ttlSec) {
  const key = "HDR::" + spreadsheetId + "::" + sheetName;
  const cache = cache_();
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  const sh = openSheet_(spreadsheetId, sheetName);
  const headers = getHeaders_(sh);

  cache.put(key, JSON.stringify(headers), ttlSec || 300);
  return headers;
}

function safeJsonParse_(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * JSONP response for NO-CORS browser GET
 * If callback missing -> plain JSON.
 */
function jsonOrJsonpResponse_(data, callback) {
  if (!callback) return jsonResponse_(data);

  const safeCb = String(callback || '')
    .replace(/[^\w.$]/g, ''); // basic sanitizer

  const body = safeCb + '(' + JSON.stringify(data) + ');';

  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function generateId_() {
  return 'CS-' + new Date().getTime();
}

function now_() {
  return new Date();
}

function toStr_(v) {
  return String(v == null ? '' : v).trim();
}

function toNum_(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[,₹\s]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function getAllRows_(sheet) {
  const headers = getHeaders_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || headers.length < 1) return { headers: headers, rows: [] };
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return { headers: headers, rows: values };
}

function findCol_(headers, candidates) {
  for (let i = 0; i < candidates.length; i++) {
    const idx = headers.indexOf(candidates[i]);
    if (idx >= 0) return idx;
  }
  return -1;
}

function isAdminRole_(role) {
  return String(role || '').toLowerCase() === 'admin';
}

/**
 * normalize timestamp for matching
 * Accepts Date | number | string.
 * Returns numeric millis (string->Date parse if possible) or ''.
 */
function normTs_(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v.getTime())) return v.getTime();
  if (typeof v === 'number' && isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return '';
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.getTime();
  const n = Number(s);
  if (!isNaN(n) && isFinite(n)) return n;
  return '';
}

/**
 * active check, case-insensitive
 */
function isActiveYes_(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (!s) return true; // if blank -> treat as active
  return s !== 'no';
}

function getExpenseRequestsSheet_() {
  return openSheet_(COSTING_SPREADSHEET_ID, EXPENSE_REQUESTS_TAB);
}

function generateBatchId_() {
  return 'BATCH-' + new Date().getTime();
}

function generateRequestId_() {
  return 'REQ-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000);
}

function getRowsAsObjects_(sheet) {
  const headers = getHeaders_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || !headers.length) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function buildRowFromHeaders_(headers, data) {
  return headers.map(h => (data && data[h] !== undefined) ? data[h] : '');
}

function getAttributionStatus_(row) {
  const hasEntity =
    toStr_(row['Linked Entity Type']) ||
    toStr_(row['Linked Entity ID']) ||
    toStr_(row['Linked Entity Name']);

  const hasCostSheet =
    toStr_(row['Existing Cost Sheet ID']) ||
    toStr_(row['Existing Cost Sheet Name']);

  if (hasEntity && hasCostSheet) return 'Fully Mapped';
  if (hasEntity) return 'Linked Entity Attached';
  if (hasCostSheet) return 'Cost Sheet Attached';
  return 'Unmapped';
}

/* =================== VALIDATION =================== */

function getCostValidation_() {
  const sheet = openSheet_(VALIDATION_SPREADSHEET_ID, COST_VALIDATION_TAB);
  const headers = getHeaders_(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || headers.length < 1) {
    return { heads: [], subcategories: {}, paymentStatus: [], validationHeaders: headers };
  }

  const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  const result = {
    heads: [],
    subcategories: {},
    paymentStatus: [],
    validationHeaders: headers
  };

  headers.forEach((header, colIndex) => {
    const h = String(header || '').trim();
    if (!h) return;

    const values = data
      .map(r => r[colIndex])
      .map(v => String(v || '').trim())
      .filter(v => v);

    if (h === 'Cost Heads') {
      result.heads = values;
    } else if (h === 'Payment Status') {
      result.paymentStatus = values;
    } else {
      // Every other column header is treated as a "Head Name" column => its subcategories
      result.subcategories[h] = values;
    }
  });

  return result;
}

/**
 * Dynamic head columns = headers in Cost Validation sheet except ignored
 */
function getDynamicHeadsFromValidationHeaders_() {
  const sheet = openSheet_(VALIDATION_SPREADSHEET_ID, COST_VALIDATION_TAB);
  const headers = getHeaders_(sheet);

  const out = [];
  const seen = {};
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').trim();
    if (!h) continue;
    if (IGNORE_VALIDATION_HEADERS[h]) continue;
    if (seen[h]) continue;
    seen[h] = true;
    out.push(h);
  }
  return out;
}

/**
 * cached dynamic heads for speed (non-destructive)
 */
function getDynamicHeadsCached_(ttlSec) {
  const key = "DYN_HEADS::COST_VALIDATION";
  const cache = cache_();
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  const heads = getDynamicHeadsFromValidationHeaders_();
  cache.put(key, JSON.stringify(heads), ttlSec || 300);
  return heads;
}

/* =================== FAST + SAFE SYNC GUARD (NEW) =================== */

function getValidationHeadsHash_() {
  const headers = getHeadersCached_(VALIDATION_SPREADSHEET_ID, COST_VALIDATION_TAB, 300);
  const heads = headers
    .map(h => String(h || '').trim())
    .filter(h => h && !IGNORE_VALIDATION_HEADERS[h]);

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    heads.join("||")
  );

  return Utilities.base64EncodeWebSafe(digest);
}

/**
 * ✅ Only sync Cost Sheet head columns if validation headers changed
 * Lock protected so concurrent requests don't race.
 */
function syncCostSheetHeadColumnsIfNeeded_() {
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);

  try {
    const currentHash = getValidationHeadsHash_();
    const key = "COST_VALIDATION_HEADS_HASH";
    const prevHash = props_().getProperty(key);

    if (prevHash && prevHash === currentHash) {
      return { success: true, skipped: true, reason: "no_change" };
    }

    const res = syncCostSheetHeadColumns_();

    props_().setProperty(key, currentHash);

    // Clear caches because sheet headers changed
    cache_().remove("HDR::" + COSTING_SPREADSHEET_ID + "::" + COST_SHEET_TAB);

    return { success: true, skipped: false, synced: true, res: res };
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

/* =================== COST SHEET HEAD SYNC (DYNAMIC COLUMNS) =================== */

/**
 * Ensures Cost Sheet sheet has one column for every head (from validation headers).
 * Adds missing head columns automatically (safe: never deletes anything).
 * Inserts head columns BEFORE "Grand Total" when present.
 */
function syncCostSheetHeadColumns_() {
  const sheet = openSheet_(COSTING_SPREADSHEET_ID, COST_SHEET_TAB);

  // speed: cached headers/heads
  const headers = getHeadersCached_(COSTING_SPREADSHEET_ID, COST_SHEET_TAB, 300);
  if (!headers.length) throw new Error('No headers found in sheet: ' + COST_SHEET_TAB);

  const heads = getDynamicHeadsCached_(300);

  // locate Grand Total (0-based)
  let grandIdx0 = headers.indexOf('Grand Total');
  const hasGrand = grandIdx0 >= 0;

  // existing header set
  const existing = {};
  headers.forEach(h => existing[String(h || '').trim()] = true);

  const added = [];

  for (let i = 0; i < heads.length; i++) {
    const headName = heads[i];
    if (existing[headName]) continue;

    if (hasGrand) {
      const grandCol1 = grandIdx0 + 1;
      sheet.insertColumnBefore(grandCol1);
      sheet.getRange(1, grandCol1, 1, 1).setValue(headName);
      grandIdx0 = grandIdx0 + 1;
    } else {
      sheet.insertColumnAfter(sheet.getLastColumn());
      sheet.getRange(1, sheet.getLastColumn(), 1, 1).setValue(headName);
    }

    added.push(headName);
  }

  if (added.length) log_('syncCostSheetHeadColumns_added', { added: added });
  return { success: true, added: added, headCount: heads.length };
}

/* =================== MODAL CACHE (NEW) =================== */

function getCostSheetDetailsCached_(costSheetId, ttlSec) {
  const key = "CS_DETAILS::" + String(costSheetId || "").trim();
  const c = cache_();

  try {
    const hit = c.get(key);
    if (hit) {
      const parsed = JSON.parse(hit);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    Logger.log("DETAIL CACHE READ ERROR: " + e);
  }

  const data = getCostSheetDetails_(costSheetId);

  // Cache only if safe; never let cache failure break modal loading
  try {
    const json = JSON.stringify(data);
    // CacheService has size limits; skip caching large payloads
    if (json.length < 90000) {
      c.put(key, json, ttlSec || 60);
    } else {
      Logger.log("DETAIL CACHE SKIPPED (too large) for costSheetId=" + costSheetId + " size=" + json.length);
    }
  } catch (e) {
    Logger.log("DETAIL CACHE WRITE ERROR: " + e);
  }

  return data;
}

function invalidateCostSheetDetailsCache_(costSheetId) {
  cache_().remove("CS_DETAILS::" + String(costSheetId || "").trim());
}

/* =================== COST TOTALS RECOMPUTE (FASTER) =================== */

/**
 * Recompute head-wise totals for a Cost Sheet ID based on Cost Line Items.
 * Writes into matching head columns + Grand Total + Last Calculated At
 *
 * ✅ Faster:
 * - Reads only the columns needed from line items (Cost Sheet ID, Head Name, Total/Amount, Active)
 * - Finds cost sheet row by scanning only Cost Sheet ID column
 */
function recomputeCostSheetTotals_(costSheetId) {
  if (!costSheetId) throw new Error("recomputeCostSheetTotals_ requires costSheetId");

  // Ensure columns exist (new heads auto-added) only if needed
  syncCostSheetHeadColumnsIfNeeded_();

  const cs = openSheet_(COSTING_SPREADSHEET_ID, COST_SHEET_TAB);
  const li = openSheet_(COSTING_SPREADSHEET_ID, COST_LINE_TAB);

  const csH = getHeadersCached_(COSTING_SPREADSHEET_ID, COST_SHEET_TAB, 300);
  const liH = getHeadersCached_(COSTING_SPREADSHEET_ID, COST_LINE_TAB, 300);

  const csIdIdx = csH.indexOf("Cost Sheet ID");
  if (csIdIdx < 0) throw new Error("Cost Sheet missing header: Cost Sheet ID");

  // Find summary row by scanning only ID column
  const csLastRow = cs.getLastRow();
  if (csLastRow < 2) throw new Error("Cost Sheet has no data rows");

  const csIds = cs.getRange(2, csIdIdx + 1, csLastRow - 1, 1)
    .getValues()
    .map(r => String(r[0] || '').trim());

  let summaryRowNumber = -1;
  for (let i = 0; i < csIds.length; i++) {
    if (csIds[i] === String(costSheetId)) { summaryRowNumber = i + 2; break; }
  }
  if (summaryRowNumber < 0) throw new Error("Cost Sheet ID not found in Cost Sheet: " + costSheetId);

  // Line item indices
  const liCostIdIdx = liH.indexOf("Cost Sheet ID");
  const liHeadIdx = liH.indexOf("Head Name");
  let liTotalIdx = liH.indexOf("Total Amount");
  if (liTotalIdx < 0) liTotalIdx = liH.indexOf("Amount");
  const liActiveIdx = liH.indexOf("Active");

  if (liCostIdIdx < 0) throw new Error("Cost Line Items missing header: Cost Sheet ID");
  if (liHeadIdx < 0) throw new Error("Cost Line Items missing header: Head Name");
  if (liTotalIdx < 0) throw new Error("Cost Line Items missing header: Total Amount (or Amount)");

  const liLastRow = li.getLastRow();
  if (liLastRow < 2) {
    // No line items; set totals to 0
    const rowValuesEmpty = cs.getRange(summaryRowNumber, 1, 1, csH.length).getValues()[0];
    const dynamicHeadsEmpty = getDynamicHeadsCached_(300);
    dynamicHeadsEmpty.forEach(h => {
      const idx = csH.indexOf(h);
      if (idx >= 0) rowValuesEmpty[idx] = 0;
    });
    const gtIdxEmpty = csH.indexOf("Grand Total");
    if (gtIdxEmpty >= 0) rowValuesEmpty[gtIdxEmpty] = 0;
    const lcIdxEmpty = csH.indexOf("Last Calculated At");
    if (lcIdxEmpty >= 0) rowValuesEmpty[lcIdxEmpty] = now_();
    cs.getRange(summaryRowNumber, 1, 1, csH.length).setValues([rowValuesEmpty]);

    return { success: true, costSheetId: costSheetId, grandTotal: 0, totalsByHead: {} };
  }

  // Read only needed columns
  const liCostIds = li.getRange(2, liCostIdIdx + 1, liLastRow - 1, 1).getValues();
  const liHeads = li.getRange(2, liHeadIdx + 1, liLastRow - 1, 1).getValues();
  const liTotals = li.getRange(2, liTotalIdx + 1, liLastRow - 1, 1).getValues();
  const liActives = (liActiveIdx >= 0)
    ? li.getRange(2, liActiveIdx + 1, liLastRow - 1, 1).getValues()
    : null;

  const dynamicHeads = getDynamicHeadsCached_(300);
  const totalsByHead = {};
  dynamicHeads.forEach(h => totalsByHead[h] = 0);

  let grandTotal = 0;

  for (let i = 0; i < liCostIds.length; i++) {
    if (String(liCostIds[i][0] || "").trim() !== String(costSheetId)) continue;
    if (liActives && !isActiveYes_(liActives[i][0])) continue;

    const head = toStr_(liHeads[i][0]);
    const amt = toNum_(liTotals[i][0]);

    if (totalsByHead.hasOwnProperty(head)) totalsByHead[head] += amt;
    grandTotal += amt;
  }

  const rowValues = cs.getRange(summaryRowNumber, 1, 1, csH.length).getValues()[0];

  dynamicHeads.forEach(headName => {
    const colIdx = csH.indexOf(headName);
    if (colIdx >= 0) rowValues[colIdx] = totalsByHead[headName] || 0;
  });

  const gtIdx = csH.indexOf("Grand Total");
  if (gtIdx >= 0) rowValues[gtIdx] = grandTotal;

  const lcIdx = csH.indexOf("Last Calculated At");
  if (lcIdx >= 0) rowValues[lcIdx] = now_();

  cs.getRange(summaryRowNumber, 1, 1, csH.length).setValues([rowValues]);

  log_('recomputeCostSheetTotals_done', { costSheetId: costSheetId, grandTotal: grandTotal });
  return { success: true, costSheetId: costSheetId, grandTotal: grandTotal, totalsByHead: totalsByHead };
}

/* =================== ENTITY DROPDOWN (LINKAGE) =================== */

/************************************************************
 * getEntities_(type, owner, role, q)
 * Covers Account + Deal + Project + Order using YOUR headers
 * Supports SEARCH via q (contains match across display fields)
 *
 * Output display:
 *   Entity Name | Company | Mobile Number | Owner
 ************************************************************/
function getEntities_(type, owner, role, q) {
  type = String(type || "").trim();
  if (!type || !ENTITY_SOURCES[type]) {
    return { success: false, error: "Invalid type. Use Account|Deal|Project|Order", type: type };
  }

  const src = ENTITY_SOURCES[type];
  if (!src.spreadsheetId || !src.sheetName) {
    return { success: false, error: type + " source not configured (missing spreadsheetId/sheetName)" };
  }

  const sh = openSheet_(src.spreadsheetId, src.sheetName);
  const data = getAllRows_(sh);
  const h = data.headers;
  const query = String(q || "").trim().toLowerCase();

  const idCandidates = [
    type + " ID",
    "Account ID",
    "Deal ID",
    "Project ID",
    "Order ID",
    "Lead ID",
    "Project ID (unique, auto-generated)",
    "Unique ID",
    "UID",
    "ID",
  ];

  const ownerCandidates = [
    "Owner",
    "Account Owner",
    "Lead Owner",
    "Deal Owner",
    "Project Owner",
    "Assigned Owner",
  ];

  let nameCandidates = [];
  if (type === "Account") {
    nameCandidates = ["Account Name", "Company", "Company Name"];
  } else if (type === "Project") {
    nameCandidates = ["Project Name"];
  } else if (type === "Deal") {
    nameCandidates = ["Deal Name", "Company", "Company Name"];
  } else if (type === "Order") {
    nameCandidates = ["Order Name", "Order Product Description", "Order Details", "Company", "Company Name", "Order ID"];
  }

  const companyCandidates = ["Company", "Company Name", "Client Name", "Account Name"];
  const mobileCandidates = ["Mobile Number", "Mobile", "Phone", "Contact Number"];

  const idIdx = findCol_(h, idCandidates);
  const ownerIdx = findCol_(h, ownerCandidates);
  const nameIdx = findCol_(h, nameCandidates);
  const companyIdx = findCol_(h, companyCandidates);
  const mobIdx = findCol_(h, mobileCandidates);

  const missing = [];
  if (idIdx < 0) missing.push("ID");
  if (nameIdx < 0) missing.push("Name");
  if (ownerIdx < 0) missing.push("Owner");

  if (missing.length) {
    return {
      success: false,
      error: "Missing required columns in " + type + " source: " + missing.join(", "),
      sheet: src.sheetName,
      spreadsheetId: src.spreadsheetId,
      availableHeaders: h,
    };
  }

  const admin = isAdminRole_(role);
  const out = [];
  const seen = {};

  for (let i = 0; i < data.rows.length; i++) {
    const r = data.rows[i];

    const id = toStr_(r[idIdx]);
    if (!id) continue;

    const rowOwner = toStr_(r[ownerIdx]);

    if (!admin) {
      const u = toStr_(owner).toLowerCase();
      if (u && u !== rowOwner.toLowerCase()) continue;
    }

    if (seen[id]) continue;
    seen[id] = true;

    const entityName = toStr_(r[nameIdx]);

    let company = companyIdx >= 0 ? toStr_(r[companyIdx]) : "";
    if (type === "Account") company = entityName || company;

    const mobile = mobIdx >= 0 ? toStr_(r[mobIdx]) : "";

    const display = [
      entityName || "(No Name)",
      company || "-",
      mobile || "-",
      rowOwner || "-",
    ].join(" | ");

    if (query) {
      const hay = [id, entityName, company, mobile, rowOwner, display].join(" | ").toLowerCase();
      if (!hay.includes(query)) continue;
    }

    out.push({
      id: id,
      display: display,
      entityName: entityName,
      company: company,
      mobile: mobile,
      owner: rowOwner,
    });
  }

  out.sort((a, b) => (a.display.toLowerCase() > b.display.toLowerCase() ? 1 : -1));
  return { success: true, type: type, count: out.length, entities: out };
}

/* =================== EXPORT HELPERS =================== */

function ymd_(d) {
  if (!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const da = String(dt.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + da;
}

function parseDateLoose_(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v;

  const s = String(v).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10) - 1;
    const yy = parseInt(m[3], 10);
    const hh = parseInt(m[4] || '0', 10);
    const mi = parseInt(m[5] || '0', 10);
    const ss = parseInt(m[6] || '0', 10);
    const d = new Date(yy, mm, dd, hh, mi, ss);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function inRangeInclusive_(d, fromD, toD) {
  if (!d) return false;
  const t = d.getTime();
  if (fromD && t < fromD.getTime()) return false;
  if (toD && t > toD.getTime()) return false;
  return true;
}

function csvEscape_(v) {
  const s = String(v == null ? '' : v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/**
 * EXPORT COSTING (Line Items extraction)
 * Filters supported:
 *  - costSheetId (Cost Sheet ID)
 *  - entityType (Linked Entity Type)
 *  - linkedEntityId (Linked Entity ID)
 *  - particular (contains)
 *  - paymentStatus (exact)
 *  - from/to (YYYY-MM-DD)
 *
 * format:
 *  - csv: direct download via HtmlService
 *  - xlsx/pdf: creates temp sheet + redirects to export
 */
function exportCosting_(params) {
  const format = String(params.format || 'csv').toLowerCase();

  const costSheetId = toStr_(params.costSheetId);
  const entityType = toStr_(params.entityType);
  const linkedEntityId = toStr_(params.linkedEntityId);
  const particular = toStr_(params.particular).toLowerCase();
  const paymentStatus = toStr_(params.paymentStatus);

  const fromStr = toStr_(params.from);
  const toStr2 = toStr_(params.to);
  const fromD = fromStr ? parseDateLoose_(fromStr + ' 00:00:00') : null;
  const toD = toStr2 ? parseDateLoose_(toStr2 + ' 23:59:59') : null;

  const li = openSheet_(COSTING_SPREADSHEET_ID, COST_LINE_TAB);
  const liData = getAllRows_(li);
  const h = liData.headers;

  let selectedHeaders = null;

  if (params.fields) {
    const raw = String(params.fields).trim();
    const parsed = safeJsonParse_(raw);

    if (Array.isArray(parsed)) {
      selectedHeaders = parsed.map(x => String(x || '').trim()).filter(Boolean);
    } else {
      selectedHeaders = raw.split(',').map(s => String(s || '').trim()).filter(Boolean);
    }

    selectedHeaders = selectedHeaders.filter(name => h.indexOf(name) >= 0);
    if (!selectedHeaders.length) selectedHeaders = null;
  }

  const idxCostSheetId = h.indexOf("Cost Sheet ID");
  const idxEntityType = h.indexOf('Linked Entity Type');
  const idxEntityId = h.indexOf('Linked Entity ID');
  const idxParticular = h.indexOf('Particular');
  const idxPay = h.indexOf('Payment Status');

  const idxExpense = h.indexOf('Expense Date');
  const idxEntryTs = h.indexOf('Entry Timestamp');
  const idxActive = h.indexOf('Active');

  const outRows = [];
  for (let i = 0; i < liData.rows.length; i++) {
    const r = liData.rows[i];

    if (idxActive >= 0) {
      const act = toStr_(r[idxActive]);
      if (act && act.toLowerCase() === 'no') continue;
    }

    if (costSheetId && idxCostSheetId >= 0 && toStr_(r[idxCostSheetId]) !== costSheetId) continue;

    if (entityType && idxEntityType >= 0 && toStr_(r[idxEntityType]) !== entityType) continue;
    if (linkedEntityId && idxEntityId >= 0 && toStr_(r[idxEntityId]) !== linkedEntityId) continue;

    if (paymentStatus && idxPay >= 0) {
      const rowPS = toStr_(r[idxPay]).toLowerCase();
      const want = toStr_(paymentStatus).toLowerCase();
      if (want && rowPS !== want) continue;
    }

    if (particular && idxParticular >= 0) {
      const p = toStr_(r[idxParticular]).toLowerCase();
      if (!p.includes(particular)) continue;
    }

    if (fromD || toD) {
      let dt = null;
      if (idxExpense >= 0) dt = parseDateLoose_(r[idxExpense]);
      if (!dt && idxEntryTs >= 0) dt = parseDateLoose_(r[idxEntryTs]);
      if (!inRangeInclusive_(dt, fromD, toD)) continue;
    }

    outRows.push(r);
  }

  if (format === 'csv') {
    const filename = 'Costing_Extraction_' + (ymd_(new Date()) || 'date') + '.csv';

    const exportHeaders = selectedHeaders || h;
    const exportIndexes = exportHeaders.map(name => h.indexOf(name));

    const lines = [];
    lines.push(exportHeaders.map(csvEscape_).join(','));

    outRows.forEach(r => {
      const rowOut = exportIndexes.map(ix => (ix >= 0 ? r[ix] : ""));
      lines.push(rowOut.map(csvEscape_).join(','));
    });

    const csv = lines.join('\n');

    const html = `
      <html>
        <head><meta charset="utf-8"/></head>
        <body>
          <script>
            (function(){
              var csv = ${JSON.stringify(csv)};
              var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
              var url = URL.createObjectURL(blob);
              var a = document.createElement("a");
              a.href = url;
              a.download = ${JSON.stringify(filename)};
              document.body.appendChild(a);
              a.click();
              setTimeout(function(){
                URL.revokeObjectURL(url);
                a.remove();
                document.body.innerHTML = "Download started: " + ${JSON.stringify(filename)};
              }, 300);
            })();
          </script>
        </body>
      </html>
    `;
    return HtmlService.createHtmlOutput(html);
  }

  const temp = SpreadsheetApp.create('TMP_Costing_Extraction_' + new Date().getTime());
  const sh = temp.getSheets()[0];
  sh.setName('Cost Line Items');

  const exportHeaders = selectedHeaders || h;
  const exportIndexes = exportHeaders.map(name => h.indexOf(name));

  if (exportHeaders.length) sh.getRange(1, 1, 1, exportHeaders.length).setValues([exportHeaders]);

  if (outRows.length && exportHeaders.length) {
    const mapped = outRows.map(r => exportIndexes.map(ix => (ix >= 0 ? r[ix] : "")));
    sh.getRange(2, 1, mapped.length, exportHeaders.length).setValues(mapped);
  }

  const ssId = temp.getId();
  let exportUrl = '';
  if (format === 'xlsx') {
    exportUrl = 'https://docs.google.com/spreadsheets/d/' + ssId + '/export?format=xlsx';
  } else if (format === 'pdf') {
    exportUrl = 'https://docs.google.com/spreadsheets/d/' + ssId + '/export?format=pdf&gid=' + sh.getSheetId();
  } else {
    exportUrl = 'https://docs.google.com/spreadsheets/d/' + ssId + '/export?format=xlsx';
  }

  return HtmlService.createHtmlOutput(
    '<html><head><meta http-equiv="refresh" content="0;url=' + exportUrl + '"/></head><body>Downloading…</body></html>'
  );
}

/* =================== GET ROUTER =================== */

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : '';
  const callback = (e && e.parameter && e.parameter.callback) ? String(e.parameter.callback) : '';

  try {
    // ✅ Only sync when needed (avoids expensive work on every request)
    const needsSync = (
      action === 'getValidation' ||
      action === 'recomputeTotals' ||
      action === 'exportCosting' ||
      action === 'exportCostSheetLineItems' ||
      action === 'exportFinance'
    );
    if (needsSync) syncCostSheetHeadColumnsIfNeeded_();

    if (action === 'getValidation') {
      return jsonOrJsonpResponse_(getCostValidation_(), callback);
    }

    if (action === 'getCostSheets') {
      // ✅ Supports lite fetch: ?fields=Cost Sheet ID,Grand Total,...
      return jsonOrJsonpResponse_(getCostSheets_(e.parameter.fields), callback);
    }

    if (action === 'getCostSheetDetails') {
      const costSheetId = e.parameter.costSheetId ? String(e.parameter.costSheetId) : '';
      try {
        const details = getCostSheetDetailsCached_(costSheetId, 60);
        return jsonOrJsonpResponse_(Array.isArray(details) ? details : [], callback);
      } catch (err) {
        Logger.log("GET_COST_SHEET_DETAILS ERROR for " + costSheetId + ": " + err);
        return jsonOrJsonpResponse_([], callback);
      }
    }

    if (action === 'searchCostLineItems') {
      return jsonOrJsonpResponse_(searchCostLineItems_(e.parameter || {}), callback);
    }

    if (action === 'getExpenseRequests') {
      return jsonOrJsonpResponse_(getExpenseRequests_(e.parameter || {}), callback);
    }

    if (action === 'getExpenseApprovalQueue') {
      return jsonOrJsonpResponse_(getExpenseApprovalQueue_(), callback);
    }

    if (action === 'getExpenseAccountsQueue') {
      return jsonOrJsonpResponse_(getExpenseAccountsQueue_(), callback);
    }

    if (action === 'getCostSheetsForMapping') {
      return jsonOrJsonpResponse_(getCostSheetsForMapping_(), callback);
    }

    if (action === 'getLinkedEntitiesForMapping') {
      return jsonOrJsonpResponse_(getLinkedEntitiesForMapping_(), callback);
    }

    if (action === 'getEntities') {
      const type = e.parameter.type ? String(e.parameter.type) : '';
      const owner = e.parameter.owner ? String(e.parameter.owner) : '';
      const role = e.parameter.role ? String(e.parameter.role) : '';
      const q = e.parameter.q ? String(e.parameter.q) : '';
      return jsonOrJsonpResponse_(getEntities_(type, owner, role, q), callback);
    }

    if (action === 'recomputeTotals') {
      const costSheetId = e.parameter.costSheetId ? String(e.parameter.costSheetId) : '';
      const res = recomputeCostSheetTotals_(costSheetId);
      // totals changed => invalidate modal cache
      invalidateCostSheetDetailsCache_(costSheetId);
      return jsonOrJsonpResponse_(res, callback);
    }

    if (action === 'exportCosting') {
      return exportCosting_({
        format: e.parameter.format,
        fields: e.parameter.fields,
        costSheetId: e.parameter.costSheetId,
        entityType: e.parameter.entityType,
        linkedEntityId: e.parameter.linkedEntityId,
        particular: e.parameter.particular,
        paymentStatus: e.parameter.paymentStatus,
        from: e.parameter.from,
        to: e.parameter.to
      });
    }

    if (action === 'exportCostSheetLineItems') {
      const costSheetId = e.parameter.costSheetId ? String(e.parameter.costSheetId).trim() : '';
      if (!costSheetId) return jsonOrJsonpResponse_({ success: false, error: 'costSheetId required' }, callback);

      return exportCosting_({
        format: e.parameter.format || 'csv',
        fields: e.parameter.fields,
        costSheetId: costSheetId
      });
    }

    if (action === "exportFinance") {
      const normalized = normalizeFinanceExportParams_(e);

      const format = String(normalized.format || "csv").toLowerCase();
      const from = normalized.from || "";
      const to = normalized.to || "";

      if (format === "xlsx") {
        const info = exportFinanceXLSX_({ parameter: normalized });

        return ContentService
          .createTextOutput(JSON.stringify({
            success: true,
            format: "xlsx",
            downloadUrl: info.downloadUrl,
            viewUrl: info.viewUrl,
            fileName: info.fileName
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const csv = exportFinanceCSV_({ parameter: normalized });
      const filename = `finance_${from || "all"}_${to || "all"}.csv`;

      if (String(normalized.dl || "") === "1") {
        return csvDownloadHtml_(csv, filename);
      }

      return ContentService
        .createTextOutput(csv)
        .setMimeType(ContentService.MimeType.CSV);
    }

    return jsonOrJsonpResponse_({ error: 'Invalid GET action', action: action }, callback);

  } catch (err) {
    log_('doGet_error', { action: action, error: String(err), stack: err && err.stack });
    return jsonOrJsonpResponse_({ error: String(err), action: action }, callback);
  }
}

/* =================== COST SHEETS (HEADER) =================== */

/**
 * ✅ Supports ?fields=... (comma list) or JSON array string
 */
function getCostSheets_(fields) {
  const sheet = openSheet_(COSTING_SPREADSHEET_ID, COST_SHEET_TAB);
  const headers = getHeadersCached_(COSTING_SPREADSHEET_ID, COST_SHEET_TAB, 300);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || headers.length < 1) return [];

  let selectedHeaders = headers;

  if (fields) {
    const raw = String(fields).trim();
    const parsed = safeJsonParse_(raw);

    const wanted = Array.isArray(parsed)
      ? parsed.map(x => String(x || "").trim())
      : raw.split(",").map(s => String(s || "").trim());

    const filtered = wanted.filter(h => headers.indexOf(h) >= 0);
    if (filtered.length) selectedHeaders = filtered;
  }

  const colIndexes = selectedHeaders.map(h => headers.indexOf(h)); // 0-based
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  return values.map(row => {
    const obj = {};
    selectedHeaders.forEach((h, i) => obj[h] = row[colIndexes[i]]);
    return obj;
  });
}

function createCostSheet_(data) {
  // Ensure headers exist if validation changed
  syncCostSheetHeadColumnsIfNeeded_();

  const sheet = openSheet_(COSTING_SPREADSHEET_ID, COST_SHEET_TAB);
  const headers = getHeaders_(sheet);
  if (!headers.length) throw new Error('No headers found in sheet: ' + COST_SHEET_TAB);

  const costSheetId = generateId_();

  const row = headers.map(h => {
    if (h === 'Cost Sheet ID') return costSheetId;
    if (h === 'Timestamp') return now_();
    if (h === 'Grand Total') return 0;
    return (data && data[h] !== undefined) ? data[h] : '';
  });

  sheet.appendRow(row);

  recomputeCostSheetTotals_(costSheetId);
  invalidateCostSheetDetailsCache_(costSheetId);

  return { success: true, costSheetId: costSheetId };
}

/* =================== LINE ITEMS =================== */

/**
 * ✅ Faster modal load:
 * - scans only "Cost Sheet ID" column to find matching rows
 * - then fetches only those row(s)
 */
function getCostSheetDetails_(costSheetId) {
  costSheetId = String(costSheetId || "").trim();
  if (!costSheetId) return [];

  const sheet = openSheet_(COSTING_SPREADSHEET_ID, COST_LINE_TAB);
  const headers = getHeadersCached_(COSTING_SPREADSHEET_ID, COST_LINE_TAB, 300);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || headers.length < 1) return [];

  const idIdx0 = headers.indexOf("Cost Sheet ID");
  if (idIdx0 < 0) throw new Error('Cost Line Items missing header: Cost Sheet ID');

  // Read only ID column
  const idCol = sheet.getRange(2, idIdx0 + 1, lastRow - 1, 1)
    .getValues()
    .map(r => String(r[0] || '').trim());

  const matchRows = [];
  for (let i = 0; i < idCol.length; i++) {
    if (idCol[i] === costSheetId) matchRows.push(i + 2);
  }
  if (!matchRows.length) return [];

  const out = [];
  for (let i = 0; i < matchRows.length; i++) {
    const rn = matchRows[i];
    const row = sheet.getRange(rn, 1, 1, headers.length).getValues()[0];
    const obj = {};
    headers.forEach((h, j) => obj[h] = row[j]);
    out.push(obj);
  }

  return out;
}

function addLineItem_(data) {
  Logger.log("==== ADD LINE ITEM START ====");
  Logger.log("Incoming data: " + JSON.stringify(data));

  const sheet = openSheet_(COSTING_SPREADSHEET_ID, COST_LINE_TAB);
  Logger.log("Opened sheet: " + COST_LINE_TAB);

  const headers = getHeaders_(sheet);
  Logger.log("Headers found: " + JSON.stringify(headers));

  if (!headers.length) {
    Logger.log("No headers found in Cost Line Items sheet");
    throw new Error("No headers found in Cost Line Items sheet");
  }

  const row = headers.map(h => {
    if (h === "Entry Timestamp") return now_();
    if (h === "Active") return "Yes";
    return data && data[h] !== undefined ? data[h] : "";
  });

  Logger.log("Final row to write: " + JSON.stringify(row));

  // ✅ Faster than appendRow
  const nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);

  Logger.log("Row written successfully at row: " + nextRow);

  const csId = (data && data["Cost Sheet ID"] !== undefined) ? String(data["Cost Sheet ID"]) : "";
  if (csId) {
    invalidateCostSheetDetailsCache_(csId);
    try {
      recomputeCostSheetTotals_(csId);
    } catch (reErr) {
      Logger.log("RECOMPUTE ERROR (non-fatal): " + reErr);
    }
  }

  return { success: true };
}

/**
 * ✅ FAST BATCH APPEND (single write, recompute once)
 */
function addLineItemsBatch_(data) {
  Logger.log("==== ADD LINE ITEMS BATCH START ====");
  Logger.log("Incoming data: " + JSON.stringify(data));

  if (!data || !Array.isArray(data.items) || !data.items.length) {
    throw new Error("addLineItemsBatch_ requires data.items array");
  }

  const sheet = openSheet_(COSTING_SPREADSHEET_ID, COST_LINE_TAB);
  const headers = getHeaders_(sheet);
  if (!headers.length) throw new Error("No headers found in Cost Line Items sheet");

  const startRow = sheet.getLastRow() + 1;
  const now = now_();

  const rowsToWrite = data.items.map((item) => {
    const rowObj = item || {};
    return headers.map((h) => {
      if (h === "Entry Timestamp") return now;
      if (h === "Active") return rowObj[h] !== undefined ? rowObj[h] : "Yes";
      return rowObj[h] !== undefined ? rowObj[h] : "";
    });
  });

  sheet.getRange(startRow, 1, rowsToWrite.length, headers.length).setValues(rowsToWrite);
  Logger.log("Batch rows written: " + rowsToWrite.length);

  const ids = {};
  const explicitId = data.costSheetId ? String(data.costSheetId).trim() : "";

  const idxCostId = headers.indexOf("Cost Sheet ID");
  if (explicitId) ids[explicitId] = true;

  if (!explicitId && idxCostId >= 0) {
    data.items.forEach((it) => {
      const id = it && it["Cost Sheet ID"] ? String(it["Cost Sheet ID"]).trim() : "";
      if (id) ids[id] = true;
    });
  }

  Object.keys(ids).forEach((csId) => {
    invalidateCostSheetDetailsCache_(csId);
    try {
      recomputeCostSheetTotals_(csId);
    } catch (reErr) {
      Logger.log("RECOMPUTE ERROR (non-fatal) for " + csId + ": " + reErr);
    }
  });

  Logger.log("==== ADD LINE ITEMS BATCH DONE ====");
  return { success: true, count: rowsToWrite.length, recomputed: Object.keys(ids) };
}

/**
 * ✅ audit-safe edit line item (soft delete + append)
 */
function updateLineItem_(data) {
  Logger.log("==== UPDATE LINE ITEM START ====");
  Logger.log("Incoming data: " + JSON.stringify(data));

  if (!data) throw new Error("updateLineItem_ requires data");

  const costSheetId = String(data.costSheetId || (data.updated && data.updated["Cost Sheet ID"]) || "").trim();
  if (!costSheetId) throw new Error("updateLineItem_ requires costSheetId");

  const original = data.original || {};
  const updated = data.updated || {};
  updated["Cost Sheet ID"] = costSheetId;

  softDeleteLineItem_({
    costSheetId: costSheetId,
    particular: original.particular,
    entryTimestamp: original.entryTimestamp
  });

  const res = addLineItem_(updated);

  invalidateCostSheetDetailsCache_(costSheetId);

  try {
    recomputeCostSheetTotals_(costSheetId);
  } catch (reErr) {
    Logger.log("RECOMPUTE ERROR (non-fatal): " + reErr);
  }

  Logger.log("==== UPDATE LINE ITEM DONE ====");
  return { success: true, costSheetId: costSheetId, updated: res };
}

function softDeleteLineItem_(data) {
  const sheet = openSheet_(COSTING_SPREADSHEET_ID, COST_LINE_TAB);
  const headers = getHeaders_(sheet);
  const values = sheet.getDataRange().getValues();

  const idIndex = headers.indexOf('Cost Sheet ID');
  const particularIndex = headers.indexOf('Particular');
  const activeIndex = headers.indexOf('Active');
  const entryTsIndex = headers.indexOf('Entry Timestamp');

  if (idIndex < 0 || particularIndex < 0 || activeIndex < 0) {
    throw new Error('Missing one of required columns: Cost Sheet ID / Particular / Active');
  }

  const targetId = String(data && data.costSheetId ? data.costSheetId : '').trim();
  const targetParticular = String(data && data.particular ? data.particular : '').trim();

  const targetEntryTsRaw = (data && data.entryTimestamp !== undefined) ? data.entryTimestamp : '';
  const targetEntryTs = normTs_(targetEntryTsRaw);

  if (!targetId) throw new Error('softDeleteLineItem requires costSheetId');
  if (!targetEntryTs && !targetParticular) {
    throw new Error('softDeleteLineItem requires either entryTimestamp or particular');
  }

  Logger.log("==== SOFT DELETE START ====");
  Logger.log("Target: " + JSON.stringify({ targetId: targetId, targetParticular: targetParticular, targetEntryTsRaw: targetEntryTsRaw, targetEntryTs: targetEntryTs }));

  let matchedRowNumber = -1;

  if (targetEntryTs && entryTsIndex >= 0) {
    for (let i = 1; i < values.length; i++) {
      const rowId = String(values[i][idIndex] || '').trim();
      if (rowId !== targetId) continue;

      const rowTs = normTs_(values[i][entryTsIndex]);
      if (rowTs && rowTs === targetEntryTs) {
        const isActive = isActiveYes_(values[i][activeIndex]);
        if (isActive) { matchedRowNumber = i + 1; break; }
        matchedRowNumber = i + 1;
      }
    }
  }

  if (matchedRowNumber < 0 && targetParticular) {
    for (let i = values.length - 1; i >= 1; i--) {
      const rowId = String(values[i][idIndex] || '').trim();
      const rowPart = String(values[i][particularIndex] || '').trim();
      if (rowId !== targetId) continue;
      if (rowPart !== targetParticular) continue;

      const isActive = isActiveYes_(values[i][activeIndex]);
      if (!isActive) continue;
      matchedRowNumber = i + 1;
      break;
    }

    if (matchedRowNumber < 0) {
      for (let i = 1; i < values.length; i++) {
        const rowId = String(values[i][idIndex] || '').trim();
        const rowPart = String(values[i][particularIndex] || '').trim();
        if (rowId === targetId && rowPart === targetParticular) {
          matchedRowNumber = i + 1;
          break;
        }
      }
    }
  }

  if (matchedRowNumber < 0) {
    Logger.log("SOFT DELETE: No matching row found.");
    return { success: false, error: "No matching row found to delete", targetId: targetId, targetParticular: targetParticular, targetEntryTs: targetEntryTsRaw };
  }

  sheet.getRange(matchedRowNumber, activeIndex + 1).setValue('No');

  const updatedAtIdx =
    headers.indexOf('Updated At') >= 0 ? headers.indexOf('Updated At')
    : headers.indexOf('Last Updated At') >= 0 ? headers.indexOf('Last Updated At')
    : headers.indexOf('Deleted At') >= 0 ? headers.indexOf('Deleted At')
    : -1;

  if (updatedAtIdx >= 0) {
    sheet.getRange(matchedRowNumber, updatedAtIdx + 1).setValue(now_());
  }

  invalidateCostSheetDetailsCache_(targetId);

  try {
    recomputeCostSheetTotals_(targetId);
  } catch (reErr) {
    Logger.log("RECOMPUTE ERROR (non-fatal): " + reErr);
  }

  Logger.log("==== SOFT DELETE DONE ====");
  return { success: true, matchedRow: matchedRowNumber };
}

/* =================== POST ROUTER =================== */

function doPost(e) {
  try {
    Logger.log("==== DOPOST START ====");
    Logger.log("Raw postData: " + (e && e.postData ? e.postData.contents : "NO POST DATA"));

    // ✅ Sync only if validation changed
    syncCostSheetHeadColumnsIfNeeded_();

    const raw = e && e.postData && e.postData.contents
      ? String(e.postData.contents)
      : "";

    const payload = safeJsonParse_(raw);

    Logger.log("Parsed payload: " + JSON.stringify(payload));

    if (!payload || !payload.action) {
      Logger.log("Invalid payload or missing action");
      return jsonResponse_({ success: false, error: "Invalid JSON or missing action" });
    }

    const action = String(payload.action);
    Logger.log("Action: " + action);

    if (action === "createCostSheet") {
      return jsonResponse_(createCostSheet_(payload.data || {}));
    }

    if (action === "addLineItem") {
      const d = payload.data || {};
      const csId = d && d["Cost Sheet ID"] ? String(d["Cost Sheet ID"]).trim() : "";
      if (csId) invalidateCostSheetDetailsCache_(csId);
      return jsonResponse_(addLineItem_(d));
    }

    if (action === "addLineItemsBatch") {
      const d = payload.data || {};
      if (d && d.costSheetId) invalidateCostSheetDetailsCache_(d.costSheetId);
      return jsonResponse_(addLineItemsBatch_(d));
    }

    if (action === "updateLineItem") {
      const d = payload.data || {};
      const csId = d && (d.costSheetId || (d.updated && d.updated["Cost Sheet ID"])) ? String(d.costSheetId || (d.updated && d.updated["Cost Sheet ID"])).trim() : "";
      if (csId) invalidateCostSheetDetailsCache_(csId);
      return jsonResponse_(updateLineItem_(d));
    }

    if (action === "softDeleteLineItem") {
      const d = payload.data || {};
      const csId = d && d.costSheetId ? String(d.costSheetId).trim() : "";
      if (csId) invalidateCostSheetDetailsCache_(csId);
      return jsonResponse_(softDeleteLineItem_(d));
    }

    if (action === "createCostSheetAndAddLineItem") {
      return jsonResponse_(createCostSheetAndAddLineItem_(payload.data || {}));
    }

    if (action === "createCostSheetAndAddLineItemsBatch") {
      return jsonResponse_(createCostSheetAndAddLineItemsBatch_(payload.data || {}));
    }

    if (action === "createExpenseRequestBatch") {
      return jsonResponse_(createExpenseRequestBatch_(payload.data || {}));
    }

    if (action === "updateExpenseRequestApproval") {
      return jsonResponse_(updateExpenseRequestApproval_(payload.data || {}));
    }

    if (action === "syncExpenseRequestToCostLine") {
      return jsonResponse_(syncExpenseRequestToCostLine_(payload.data || {}));
    }

    if (action === "bulkReviewExpenseRequests") {
      return jsonResponse_(bulkReviewExpenseRequests_(payload.data || {}));
    }

    if (action === "bulkUpdateExpenseRequestApproval") {
      return jsonResponse_(bulkUpdateExpenseRequestApproval_(payload.data || {}));
    }

    if (action === "bulkSyncExpenseRequestsToCostLine") {
      return jsonResponse_(bulkSyncExpenseRequestsToCostLine_(payload.data || {}));
    }

    Logger.log("Unknown action");
    return jsonResponse_({ success: false, error: "Invalid POST action" });

  } catch (err) {
    Logger.log("ERROR IN DOPOST: " + err);
    return jsonResponse_({ success: false, error: String(err) });
  }
}

/* =================== ATOMIC CREATE + FIRST LINE ITEM =================== */

function createCostSheetAndAddLineItem_(data) {
  Logger.log("==== CREATE COST SHEET + ADD LINE ITEM START ====");
  Logger.log("Incoming data: " + JSON.stringify(data));

  if (!data) throw new Error("Missing data for createCostSheetAndAddLineItem_");

  const costSheetData = data.costSheetData || {};
  const lineItemData = data.lineItemData || {};

  syncCostSheetHeadColumnsIfNeeded_();

  const created = createCostSheet_(costSheetData);
  const costSheetId = created && created.costSheetId ? String(created.costSheetId) : "";
  if (!costSheetId) throw new Error("Failed to generate Cost Sheet ID");

  lineItemData["Cost Sheet ID"] = costSheetId;
  if (lineItemData["Active"] === undefined) lineItemData["Active"] = "Yes";

  const added = addLineItem_(lineItemData);

  invalidateCostSheetDetailsCache_(costSheetId);

  try {
    recomputeCostSheetTotals_(costSheetId);
  } catch (reErr) {
    Logger.log("RECOMPUTE ERROR (non-fatal): " + reErr);
  }

  Logger.log("==== CREATE COST SHEET + ADD LINE ITEM DONE ====");
  return {
    success: true,
    costSheetId: costSheetId,
    created: created,
    lineItem: added
  };
}

/* =================== ATOMIC CREATE + MANY LINE ITEMS (FAST) =================== */

function createCostSheetAndAddLineItemsBatch_(data) {
  Logger.log("==== CREATE COST SHEET + ADD LINE ITEMS BATCH START ====");
  Logger.log("Incoming data: " + JSON.stringify(data));

  if (!data) throw new Error("Missing data for createCostSheetAndAddLineItemsBatch_");

  const costSheetData = data.costSheetData || {};
  const lineItems = Array.isArray(data.lineItems) ? data.lineItems : [];

  syncCostSheetHeadColumnsIfNeeded_();

  const created = createCostSheet_(costSheetData);
  const costSheetId = created && created.costSheetId ? String(created.costSheetId) : "";
  if (!costSheetId) throw new Error("Failed to generate Cost Sheet ID");

  if (!lineItems.length) {
    invalidateCostSheetDetailsCache_(costSheetId);
    return { success: true, costSheetId: costSheetId, created: created, count: 0 };
  }

  const items = lineItems.map((li) => {
    const obj = li || {};
    obj["Cost Sheet ID"] = costSheetId;
    if (obj["Active"] === undefined) obj["Active"] = "Yes";
    return obj;
  });

  const batch = addLineItemsBatch_({ costSheetId: costSheetId, items: items });

  invalidateCostSheetDetailsCache_(costSheetId);

  try {
    recomputeCostSheetTotals_(costSheetId);
  } catch (reErr) {
    Logger.log("RECOMPUTE ERROR (non-fatal): " + reErr);
  }

  Logger.log("==== CREATE COST SHEET + ADD LINE ITEMS BATCH DONE ====");
  return {
    success: true,
    costSheetId: costSheetId,
    created: created,
    batch: batch
  };
}

/* =================== EXPORT FINANCE (GROUP + PROJECT/DATE/HEAD/etc.) =================== */
/**
 * ✅ FIXED:
 * - exportFinanceCSV_ ALWAYS returns STRING CSV (never ContentService)
 * - Works whether called as exportFinanceCSV_(e) OR exportFinanceCSV_({ ...params })
 * - Date range filtering respects full-day end time (23:59:59)
 * - Date parsing works for Date objects + strings (prevents 0-row exports)
 * - Flat mode subtotal is per (Head+Subcategory+Date+Entity+Particular), not just Particular
 */
function exportFinanceCSV_(params) {
  // ✅ IMPORTANT: support both event object (e) and plain params object
  const p = (params && params.parameter) ? params.parameter : (params || {});

  const ss = SpreadsheetApp.openById(COSTING_SPREADSHEET_ID);
  const sh = ss.getSheetByName(COST_LINE_TAB);
  if (!sh) throw new Error("Sheet not found: " + COST_LINE_TAB);

  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return "No data\n";

  const headers = values[0].map(h => String(h || "").trim());
  const dataRows = values.slice(1);

  const idxAny = (candidates) => {
    for (let i = 0; i < candidates.length; i++) {
      const k = String(candidates[i] || "").trim();
      const ix = headers.indexOf(k);
      if (ix >= 0) return ix;
    }
    return -1;
  };

  const safe = (v) => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const toStrLocal = (v) => String(v ?? "").trim();

  const num = (x) => {
    const n = parseFloat(String(x ?? "").replace(/[,₹\s]/g, ""));
    return isNaN(n) ? 0 : n;
  };

  // ✅ robust date parse for Date objects + strings
  const parseDateAny_ = (v) => {
    if (!v && v !== 0) return null;
    if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) return v;

    // fallback to your existing parser
    const d = parseDateLoose_(v);
    if (d && !isNaN(d.getTime())) return d;

    // last resort: Date(string)
    const d2 = new Date(v);
    if (d2 && !isNaN(d2.getTime())) return d2;

    return null;
  };

  const fmtDate = (d) =>
    d ? Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd") : "";

  const parseDateOnly = (v) => {
    const d = parseDateAny_(v);
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  // --- REQUIRED/OPTIONAL COLS (tolerant) ---
  const H = {
    costSheetId: idxAny(["Cost Sheet ID"]),
    head: idxAny(["Head Name", "Head"]),
    subcategory: idxAny(["Subcategory", "Sub Category", "Sub-Category"]),
    expenseDate: idxAny(["Expense Date", "ExpenseDate"]),
    entryTs: idxAny(["Entry Timestamp", "Timestamp", "Entry TS"]),
    particular: idxAny(["Particular"]),
    details: idxAny(["Details", "Description"]),
    qty: idxAny(["QTY", "Qty", "Quantity"]),
    rate: idxAny(["Rate", "Unit Rate"]),
    amount: idxAny(["Amount"]),
    gstAmount: idxAny(["GST Amount", "GST Amt", "GST"]),
    totalAmount: idxAny(["Total Amount", "Total", "TotalAmount"]),
    attachment: idxAny(["Attachment Link", "Attachment", "Link"]),
    voucher: idxAny(["Voucher/Invoice No", "Voucher No", "Invoice No", "Voucher"]),
    paymentStatus: idxAny(["Payment Status", "PaymentStatus"]),
    active: idxAny(["Active"]),
    owner: idxAny(["Owner", "Entered By"]),
    entityType: idxAny(["Linked Entity Type"]),
    entityId: idxAny(["Linked Entity ID"]),
    entityName: idxAny(["Linked Entity Name"]),
    clientName: idxAny(["Client Name", "Client"]),
    projectType: idxAny(["Project Type"]),
  };

  if (H.totalAmount < 0 && H.amount >= 0) H.totalAmount = H.amount;

  const requiredForExport = [
    ["Cost Sheet ID", H.costSheetId],
    ["Particular", H.particular],
    ["Amount", H.amount],
    ["Total Amount (or Amount fallback)", H.totalAmount],
  ];

  const dateAvailable = (H.expenseDate >= 0) || (H.entryTs >= 0);
  const missing = requiredForExport.filter(x => x[1] < 0).map(x => x[0]);

  const fromParam = toStr_(p.from);
  const toParam = toStr_(p.to);
  const wantsDateRange = !!(fromParam || toParam);

  if (missing.length || (wantsDateRange && !dateAvailable)) {
    const outHeaders = [
      "Row Type","Group Path","Linked Entity Type","Linked Entity ID","Linked Entity Name",
      "Expense Date","Head Name","Subcategory","Particular",
      "Details","QTY","Rate",
      "Amount","GST Amount","Total Amount",
      "Voucher/Invoice No","Payment Status",
      "Cost Sheet ID","Owner","Client Name","Project Type","Attachment Link"
    ];

    const msg = []
      .concat(missing.length ? ["Missing required headers: " + missing.join(", ")] : [])
      .concat((wantsDateRange && !dateAvailable) ? ["Date range used but no Expense Date / Entry Timestamp column found"] : [])
      .join(" | ");

    const debugLine = [
      "ERROR",
      "HEADER_MISMATCH",
      "", "", "",
      "", "", "", "",
      msg,
      "", "",
      0, 0, 0,
      "", "",
      "", "", "", "", ""
    ];

    const csv = [outHeaders, debugLine, ["DEBUG_HEADERS"].concat(headers)]
      .map(r => r.map(safe).join(","))
      .join("\n");
    return csv + "\n";
  }

  // ---------- filters ----------
  const role = toStr_(p.role);

  const isAdminLocal = (() => {
    const r = String(role || "").toLowerCase().trim();
    if (!r) return false;
    if (r === "admin" || r === "super admin" || r === "superadmin") return true;
    try { return !!isAdminRole_(role); } catch (e) { return false; }
  })();

  const ownerFilter = toStr_(p.owner);

  const costSheetId = toStr_(p.costSheetId);
  const entityType = toStr_(p.entityType);
  const linkedEntityId = toStr_(p.linkedEntityId);
  const paymentStatusFilter = toStr_(p.paymentStatus);
  const headFilter = toStr_(p.head);
  const subcategoryFilter = toStr_(p.subcategory);
  const particularContains = toStr_(p.particular).toLowerCase();

  const activeOnly = String(p.activeOnly || "").toLowerCase() === "true";

  const fromD = fromParam ? parseDateAny_(fromParam + " 00:00:00") : null;
  const toD = toParam ? parseDateAny_(toParam + " 23:59:59") : null;

  // ---------- filter rows ----------
  const rows = [];
  for (const r of dataRows) {
    // active
    if (activeOnly && H.active >= 0) {
      const a = toStrLocal(r[H.active]).toLowerCase();
      if (a && a !== "yes" && a !== "true" && a !== "1") continue;
    } else if (H.active >= 0) {
      if (!isActiveYes_(r[H.active])) continue;
    }

    
   // role/owner filter only when ownerFilter is provided (prevents 0-row exports)
    if (!isAdminLocal && H.owner >= 0 && ownerFilter) {
      const rowOwner = toStrLocal(r[H.owner]);
      if (rowOwner.toLowerCase() !== ownerFilter.toLowerCase()) continue;
    }

    if (costSheetId && toStrLocal(r[H.costSheetId]) !== costSheetId) continue;
    if (entityType && H.entityType >= 0 && toStrLocal(r[H.entityType]) !== entityType) continue;
    if (linkedEntityId && H.entityId >= 0 && toStrLocal(r[H.entityId]) !== linkedEntityId) continue;

    if (paymentStatusFilter && H.paymentStatus >= 0) {
      if (toStrLocal(r[H.paymentStatus]).toLowerCase() !== paymentStatusFilter.toLowerCase()) continue;
    }

    if (headFilter && H.head >= 0 && toStrLocal(r[H.head]) !== headFilter) continue;
    if (subcategoryFilter && H.subcategory >= 0 && toStrLocal(r[H.subcategory]) !== subcategoryFilter) continue;

    if (particularContains) {
      const p0 = toStrLocal(r[H.particular]).toLowerCase();
      if (p0.indexOf(particularContains) === -1) continue;
    }

    // date range
    if (fromD || toD) {
      let dt = null;
      if (H.expenseDate >= 0) dt = parseDateAny_(r[H.expenseDate]);
      if (!dt && H.entryTs >= 0) dt = parseDateAny_(r[H.entryTs]);
      if (!dt) continue;
      if (!inRangeInclusive_(dt, fromD, toD)) continue;
    }

    rows.push(r);
  }

  /* =================== ✅ FLAT MODE (clean output) =================== */
  const flatOnly =
    String(p.flat || "").toLowerCase() === "1" ||
    String(p.flat || "").toLowerCase() === "true";

  if (flatOnly) {
    const subtotalByRaw = toStr_(p.subtotalBy || "Particular");
    const subtotalKeys = subtotalByRaw
      .split(/[|,]/)
      .map(s => String(s || "").trim())
      .filter(Boolean);

    const normKey = (k) => String(k || "").toLowerCase().replace(/\s+/g, "");

    const getSubtotalPart = (r, keyName) => {
      const k = normKey(keyName);

      if (k === "particular") {
        return toStrLocal(r[H.particular]) || "(Blank)";
      }

      if (k === "subcategory" || k === "subcategoryname") {
        return H.subcategory >= 0 ? (toStrLocal(r[H.subcategory]) || "(Blank)") : "(Blank)";
      }

      if (k === "head" || k === "headname") {
        return H.head >= 0 ? (toStrLocal(r[H.head]) || "(Blank)") : "(Blank)";
      }

      if (k === "date" || k === "expensedate") {
        let dt = null;
        if (H.expenseDate >= 0) dt = parseDateAny_(r[H.expenseDate]);
        if (!dt && H.entryTs >= 0) dt = parseDateAny_(r[H.entryTs]);
        return fmtDate(dt) || "(Blank)";
      }

      if (k === "linkedentityname" || k === "entity" || k === "entityname") {
        return H.entityName >= 0 ? (toStrLocal(r[H.entityName]) || "(Blank)") : "(Blank)";
      }

      return toStrLocal(r[H.particular]) || "(Blank)";
    };

    const subtotalKey = (r) => {
      if (!subtotalKeys.length) return getSubtotalPart(r, "Particular");
      return subtotalKeys.map(k => getSubtotalPart(r, k)).join(" | ");
    };

    const grouped = {};
    for (const r of rows) {
      const k = subtotalKey(r);
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(r);
    }

    const outHeaders = [
      "Row Type",
      "Head Name",
      "Subcategory",
      "Expense Date",
      "Particular",
      "Details",
      "Total Amount",
      "Sub Total",
      "Linked Entity Name",
      "Client Name"
    ];

    const csvRows = [outHeaders];

    const sortedKeys = Object.keys(grouped).sort((a, b) => String(a).localeCompare(String(b)));

    for (const k of sortedKeys) {
      const groupRows = grouped[k];
      let subtotal = 0;

      for (const r of groupRows) {
        let dt = null;
        if (H.expenseDate >= 0) dt = parseDateAny_(r[H.expenseDate]);
        if (!dt && H.entryTs >= 0) dt = parseDateAny_(r[H.entryTs]);
        const expenseDateStr = fmtDate(dt);

        const rowTotal = num(r[H.totalAmount]);
        subtotal += rowTotal;

        csvRows.push([
          "LINE",
          (H.head >= 0) ? toStrLocal(r[H.head]) : "",
          (H.subcategory >= 0) ? toStrLocal(r[H.subcategory]) : "",
          expenseDateStr,
          toStrLocal(r[H.particular]),
          (H.details >= 0) ? toStrLocal(r[H.details]) : "",
          rowTotal,
          "",
          (H.entityName >= 0) ? toStrLocal(r[H.entityName]) : "",
          (H.clientName >= 0) ? toStrLocal(r[H.clientName]) : ""
        ]);
      }

      csvRows.push([
        "SUBTOTAL",
        "",
        "",
        "",
        `Subtotal - ${k}`,
        "",
        "",
        subtotal,
        "",
        ""
      ]);
    }

    const grandTotal = rows.reduce((acc, r) => acc + num(r[H.totalAmount]), 0);

    csvRows.push([
      "GRAND_TOTAL",
      "",
      "",
      "",
      "Grand Total",
      "",
      "",
      grandTotal,
      "",
      ""
    ]);

    return csvRows.map(r => r.map(safe).join(",")).join("\n") + "\n";
  }

  /* =================== DEFAULT GROUPED MODE =================== */

  const groupResolvers = {
    entityType: (r) => toStrLocal(r[H.entityType]) || "(Blank)",
    entityId: (r) => toStrLocal(r[H.entityId]) || "(Blank)",
    entity: (r) => toStrLocal(r[H.entityName]) || "(Blank)",
    date: (r) => {
      let d = null;
      if (H.expenseDate >= 0) d = parseDateOnly(r[H.expenseDate]);
      if (!d && H.entryTs >= 0) d = parseDateOnly(r[H.entryTs]);
      return fmtDate(d) || "(Blank)";
    },
    head: (r) => toStrLocal(r[H.head]) || "(Blank)",
    subcategory: (r) => toStrLocal(r[H.subcategory]) || "(Blank)",
    particular: (r) => toStrLocal(r[H.particular]) || "(Blank)",
    owner: (r) => toStrLocal(r[H.owner]) || "(Blank)",
    paymentStatus: (r) => toStrLocal(r[H.paymentStatus]) || "(Blank)",
    client: (r) => toStrLocal(r[H.clientName]) || "(Blank)",
    projectType: (r) => toStrLocal(r[H.projectType]) || "(Blank)",
  };

  const groupByRaw = toStr_(p.groupBy || "entity,date,head,subcategory,particular");
  const groupKeysFinal = groupByRaw
    .split(/[|,]/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(k => groupResolvers[k]);

  const groupKeys = groupKeysFinal.length
    ? groupKeysFinal
    : ["entity", "date", "head", "subcategory", "particular"];

  const outHeaders = [
    "Row Type",
    "Group Path",
    "Linked Entity Type","Linked Entity ID","Linked Entity Name",
    "Expense Date","Head Name","Subcategory","Particular",
    "Details","QTY","Rate",
    "Amount","GST Amount","Total Amount",
    "Voucher/Invoice No","Payment Status",
    "Cost Sheet ID","Owner","Client Name","Project Type","Attachment Link"
  ];

  const csvRows = [outHeaders];

  const sumRows = (arr) => {
    let s = { amt:0, gst:0, tot:0 };
    for (const r of arr) {
      s.amt += (H.amount >= 0) ? num(r[H.amount]) : 0;
      s.gst += (H.gstAmount >= 0) ? num(r[H.gstAmount]) : 0;
      s.tot += num(r[H.totalAmount]);
    }
    return s;
  };

  const emitLine = (r, groupPath) => {
    let dt = null;
    if (H.expenseDate >= 0) dt = parseDateAny_(r[H.expenseDate]);
    if (!dt && H.entryTs >= 0) dt = parseDateAny_(r[H.entryTs]);

    const d = fmtDate(dt);

    csvRows.push([
      "LINE",
      groupPath,
      (H.entityType >= 0) ? toStrLocal(r[H.entityType]) : "",
      (H.entityId >= 0) ? toStrLocal(r[H.entityId]) : "",
      (H.entityName >= 0) ? toStrLocal(r[H.entityName]) : "",
      d,
      (H.head >= 0) ? toStrLocal(r[H.head]) : "",
      (H.subcategory >= 0) ? toStrLocal(r[H.subcategory]) : "",
      toStrLocal(r[H.particular]),
      (H.details >= 0) ? toStrLocal(r[H.details]) : "",
      (H.qty >= 0) ? (r[H.qty] ?? "") : "",
      (H.rate >= 0) ? (r[H.rate] ?? "") : "",
      (H.amount >= 0) ? num(r[H.amount]) : 0,
      (H.gstAmount >= 0) ? num(r[H.gstAmount]) : 0,
      num(r[H.totalAmount]),
      (H.voucher >= 0) ? toStrLocal(r[H.voucher]) : "",
      (H.paymentStatus >= 0) ? toStrLocal(r[H.paymentStatus]) : "",
      toStrLocal(r[H.costSheetId]),
      (H.owner >= 0) ? toStrLocal(r[H.owner]) : "",
      (H.clientName >= 0) ? toStrLocal(r[H.clientName]) : "",
      (H.projectType >= 0) ? toStrLocal(r[H.projectType]) : "",
      (H.attachment >= 0) ? toStrLocal(r[H.attachment]) : "",
    ]);
  };

  const emitSubtotal = (levelKey, levelVal, groupPath, sums) => {
    csvRows.push([
      `SUBTOTAL_${levelKey.toUpperCase()}`,
      groupPath,
      "", "", "",
      "", "", "", "",
      `${levelKey}: ${levelVal} SUBTOTAL`,
      "", "",
      sums.amt, sums.gst, sums.tot,
      "", "",
      "", "", "", "", ""
    ]);
  };

  function groupAndEmit(arr, levelIdx, pathParts) {
    if (levelIdx >= groupKeys.length) {
      const groupPath = pathParts.join(" > ");
      for (const r of arr) emitLine(r, groupPath);
      return sumRows(arr);
    }

    const key = groupKeys[levelIdx];
    const getVal = groupResolvers[key];

    const map = new Map();
    for (const r of arr) {
      const v = (getVal(r) || "(Blank)");
      if (!map.has(v)) map.set(v, []);
      map.get(v).push(r);
    }

    const entries = Array.from(map.entries())
      .sort((a,b) => String(a[0]).localeCompare(String(b[0])));

    let total = { amt:0, gst:0, tot:0 };
    for (const [val, bucket] of entries) {
      const childPath = [...pathParts, `${key}:${val}`];
      const sums = groupAndEmit(bucket, levelIdx + 1, childPath);
      emitSubtotal(key, val, childPath.join(" > "), sums);

      total.amt += sums.amt;
      total.gst += sums.gst;
      total.tot += sums.tot;
    }
    return total;
  }

  const grand = groupAndEmit(rows, 0, []);
  csvRows.push([
    "GRAND_TOTAL",
    groupKeys.join(" > "),
    "", "", "",
    "", "", "", "",
    "GRAND TOTAL",
    "", "",
    grand.amt, grand.gst, grand.tot,
    "", "",
    "", "", "", "", ""
  ]);

  if (String(p.debug || "").toLowerCase() === "true") {
    csvRows.push([
      "DEBUG",
      "rows_after_filters=" + rows.length,
      "", "", "", "", "", "", "",
      "headers=" + headers.length,
      "", "",
      0, 0, 0,
      "", "",
      "", "", "", "", ""
    ]);
  }

  return csvRows.map(r => r.map(safe).join(",")).join("\n") + "\n";
}

function csvDownloadHtml_(csv, filename) {
  const safeName = String(filename || "export.csv").replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeCsv = String(csv || "");

  const html = `
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Download</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; }
        .btn {
          display: inline-block;
          padding: 10px 14px;
          border: 1px solid #1a73e8;
          background: #1a73e8;
          color: #fff;
          border-radius: 8px;
          text-decoration: none;
          cursor: pointer;
          font-size: 14px;
        }
        .muted { opacity: 0.75; margin-top: 10px; font-size: 13px; }
        textarea { width: 100%; height: 220px; margin-top: 12px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div style="font-size:16px; font-weight:600;">Finance export ready</div>
      <div class="muted">
        If the download doesn't start automatically (common on iOS/Safari), click the button below.
      </div>

      <button class="btn" id="dlBtn">Download ${safeName}</button>

      <div class="muted">
        If your browser still blocks it, the CSV is shown below — you can copy/paste into Google Sheets.
      </div>
      <textarea id="csvBox" readonly></textarea>

      <script>
        (function () {
          const csv = ${JSON.stringify(safeCsv)};
          const filename = ${JSON.stringify(safeName)};
          const box = document.getElementById("csvBox");
          box.value = csv;

          function triggerDownload() {
            try {
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);

              const a = document.createElement("a");
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);

              // Attempt programmatic click (may be blocked)
              a.click();

              setTimeout(() => {
                URL.revokeObjectURL(url);
                a.remove();
              }, 500);
            } catch (e) {
              // If anything fails, user can still copy from textarea
              console.log("Download trigger failed:", e);
            }
          }

          document.getElementById("dlBtn").addEventListener("click", triggerDownload);

          // Auto-attempt once (works on desktop Chrome most times)
          setTimeout(triggerDownload, 50);
        })();
      </script>
    </body>
  </html>`;

  return HtmlService.createHtmlOutput(html);
}

/**
 * ✅ Backward/Frontend compatibility:
 * Map UI params (subtotalBy / flat / group) into what exportFinanceCSV_ already understands.
 * - Does NOT delete/override existing params unless needed.
 */
function normalizeFinanceExportParams_(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const out = {};
  Object.keys(p).forEach(k => out[k] = p[k]); // clone

  const subtotalBy = String(p.subtotalBy || "").trim();   // e.g. "Particular"
  const flat = String(p.flat || "").toLowerCase().trim(); // "1" / "true"
  const group = String(p.group || "").toLowerCase().trim(); // "1" / "true"
  const groupBy = String(p.groupBy || "").trim();

  // If caller explicitly set flat/group/groupBy, respect them.
  const hasFlat = (flat === "1" || flat === "true");
  const hasGroup = (group === "1" || group === "true");
  const hasGroupBy = !!groupBy;

  // If UI is sending subtotalBy but not providing groupBy/flat/group,
  // choose the intended behavior:
  // ✅ default: subtotalBy=Particular => FLAT subtotal output (flat=1)
  if (subtotalBy && !hasFlat && !hasGroup && !hasGroupBy) {
    if (subtotalBy.toLowerCase() === "particular") {
      out.flat = "1";
    } else {
      // For other subtotalBy values, we map to grouped mode
      // Default grouped order with subtotal target at the end
      // Examples:
      // subtotalBy=head => entity,date,head
      // subtotalBy=subcategory => entity,date,head,subcategory
      // subtotalBy=particular => entity,date,head,subcategory,particular (but particular uses flat)
      const sb = subtotalBy.toLowerCase();
      if (sb === "entity") out.groupBy = "entity";
      else if (sb === "date") out.groupBy = "entity,date";
      else if (sb === "head") out.groupBy = "entity,date,head";
      else if (sb === "subcategory") out.groupBy = "entity,date,head,subcategory";
      else if (sb === "paymentstatus") out.groupBy = "paymentStatus";
      else if (sb === "owner") out.groupBy = "owner";
      else if (sb === "client") out.groupBy = "client";
      else if (sb === "projecttype") out.groupBy = "projectType";
      else out.groupBy = "entity,date,head,subcategory,particular";
      out.group = "1";
    }
  }

  // If UI sets group=1 but groupBy missing, ensure a sensible default
  if (hasGroup && !hasGroupBy) {
    out.groupBy = "entity,date,head,subcategory,particular";
  }

  return out;
}

function exportFinanceXLSX_(params) {
  const p = (params && params.parameter) ? params.parameter : (params || {});

  const ss = SpreadsheetApp.openById(COSTING_SPREADSHEET_ID);
  const sh = ss.getSheetByName(COST_LINE_TAB);
  if (!sh) throw new Error("Sheet not found: " + COST_LINE_TAB);

  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) {
    throw new Error("No data found for export.");
  }

  const headers = values[0].map(h => String(h || "").trim());
  const dataRows = values.slice(1);

  const idxAny = (candidates) => {
    for (let i = 0; i < candidates.length; i++) {
      const k = String(candidates[i] || "").trim();
      const ix = headers.indexOf(k);
      if (ix >= 0) return ix;
    }
    return -1;
  };

  const toStrLocal = (v) => String(v ?? "").trim();

  const num = (x) => {
    const n = parseFloat(String(x ?? "").replace(/[,₹\s]/g, ""));
    return isNaN(n) ? 0 : n;
  };

  const parseDateAny_ = (v) => {
    if (!v && v !== 0) return null;
    if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) return v;

    const d = parseDateLoose_(v);
    if (d && !isNaN(d.getTime())) return d;

    const d2 = new Date(v);
    if (d2 && !isNaN(d2.getTime())) return d2;

    return null;
  };

  const fmtDate = (d) =>
    d ? Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd") : "";

  const parseDateOnly = (v) => {
    const d = parseDateAny_(v);
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const H = {
    costSheetId: idxAny(["Cost Sheet ID"]),
    head: idxAny(["Head Name", "Head"]),
    subcategory: idxAny(["Subcategory", "Sub Category", "Sub-Category"]),
    expenseDate: idxAny(["Expense Date", "ExpenseDate"]),
    entryTs: idxAny(["Entry Timestamp", "Timestamp", "Entry TS"]),
    particular: idxAny(["Particular"]),
    details: idxAny(["Details", "Description"]),
    qty: idxAny(["QTY", "Qty", "Quantity"]),
    rate: idxAny(["Rate", "Unit Rate"]),
    amount: idxAny(["Amount"]),
    gstAmount: idxAny(["GST Amount", "GST Amt", "GST"]),
    totalAmount: idxAny(["Total Amount", "Total", "TotalAmount"]),
    attachment: idxAny(["Attachment Link", "Attachment", "Link"]),
    voucher: idxAny(["Voucher/Invoice No", "Voucher No", "Invoice No", "Voucher"]),
    paymentStatus: idxAny(["Payment Status", "PaymentStatus"]),
    active: idxAny(["Active"]),
    owner: idxAny(["Owner", "Entered By"]),
    entityType: idxAny(["Linked Entity Type"]),
    entityId: idxAny(["Linked Entity ID"]),
    entityName: idxAny(["Linked Entity Name"]),
    clientName: idxAny(["Client Name", "Client"]),
    projectType: idxAny(["Project Type"]),
  };

  if (H.totalAmount < 0 && H.amount >= 0) H.totalAmount = H.amount;

  const requiredForExport = [
    ["Cost Sheet ID", H.costSheetId],
    ["Particular", H.particular],
    ["Amount", H.amount],
    ["Total Amount (or Amount fallback)", H.totalAmount],
  ];

  const dateAvailable = (H.expenseDate >= 0) || (H.entryTs >= 0);
  const missing = requiredForExport.filter(x => x[1] < 0).map(x => x[0]);

  const fromParam = toStr_(p.from);
  const toParam = toStr_(p.to);
  const wantsDateRange = !!(fromParam || toParam);

  if (missing.length || (wantsDateRange && !dateAvailable)) {
    throw new Error(
      []
        .concat(missing.length ? ["Missing required headers: " + missing.join(", ")] : [])
        .concat((wantsDateRange && !dateAvailable) ? ["Date range used but no Expense Date / Entry Timestamp column found"] : [])
        .join(" | ")
    );
  }

  const role = toStr_(p.role);

  const isAdminLocal = (() => {
    const r = String(role || "").toLowerCase().trim();
    if (!r) return false;
    if (r === "admin" || r === "super admin" || r === "superadmin") return true;
    try { return !!isAdminRole_(role); } catch (e) { return false; }
  })();

  const ownerFilter = toStr_(p.owner);

  const costSheetId = toStr_(p.costSheetId);
  const entityType = toStr_(p.entityType);
  const linkedEntityId = toStr_(p.linkedEntityId);
  const paymentStatusFilter = toStr_(p.paymentStatus);
  const headFilter = toStr_(p.head);
  const subcategoryFilter = toStr_(p.subcategory);
  const particularContains = toStr_(p.particular).toLowerCase();

  const activeOnly = String(p.activeOnly || "").toLowerCase() === "true";

  const fromD = fromParam ? parseDateAny_(fromParam + " 00:00:00") : null;
  const toD = toParam ? parseDateAny_(toParam + " 23:59:59") : null;

  const rows = [];
  for (const r of dataRows) {
    if (activeOnly && H.active >= 0) {
      const a = toStrLocal(r[H.active]).toLowerCase();
      if (a && a !== "yes" && a !== "true" && a !== "1") continue;
    } else if (H.active >= 0) {
      if (!isActiveYes_(r[H.active])) continue;
    }

    if (!isAdminLocal && H.owner >= 0 && ownerFilter) {
      const rowOwner = toStrLocal(r[H.owner]);
      if (rowOwner.toLowerCase() !== ownerFilter.toLowerCase()) continue;
    }

    if (costSheetId && toStrLocal(r[H.costSheetId]) !== costSheetId) continue;
    if (entityType && H.entityType >= 0 && toStrLocal(r[H.entityType]) !== entityType) continue;
    if (linkedEntityId && H.entityId >= 0 && toStrLocal(r[H.entityId]) !== linkedEntityId) continue;

    if (paymentStatusFilter && H.paymentStatus >= 0) {
      if (toStrLocal(r[H.paymentStatus]).toLowerCase() !== paymentStatusFilter.toLowerCase()) continue;
    }

    if (headFilter && H.head >= 0 && toStrLocal(r[H.head]) !== headFilter) continue;
    if (subcategoryFilter && H.subcategory >= 0 && toStrLocal(r[H.subcategory]) !== subcategoryFilter) continue;

    if (particularContains) {
      const p0 = toStrLocal(r[H.particular]).toLowerCase();
      if (p0.indexOf(particularContains) === -1) continue;
    }

    if (fromD || toD) {
      let dt = null;
      if (H.expenseDate >= 0) dt = parseDateAny_(r[H.expenseDate]);
      if (!dt && H.entryTs >= 0) dt = parseDateAny_(r[H.entryTs]);
      if (!dt) continue;
      if (!inRangeInclusive_(dt, fromD, toD)) continue;
    }

    rows.push(r);
  }

  const subtotalByRaw = toStr_(p.subtotalBy || "Particular");
  const mergeByRaw = toStr_(p.mergeBy || p.subtotalBy || "Particular");

  const subtotalKeys = subtotalByRaw
    .split(/[|,]/)
    .map(s => String(s || "").trim())
    .filter(Boolean);

  const normKey = (k) => String(k || "").toLowerCase().replace(/\s+/g, "");

  const getGroupPart = (r, keyName) => {
    const k = normKey(keyName);

    if (k === "particular") {
      return toStrLocal(r[H.particular]) || "(Blank)";
    }

    if (k === "subcategory" || k === "subcategoryname") {
      return H.subcategory >= 0 ? (toStrLocal(r[H.subcategory]) || "(Blank)") : "(Blank)";
    }

    if (k === "head" || k === "headname") {
      return H.head >= 0 ? (toStrLocal(r[H.head]) || "(Blank)") : "(Blank)";
    }

    if (k === "date" || k === "expensedate") {
      let dt = null;
      if (H.expenseDate >= 0) dt = parseDateAny_(r[H.expenseDate]);
      if (!dt && H.entryTs >= 0) dt = parseDateAny_(r[H.entryTs]);
      return fmtDate(dt) || "(Blank)";
    }

    if (k === "linkedentityname" || k === "entity" || k === "entityname") {
      return H.entityName >= 0 ? (toStrLocal(r[H.entityName]) || "(Blank)") : "(Blank)";
    }

    if (k === "clientname" || k === "client") {
      return H.clientName >= 0 ? (toStrLocal(r[H.clientName]) || "(Blank)") : "(Blank)";
    }

    return toStrLocal(r[H.particular]) || "(Blank)";
  };

  const subtotalKey = (r) => {
    if (!subtotalKeys.length) return getGroupPart(r, "Particular");
    return subtotalKeys.map(k => getGroupPart(r, k)).join(" | ");
  };

  const grouped = {};
  for (const r of rows) {
    const k = subtotalKey(r);
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(r);
  }

  const outHeaders = [
    "Row Type",
    "Head Name",
    "Subcategory",
    "Expense Date",
    "Particular",
    "Details",
    "Total Amount",
    "Sub Total",
    "Linked Entity Name",
    "Client Name"
  ];

  const outputRows = [outHeaders];
  const rowMeta = [{ type: "HEADER" }];

  const sortedKeys = Object.keys(grouped).sort((a, b) => String(a).localeCompare(String(b)));

  for (const k of sortedKeys) {
    const groupRows = grouped[k];
    let subtotal = 0;

    for (const r of groupRows) {
      let dt = null;
      if (H.expenseDate >= 0) dt = parseDateAny_(r[H.expenseDate]);
      if (!dt && H.entryTs >= 0) dt = parseDateAny_(r[H.entryTs]);
      const expenseDateStr = fmtDate(dt);

      const rowTotal = num(r[H.totalAmount]);
      subtotal += rowTotal;

      outputRows.push([
        "LINE",
        (H.head >= 0) ? toStrLocal(r[H.head]) : "",
        (H.subcategory >= 0) ? toStrLocal(r[H.subcategory]) : "",
        expenseDateStr,
        toStrLocal(r[H.particular]),
        (H.details >= 0) ? toStrLocal(r[H.details]) : "",
        rowTotal,
        "",
        (H.entityName >= 0) ? toStrLocal(r[H.entityName]) : "",
        (H.clientName >= 0) ? toStrLocal(r[H.clientName]) : ""
      ]);
      rowMeta.push({ type: "LINE" });
    }

    outputRows.push([
      "SUBTOTAL",
      `Subtotal - ${k}`,
      "",
      "",
      "",
      "",
      "",
      subtotal,
      "",
      ""
    ]);
    rowMeta.push({
      type: "SUBTOTAL",
      mergeBy: mergeByRaw,
      label: k
    });
  }

  const grandTotal = rows.reduce((acc, r) => acc + num(r[H.totalAmount]), 0);

  outputRows.push([
    "GRAND_TOTAL",
    "Grand Total",
    "",
    "",
    "",
    "",
    "",
    grandTotal,
    "",
    ""
  ]);
  rowMeta.push({ type: "GRAND_TOTAL" });

  const fileNameBase = "Finance_Export_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");

  const tempSs = SpreadsheetApp.create(fileNameBase);
  const outSh = tempSs.getSheets()[0];
  outSh.setName("Finance Export");

  outSh.getRange(1, 1, outputRows.length, outHeaders.length).setValues(outputRows);

  outSh.setFrozenRows(1);

  const headerRange = outSh.getRange(1, 1, 1, outHeaders.length);
  headerRange
    .setFontWeight("bold")
    .setBackground("#dfe9ff")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  const fullRange = outSh.getRange(1, 1, outputRows.length, outHeaders.length);
  fullRange.setBorder(true, true, true, true, true, true);

  outSh.getRange(2, 1, outputRows.length - 1, outHeaders.length).setVerticalAlignment("middle");

  if (outputRows.length > 1) {
    outSh.getRange(2, 7, outputRows.length - 1, 2).setNumberFormat("₹#,##0.00");
  }

  for (let r = 2; r <= outputRows.length; r++) {
    const meta = rowMeta[r - 1];
    if (!meta) continue;

    if (meta.type === "SUBTOTAL") {
      outSh.getRange(r, 1, 1, outHeaders.length)
        .setFontWeight("bold")
        .setBackground("#eef4ff");

      // Merge subtotal label area only
      // Row Type stays in col 1
      // Merge cols 2 to 6 for the subtotal label
      outSh.getRange(r, 2, 1, 5).merge();

      outSh.getRange(r, 2).setHorizontalAlignment("left");
      outSh.getRange(r, 8).setHorizontalAlignment("right");
    }

    if (meta.type === "GRAND_TOTAL") {
      outSh.getRange(r, 1, 1, outHeaders.length)
        .setFontWeight("bold")
        .setBackground("#d9ead3");

      outSh.getRange(r, 2, 1, 5).merge();
      outSh.getRange(r, 2).setHorizontalAlignment("left");
      outSh.getRange(r, 8).setHorizontalAlignment("right");
    }
  }

  outSh.autoResizeColumns(1, outHeaders.length);

  outSh.setColumnWidth(1, 110);
  outSh.setColumnWidth(2, 180);
  outSh.setColumnWidth(3, 140);
  outSh.setColumnWidth(4, 110);
  outSh.setColumnWidth(5, 180);
  outSh.setColumnWidth(6, 220);
  outSh.setColumnWidth(7, 120);
  outSh.setColumnWidth(8, 120);
  outSh.setColumnWidth(9, 180);
  outSh.setColumnWidth(10, 180);

  const spreadsheetId = tempSs.getId();
  const exportUrl = "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/export?format=xlsx";

  const token = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(exportUrl, {
    headers: {
      Authorization: "Bearer " + token
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error("XLSX export failed: " + response.getContentText());
  }

  const blob = response.getBlob().setName(fileNameBase + ".xlsx");
  const xlsxFile = DriveApp.createFile(blob);

  // temp spreadsheet no longer needed
  DriveApp.getFileById(spreadsheetId).setTrashed(true);

  return {
    success: true,
    fileId: xlsxFile.getId(),
    fileName: xlsxFile.getName(),
    downloadUrl: "https://drive.google.com/uc?export=download&id=" + xlsxFile.getId(),
    viewUrl: xlsxFile.getUrl()
  };
}

function testUrlFetchAuth() {
  const resp = UrlFetchApp.fetch("https://www.google.com");
  Logger.log(resp.getResponseCode());
}

function createExpenseRequestBatch_(data) {
  if (!data || !Array.isArray(data.rows) || !data.rows.length) {
    throw new Error('createExpenseRequestBatch_ requires rows array');
  }

  const sheet = getExpenseRequestsSheet_();
  const headers = getHeaders_(sheet);
  if (!headers.length) throw new Error('No headers found in sheet: ' + EXPENSE_REQUESTS_TAB);

  const batchId = generateBatchId_();
  const timestamp = now_();

  const raisedBy = toStr_(data.raisedBy);
  const raisedByEmail = toStr_(data.raisedByEmail);
  const owner = toStr_(data.owner || data.raisedBy || '');

  const rowsToWrite = data.rows.map(item => {
    const amount = toNum_(item.amount);

    const rowObj = {
      'Batch ID': batchId,
      'Request ID': generateRequestId_(),
      'Timestamp': timestamp,
      'Raised By': raisedBy,
      'Raised By Email': raisedByEmail,
      'Owner': owner,
      'Particular': toStr_(item.particular),
      'Description': toStr_(item.description),
      'Amount': amount,
      'Approval Status': 'Pending',
      'Approved By': '',
      'Approved On': '',
      'Rejected By': '',
      'Rejected On': '',
      'Rejection Remarks': '',
      'Hold By': '',
      'Hold On': '',
      'Hold Remarks': '',
      'Linked Entity Type': '',
      'Linked Entity ID': '',
      'Linked Entity Name': '',
      'Existing Cost Sheet ID': '',
      'Existing Cost Sheet Name': '',
      'Attribution Status': 'Unmapped',
      'Operations Remarks': '',
      'Synced To Cost Line': 'No',
      'Synced On': '',
      'Active': 'Yes',
      'Last Updated On': timestamp
    };

    return buildRowFromHeaders_(headers, rowObj);
  });

  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rowsToWrite.length, headers.length).setValues(rowsToWrite);

  return {
    success: true,
    batchId: batchId,
    count: rowsToWrite.length
  };
}

function getExpenseRequests_(params) {
  const sheet = getExpenseRequestsSheet_();
  const rows = getRowsAsObjects_(sheet);

  const role = toStr_(params.role).toLowerCase();
  const raisedByEmail = toStr_(params.raisedByEmail).toLowerCase();
  const raisedBy = toStr_(params.raisedBy).toLowerCase();

  return rows.filter(r => {
    if (!isActiveYes_(r['Active'])) return false;

    if (role === 'admin') return true;
    if (role === 'operations manager') return true;
    if (role === 'accounts') return true;

    const rowEmail = toStr_(r['Raised By Email']).toLowerCase();
    const rowRaisedBy = toStr_(r['Raised By']).toLowerCase();

    if (raisedByEmail && rowEmail === raisedByEmail) return true;
    if (raisedBy && rowRaisedBy === raisedBy) return true;

    return false;
  });
}

function getExpenseApprovalQueue_() {
  const sheet = getExpenseRequestsSheet_();
  const rows = getRowsAsObjects_(sheet);

  return rows.filter(r => {
    if (!isActiveYes_(r['Active'])) return false;
    const status = toStr_(r['Approval Status']);
    return status === 'Pending' || status === 'On Hold';
  });
}

function getExpenseAccountsQueue_() {
  const sheet = getExpenseRequestsSheet_();
  const rows = getRowsAsObjects_(sheet);

  return rows.filter(r => {
    if (!isActiveYes_(r['Active'])) return false;
    return toStr_(r['Approval Status']) === 'Approved';
  });
}

function getCostSheetsForMapping_() {
  const rows = getCostSheets_();

  return rows.map(r => ({
    costSheetId: toStr_(r['Cost Sheet ID']),
    linkedEntityType: toStr_(r['Linked Entity Type']),
    linkedEntityId: toStr_(r['Linked Entity ID']),
    linkedEntityName: toStr_(r['Linked Entity Name']),
    clientName: toStr_(r['Client Name']),
    projectType: toStr_(r['Project Type']),
    owner: toStr_(r['Owner']),
    status: toStr_(r['Status']),
    display: [
      toStr_(r['Cost Sheet ID']) || '-',
      toStr_(r['Linked Entity Name']) || '-',
      toStr_(r['Client Name']) || '-',
      toStr_(r['Project Type']) || '-'
    ].join(' | ')
  }));
}

function getLinkedEntitiesForMapping_() {
  const rows = getCostSheets_();
  const seen = {};
  const out = [];

  rows.forEach(r => {
    const type = toStr_(r['Linked Entity Type']);
    const id = toStr_(r['Linked Entity ID']);
    const name = toStr_(r['Linked Entity Name']);
    const key = [type, id, name].join('||');

    if (!type && !id && !name) return;
    if (seen[key]) return;
    seen[key] = true;

    out.push({
      linkedEntityType: type,
      linkedEntityId: id,
      linkedEntityName: name,
      display: [type || '-', id || '-', name || '-'].join(' | ')
    });
  });

  return out;
}

function updateExpenseRequestApproval_(data) {
  if (!data || !data.requestId) {
    throw new Error('updateExpenseRequestApproval_ requires requestId');
  }

  const sheet = getExpenseRequestsSheet_();
  const headers = getHeaders_(sheet);
  const values = sheet.getDataRange().getValues();

  const requestIdIdx = headers.indexOf('Request ID');
  if (requestIdIdx < 0) throw new Error('Missing Request ID header');

  let rowNumber = -1;
  for (let i = 1; i < values.length; i++) {
    if (toStr_(values[i][requestIdIdx]) === toStr_(data.requestId)) {
      rowNumber = i + 1;
      break;
    }
  }

  if (rowNumber < 0) {
    throw new Error('Request ID not found: ' + data.requestId);
  }

  const row = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const obj = {};
  headers.forEach((h, i) => obj[h] = row[i]);

  const approvalStatus = toStr_(data.approvalStatus);
  const actionBy = toStr_(data.actionBy);
  const actionOn = now_();

  obj['Approval Status'] = approvalStatus;
  obj['Linked Entity Type'] = toStr_(data['Linked Entity Type']);
  obj['Linked Entity ID'] = toStr_(data['Linked Entity ID']);
  obj['Linked Entity Name'] = toStr_(data['Linked Entity Name']);
  obj['Existing Cost Sheet ID'] = toStr_(data['Existing Cost Sheet ID']);
  obj['Existing Cost Sheet Name'] = toStr_(data['Existing Cost Sheet Name']);
  obj['Operations Remarks'] = toStr_(data['Operations Remarks']);
  obj['Attribution Status'] = getAttributionStatus_(obj);
  obj['Last Updated On'] = actionOn;

  if (approvalStatus === 'Approved') {
    obj['Approved By'] = actionBy;
    obj['Approved On'] = actionOn;
    obj['Rejected By'] = '';
    obj['Rejected On'] = '';
    obj['Rejection Remarks'] = '';
    obj['Hold By'] = '';
    obj['Hold On'] = '';
    obj['Hold Remarks'] = '';
  } else if (approvalStatus === 'Rejected') {
    obj['Rejected By'] = actionBy;
    obj['Rejected On'] = actionOn;
    obj['Rejection Remarks'] = toStr_(data['Rejection Remarks']);
  } else if (approvalStatus === 'On Hold') {
    obj['Hold By'] = actionBy;
    obj['Hold On'] = actionOn;
    obj['Hold Remarks'] = toStr_(data['Hold Remarks']);
  }

  const updatedRow = buildRowFromHeaders_(headers, obj);
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([updatedRow]);

  return { success: true, requestId: data.requestId, approvalStatus: approvalStatus };
}

function syncExpenseRequestToCostLine_(data) {
  if (!data || !data.requestId) {
    throw new Error('syncExpenseRequestToCostLine_ requires requestId');
  }

  const reqSheet = getExpenseRequestsSheet_();
  const reqHeaders = getHeaders_(reqSheet);
  const reqValues = reqSheet.getDataRange().getValues();

  const reqIdIdx = reqHeaders.indexOf('Request ID');
  if (reqIdIdx < 0) throw new Error('Expense Requests missing Request ID');

  let rowNumber = -1;
  let reqObj = null;

  for (let i = 1; i < reqValues.length; i++) {
    if (toStr_(reqValues[i][reqIdIdx]) === toStr_(data.requestId)) {
      rowNumber = i + 1;
      reqObj = {};
      reqHeaders.forEach((h, j) => reqObj[h] = reqValues[i][j]);
      break;
    }
  }

  if (!reqObj) throw new Error('Request not found: ' + data.requestId);

  if (toStr_(reqObj['Approval Status']) !== 'Approved') {
    throw new Error('Only approved requests can sync');
  }

  if (toStr_(reqObj['Synced To Cost Line']) === 'Yes') {
    throw new Error('Request already synced');
  }

  // ✅ Resolve cost sheet from either direct cost sheet mapping OR linked entity mapping
  const matched = resolveCostSheetForExpenseSync_(reqObj, data);
  const costSheetId = toStr_(matched['Cost Sheet ID']);

  if (!costSheetId) {
    throw new Error('Resolved Cost Sheet is missing Cost Sheet ID');
  }

  const overrideAmount = toNum_(data.amount || reqObj['Amount']);
  const gstPct = toNum_(data.gstPct || 0);
  const gstAmt = (overrideAmount * gstPct) / 100;
  const totalAmt = overrideAmount + gstAmt;

  const linkedEntityType = toStr_(data['Linked Entity Type'] || reqObj['Linked Entity Type']);
  const linkedEntityId = toStr_(data['Linked Entity ID'] || reqObj['Linked Entity ID']);
  const linkedEntityName = toStr_(data['Linked Entity Name'] || reqObj['Linked Entity Name']);

  const lineItemData = {
    'Cost Sheet ID': costSheetId,
    'Head Name': toStr_(data.headName || 'Miscellaneous'),
    'Subcategory': toStr_(data.subcategory || ''),
    'Expense Date': toStr_(data.expenseDate || now_()),
    'Entered By': toStr_(data.syncedBy || reqObj['Raised By']),
    'Entry Tag': 'Expense Request',

    'Particular': toStr_(data.particular || reqObj['Particular']),
    'Details': toStr_(data.details || reqObj['Description']),

    'QTY': 1,
    'Rate': overrideAmount,
    'Amount': overrideAmount,

    'GST %': gstPct,
    'GST Amount': gstAmt,
    'Total Amount': totalAmt,

    'Attachment Link': '',
    'Voucher/Invoice No': toStr_(data.voucherNo || ''),
    'Payment Status': toStr_(data.paymentStatus || 'Pending'),

    'Active': 'Yes',
    'Owner': toStr_(reqObj['Owner']),

    'Linked Entity Type': linkedEntityType || toStr_(matched['Linked Entity Type']),
    'Linked Entity ID': linkedEntityId || toStr_(matched['Linked Entity ID']),
    'Linked Entity Name': linkedEntityName || toStr_(matched['Linked Entity Name']),

    'Client Name': toStr_(matched['Client Name']),
    'Project Type': toStr_(matched['Project Type'])
  };

  const addRes = addLineItem_(lineItemData);

  // ✅ Persist the final resolved mapping back onto the request
  reqObj['Existing Cost Sheet ID'] = costSheetId;
  reqObj['Existing Cost Sheet Name'] =
    toStr_(data['Existing Cost Sheet Name']) ||
    toStr_(reqObj['Existing Cost Sheet Name']) ||
    toStr_(matched['Project Name']) ||
    toStr_(matched['Cost Sheet Name']) ||
    costSheetId;

  reqObj['Linked Entity Type'] = linkedEntityType || toStr_(reqObj['Linked Entity Type']) || toStr_(matched['Linked Entity Type']);
  reqObj['Linked Entity ID'] = linkedEntityId || toStr_(reqObj['Linked Entity ID']) || toStr_(matched['Linked Entity ID']);
  reqObj['Linked Entity Name'] = linkedEntityName || toStr_(reqObj['Linked Entity Name']) || toStr_(matched['Linked Entity Name']);

  reqObj['Attribution Status'] = 'Mapped';
  reqObj['Synced To Cost Line'] = 'Yes';
  reqObj['Synced On'] = now_();
  reqObj['Last Updated On'] = now_();

  const updatedReqRow = buildRowFromHeaders_(reqHeaders, reqObj);
  reqSheet.getRange(rowNumber, 1, 1, reqHeaders.length).setValues([updatedReqRow]);

  return {
    success: true,
    requestId: data.requestId,
    costSheetId: costSheetId,
    synced: addRes
  };
}

function resolveCostSheetForExpenseSync_(reqObj, data) {
  const explicitCostSheetId = toStr_(
    data['Existing Cost Sheet ID'] ||
    reqObj['Existing Cost Sheet ID']
  );

  if (explicitCostSheetId) {
    const costSheets = getCostSheets_();
    const matched = costSheets.find(
      r => toStr_(r['Cost Sheet ID']) === explicitCostSheetId
    );
    if (!matched) {
      throw new Error('Mapped Cost Sheet not found: ' + explicitCostSheetId);
    }
    return matched;
  }

  const linkedEntityType = toStr_(
    data['Linked Entity Type'] ||
    reqObj['Linked Entity Type']
  );
  const linkedEntityId = toStr_(
    data['Linked Entity ID'] ||
    reqObj['Linked Entity ID']
  );
  const linkedEntityName = toStr_(
    data['Linked Entity Name'] ||
    reqObj['Linked Entity Name']
  );

  if (!linkedEntityType && !linkedEntityId && !linkedEntityName) {
    throw new Error('Either Existing Cost Sheet or Linked Entity mapping is required before sync');
  }

  const costSheets = getCostSheets_();

  let matched = null;

  if (linkedEntityType && linkedEntityId) {
    matched = costSheets.find(r =>
      toStr_(r['Linked Entity Type']) === linkedEntityType &&
      toStr_(r['Linked Entity ID']) === linkedEntityId
    );
  }

  if (!matched && linkedEntityType && linkedEntityName) {
    matched = costSheets.find(r =>
      toStr_(r['Linked Entity Type']) === linkedEntityType &&
      toStr_(r['Linked Entity Name']) === linkedEntityName
    );
  }

  if (!matched && linkedEntityId) {
    matched = costSheets.find(r =>
      toStr_(r['Linked Entity ID']) === linkedEntityId
    );
  }

  if (!matched && linkedEntityName) {
    matched = costSheets.find(r =>
      toStr_(r['Linked Entity Name']) === linkedEntityName
    );
  }

  if (!matched) {
    throw new Error(
      'No Cost Sheet found for linked entity mapping: ' +
      [linkedEntityType, linkedEntityId, linkedEntityName].filter(Boolean).join(' | ')
    );
  }

  return matched;
}

function normalizeSearchText_(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeLooseSearchText_(v) {
  return normalizeSearchText_(v).replace(/[^a-z0-9]/g, '');
}

function findHeaderLoose_(headers, name) {
  const want = normalizeLooseSearchText_(name);
  for (let i = 0; i < headers.length; i++) {
    if (normalizeLooseSearchText_(headers[i]) === want) return i;
  }
  return -1;
}

function matchesLineSearch_(value, query, matchMode) {
  const text = normalizeSearchText_(value);
  const looseText = normalizeLooseSearchText_(value);
  const q = normalizeSearchText_(query);
  const looseQ = normalizeLooseSearchText_(query);

  if (!q && !looseQ) return true;

  if (String(matchMode || '').toLowerCase() === 'exact') {
    return (q && text === q) || (looseQ && looseText === looseQ);
  }

  return (q && text.indexOf(q) >= 0) || (looseQ && looseText.indexOf(looseQ) >= 0);
}

function searchCostLineItems_(params) {
  const sheet = openSheet_(COSTING_SPREADSHEET_ID, COST_LINE_TAB);
  const headers = getHeadersCached_(COSTING_SPREADSHEET_ID, COST_LINE_TAB, 300);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || !headers.length) {
    return {
      success: true,
      rows: [],
      totalCount: 0,
      totals: { qty: 0, amount: 0, gst: 0, totalAmount: 0 },
      groupedTotals: []
    };
  }

  const q = toStr_(params.q);
  const searchColumn = toStr_(params.searchColumn || 'all');
  const matchMode = toStr_(params.matchMode || 'contains');

  const entityType = toStr_(params.entityType);
  const paymentStatus = toStr_(params.paymentStatus);
  const head = toStr_(params.head);
  const groupBy = toStr_(params.groupBy || 'Linked Entity Name');

  const limit = Math.max(1, Math.min(500, parseInt(params.limit || '500', 10)));
  const offset = Math.max(0, parseInt(params.offset || '0', 10));

  const idxActive = findHeaderLoose_(headers, 'Active');
  const idxEntityType = findHeaderLoose_(headers, 'Linked Entity Type');
  const idxPaymentStatus = findHeaderLoose_(headers, 'Payment Status');
  const idxHead = findHeaderLoose_(headers, 'Head Name');

  const idxQty = findHeaderLoose_(headers, 'QTY');
  const idxAmount = findHeaderLoose_(headers, 'Amount');
  const idxGst = findHeaderLoose_(headers, 'GST Amount');
  const idxTotal = findHeaderLoose_(headers, 'Total Amount');
  const idxExpenseDate = findHeaderLoose_(headers, 'Expense Date');
  const idxEntryTs = findHeaderLoose_(headers, 'Entry Timestamp');

  const idxGroup = findHeaderLoose_(headers, groupBy);
  const idxSearch = searchColumn === 'all' ? -1 : findHeaderLoose_(headers, searchColumn);

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  const matched = [];
  const groupedMap = {};

  const totals = {
    qty: 0,
    amount: 0,
    gst: 0,
    totalAmount: 0
  };

  for (let i = 0; i < values.length; i++) {
    const row = values[i];

    if (idxActive >= 0 && !isActiveYes_(row[idxActive])) continue;

    if (entityType && idxEntityType >= 0 && toStr_(row[idxEntityType]) !== entityType) continue;
    if (paymentStatus && idxPaymentStatus >= 0 && toStr_(row[idxPaymentStatus]) !== paymentStatus) continue;
    if (head && idxHead >= 0 && toStr_(row[idxHead]) !== head) continue;

    if (q) {
      let ok = false;

      if (searchColumn !== 'all' && idxSearch >= 0) {
        ok = matchesLineSearch_(row[idxSearch], q, matchMode);
      } else {
        for (let c = 0; c < headers.length; c++) {
          if (matchesLineSearch_(row[c], q, matchMode)) {
            ok = true;
            break;
          }
        }
      }

      if (!ok) continue;
    }

    const qty = idxQty >= 0 ? toNum_(row[idxQty]) : 0;
    const amount = idxAmount >= 0 ? toNum_(row[idxAmount]) : 0;
    const gst = idxGst >= 0 ? toNum_(row[idxGst]) : 0;
    const totalAmount = idxTotal >= 0 ? toNum_(row[idxTotal]) : amount + gst;

    totals.qty += qty;
    totals.amount += amount;
    totals.gst += gst;
    totals.totalAmount += totalAmount;

    const groupKey = idxGroup >= 0 ? (toStr_(row[idxGroup]) || 'Unassigned') : 'Unassigned';
    if (!groupedMap[groupKey]) {
      groupedMap[groupKey] = {
        key: groupKey,
        count: 0,
        qty: 0,
        amount: 0,
        gst: 0,
        totalAmount: 0
      };
    }

    groupedMap[groupKey].count += 1;
    groupedMap[groupKey].qty += qty;
    groupedMap[groupKey].amount += amount;
    groupedMap[groupKey].gst += gst;
    groupedMap[groupKey].totalAmount += totalAmount;

    matched.push(row);
  }

  matched.sort(function(a, b) {
    const av = idxExpenseDate >= 0 ? a[idxExpenseDate] : (idxEntryTs >= 0 ? a[idxEntryTs] : '');
    const bv = idxExpenseDate >= 0 ? b[idxExpenseDate] : (idxEntryTs >= 0 ? b[idxEntryTs] : '');
    const at = parseDateLoose_(av);
    const bt = parseDateLoose_(bv);
    return (bt ? bt.getTime() : 0) - (at ? at.getTime() : 0);
  });

  const pageRows = matched.slice(offset, offset + limit).map(function(row) {
    const obj = {};
    headers.forEach(function(h, idx) {
      obj[h] = row[idx];
    });
    return obj;
  });

  const groupedTotals = Object.keys(groupedMap)
    .map(function(k) { return groupedMap[k]; })
    .sort(function(a, b) { return b.totalAmount - a.totalAmount; });

  return {
    success: true,
    rows: pageRows,
    totalCount: matched.length,
    totals: totals,
    groupedTotals: groupedTotals,
    limit: limit,
    offset: offset
  };
}