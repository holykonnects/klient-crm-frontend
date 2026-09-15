import { createHash, randomUUID } from "crypto";
import { SHEETS } from "./crmConfig.js";
import { googleFetch, rowsToObjects } from "./googleSheets.js";

export const clean = (value) => String(value ?? "").trim();
export const number = (value) => Number(String(value ?? "").replace(/[,₹\s]/g, "")) || 0;
export const active = (row) => clean(row.Active).toLowerCase() !== "no";
export const newId = (prefix) => `${prefix}-${randomUUID()}`;
export const quoteSheet = (name) => `'${name.replace(/'/g, "''")}'`;
export function column(index) {
  let result = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result;
  return result;
}
export function dateMs(value) {
  const s = clean(value);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  const time = m ? Date.parse(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T${(m[4] || "00").padStart(2, "0")}:${m[5] || "00"}:${m[6] || "00"}+05:30`) : Date.parse(s);
  return Number.isFinite(time) ? time : 0;
}
const cell = (value) => ({ userEnteredValue: typeof value === "number" ? { numberValue: value } : typeof value === "boolean" ? { boolValue: value } : { stringValue: String(value ?? "") } });
const formulaCell = (formula) => ({ userEnteredValue: { formulaValue: formula } });
const literal = (value) => `"${String(value).replace(/"/g, '""')}"`;
const criteria = (value) => literal(String(value).replace(/~/g, "~~").replace(/\*/g, "~*").replace(/\?/g, "~?"));

// Build all changes in memory and commit once. AppendCells chooses the row on
// Google's side, so simultaneous appends do not overwrite one another.
export async function openCostingStore(names, { headerOnly = [] } = {}, fetcher = googleFetch) {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS.costing.spreadsheetId}`;
  const metadata = await fetcher(`${base}?fields=sheets.properties`);
  const properties = (metadata.sheets || []).map((s) => s.properties);
  const wanted = [...new Set(names)];
  const existing = wanted.filter((name) => properties.some((p) => p.title === name));
  const params = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING" });
  existing.forEach((name) => params.append("ranges", quoteSheet(name) + (headerOnly.includes(name) ? "!1:1" : "")));
  const data = existing.length ? await fetcher(`${base}/values:batchGet?${params}`) : { valueRanges: [] };
  const requests = [];
  const tables = {};
  let nextSheetId = Math.max(0, ...properties.map((p) => p.sheetId)) + 1;
  for (const name of wanted) {
    const prop = properties.find((p) => p.title === name);
    const values = data.valueRanges?.[existing.indexOf(name)]?.values || [];
    tables[name] = {
      name, id: prop?.sheetId ?? nextSheetId++, exists: Boolean(prop),
      columns: prop?.gridProperties?.columnCount || 26,
      headers: (values[0] || []).map(clean), rows: rowsToObjects(values),
    };
  }
  const table = (name, required = []) => {
    const t = tables[name];
    if (!t) throw new Error(`Table not loaded: ${name}`);
    if (!t.exists) {
      if (!required.length) throw new Error(`Sheet not found: ${name}`);
      requests.push({ addSheet: { properties: { sheetId: t.id, title: name } } });
      t.exists = true;
    }
    const missing = [...new Set(required)].filter((h) => !t.headers.includes(h));
    if (missing.length) {
      const start = t.headers.length;
      t.headers.push(...missing);
      if (t.headers.length > t.columns) {
        requests.push({ appendDimension: { sheetId: t.id, dimension: "COLUMNS", length: t.headers.length - t.columns } });
        t.columns = t.headers.length;
      }
      requests.push({ updateCells: { start: { sheetId: t.id, rowIndex: 0, columnIndex: start }, rows: [{ values: missing.map(cell) }], fields: "userEnteredValue" } });
    }
    return t;
  };
  const patch = (t, rowIndex, changes, formulas = {}) => {
    for (const [key, value] of Object.entries({ ...changes, ...formulas })) {
      const col = t.headers.indexOf(key);
      if (col < 0) throw new Error(`Missing ${t.name} header: ${key}`);
      requests.push({ updateCells: { start: { sheetId: t.id, rowIndex: rowIndex + 1, columnIndex: col }, rows: [{ values: [key in formulas ? formulaCell(value) : cell(value)] }], fields: "userEnteredValue" } });
    }
    Object.assign(t.rows[rowIndex], changes);
  };
  const append = (t, rows, formulas = () => ({})) => {
    requests.push({ appendCells: { sheetId: t.id, rows: rows.map((row) => {
      const f = formulas(row);
      return { values: t.headers.map((h) => h in f ? formulaCell(f[h]) : cell(row[h])) };
    }), fields: "userEnteredValue" } });
    // Appended positions are unknown under concurrency; callers must not patch them.
  };
  return {
    table, patch, append, requests,
    consumeOnce(t, rowIndex, identity) {
      const token = "CostingConsumed_" + createHash("sha256").update(identity).digest("hex");
      // A deterministic named-range ID makes competing edits/syncs conflict
      // inside Google's atomic batch instead of appending twice.
      requests.push({ addNamedRange: { namedRange: {
        namedRangeId: token, name: token,
        range: { sheetId: t.id, startRowIndex: rowIndex + 1, endRowIndex: rowIndex + 2, startColumnIndex: 0, endColumnIndex: 1 },
      } } });
    },
    async commit() {
      if (!requests.length) return;
      try {
        await fetcher(`${base}:batchUpdate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requests }) });
      } catch (cause) {
        const error = new Error("Save could not be confirmed. Refresh and check the records before submitting again.");
        error.code = "SAVE_UNCONFIRMED";
        error.cause = cause;
        throw error;
      }
    },
  };
}

