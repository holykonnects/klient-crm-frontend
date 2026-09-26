import { SHEETS } from "./crmConfig.js";
import { formatTimestamp, getValues, resolveSheetTitle, rowsToObjects, updateValues } from "./googleSheets.js";

export const UPDATE_AUDIT_HEADERS = ["Updated At", "Updated By", "Updated By Email", "Updated By Role"];

const clean = (value) => String(value ?? "").trim();
const normalize = (value) => clean(value).toLowerCase();
const identityHeaders = ["Login Email", "Email", "Email ID", "Login Username", "Username", "Name", "Full Name", "Employee Name"];

function valueFrom(row, aliases) {
  for (const alias of aliases) {
    const entry = Object.entries(row || {}).find(([key]) => normalize(key) === normalize(alias));
    if (entry && clean(entry[1])) return clean(entry[1]);
  }
  return "";
}

export function resolveLoginAudit(rows, submitted = {}, stamp = formatTimestamp()) {
  const candidates = [
    submitted.updatedByEmail,
    submitted["Updated By Email"],
    submitted.userEmail,
    submitted.actionByEmail,
    submitted.raisedByEmail,
    submitted.updatedByName,
    submitted["Updated By"],
    submitted.updatedBy,
    submitted.actionBy,
    submitted.raisedBy,
  ].map(normalize).filter(Boolean);
  if (!candidates.length) throw new Error("Logged-in updater details were not supplied");

  const matches = (rows || []).filter((row) => identityHeaders.some((header) => {
    const identity = normalize(valueFrom(row, [header]));
    return identity && candidates.includes(identity);
  }));
  if (matches.length !== 1) throw new Error(matches.length
    ? "Updater identity is duplicated in CRM Login"
    : "Updater identity was not found in CRM Login");

  const login = matches[0];
  const email = valueFrom(login, ["Login Email", "Email", "Email ID"]);
  if (!email) throw new Error("Updater CRM Login entry is missing an email address");
  const name = valueFrom(login, ["Login Username", "Username", "Name", "Full Name", "Employee Name"]) || email;
  return {
    ...submitted,
    updatedByName: name,
    updatedByEmail: email,
    updatedByRole: valueFrom(login, ["Role", "User Role"]),
    "Updated At": stamp,
    "Updated By": name,
    "Updated By Email": email,
    "Updated By Role": valueFrom(login, ["Role", "User Role"]),
  };
}

export async function withUpdateAudit(submitted) {
  const sheetName = await resolveSheetTitle(SHEETS.auth.spreadsheetId, SHEETS.auth.sheetNames);
  const rows = rowsToObjects(await getValues(SHEETS.auth.spreadsheetId, sheetName));
  return resolveLoginAudit(rows, submitted);
}

export async function ensureUpdateAuditHeaders(config, sheetName, headers) {
  const next = [...(headers || [])];
  UPDATE_AUDIT_HEADERS.forEach((header) => {
    if (!next.includes(header)) next.push(header);
  });
  if (next.length !== (headers || []).length) {
    await updateValues(config.spreadsheetId, sheetName, 1, next);
  }
  return next;
}
