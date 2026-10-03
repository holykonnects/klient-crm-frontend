import { gzipSync, gunzipSync } from "zlib";
import { SHEETS } from "./crmConfig.js";
import {
  appendValues, buildRow, formatTimestamp, getValues, googleFetch,
  getSheetsAuthSubjects, resolveSheetTitle, rowsToObjects, updateValues,
} from "./googleSheets.js";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const HEADERS = [
  "Quote ID", "Revision", "Status", "Quote Type", "Quotation No", "Title",
  "Client Name", "Project Name", "Owner", "Payload", "PDF URL", "Working Copy URL",
  "Created At", "Updated At", "Updated By", "Updated By Email", "Engine Version",
];

function clean(value) {
  return String(value || "").trim();
}

function normalized(value) {
  return clean(value).toLowerCase();
}

function pick(row, names) {
  const entries = Object.entries(row || {});
  for (const name of names) {
    const found = entries.find(([key]) => normalized(key).replace(/[^a-z0-9]/g, "") === normalized(name).replace(/[^a-z0-9]/g, ""));
    if (found && clean(found[1])) return found[1];
  }
  return "";
}

function canUseQuotation(username, row) {
  if (!row) return false;
  if (normalized(row.Role) === "admin") return true;
  return clean(row["Page Access"]).split(",").map(normalized).includes("quotation");
}

function encodePayload(payload) {
  const value = `gz:${gzipSync(JSON.stringify(payload || {})).toString("base64")}`;
  if (value.length > 49000) throw new Error("This quotation is too large for one register cell. Split it into separate quotations.");
  return value;
}

function decodePayload(value) {
  const text = String(value || "");
  if (text.startsWith("gz:")) return JSON.parse(gunzipSync(Buffer.from(text.slice(3), "base64")).toString("utf8"));
  return JSON.parse(text || "{}");
}

async function loginRows() {
  const sheetName = await resolveSheetTitle(SHEETS.validation.spreadsheetId, ["CRM Login"]);
  return rowsToObjects(await getValues(SHEETS.validation.spreadsheetId, sheetName));
}

async function identityFor(user) {
  const rows = await loginRows();
  const row = rows.find((entry) => normalized(entry["Login Username"]) === normalized(user));
  if (!canUseQuotation(user, row)) {
    const error = new Error("Unauthorized: no access to Quotation");
    error.status = 403;
    throw error;
  }
  return {
    username: clean(user),
    name: clean(pick(row, ["Name", "Full Name", "Employee Name", "Login Entity", "User Name"])) || clean(user),
    email: clean(pick(row, ["Email ID", "Email", "Email Address", "Official Email"])),
    admin: normalized(row.Role) === "admin",
  };
}

async function ensureRegister() {
  const spreadsheetId = SHEETS.quotations.registerSpreadsheetId;
  const errors = [];
  for (const subject of getSheetsAuthSubjects()) {
    const auth = { scopes: [SHEETS_SCOPE], subject };
    let sheetName;
    try {
      try {
        sheetName = await resolveSheetTitle(spreadsheetId, SHEETS.quotations.registerSheetNames, auth);
      } catch {
        sheetName = SHEETS.quotations.registerSheetNames[0];
        try {
          await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requests: [{
                addSheet: {
                  properties: { title: sheetName, gridProperties: { frozenRowCount: 1 } },
                },
              }],
            }),
          }, auth);
        } catch (error) {
          if (!/already exists/i.test(error.message || "")) throw error;
        }
        sheetName = await resolveSheetTitle(spreadsheetId, [sheetName], auth);
      }
      const firstRow = await getValues(spreadsheetId, sheetName, "1:1", auth);
      if (!(firstRow[0] || []).some((value) => clean(value))) {
        await updateValues(spreadsheetId, sheetName, 1, HEADERS, auth);
      }
      return { spreadsheetId, sheetName, auth };
    } catch (error) {
      errors.push(error);
    }
  }
  const detail = errors.at(-1)?.message || "Google Sheets access was denied";
  throw new Error(`Quotation Register is not writable. Share spreadsheet ${spreadsheetId} with the service account as Editor, or set GOOGLE_SHEETS_DELEGATED_USER_EMAIL in Vercel to a Workspace user who can edit it. Google response: ${detail}`);
}