export const COST_HEADERS = ["Cost Sheet ID", "Timestamp", "Owner", "Linked Entity Type", "Linked Entity ID", "Linked Entity Name", "Client Name", "Project Type", "Status", "Grand Total", "Last Calculated At", "Notes"];
export const LINE_HEADERS = ["Cost Sheet ID", "Head Name", "Subcategory", "Expense Date", "Entered By", "Entry Tag", "Particular", "Details", "QTY", "Rate", "Amount", "GST %", "GST Amount", "Total Amount", "Attachment Link", "Voucher/Invoice No", "Payment Status", "Active", "Entry Timestamp", "Owner", "Linked Entity Type", "Linked Entity ID", "Linked Entity Name", "Client Name", "Project Type", "Payment Source", "Advance ID", "Advance Applied Amount", "Line Item ID", "Expense Request ID"];
export const ADVANCE_HEADERS = ["Advance ID", "Timestamp", "Cost Sheet ID", "Advance Date", "Advance Paid To", "Advance Amount", "Amount Used", "Balance Available", "Mode", "Reference No", "Collected By", "Remarks", "Active"];
export const REQUEST_HEADERS = ["Batch ID", "Request ID", "Timestamp", "Raised By", "Raised By Email", "Owner", "Particular", "Description", "Amount", "Approval Status", "Approved By", "Approved On", "Rejected By", "Rejected On", "Rejection Remarks", "Hold By", "Hold On", "Hold Remarks", "Linked Entity Type", "Linked Entity ID", "Linked Entity Name", "Existing Cost Sheet ID", "Existing Cost Sheet Name", "Attribution Status", "Operations Remarks", "Synced To Cost Line", "Synced On", "Active", "Last Updated On", "Action By", "Action By Email", "Action By Role"];
export const TABLE = { costs: SHEETS.costing.costSheetNames[0], lines: SHEETS.costing.lineItemSheetNames[0], advances: SHEETS.costing.advanceSheetNames[0], requests: "Expense Requests" };

function range(t, field) {
  const col = t.headers.indexOf(field);
  if (col < 0) throw new Error(`Missing ${t.name} header: ${field}`);
  return `${quoteSheet(t.name)}!${column(col)}2:${column(col)}`;
}
// Live formulas avoid read/compute/write races and repeated full-table reads.
export function costFormulas(lines, id, heads) {
  const sum = (head) => `=SUMIFS(${range(lines, "Total Amount")},${range(lines, "Cost Sheet ID")},${criteria(id)},${range(lines, "Active")},"<>No"${head == null ? "" : `,${range(lines, "Head Name")},${criteria(head)}`})`;
  return Object.fromEntries([["Grand Total", sum()], ...heads.map((head) => [head, sum(head)])]);
}
export function advanceFormulas(lines, advance) {
  const used = `SUMIFS(${range(lines, "Advance Applied Amount")},${range(lines, "Advance ID")},${criteria(advance["Advance ID"])},${range(lines, "Active")},"<>No")`;
  return { "Amount Used": `=${used}`, "Balance Available": `=MAX(${number(advance["Advance Amount"])}-${used},0)` };
}
