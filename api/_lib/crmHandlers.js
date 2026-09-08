import { DRIVE_FOLDERS } from "./crmConfig.js";
import {
  appendValues,
  buildRow,
  getValues,
  optionsFromValues,
  resolveSheetTitle,
  rowsToObjects,
  updateValues,
  uploadDriveFile,
} from "./googleSheets.js";

const FILE_FIELDS = ["Attach Purchase Order", "Attach Drawing", "Attach BOQ", "Proforma Invoice"];

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

export async function getValidationOptions(validationConfig, sheetNames) {
  const sheetName = await resolveSheetTitle(validationConfig.spreadsheetId, sheetNames);
  const values = await getValues(validationConfig.spreadsheetId, sheetName);
  return optionsFromValues(values);
}

export async function handleDealPost({ dealsConfig, ordersConfig, payload }) {
  const action = String(payload?.action || "").trim();
  const data = payload?.data || payload || {};

  if (!action || action === "updateDeal") {
    await appendTableRow(dealsConfig, data);
    return { ok: true };
  }

  if (action === "createOrder") {
    const orderId = data["Order ID"];
    if (!orderId) throw new Error("Missing Order ID in createOrder payload.");
    const uploaded = await withUploadedFiles(data, `ORD ${orderId}${data["Deal Name"] ? ` - ${data["Deal Name"]}` : ""}`);
    await appendTableRow(ordersConfig, uploaded);
    await appendTableRow(dealsConfig, clearFileFields(uploaded));
    return { ok: true, orderId };
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
  await appendTableRow(ordersConfig, uploaded);
  return { ok: true, orderId };
}

export async function handleSalesTrackerPost(config, payload) {
  const data = payload || {};
  const sheetName = await resolveSheetTitle(config.spreadsheetId, config.sheetNames);
  const values = await getValues(config.spreadsheetId, sheetName);
  const headers = values[0] || [];
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
