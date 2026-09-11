// https://script.google.com/macros/s/AKfycbxLsPfXtpRuKOoB956pb6VfO4_Hx1cPEVpiZApTMKjxig0iL3EwodQaHCGItGyUwMnhzQ/exec

/***** CONFIG *****/
const SPREADSHEET_ID   = '1L9yGqk0NCXDYAB7TeyOyXBEhSMs1f1aU0jbDOWzr9_s';
const PROJECT_SHEET    = 'Project';
const VALIDATION_SHEET = 'Validation Tables';

// Special “controls” in Validation Tables (optional)
const VISIBLE_COL_KEY  = 'Project Visible Columns';
const READONLY_COL_KEY = 'Project Readonly Columns';
const ORDER_COL_KEY    = 'Project Column Order';
// Add near your other CONFIG keys
const MULTI_COL_KEY = 'Project Multiselect Fields';

/***** RELATED SOURCES FOR CLIENT SELECTOR *****/
// Accounts source
const ACCOUNTS_SPREADSHEET_ID = '1K9JT7C88oOVdAvapDOieWaiYj6Wd_XRZ1CCNiYzUhG8';
const ACCOUNTS_SHEET_NAME     = 'Qualified Leads';   // <-- confirm this tab name

// Deals source
const DEALS_SPREADSHEET_ID = '1GoZiI3HMDA_Ohkr50wwQlCiYWnT5EcNgDW3dWiZAJU4';
const DEALS_SHEET_NAME     = 'Form responses 1';     // exact case matters

/***** EMAIL RECIPIENTS (Lead Mgmt Validation Tables — separate file) *****/
const EMAIL_VALIDATION_SPREADSHEET_ID = '1YxYSLVuBrNOp8fYdA3s1dLzR3KFW0IaVMUvJ2AvY4aQ'; // from your link
const EMAIL_VALIDATION_SHEET_NAME     = 'Validation Tables'; // <- if the actual tab name differs, set it here

// Expected headers in that sheet:
const COL_LEAD_OWNER = 'Lead Owner';
const COL_EMAIL      = 'Email';
const COL_CC         = 'CC';
const COL_BCC        = 'BCC';

//Email Exclusion Column:
const EMAIL_EXCLUDED_COLUMNS = ['Vendors','Timestamp','Task Name','Task Owner','Start Date','End Date','Budget (₹)','Actual Cost (₹)','Variance (₹)','PO Link','Invoice Link','Payment Receipt Link','Other Documents','Assigned Team','Task Status','Project Manager'];



/***** WEB HANDLERS *****/
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'noop';

    if (action === 'getProjects')   return jsonSuccess(getProjectsPayload_());
    if (action === 'getValidation') return jsonSuccess(getValidationPayload_());

    // NEW: provide Accounts / Deals options for client selector
    if (action === 'getClientOptions') {
      const source = (e.parameter && e.parameter.source) || 'accounts';
      if (source === 'accounts') return jsonSuccess({ options: getAccountsOptions_() });
      if (source === 'deals')    return jsonSuccess({ options: getDealsOptions_() });
      return jsonError('Unknown source for getClientOptions', 400);
    }

    return jsonError('Unknown action: ' + action, 400);
  } catch (err) {
    console.error('doGet error:', err);
    return jsonError(String(err), 500);
  }
}

function doPost(e) {
  try {
    const payload = parsePostBody_(e);
    const action = payload.action || 'noop';

    if (action === 'addOrUpdateProject') {
      const result = addOrUpdateProject_(payload.data || {});
      return jsonSuccess({ ok: true, ...result });
    }

    return jsonError('Unknown action: ' + action, 400);
  } catch (err) {
    console.error('doPost error:', err);
    return jsonError(String(err), 500);
  }
}

/***** CORE: GET *****/
function getProjectsPayload_() {
  const { sheet, headers } = getSheetAndHeaders_(PROJECT_SHEET);
  const lastRow = sheet.getLastRow();
  const lastCol = headers.length;
  const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];
  const objects = rows.map(r => rowToObject_(headers, r));
  return { headers, rows: objects };
}

