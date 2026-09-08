import { DRIVE_FOLDERS } from "./crmConfig.js";
import {
  appendValues,
  buildRow,
  formatTimestamp,
  getValues,
  optionsFromValues,
  resolveSheetTitle,
  rowsToObjects,
  updateValues,
  uploadDriveFile,
} from "./googleSheets.js";
import {
  notifyDealSubmitted,
  notifyLeadSubmitted,
  notifyOrderSubmitted,
} from "./operationalEmails.js";

const FILE_FIELDS = ["Attach Purchase Order", "Attach Drawing", "Attach BOQ", "Proforma Invoice"];
const LEAD_TRANSFER_FIELDS = [
  "Lead Owner",
  "First Name",
  "Last Name",
  "Company",
  "Mobile Number",
  "Email ID",
  "Fax",
  "Website",
  "Lead Source",
  "Lead Status",
  "Industry",
  "Number of Employees",
  "Annual Revenue",
  "Social Media",
  "Description",
  "Street",
  "City",
  "State",
  "Country",
  "PinCode",
  "Additional Description",
  "Lead ID",
  "Prefilled Link",
];
const SALES_TRACKER_ENTITY_FIELDS = ["Field", "Field Selection"];

export async function getTable(config) {
  const sheetName = await resolveSheetTitle(config.spreadsheetId, config.sheetNames);
  const values = await getValues(config.spreadsheetId, sheetName);
  return rowsToObjects(values);
}

export async function appendTableRow(config, data) {
  const sheetName = await resolveSheetTitle(config.spreadsheetId, config.sheetNames);
  const values = await getValues(config.spreadsheetId, sheetName, "1:1");
  const headers = values[0] || [];
  if (!headers.length) throw new Error(`No headers found in ${sheetName}`);
  await appendValues(config.spreadsheetId, sheetName, buildRow(headers, data || {}));
  return { ok: true };
}

export async function handleLeadPost({ leadsConfig, accountsConfig, payload }) {
  const sheetName = await resolveSheetTitle(leadsConfig.spreadsheetId, leadsConfig.sheetNames);
  const values = await getValues(leadsConfig.spreadsheetId, sheetName);
  const headers = values[0] || [];
  if (!headers.length) throw new Error(`No headers found in ${sheetName}`);

  const data = { ...(payload || {}) };
  const timestamp = data.Timestamp || formatTimestamp();
  data.Timestamp = timestamp;
  data["Lead ID"] = data["Lead ID"] || findExistingLeadId(values, headers, data["Mobile Number"]) || generateLeadId(timestamp);
  data["Prefilled Link"] = data["Prefilled Link"] || buildLeadPrefilledLink(data);

  await appendValues(leadsConfig.spreadsheetId, sheetName, buildRow(headers, data));
  const notification = await notifySafely(() => notifyLeadSubmitted(headers, data));

  const qualifiedTransfer = await maybeTransferQualifiedLead({
    accountsConfig,
    lead: data,
  });

  return {
    ok: true,
    leadId: data["Lead ID"],
    qualifiedTransfer,
    notification,
  };
}

export async function getValidationOptions(validationConfig, sheetNames) {
  const sheetName = await resolveSheetTitle(validationConfig.spreadsheetId, sheetNames);
  const values = await getValues(validationConfig.spreadsheetId, sheetName);
  return optionsFromValues(values);
}