function summary(row) {
  return {
    quoteId: clean(row["Quote ID"]), revision: Number(row.Revision) || 1,
    status: clean(row.Status) || "Draft", quoteType: clean(row["Quote Type"]),
    quotationNo: clean(row["Quotation No"]), title: clean(row.Title),
    clientName: clean(row["Client Name"]), projectName: clean(row["Project Name"]),
    owner: clean(row.Owner), pdfUrl: clean(row["PDF URL"]), workingCopyUrl: clean(row["Working Copy URL"]),
    createdAt: clean(row["Created At"]), updatedAt: clean(row["Updated At"]),
    updatedBy: clean(row["Updated By"]), updatedByEmail: clean(row["Updated By Email"]),
  };
}

async function visibleRows(user) {
  const identity = await identityFor(user);
  const register = await ensureRegister();
  const rows = rowsToObjects(await getValues(register.spreadsheetId, register.sheetName, "", register.auth));
  return {
    ...register,
    identity,
    allRows: rows,
    rows: identity.admin ? rows : rows.filter((row) => normalized(row.Owner) === normalized(identity.username)),
  };
}

export async function listSavedQuotes(user) {
  const { rows } = await visibleRows(user);
  const latest = new Map();
  [...rows].reverse().forEach((row) => {
    const id = clean(row["Quote ID"]);
    if (id && !latest.has(id)) latest.set(id, summary(row));
  });
  return { ok: true, quotes: [...latest.values()] };
}

export async function getSavedQuote(user, quoteId, requestedRevision) {
  const { rows } = await visibleRows(user);
  const matches = rows.filter((row) => clean(row["Quote ID"]) === clean(quoteId));
  const revision = Number(requestedRevision) || 0;
  const row = revision ? matches.find((entry) => Number(entry.Revision) === revision) : matches.at(-1);
  if (!row) {
    const error = new Error("Saved quotation was not found");
    error.status = 404;
    throw error;
  }
  return { ok: true, quote: { ...summary(row), payload: decodePayload(row.Payload) } };
}

export async function saveQuoteRevision(user, submitted = {}, engineVersion = "quotation-v1") {
  const { spreadsheetId, sheetName, auth, identity, allRows } = await visibleRows(user);
  const quoteId = clean(submitted.quoteId) || `Q-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const existing = allRows.filter((row) => clean(row["Quote ID"]) === quoteId);
  if (existing.length && !identity.admin && normalized(existing[0].Owner) !== normalized(identity.username)) {
    const error = new Error("You do not have access to update this quotation");
    error.status = 403;
    throw error;
  }
  const revision = existing.reduce((max, row) => Math.max(max, Number(row.Revision) || 0), 0) + 1;
  const payload = submitted.payload || {};
  const meta = payload.meta || {};
  const now = formatTimestamp();
  const record = {
    "Quote ID": quoteId,
    Revision: revision,
    Status: clean(submitted.status) || "Draft",
    "Quote Type": clean(payload.quoteType),
    "Quotation No": clean(meta.quotationNo),
    Title: clean(meta.quotationTitle),
    "Client Name": clean(meta.clientName),
    "Project Name": clean(meta.projectName),
    Owner: clean(existing[0]?.Owner) || identity.username,
    Payload: encodePayload(payload),
    "PDF URL": clean(submitted.pdfUrl),
    "Working Copy URL": clean(submitted.workingCopyUrl),
    "Created At": clean(existing[0]?.["Created At"]) || now,
    "Updated At": now,
    "Updated By": identity.name,
    "Updated By Email": identity.email,
    "Engine Version": engineVersion,
  };
  await appendValues(spreadsheetId, sheetName, buildRow(HEADERS, record, { timestampFields: [] }), auth);
  return { ok: true, quote: summary(record) };
}
