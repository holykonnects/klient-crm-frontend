import { SHEETS } from "../_lib/crmConfig.js";
import { appendRows, appendValues, buildRow, formatTimestamp, getValues, googleFetch, resolveSheetTitle, rowsToObjects, updateValues } from "../_lib/googleSheets.js";
import { notifyProjectSubmitted, notifyProjectTaskChanged, notifyProjectTasksImported } from "../_lib/operationalEmails.js";
import { ensureUpdateAuditHeaders, withUpdateAudit } from "../_lib/updateAudit.js";

const PROJECT_ID = "Project ID (unique, auto-generated)";
export const DELIVERY_PIN_HEADER = "Delivery PIN Code";
export const PROJECT_TASK_HEADERS = [
  "Task ID", "Project ID", "Project Name", "Task Name", "Description", "Task Owner", "Assigned Team",
  "Start Date", "Due Date", "Status", "Progress %", "Completion Date", "Notes", "Source Type",
  "Quote ID", "Quote Revision", "Quotation Line ID", "Quotation Item", "Quotation Quantity", "Quotation Unit",
  "Updated At", "Updated By", "Updated By Email", "Updated By Role",
];
const PROJECT_TASK_SHEET = "Project Tasks";
const TASK_STATUSES = new Set(["Not Started", "In Progress", "Blocked", "Completed", "Cancelled"]);

export function requireDeliveryPin(value) {
  const pin = String(value ?? "").trim();
  if (!/^\d{6}$/.test(pin)) throw new Error("Delivery PIN Code is required and must contain exactly 6 digits");
  return pin;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") return res.status(200).json(await handleGet(req.query || {}));
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      if (body.action === "addOrUpdateProject") return res.status(200).json(await addOrUpdateProject(body.data || {}));
      if (body.action === "saveProjectTask") return res.status(200).json(await saveProjectTask(body.data || {}));
      if (body.action === "importQuotationTasks") return res.status(200).json(await importQuotationTasks(body.data || {}));
      throw new Error(`Unknown projects action: ${body.action || ""}`);
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
  if (query.action === "getProjectTasks") return getProjectTasks(query.projectId || "");
  if (query.action === "getProjectTaskHistory") return getProjectTaskHistory(query.taskId || "");
  throw new Error(`Unknown projects action: ${query.action || ""}`);
}

export function latestProjectTasks(rows = []) {
  const latest = new Map();
  [...rows].reverse().forEach((row) => {
    const id = String(row?.["Task ID"] || "").trim();
    if (id && !latest.has(id)) latest.set(id, row);
  });
  return [...latest.values()];
}

export function normalizeProjectTask(submitted = {}, previous = {}, audit = {}, today = new Date().toISOString().slice(0, 10)) {
  const task = { ...previous, ...submitted, ...audit };
  const status = TASK_STATUSES.has(String(task.Status || "").trim()) ? String(task.Status).trim() : "Not Started";
  task.Status = status;
  const progress = Math.max(0, Math.min(100, Number(task["Progress %"]) || 0));
  task["Progress %"] = status === "Completed" ? 100 : Math.min(progress, 99);
  if (status === "Completed") task["Completion Date"] = task["Completion Date"] || today;
  if (status !== "Completed" && String(previous.Status || "") === "Completed") {
    task["Completion Date"] = "";
  }
  task["Source Type"] = task["Source Type"] || "Manual";
  return task;
}

export function legacyTaskFromProject(project = {}) {
  const projectId = String(project[PROJECT_ID] || "").trim();
  const taskName = String(project["Task Name"] || "").trim();
  if (!projectId || !taskName) return null;
  return {
    "Task ID": `LEGACY-${projectId}`, "Project ID": projectId, "Project Name": project["Project Name"] || "",
    "Task Name": taskName, Description: project["Task Description"] || project["Description"] || "",
    "Task Owner": project["Task Owner"] || "", "Assigned Team": project["Assigned Team"] || "",
    "Start Date": project["Start Date"] || "", "Due Date": project["End Date"] || project["Due Date"] || "",
    Status: project["Task Status (Not Started / In Progress / Completed)"] || project["Task Status"] || "Not Started",
    "Progress %": project["Task Progress %"] || (project["Task Status (Not Started / In Progress / Completed)"] === "Completed" ? 100 : 0),
    "Completion Date": project["Task Completion Date"] || "", Notes: project["Task Notes"] || "",
    "Source Type": "Legacy Project Task", "Updated At": project["Updated At"] || project.Timestamp || "",
    "Updated By": project["Updated By"] || "", "Updated By Email": project["Updated By Email"] || "",
    "Updated By Role": project["Updated By Role"] || "",
  };
}