export async function handleDealPost({ dealsConfig, ordersConfig, payload }) {
  const action = String(payload?.action || "").trim();
  const data = payload?.data || payload || {};

  if (!action || action === "updateDeal") {
    const sheetName = await resolveSheetTitle(dealsConfig.spreadsheetId, dealsConfig.sheetNames);
    const values = await getValues(dealsConfig.spreadsheetId, sheetName, "1:1");
    const headers = values[0] || [];
    if (!headers.length) throw new Error(`No headers found in ${sheetName}`);
    await appendValues(dealsConfig.spreadsheetId, sheetName, buildRow(headers, data || {}));
    const notification = await notifySafely(() => notifyDealSubmitted(headers, data));
    return { ok: true, notification };
  }

  if (action === "createOrder") {
    const orderId = data["Order ID"];
    if (!orderId) throw new Error("Missing Order ID in createOrder payload.");
    const uploaded = await withUploadedFiles(data, `ORD ${orderId}${data["Deal Name"] ? ` - ${data["Deal Name"]}` : ""}`);
    const orderSheetName = await resolveSheetTitle(ordersConfig.spreadsheetId, ordersConfig.sheetNames);
    const orderValues = await getValues(ordersConfig.spreadsheetId, orderSheetName, "1:1");
    const orderHeaders = orderValues[0] || [];
    if (!orderHeaders.length) throw new Error(`No headers found in ${orderSheetName}`);
    await appendValues(ordersConfig.spreadsheetId, orderSheetName, buildRow(orderHeaders, uploaded || {}));
    await appendTableRow(dealsConfig, clearFileFields(uploaded));
    const notification = await notifySafely(() => notifyOrderSubmitted(orderHeaders, uploaded));
    return { ok: true, orderId, notification };
  }

  throw new Error(`Unknown deals action: ${action}`);
}

export async function handleOrderPost({ ordersConfig, payload }) {
  const action = String(payload?.action || "").trim();
  const data = payload?.data || payload || {};

  if (action && action !== "updateOrder") throw new Error(`Unknown orders action: ${action}`);
  const orderId = data["Order ID"];
  if (!orderId) throw new Error("Missing Order ID in updateOrder payload.");

  const uploaded = await withUploadedFiles(data, `ORD-UPDATE ${orderId}${data["Deal Name"] ? ` - ${data["Deal Name"]}` : ""}`);
  const sheetName = await resolveSheetTitle(ordersConfig.spreadsheetId, ordersConfig.sheetNames);
  const values = await getValues(ordersConfig.spreadsheetId, sheetName, "1:1");
  const headers = values[0] || [];
  if (!headers.length) throw new Error(`No headers found in ${sheetName}`);
  await appendValues(ordersConfig.spreadsheetId, sheetName, buildRow(headers, uploaded || {}));
  const notification = await notifySafely(() => notifyOrderSubmitted(headers, uploaded));
  return { ok: true, orderId, notification };
}

export async function handleSalesTrackerPost(config, payload) {
  const data = payload || {};
  const sheetName = await resolveSheetTitle(config.spreadsheetId, config.sheetNames);
  const values = await getValues(config.spreadsheetId, sheetName);
  const headers = await ensureSheetHeaders(config, sheetName, values[0] || [], SALES_TRACKER_ENTITY_FIELDS);
  if (!headers.length) throw new Error(`No headers found in ${sheetName}`);
  const row = buildRow(headers, data);

  if (data.mode === "edit" && data.originalSNo != null) {
    const snoIndex = headers.indexOf("S.No");
    if (snoIndex >= 0) {
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][snoIndex]) === String(data.originalSNo)) {
          await updateValues(config.spreadsheetId, sheetName, i + 1, row);
          return { ok: true, status: "updated" };
        }
      }
    }
  }

  await appendValues(config.spreadsheetId, sheetName, row);
  return { ok: true, status: "added" };
}

async function ensureSheetHeaders(config, sheetName, headers, requiredFields) {
  const next = [...(headers || [])];
  requiredFields.forEach((field) => {
    if (!next.includes(field)) next.push(field);
  });
  if (next.length !== (headers || []).length) {
    await updateValues(config.spreadsheetId, sheetName, 1, next);
  }
  return next;
}

async function notifySafely(fn) {
  try {
    return await fn();
  } catch (err) {
    return { sent: false, reason: err.message || String(err) };
  }
}

function findExistingLeadId(values, headers, mobileNumber) {
  const mobile = String(mobileNumber || "").trim();
  if (!mobile) return "";
  const mobileIndex = headers.indexOf("Mobile Number");
  const leadIdIndex = headers.indexOf("Lead ID");
  if (mobileIndex < 0 || leadIdIndex < 0) return "";

  for (let i = values.length - 1; i >= 1; i--) {
    const row = values[i] || [];
    if (String(row[mobileIndex] || "").trim() === mobile && row[leadIdIndex]) {
      return String(row[leadIdIndex]).trim();
    }
  }
  return "";
}