function getValidationPayload_() {
  const { sheet: projectSheet, headers: projectHeaders } = getSheetAndHeaders_(PROJECT_SHEET);
  const { sheet: valSheet } = getSheetAndHeaders_(VALIDATION_SHEET);

  const ref = readValidationTable_(valSheet); // { header -> [values] } + control columns
  const validation = {};
  projectHeaders.forEach(h => { if (ref[h] && ref[h].length) validation[h] = ref[h]; });

  const visibleColumns  = ref[VISIBLE_COL_KEY]  || projectHeaders;
  const readonlyColumns = ref[READONLY_COL_KEY] || [];
  const order           = ref[ORDER_COL_KEY]    || projectHeaders;
  const multiselectFields = (ref[MULTI_COL_KEY] || []).filter(Boolean);

  return { validation, visibleColumns, readonlyColumns, order, multiselectFields };
}

/***** CORE: POST (create/update) *****/
function addOrUpdateProject_(data) {
  const { sheet, headers } = getSheetAndHeaders_(PROJECT_SHEET);

  const idHeader       = 'Project ID (unique, auto-generated)';
  const tsHeader       = 'Timestamp';
  const budgetHeader   = 'Budget (₹)';
  const actualHeader   = 'Actual Cost (₹)';
  const varianceHeader = 'Variance (₹)';

  // 🔁 Always stamp a NEW timestamp on every add/update
  data[tsHeader] = new Date();

  if (!data[idHeader]) data[idHeader] = generateProjectId_();

  const budget = toNumber_(data[budgetHeader]);
  const actual = toNumber_(data[actualHeader]);
  if (!isNaN(budget) || !isNaN(actual)) {
    data[varianceHeader] = (isNaN(budget) ? 0 : budget) - (isNaN(actual) ? 0 : actual);
  }

  // Append (history-preserving)
  const rowArray = headers.map(h => normalizeForWrite_(data[h]));
  sheet.appendRow(rowArray);
  const newRow = sheet.getLastRow();

  // Build object of just-appended row for email
  const rowValues = sheet.getRange(newRow, 1, 1, headers.length).getValues()[0];
  const newRowObj = {};
  headers.forEach((h, i) => newRowObj[h] = rowValues[i]);

  // Project notifications are sent only by the CRM server. Do not send from
  // GAS, even if an older web-app deployment is still receiving submissions.
  console.log('Project email skipped: server-side operational email is authoritative.');

  return { created: true, projectId: data[idHeader], row: newRow };
}



/***** CLIENT OPTIONS (Accounts & Deals) *****/

function getAccountsOptions_() {
  return readAccountsOptionsFromSheet_(
    ACCOUNTS_SPREADSHEET_ID,
    ACCOUNTS_SHEET_NAME
  );
}

function getDealsOptions_() {
  return readDealsOptionsFromSheet_(
    DEALS_SPREADSHEET_ID,
    DEALS_SHEET_NAME
  );
}

/* ===========================
   ACCOUNTS OPTIONS (UPDATED)
   Based strictly on your headers:
   Lead Owner, First Name, Last Name, Company, Mobile Number, Lead ID...
=========================== */

function readAccountsOptionsFromSheet_(fileId, tabName) {
  const ss = SpreadsheetApp.openById(fileId);
  const sh = ss.getSheetByName(tabName);
  if (!sh) return [];

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => (h || "").toString().trim());

  const idx = (name) =>
    headers.findIndex(h => h.toLowerCase() === String(name).toLowerCase());

  // ✅ Based on your exact headers
  const iLeadId  = idx("Lead ID");
  const iCompany = idx("Company");
  const iFirst   = idx("First Name");
  const iLast    = idx("Last Name");
  const iMobile  = idx("Mobile Number");
  const iOwner   = idx("Lead Owner");

  const out = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const leadId = iLeadId >= 0 ? String(row[iLeadId] || "").trim() : "";
    if (!leadId) continue; // no Lead ID => skip

    const company = iCompany >= 0 ? String(row[iCompany] || "").trim() : "";
    const first   = iFirst   >= 0 ? String(row[iFirst]   || "").trim() : "";
    const last    = iLast    >= 0 ? String(row[iLast]    || "").trim() : "";
    const mobile  = iMobile  >= 0 ? String(row[iMobile]  || "").trim() : "";
    const owner   = iOwner   >= 0 ? String(row[iOwner]   || "").trim() : "";

    const fullName = [first, last].filter(Boolean).join(" ").trim();

    // ✅ Label includes Mobile so frontend search by mobile works
    const label = [
      company,
      fullName,
      mobile ? `📞 ${mobile}` : "",
      `LeadID: ${leadId}`
    ].filter(Boolean).join(" | ");

    out.push({
      id: leadId,
      label,
      owner,
      company,
      mobile
    });
  }

  // ✅ Deduplicate by Lead ID
  const seen = new Set();
  const deduped = [];
  for (const o of out) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    deduped.push(o);
  }

  deduped.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  return deduped;
}


