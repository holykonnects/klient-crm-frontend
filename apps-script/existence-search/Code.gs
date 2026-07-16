/************************************************************
 * KLIENT KONNECT — CRM EXISTENCE SEARCH (DEDICATED WEB APP)
 *
 * POST:
 *  ?action=multiExistenceSearch
 *  body: { rows: [{ rowId, tables:["leads","accounts","deals"], criteria:{...} }] }
 *
 * Searches across separate spreadsheets/sheets:
 * - Leads:    Spreadsheet 1vJbB0...  Sheet: "Form responses 1"
 * - Accounts: Spreadsheet 1K9JT...   Sheet: "Qualified Leads"
 * - Deals:    Spreadsheet 1GoZi...   Sheet: "Form responses 1"
 *
 * Column assumptions:
 * - Lead Owner / Account Owner
 * - First Name, Last Name, Mobile Number, Company, Email ID, GST Number
 ************************************************************/

const SOURCES = {
  leads: {
    spreadsheetId: "1vJbB0fmBQhd6XGTNbjUAi7Bt71lHNyau2TBMXTCdoM0",
    sheetName: "Form responses 1",
    tableLabel: "Leads",
    ownerHeader: "Lead Owner",
  },
  accounts: {
    spreadsheetId: "1K9JT7C88oOVdAvapDOieWaiYj6Wd_XRZ1CCNiYzUhG8",
    sheetName: "Qualified Leads",
    tableLabel: "Accounts",
    ownerHeader: "Account Owner",
  },
  deals: {
    spreadsheetId: "1GoZiI3HMDA_Ohkr50wwQlCiYWnT5EcNgDW3dWiZAJU4",
    sheetName: "Form responses 1",
    tableLabel: "Deals",
    ownerHeader: "Account Owner", // ✅ your rule for deals owner
  },
};

// Optional: cap total results per row to keep payload small
const MAX_RESULTS_PER_TABLE = 25;

function doPost(e) {
  const action = (e.parameter.action || "").trim();

  if (action === "multiExistenceSearch") {
    return handleMultiExistenceSearch_(e);
  }

  return json_({ success: false, error: "Unknown action" });
}

function handleMultiExistenceSearch_(e) {
  try {
    const body = safeJson_(e.postData && e.postData.contents);
    if (!body || !Array.isArray(body.rows)) {
      return json_({ success: false, error: "Invalid payload. Expecting { rows: [] }" });
    }

    // Build cache once per request (fast for multi-row)
    const cache = buildAllCaches_();

    const responseRows = body.rows.map((req) => {
      const rowId = String(req.rowId || "");
      const tables = Array.isArray(req.tables) ? req.tables.map((x) => String(x).toLowerCase()) : [];
      const criteria = req.criteria || {};

      if (!hasAnyCriteria_(criteria)) {
        return { rowId, count: 0, results: [], error: "No criteria provided" };
      }

      if (!tables.length) {
        return { rowId, count: 0, results: [], error: "No tables selected" };
      }

      const results = [];

      if (tables.includes("leads")) {
        results.push(...searchInCache_(cache.leads, SOURCES.leads.tableLabel, SOURCES.leads.ownerHeader, criteria));
      }
      if (tables.includes("accounts")) {
        results.push(...searchInCache_(cache.accounts, SOURCES.accounts.tableLabel, SOURCES.accounts.ownerHeader, criteria));
      }
      if (tables.includes("deals")) {
        results.push(...searchInCache_(cache.deals, SOURCES.deals.tableLabel, SOURCES.deals.ownerHeader, criteria));
      }

      return { rowId, count: results.length, results };
    });

    return json_({ success: true, rows: responseRows });
  } catch (err) {
    return json_({ success: false, error: String(err) });
  }
}

/** -------------------- Cache Builders -------------------- */

function buildAllCaches_() {
  return {
    leads: buildCacheFor_("leads"),
    accounts: buildCacheFor_("accounts"),
    deals: buildCacheFor_("deals"),
  };
}

function buildCacheFor_(key) {
  const src = SOURCES[key];
  const ss = SpreadsheetApp.openById(src.spreadsheetId);
  const sh = ss.getSheetByName(src.sheetName);
  if (!sh) return { headers: [], rows: [] };

  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return { headers: [], rows: [] };

  return {
    headers: values[0].map((h) => String(h || "").trim()),
    rows: values.slice(1),
  };
}

/** -------------------- Search Logic -------------------- */

function hasAnyCriteria_(c) {
  const keys = ["firstName", "lastName", "mobile", "company", "email", "gst"];
  return keys.some((k) => String(c[k] || "").trim());
}

function searchInCache_(sheetData, tableLabel, ownerHeader, criteria) {
  const headers = sheetData.headers || [];
  const rows = sheetData.rows || [];
  if (!headers.length || !rows.length) return [];

  const idx = (h) => headers.findIndex((x) => x === h);

  const iOwner = idx(ownerHeader);

  // Standard fields (won’t crash if missing)
  const iFirst = idx("First Name");
  const iLast  = idx("Last Name");
  const iMob   = idx("Mobile Number");
  const iComp  = idx("Company");
  const iEmail = idx("Email ID");     // ✅ confirmed by you
  const iGst   = idx("GST Number");

  const qFirst = String(criteria.firstName || "").trim().toLowerCase();
  const qLast  = String(criteria.lastName || "").trim().toLowerCase();
  const qComp  = String(criteria.company || "").trim().toLowerCase();
  const qEmail = String(criteria.email || "").trim().toLowerCase();
  const qGst   = String(criteria.gst || "").trim().toLowerCase();
  const qMobN  = normalizeMobile_(criteria.mobile);

  const out = [];

  for (const r of rows) {
    const vOwner = iOwner >= 0 ? String(r[iOwner] || "").trim() : "";

    const vFirst = iFirst >= 0 ? String(r[iFirst] || "").trim() : "";
    const vLast  = iLast  >= 0 ? String(r[iLast] || "").trim() : "";
    const vComp  = iComp  >= 0 ? String(r[iComp] || "").trim() : "";
    const vEmail = iEmail >= 0 ? String(r[iEmail] || "").trim() : "";
    const vGst   = iGst   >= 0 ? String(r[iGst] || "").trim() : "";
    const vMob   = iMob   >= 0 ? String(r[iMob] || "").trim() : "";

    // AND only on fields provided
    if (qFirst && !vFirst.toLowerCase().includes(qFirst)) continue;
    if (qLast  && !vLast.toLowerCase().includes(qLast)) continue;
    if (qComp  && !vComp.toLowerCase().includes(qComp)) continue;
    if (qEmail && !vEmail.toLowerCase().includes(qEmail)) continue;
    if (qGst   && !vGst.toLowerCase().includes(qGst)) continue;
    if (qMobN  && !normalizeMobile_(vMob).includes(qMobN)) continue;

    out.push({
      table: tableLabel,
      owner: vOwner,
      company: vComp,
      firstName: vFirst,
      lastName: vLast,
      mobile: vMob,
      email: vEmail,
      gst: vGst,
    });

    if (out.length >= MAX_RESULTS_PER_TABLE) break;
  }

  return out;
}

function normalizeMobile_(s) {
  const digits = String(s || "").replace(/[^\d]/g, "");
  return digits.replace(/^91/, "");
}

/** -------------------- JSON Helpers -------------------- */

function safeJson_(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
