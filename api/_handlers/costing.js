import { SHEETS } from "../_lib/crmConfig.js";
import { getValues, resolveSheetTitle, rowsToObjects } from "../_lib/googleSheets.js";

const GAS_URL = process.env.COSTING_GAS_URL || "https://script.google.com/macros/s/AKfycbzqSTBoeAPCKx9GD9V3Dx7M8YobMzrwkOft49w2SQG3e25tlIW2SysmmuqnQXsAuvP4/exec";
const cache = new Map();

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const action = String(req.query.action || "");
      if (action === "getValidation") return res.status(200).json(await getValidation());
      if (action === "getCostSheets") return res.status(200).json(await getCostSheets(req.query.fields));
      if (action === "getCostSheetDetails") return res.status(200).json(await getCostSheetDetails(req.query.costSheetId));
      if (action === "searchCostLineItems") return res.status(200).json(await searchCostLineItems(req.query));
      if (action === "getEntities") return res.status(200).json(await getEntities(req.query));
      return proxyGet(req, res);
    }

    if (req.method === "POST") return proxyPost(req, res);
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || String(error) });
  }
}

async function getValidation() {
  return cached("validation", 30000, async () => {
    const config = SHEETS.costing;
    const sheetName = await resolveSheetTitle(config.validationSpreadsheetId, config.validationSheetNames);
    const values = await getValues(config.validationSpreadsheetId, sheetName);
    const [headers = [], ...rows] = values;
    const result = { heads: [], subcategories: {}, paymentStatus: [], validationHeaders: headers };
    headers.forEach((header, index) => {
      const entries = rows.map((row) => clean(row[index])).filter(Boolean);
      if (header === "Cost Heads") result.heads = entries;
      else if (header === "Payment Status") result.paymentStatus = entries;
      else if (clean(header)) result.subcategories[header] = entries;
    });
    return result;
  });
}

async function getCostSheets(fields) {
  const objects = await sheetObjects(SHEETS.costing.spreadsheetId, SHEETS.costing.costSheetNames, "cost-sheets", 15000);
  const wanted = parseFields(fields);
  if (!wanted.length) return objects;
  return objects.map((row) => Object.fromEntries(wanted.filter((field) => field in row).map((field) => [field, row[field]])));
}

async function getCostSheetDetails(costSheetId) {
  const id = clean(costSheetId);
  if (!id) return [];
  const objects = await sheetObjects(SHEETS.costing.spreadsheetId, SHEETS.costing.lineItemSheetNames, "cost-lines", 10000);
  return objects.filter((row) => clean(row["Cost Sheet ID"]) === id);
}

async function searchCostLineItems(query) {
  const rows = await sheetObjects(SHEETS.costing.spreadsheetId, SHEETS.costing.lineItemSheetNames, "cost-lines", 10000);
  const q = clean(query.q).toLowerCase();
  const searchColumn = clean(query.searchColumn || "all");
  const matchMode = clean(query.matchMode || "contains");
  const groupBy = clean(query.groupBy || "Linked Entity Name");
  const limit = Math.max(1, Math.min(500, Number(query.limit) || 500));
  const offset = Math.max(0, Number(query.offset) || 0);
  const filtered = rows.filter((row) => {
    if ("Active" in row && !isActive(row.Active)) return false;
    if (query.entityType && clean(row["Linked Entity Type"]) !== clean(query.entityType)) return false;
    if (query.paymentStatus && clean(row["Payment Status"]) !== clean(query.paymentStatus)) return false;
    if (query.head && clean(row["Head Name"]) !== clean(query.head)) return false;
    if (!q) return true;
    const values = searchColumn === "all" ? Object.values(row) : [row[searchColumn]];
    return values.some((value) => matches(clean(value).toLowerCase(), q, matchMode));
  }).sort((a, b) => dateMs(b["Expense Date"] || b["Entry Timestamp"]) - dateMs(a["Expense Date"] || a["Entry Timestamp"]));

  const totals = filtered.reduce((sum, row) => {
    sum.qty += number(row.QTY);
    sum.amount += number(row.Amount);
    sum.gst += number(row["GST Amount"]);
    sum.totalAmount += number(row["Total Amount"] || number(row.Amount) + number(row["GST Amount"]));
    return sum;
  }, { qty: 0, amount: 0, gst: 0, totalAmount: 0 });
  const groups = new Map();
  filtered.forEach((row) => {
    const key = clean(row[groupBy]) || "Unassigned";
    const current = groups.get(key) || { key, count: 0, qty: 0, amount: 0, gst: 0, totalAmount: 0 };
    current.count += 1;
    current.qty += number(row.QTY);
    current.amount += number(row.Amount);
    current.gst += number(row["GST Amount"]);
    current.totalAmount += number(row["Total Amount"] || number(row.Amount) + number(row["GST Amount"]));
    groups.set(key, current);
  });
  return { success: true, rows: filtered.slice(offset, offset + limit), totalCount: filtered.length, totals, groupedTotals: [...groups.values()].sort((a, b) => b.totalAmount - a.totalAmount), limit, offset };
}