/* ===========================
   DEALS OPTIONS
   Uses your Deal sheet headers:
   Account Owner, Company, Mobile Number, Deal Name, Deal Amount, Stage,
   Timestamp, Distribution Timestamp, Account ID...
=========================== */

function readDealsOptionsFromSheet_(fileId, tabName) {
  const ss = SpreadsheetApp.openById(fileId);
  const sh = ss.getSheetByName(tabName);
  if (!sh) return [];

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => (h || "").toString().trim());

  const idx = (name) =>
    headers.findIndex(h => h.toLowerCase() === String(name).toLowerCase());

  // ✅ Based strictly on the headers you shared earlier
  const iAccountId = idx("Account ID");
  const iDealName  = idx("Deal Name");
  const iDealAmt   = idx("Deal Amount");
  const iStage     = idx("Stage");
  const iCompany   = idx("Company");
  const iMobile    = idx("Mobile Number");
  const iOwner     = idx("Account Owner");
  const iTS        = idx("Timestamp");
  const iDistTS    = idx("Distribution Timestamp");

  const out = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const accountId = iAccountId >= 0 ? String(row[iAccountId] || "").trim() : "";
    const dealName  = iDealName  >= 0 ? String(row[iDealName]  || "").trim() : "";
    const dealAmt   = iDealAmt   >= 0 ? String(row[iDealAmt]   || "").trim() : "";
    const stage     = iStage     >= 0 ? String(row[iStage]     || "").trim() : "";
    const company   = iCompany   >= 0 ? String(row[iCompany]   || "").trim() : "";
    const mobile    = iMobile    >= 0 ? String(row[iMobile]    || "").trim() : "";
    const owner     = iOwner     >= 0 ? String(row[iOwner]     || "").trim() : "";
    const ts        = iTS        >= 0 ? String(row[iTS]        || "").trim() : "";
    const distTs    = iDistTS    >= 0 ? String(row[iDistTS]    || "").trim() : "";

    // ✅ Stable unique id per row (prevents “repetition” collisions)
    const id = [
      accountId,
      dealName,
      dealAmt,
      stage,
      (distTs || ts),
      `ROW${r + 1}`
    ].filter(Boolean).join("::");

    if (!id) continue;

    // ✅ Label includes Deal Name + Mobile so frontend search works
    const label = [
      dealName,
      company,
      mobile ? `📞 ${mobile}` : "",
      stage ? `Stage: ${stage}` : "",
      dealAmt ? `₹${dealAmt}` : "",
      accountId ? `AccountID: ${accountId}` : ""
    ].filter(Boolean).join(" | ");

    out.push({
      id,
      label,
      owner,
      company,
      mobile,
      dealName
    });
  }

  // ✅ Deduplicate by id
  const seen = new Set();
  const deduped = [];
  for (const o of out) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    deduped.push(o);
  }

  deduped.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  return deduped;
}
/***** HELPERS: Sheets & Data *****/
function getSheetAndHeaders_(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  const lastCol = sheet.getLastColumn();
  const headers = (lastCol > 0)
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(v => (v || '').toString().trim())
    : [];
  return { sheet, headers };
}

function headerIndexMap_(headers) {
  const map = {};
  headers.forEach((h, i) => map[h] = i + 1);
  return map;
}

