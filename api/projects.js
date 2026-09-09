import { SHEETS } from "./_lib/crmConfig.js";
import { appendValues, buildRow, formatTimestamp, getValues, resolveSheetTitle, rowsToObjects } from "./_lib/googleSheets.js";
import { notifyProjectSubmitted } from "./_lib/operationalEmails.js";

const PROJECT_ID = "Project ID (unique, auto-generated)";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") return res.status(200).json(await handleGet(req.query || {}));
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      if (body.action !== "addOrUpdateProject") throw new Error(`Unknown projects action: ${body.action || ""}`);
      return res.status(200).json(await addOrUpdateProject(body.data || {}));
    }
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
}

async function handleGet(query) {
  if (query.action === "getProjects") return getProjectsPayload();
  if (query.action === "getValidation") return getValidationPayload();
  if (query.action === "getClientOptions") return { options: await getClientOptions(query.source || "accounts") };
  throw new Error(`Unknown projects action: ${query.action || ""}`);
}

async function getProjectsPayload() {
  const sheetName = await resolveSheetTitle(SHEETS.projects.spreadsheetId, SHEETS.projects.sheetNames);
  const values = await getValues(SHEETS.projects.spreadsheetId, sheetName);
  return { headers: values[0] || [], rows: rowsToObjects(values) };
}

async function getValidationPayload() {
  const projectSheet = await resolveSheetTitle(SHEETS.projects.spreadsheetId, SHEETS.projects.sheetNames);
  const validationSheet = await resolveSheetTitle(SHEETS.projects.spreadsheetId, SHEETS.projects.validationSheetNames);
  const projectValues = await getValues(SHEETS.projects.spreadsheetId, projectSheet, "1:1");
  const validationValues = await getValues(SHEETS.projects.spreadsheetId, validationSheet);
  const projectHeaders = projectValues[0] || [];
  const controls = columnsToLists(validationValues);
  const validation = Object.fromEntries(projectHeaders.filter((header) => controls[header]?.length).map((header) => [header, controls[header]]));
  return {
    validation,
    visibleColumns: controls["Project Visible Columns"] || projectHeaders,
    readonlyColumns: controls["Project Readonly Columns"] || [],
    columnOrder: controls["Project Column Order"] || projectHeaders,
    multiselectFields: controls["Project Multiselect Fields"] || [],
  };
}

async function addOrUpdateProject(payload) {
  const sheetName = await resolveSheetTitle(SHEETS.projects.spreadsheetId, SHEETS.projects.sheetNames);
  const values = await getValues(SHEETS.projects.spreadsheetId, sheetName);
  const headers = values[0] || [];
  if (!headers.length) throw new Error(`No headers found in ${sheetName}`);
  const data = { ...payload, Timestamp: formatTimestamp() };
  data[PROJECT_ID] = data[PROJECT_ID] || generateProjectId();
  const budget = toNumber(data["Budget (₹)"]);
  const actual = toNumber(data["Actual Cost (₹)"]);
  if (Number.isFinite(budget) || Number.isFinite(actual)) data["Variance (₹)"] = (budget || 0) - (actual || 0);

  await appendValues(SHEETS.projects.spreadsheetId, sheetName, buildRow(headers, data));
  const existingRows = rowsToObjects(values).filter((row) => String(row[PROJECT_ID]) === String(data[PROJECT_ID]));
  const notification = await safely(() => notifyProjectSubmitted(headers, data, [...existingRows, data]));
  return { ok: true, created: true, projectId: data[PROJECT_ID], notification };
}

async function getClientOptions(source) {
  const config = source === "deals" ? SHEETS.deals : SHEETS.accounts;
  const sheetName = await resolveSheetTitle(config.spreadsheetId, config.sheetNames);
  const rows = rowsToObjects(await getValues(config.spreadsheetId, sheetName));
  const seen = new Set();
  return rows.reduceRight((output, row) => {
    const id = source === "deals"
      ? [row["Account ID"], row["Deal Name"], row.Timestamp].filter(Boolean).join("::")
      : String(row["Lead ID"] || "");
    if (!id || seen.has(id)) return output;
    seen.add(id);
    output.push({
      id,
      label: [row.Company, [row["First Name"], row["Last Name"]].filter(Boolean).join(" "), row["Deal Name"], row["Mobile Number"]].filter(Boolean).join(" | "),
      owner: row["Account Owner"] || row["Lead Owner"] || "",
      company: row.Company || "",
      mobile: row["Mobile Number"] || "",
      dealName: row["Deal Name"] || "",
    });
    return output;
  }, []).sort((a, b) => a.label.localeCompare(b.label));
}

function columnsToLists(values) {
  const [headers = [], ...rows] = values;
  return Object.fromEntries(headers.filter(Boolean).map((header, index) => [header, rows.map((row) => row[index]).filter((value) => String(value || "").trim())]));
}

function generateProjectId() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `PRJ-${stamp}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
}

function toNumber(value) {
  const parsed = Number(String(value ?? "").replace(/[₹,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : NaN;
}

async function safely(fn) {
  try { return await fn(); }
  catch (error) { return { sent: false, reason: error.message || String(error) }; }
}