async function ensureProjectTaskSheet() {
  const spreadsheetId = SHEETS.projects.spreadsheetId;
  let sheetName;
  try {
    sheetName = await resolveSheetTitle(spreadsheetId, [PROJECT_TASK_SHEET]);
  } catch {
    try {
      await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: PROJECT_TASK_SHEET, gridProperties: { frozenRowCount: 1 } } } }] }),
      });
    } catch (error) {
      if (!/already exists/i.test(error.message || "")) throw error;
    }
    sheetName = await resolveSheetTitle(spreadsheetId, [PROJECT_TASK_SHEET]);
  }
  const firstRow = await getValues(spreadsheetId, sheetName, "1:1");
  const currentHeaders = firstRow[0] || [];
  if (!currentHeaders.some((value) => String(value || "").trim())) {
    await updateValues(spreadsheetId, sheetName, 1, PROJECT_TASK_HEADERS);
  } else if (PROJECT_TASK_HEADERS.some((header) => !currentHeaders.includes(header))) {
    const merged = [...currentHeaders, ...PROJECT_TASK_HEADERS.filter((header) => !currentHeaders.includes(header))];
    await updateValues(spreadsheetId, sheetName, 1, merged);
    return { spreadsheetId, sheetName, headers: merged };
  }
  return { spreadsheetId, sheetName, headers: currentHeaders.length ? currentHeaders : PROJECT_TASK_HEADERS };
}

async function readProjectTasks() {
  const store = await ensureProjectTaskSheet();
  const values = await getValues(store.spreadsheetId, store.sheetName);
  return { ...store, rows: rowsToObjects(values) };
}

async function getProjectTasks(projectId) {
  const { headers, rows } = await readProjectTasks();
  const latest = latestProjectTasks(rows).filter((row) => !projectId || String(row["Project ID"]) === String(projectId));
  if (projectId && !latest.some((row) => String(row["Task ID"]) === `LEGACY-${projectId}`)) {
    const projectSheet = await resolveSheetTitle(SHEETS.projects.spreadsheetId, SHEETS.projects.sheetNames);
    const projects = rowsToObjects(await getValues(SHEETS.projects.spreadsheetId, projectSheet));
    const latestProject = [...projects].reverse().find((row) => String(row[PROJECT_ID]) === String(projectId));
    const legacy = legacyTaskFromProject(latestProject);
    if (legacy) latest.unshift(legacy);
  }
  return { ok: true, headers, rows: latest };
}

async function getProjectTaskHistory(taskId) {
  const { rows } = await readProjectTasks();
  return { ok: true, rows: rows.filter((row) => String(row["Task ID"]) === String(taskId)).reverse() };
}