function rowToObject_(headers, row) {
  const obj = {};
  for (let i = 0; i < headers.length; i++) obj[headers[i]] = row[i];
  return obj;
}

function findRowByValue_(sheet, col, value) {
  if (!col || !value) return -1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const values = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(value)) return i + 2;
  }
  return -1;
}

function normalizeForWrite_(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'number') return v;
  if (v === null || v === undefined) return '';
  return v;
}

function toNumber_(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[₹,\s]/g, '');
    const n = Number(cleaned);
    return isNaN(n) ? NaN : n;
  }
  return NaN;
}

function generateProjectId_() {
  const now = new Date();
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mi = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  const ms = pad(now.getMilliseconds(), 3);
  const rand = pad(Math.floor(Math.random() * 1000), 3);
  return `PRJ-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${rand}`;
}

/***** VALIDATION TABLE READER *****/
function readValidationTable_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return {};

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => (h || '').toString().trim());
  const out = {};

  headers.forEach((header, c) => {
    if (!header) return;
    const colVals = [];
    for (let r = 1; r < values.length; r++) {
      const v = (values[r][c] || '').toString().trim();
      if (v) colVals.push(v);
    }
    out[header] = colVals;
  });

  return out;
}

/***** JSON RESPONSES *****/
function jsonSuccess(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(message, status) {
  const body = { error: { message, status: status || 500 } };
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

/***** UTIL: POST parsing *****/
function parsePostBody_(e) {
  if (!e || !e.postData) return {};
  const ctype = (e.postData.type || '').toLowerCase();
  const data = e.postData.contents || '';
  if (ctype.includes('application/json')) {
    try { return JSON.parse(data); } catch (_) { return {}; }
  }
  // Accept form submissions too
  try { return JSON.parse(data); } catch (_) { return e.parameter || {}; }
}

function openEmailValidationSheet_() {
  const ss = SpreadsheetApp.openById(EMAIL_VALIDATION_SPREADSHEET_ID);
  const sh = ss.getSheetByName(EMAIL_VALIDATION_SHEET_NAME);
  if (!sh) throw new Error('Email validation sheet not found: ' + EMAIL_VALIDATION_SHEET_NAME);
  return sh;
}

function getEmailValidationMatrix_() {
  const sh = openEmailValidationSheet_();
  const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return { headers: [], rows: [] };
  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => (h || '').toString().trim());
  const rows = values.slice(1);
  return { headers, rows };
}

function colIndex_(headers, name) {
  const idx = headers.findIndex(h => h.toLowerCase() === String(name).toLowerCase());
  return idx; // -1 if not found
}

function lookupOwnerEmails_(ownerNames /* array of strings */) {
  const { headers, rows } = getEmailValidationMatrix_();
  if (!headers.length || !rows.length) return [];

  const idxOwner = colIndex_(headers, COL_LEAD_OWNER);
  const idxEmail = colIndex_(headers, COL_EMAIL);
  if (idxOwner === -1 || idxEmail === -1) return [];

  const want = new Set(
    ownerNames
      .map(s => (s || '').toString().trim().toLowerCase())
      .filter(Boolean)
  );
  const out = new Set();

  for (const r of rows) {
    const owner = (r[idxOwner] || '').toString().trim().toLowerCase();
    const email = (r[idxEmail] || '').toString().trim();
    if (owner && want.has(owner) && /@/.test(email)) {
      out.add(email);
    }
  }
  return Array.from(out);
}

function getGlobalList_(colName) {
  const { headers, rows } = getEmailValidationMatrix_();
  const idx = colIndex_(headers, colName);
  if (idx === -1) return [];
  const out = new Set();
  for (const r of rows) {
    const v = (r[idx] || '').toString().trim();
    if (v && /@/.test(v)) out.add(v);
  }
  return Array.from(out);
}

function isValidProjectEmail_(value) {
  return /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(String(value || '').trim());
}

function parseProjectClientEmails_(value) {
  const seen = {};
  return String(value || '')
    .split(',')
    .map(email => String(email || '').trim())
    .filter(email => isValidProjectEmail_(email))
    .filter(email => {
      const key = email.toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
}

function sendProjectUpdateEmail_(newRowObj) {
  const { sheet, headers } = getSheetAndHeaders_(PROJECT_SHEET);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const rows2D = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];

  // Identify this project
  const projectId = newRowObj['Project ID (unique, auto-generated)'] || '';
  const projName  = newRowObj['Project Name'] || '';
  const ts        = formatTsForEmail_(newRowObj['Timestamp']);

  // Build mobile-friendly history
  const htmlHistory = buildProjectHistoryMobileHtml_(headers, rows2D, projectId);

  // Recipients from Lead Mgmt Validation Tables
  const ownerNameCandidates = [
    newRowObj['Project Manager'],
    newRowObj['Account Owner'],
    newRowObj['Lead Owner'],
    newRowObj['Owner']
  ].filter(Boolean);

  const ownerToList = lookupOwnerEmails_(ownerNameCandidates);

  // Additional TO emails from Project table column: Client Email ID
  // Supports multiple comma-separated email IDs
  const clientEmailRaw = String(newRowObj['Client Email ID'] || '').trim();

  const clientToList = parseProjectClientEmails_(clientEmailRaw);

  const ccList  = getGlobalList_(COL_CC);
  const bccList = getGlobalList_(COL_BCC);

  // Merge owner emails + client emails into TO without duplicates
  const toList = [...ownerToList, ...clientToList]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const to = (toList.length ? toList : (ccList.length ? ccList : bccList)).join(',');

  const EXTRA_CC = ['sarabjeet@ridosports.com'];

  const ccCombined = [...ccList, ...EXTRA_CC]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const cc = ccCombined.join(',');
  const bcc = bccList.join(',');

  const status = newRowObj['Project Status'] || '';
  const stage  = newRowObj['Project Stage'] || newRowObj['Stage'] || '';
  const manager = newRowObj['Project Manager'] || newRowObj['Account Owner'] || '';

  const htmlSummary = `
    <div style="margin:0;padding:0;background:#f4f7fb;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;font-family:Arial,sans-serif;color:#1f2937;">
        
        <div style="background:#6495ED;padding:18px 20px;color:#ffffff;">
          <div style="font-size:20px;font-weight:bold;line-height:1.3;">Rido Sport Project Update</div>
          <div style="font-size:13px;opacity:0.95;margin-top:4px;">
            ${htmlEscape_(projName || '(Untitled Project)')}
          </div>
        </div>

        <div style="padding:18px 20px;">
          <p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;">
            Hi,
          </p>

          <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;">
            A project entry was <strong>added/updated</strong> at <strong>${ts}</strong>.
          </p>

          <div style="border:1px solid #dbe4f0;border-radius:10px;padding:14px 16px;background:#f9fbff;margin-bottom:18px;">
            ${buildKeyValueRow_('Project Name', projName)}
            ${buildKeyValueRow_('Project ID', projectId)}
            ${buildKeyValueRow_('Project Manager', manager)}
            ${buildKeyValueRow_('Project Status', status)}
            ${buildKeyValueRow_('Project Stage', stage)}
            ${buildKeyValueRow_('Client Email ID', clientEmailRaw)}
          </div>

          <div style="font-size:15px;font-weight:bold;color:#111827;margin:0 0 12px 0;">
            Project History
          </div>

          <div style="font-size:13px;color:#4b5563;line-height:1.6;margin-bottom:14px;">
            Latest update appears first.
          </div>

          ${htmlHistory}

          <p style="margin:20px 0 0 0;font-size:14px;line-height:1.6;">
            Warm Regards,<br/>Your CRM Team
          </p>
        </div>
      </div>
    </div>
  `;

  try {
    GmailApp.sendEmail(
      to || '',
      `Project Update: ${projName || '(Untitled)'} [${projectId}]`,
      ' ',
      {
        htmlBody: htmlSummary,
        cc: cc || '',
        bcc: bcc || '',
        name: 'Rido Sport Project Update'
      }
    );
  } catch (e) {
    console.error('Email send failed:', e);
  }
}

function htmlEscape_(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function linkify_(h, v) {
  if (!v) return '';
  const s = String(v).trim();
  const looksLikeUrl = /^https?:\/\/|^www\./i.test(s);

  if (/link|document/i.test(h) || looksLikeUrl) {
    const url = /^https?:\/\//i.test(s) ? s : ('https://' + s);
    const text = htmlEscape_(s.replace(/^https?:\/\//i,''));
    return `<a href="${url}" target="_blank" style="color:#2563eb;text-decoration:none;word-break:break-all;">${text}</a>`;
  }

  return htmlEscape_(s);
}

function formatTsForEmail_(v) {
  if (!(v instanceof Date)) {
    const d = new Date(v);
    if (isNaN(d)) return htmlEscape_(v);
    v = d;
  }

  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const dd = pad(v.getDate());
  const mm = pad(v.getMonth() + 1);
  const yyyy = v.getFullYear();
  const HH = pad(v.getHours());
  const MI = pad(v.getMinutes());
  const SS = pad(v.getSeconds());
  const MS = pad(v.getMilliseconds(), 3);

  return `${dd}${mm}${yyyy} ${HH}${MI}${SS}${MS}`;
}

function buildKeyValueRow_(label, value) {
  if (!value) return '';
  return `
    <div style="margin-bottom:8px;font-size:13px;line-height:1.5;">
      <span style="font-weight:bold;color:#374151;">${htmlEscape_(label)}:</span>
      <span style="color:#111827;"> ${htmlEscape_(value)}</span>
    </div>
  `;
}

function buildProjectHistoryMobileHtml_(headers, rows2D, projectId) {
  const includedIdx = headers
    .map((h, i) => EMAIL_EXCLUDED_COLUMNS.includes(h) ? null : i)
    .filter(i => i !== null);

  const ID_COL = 'Project ID (unique, auto-generated)';
  const idIdx = headers.findIndex(h => h === ID_COL);
  if (idIdx === -1) {
    return '<p style="font-family:Arial,sans-serif;"><em>Project ID column not found.</em></p>';
  }

  const filtered = rows2D.filter(r => String(r[idIdx]) === String(projectId));
  if (!filtered.length) {
    return `<p style="font-family:Arial,sans-serif;"><em>No rows found for Project ID: ${htmlEscape_(projectId)}</em></p>`;
  }

  const tsIdx = headers.findIndex(h => h === 'Timestamp');
  const sorted = filtered.slice().sort((a, b) => {
    const da = new Date(a[tsIdx]);
    const db = new Date(b[tsIdx]);
    return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
  });

  const cards = sorted.map((row, idx) => {
    const tsValue = tsIdx > -1 ? formatTsForEmail_(row[tsIdx]) : '';
    const fieldsHtml = includedIdx
      .filter(i => headers[i] !== 'Timestamp')
      .map(i => {
        const h = headers[i];
        const v = row[i];
        if (v === '' || v == null) return '';
        const val = linkify_(h, v);

        return `
          <div style="padding:8px 0;border-top:1px solid #eef2f7;">
            <div style="font-size:11px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px;">
              ${htmlEscape_(h)}
            </div>
            <div style="font-size:13px;line-height:1.5;color:#111827;word-break:break-word;">
              ${val}
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <div style="border:1px solid #dbe4f0;border-radius:12px;background:#ffffff;margin:0 0 14px 0;overflow:hidden;">
        <div style="background:${idx === 0 ? '#eaf3ff' : '#f8fafc'};padding:12px 14px;border-bottom:1px solid #e5e7eb;">
          <div style="font-size:13px;font-weight:bold;color:#111827;">
            ${idx === 0 ? 'Latest Update' : 'Previous Update'}
          </div>
          <div style="font-size:12px;color:#4b5563;margin-top:3px;">
            ${tsValue}
          </div>
        </div>
        <div style="padding:0 14px 10px 14px;">
          ${fieldsHtml || '<div style="padding:10px 0;font-size:13px;color:#6b7280;">No additional fields.</div>'}
        </div>
      </div>
    `;
  }).join('');

  return `<div style="width:100%;">${cards}</div>`;
}