function generateLeadId(timestamp) {
  const parsed = parseTimestamp(timestamp) || new Date();
  const pad = (n, size = 2) => String(n).padStart(size, "0");
  return [
    parsed.getFullYear(),
    pad(parsed.getMonth() + 1),
    pad(parsed.getDate()),
    pad(parsed.getHours()),
    pad(parsed.getMinutes()),
    pad(parsed.getSeconds()),
    pad(parsed.getMilliseconds(), 3),
  ].join("");
}

function parseTimestamp(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  const text = String(value || "").trim();
  const indian = text.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (indian) {
    const [, dd, mm, yyyy, hh, min, ss, ms = "0"] = indian;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss), Number(ms));
  }
  const d = new Date(text);
  return Number.isFinite(d.getTime()) ? d : null;
}

function buildLeadPrefilledLink(data) {
  const base = process.env.LEAD_UPDATE_FORM_URL || "";
  if (!base) return "";
  const entries = {
    "entry.382320733": data["Lead Owner"] || data["First Name"],
    "entry.97376243": data["First Name"],
    "entry.461328421": data["Last Name"],
    "entry.595395094": data.Company,
    "entry.159263935": data["Mobile Number"],
    "entry.288566598": data["Email ID"],
    "entry.1830695020": data.Fax,
    "entry.1638620245": data.Website,
    "entry.1083761663": data["Lead Source"],
    "entry.396867408": data["Lead Status"],
    "entry.1376066188": data.Industry,
    "entry.43979889": data["Number of Employees"],
    "entry.1989724413": data["Annual Revenue"],
    "entry.1019765555": data["Social Media"],
    "entry.1922882768": data.Description,
    "entry.2064231740": data.Street,
    "entry.1963491498": data.City,
    "entry.1998507869": data.State,
    "entry.1748437282": data.Country,
    "entry.369502378": data.PinCode,
    "entry.1066602877": data["Additional Description"],
    "entry.832822168": data["Lead ID"],
  };
  const url = new URL(base);
  Object.entries(entries).forEach(([key, value]) => {
    if (value != null && value !== "") url.searchParams.set(key, value);
  });
  return url.toString();
}

async function maybeTransferQualifiedLead({ accountsConfig, lead }) {
  if (String(lead["Lead Status"] || "").trim().toLowerCase() !== "qualified") {
    return { ok: true, transferred: false, reason: "not_qualified" };
  }

  const sheetName = await resolveSheetTitle(accountsConfig.spreadsheetId, accountsConfig.sheetNames);
  const values = await getValues(accountsConfig.spreadsheetId, sheetName);
  const headers = values[0] || [];
  if (!headers.length) throw new Error(`No headers found in ${sheetName}`);

  const leadId = String(lead["Lead ID"] || "").trim();
  const leadIdIndex = headers.indexOf("Lead ID");
  if (leadId && leadIdIndex >= 0) {
    const exists = values.slice(1).some((row) => String(row[leadIdIndex] || "").trim() === leadId);
    if (exists) return { ok: true, transferred: false, reason: "already_exists" };
  }

  const accountData = {};
  LEAD_TRANSFER_FIELDS.forEach((field) => {
    accountData[field] = lead[field] || "";
  });
  accountData.Timestamp = formatTimestamp();
  accountData["Account Owner"] = lead["Lead Owner"] || lead["Account Owner"] || "";

  await appendValues(accountsConfig.spreadsheetId, sheetName, buildRow(headers, accountData));
  return { ok: true, transferred: true };
}

async function withUploadedFiles(data, prefix) {
  const next = { ...(data || {}) };
  for (const field of FILE_FIELDS) {
    const value = next[field];
    if (value && typeof value === "object") {
      const folderId = value.folderId || DRIVE_FOLDERS.attachments[field] || DRIVE_FOLDERS.defaultUpload;
      next[field] = await uploadDriveFile(value, folderId, prefix);
    }
  }
  return next;
}

function clearFileFields(data) {
  const next = { ...(data || {}) };
  FILE_FIELDS.forEach((field) => {
    next[field] = "";
  });
  return next;
}