async function getEntities(query) {
  const type = clean(query.type);
  const config = { Account: SHEETS.accounts, Deal: SHEETS.deals, Project: SHEETS.projects, Order: SHEETS.orders }[type];
  if (!config) return { success: false, error: "Invalid type. Use Account|Deal|Project|Order" };
  const rows = await sheetObjects(config.spreadsheetId, config.sheetNames, `entities-${type}`, 15000);
  const owner = clean(query.owner);
  const admin = clean(query.role).toLowerCase() === "admin";
  const q = clean(query.q).toLowerCase();
  const aliases = {
    Account: { id: ["Account ID", "Lead ID"], name: ["Account Name", "Company"] },
    Deal: { id: ["Deal ID", "Account ID"], name: ["Deal Name", "Company"] },
    Project: { id: ["Project ID (unique, auto-generated)", "Project ID"], name: ["Project Name"] },
    Order: { id: ["Order ID"], name: ["Order Name", "Deal Name", "Company"] },
  }[type];
  const seen = new Set();
  const entities = rows.reduceRight((output, row) => {
    const id = first(row, aliases.id);
    const name = first(row, aliases.name);
    const rowOwner = first(row, ["Owner", "Account Owner", "Lead Owner", "Project Manager"]);
    if (!id || seen.has(id) || (!admin && owner && rowOwner !== owner)) return output;
    const company = first(row, ["Company", "Client Name", "Account Name"]);
    const mobile = first(row, ["Mobile Number", "Phone", "Contact Number"]);
    const display = [name, company, mobile, rowOwner].filter(Boolean).join(" | ");
    if (q && !display.toLowerCase().includes(q)) return output;
    seen.add(id);
    output.push({ id, name, company, mobile, owner: rowOwner, display });
    return output;
  }, []);
  return { success: true, entities };
}

async function sheetObjects(spreadsheetId, sheetNames, key, ttl) {
  return cached(key, ttl, async () => {
    const sheetName = await resolveSheetTitle(spreadsheetId, sheetNames);
    return rowsToObjects(await getValues(spreadsheetId, sheetName));
  });
}

async function proxyPost(req, res) {
  const response = await fetch(GAS_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(req.body || {}) });
  const text = await response.text();
  cache.clear();
  res.status(response.ok ? 200 : response.status);
  res.setHeader("Content-Type", response.headers.get("content-type") || "application/json; charset=utf-8");
  return res.send(text);
}

async function proxyGet(req, res) {
  const params = new URLSearchParams();
  Object.entries(req.query || {}).forEach(([key, value]) => { if (key !== "callback" && value != null) params.set(key, String(value)); });
  const response = await fetch(`${GAS_URL}?${params.toString()}`);
  const body = Buffer.from(await response.arrayBuffer());
  res.status(response.ok ? 200 : response.status);
  res.setHeader("Content-Type", response.headers.get("content-type") || "application/octet-stream");
  return res.send(body);
}

async function cached(key, ttl, loader) {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await loader();
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  return value;
}

function parseFields(value) { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return clean(value).split(",").filter(Boolean); } }
function clean(value) { return String(value ?? "").trim(); }
function number(value) { return Number(String(value ?? "").replace(/[,₹\s]/g, "")) || 0; }
function dateMs(value) { const parsed = new Date(value); return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0; }
function isActive(value) { return ["yes", "true", "active", "1"].includes(clean(value).toLowerCase()); }
function matches(value, q, mode) { return mode === "exact" ? value === q : mode === "startsWith" ? value.startsWith(q) : value.includes(q); }
function first(row, keys) { for (const key of keys) if (clean(row[key])) return clean(row[key]); return ""; }