function generateTaskId() {
  return `TSK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

async function saveProjectTask(payload) {
  const projectId = String(payload["Project ID"] || payload.projectId || "").trim();
  if (!projectId) throw new Error("Project ID is required for a task");
  if (!String(payload["Task Name"] || "").trim()) throw new Error("Task Name is required");
  const store = await readProjectTasks();
  const taskId = String(payload["Task ID"] || "").trim() || generateTaskId();
  const previous = latestProjectTasks(store.rows).find((row) => String(row["Task ID"]) === taskId) || {};
  const audited = await withUpdateAudit(payload);
  const task = normalizeProjectTask({ ...audited, "Task ID": taskId, "Project ID": projectId }, previous, {
    "Updated At": audited["Updated At"], "Updated By": audited["Updated By"],
    "Updated By Email": audited["Updated By Email"], "Updated By Role": audited["Updated By Role"],
  });
  await appendValues(store.spreadsheetId, store.sheetName, buildRow(store.headers, task, { timestampFields: [] }));
  const notification = await safely(async () => notifyProjectTaskChanged(task, previous, await latestProjectById(projectId)));
  return { ok: true, task, notification };
}

async function importQuotationTasks(payload) {
  const projectId = String(payload.projectId || payload["Project ID"] || "").trim();
  const lines = Array.isArray(payload.lines) ? payload.lines.slice(0, 100) : [];
  if (!projectId) throw new Error("Project ID is required for quotation task import");
  if (!lines.length) throw new Error("Select at least one quotation line");
  const store = await readProjectTasks();
  const latest = latestProjectTasks(store.rows);
  const existingKeys = new Set(latest.filter((row) => String(row["Project ID"]) === projectId).map((row) => String(row["Quotation Line ID"] || "")).filter(Boolean));
  const audited = await withUpdateAudit(payload);
  const created = [];
  const skipped = [];
  lines.forEach((line) => {
    const lineId = String(line.quotationLineId || "").trim();
    if (lineId && existingKeys.has(lineId)) { skipped.push(lineId); return; }
    const task = normalizeProjectTask({
      "Task ID": generateTaskId(), "Project ID": projectId, "Project Name": payload.projectName || "",
      "Task Name": line.taskName || line.item || "Quotation task", Description: line.description || "",
      "Task Owner": line.taskOwner || "", "Assigned Team": line.assignedTeam || "", "Start Date": line.startDate || "",
      "Due Date": line.dueDate || "", Status: "Not Started", "Progress %": 0, Notes: line.notes || "",
      "Source Type": "Quotation", "Quote ID": payload.quoteId || "", "Quote Revision": payload.quoteRevision || "",
      "Quotation Line ID": lineId, "Quotation Item": line.item || line.taskName || "",
      "Quotation Quantity": line.quantity ?? "", "Quotation Unit": line.unit || "",
      updatedByName: payload.updatedByName, updatedByEmail: payload.updatedByEmail,
    }, {}, {
      "Updated At": audited["Updated At"], "Updated By": audited["Updated By"],
      "Updated By Email": audited["Updated By Email"], "Updated By Role": audited["Updated By Role"],
    });
    created.push(task);
    if (lineId) existingKeys.add(lineId);
  });
  if (created.length) await appendRows(store.spreadsheetId, store.sheetName, created.map((task) => buildRow(store.headers, task, { timestampFields: [] })));
  const notification = await safely(async () => notifyProjectTasksImported(created, await latestProjectById(projectId)));
  return { ok: true, created: created.length, skipped: skipped.length, tasks: created, notification };
}

async function latestProjectById(projectId) {
  const sheetName = await resolveSheetTitle(SHEETS.projects.spreadsheetId, SHEETS.projects.sheetNames);
  const rows = rowsToObjects(await getValues(SHEETS.projects.spreadsheetId, sheetName));
  return [...rows].reverse().find((row) => String(row[PROJECT_ID]) === String(projectId)) || {};
}

async function getProjectsPayload() {
  const sheetName = await resolveSheetTitle(SHEETS.projects.spreadsheetId, SHEETS.projects.sheetNames);
  const values = await getValues(SHEETS.projects.spreadsheetId, sheetName);
  const headers = await ensureProjectHeaders(sheetName, values[0] || []);
  return { headers, rows: rowsToObjects(values) };
}

async function getValidationPayload() {
  const projectSheet = await resolveSheetTitle(SHEETS.projects.spreadsheetId, SHEETS.projects.sheetNames);
  const validationSheet = await resolveSheetTitle(SHEETS.projects.spreadsheetId, SHEETS.projects.validationSheetNames);
  const projectValues = await getValues(SHEETS.projects.spreadsheetId, projectSheet, "1:1");
  const validationValues = await getValues(SHEETS.projects.spreadsheetId, validationSheet);
  const projectHeaders = await ensureProjectHeaders(projectSheet, projectValues[0] || []);
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
  const existingHeaders = values[0] || [];
  if (!existingHeaders.length) throw new Error(`No headers found in ${sheetName}`);
  const headers = await ensureProjectHeaders(sheetName, existingHeaders);
  const data = await withUpdateAudit({
    ...payload,
    [DELIVERY_PIN_HEADER]: requireDeliveryPin(payload[DELIVERY_PIN_HEADER]),
    Timestamp: formatTimestamp(),
  });
  data[PROJECT_ID] = data[PROJECT_ID] || generateProjectId();
  const budget = toNumber(data["Budget (₹)"]);
  const actual = toNumber(data["Actual Cost (₹)"]);
  if (Number.isFinite(budget) || Number.isFinite(actual)) data["Variance (₹)"] = (budget || 0) - (actual || 0);

  await appendValues(SHEETS.projects.spreadsheetId, sheetName, buildRow(headers, data));
  const existingRows = rowsToObjects(values).filter((row) => String(row[PROJECT_ID]) === String(data[PROJECT_ID]));
  const notification = await safely(() => notifyProjectSubmitted(headers, data, [...existingRows, data]));
  return { ok: true, created: true, projectId: data[PROJECT_ID], notification };
}

async function ensureProjectHeaders(sheetName, existingHeaders) {
  const auditHeaders = await ensureUpdateAuditHeaders(SHEETS.projects, sheetName, existingHeaders);
  if (auditHeaders.includes(DELIVERY_PIN_HEADER)) return auditHeaders;
  const headers = [...auditHeaders, DELIVERY_PIN_HEADER];
  await updateValues(SHEETS.projects.spreadsheetId, sheetName, 1, headers);
  return headers;
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
