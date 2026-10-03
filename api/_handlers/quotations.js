import { SHEETS } from "../_lib/crmConfig.js";
import { appendValues, appendedRowNumber, buildRow, getValues, resolveSheetTitle, rowsToObjects, updateCell } from "../_lib/googleSheets.js";
import { buildQuotationSetWorkbook } from "../_lib/quotationSetExport.js";
import { exportQuotationToDrive } from "../_lib/quotationPdfExport.js";
import { getSavedQuote, listSavedQuotes, saveQuoteRevision } from "../_lib/quotationRegister.js";
import { parseQuotationAdminTable } from "../_lib/quotationAdmin.js";
import { buildTermsCatalog } from "../_lib/quotationTerms.js";
import { resolveLeadSourceIdentity } from "../_lib/leadSourceIdentity.js";

export const QUOTATION_ENGINE_VERSION = "quotation-v1";
const ADMIN_TABLES = {
  equipment: { book: "standard", sheetNames: ["Equipment BD"], readOnly: ["concat"] },
  terms: { book: "standard", sheetNames: ["tc"], readOnly: [] },
  rates: { book: "athletic", sheetNames: ["Rate Library"], readOnly: [] },
  presets: { book: "athletic", sheetNames: ["Presets"], readOnly: [] },
  lists: { book: "athletic", sheetNames: ["Lists"], readOnly: [] },
};

function clean(value) {
  return String(value || "").trim();
}

function normalizeHeader(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(row, names) {
  for (const name of names) {
    if (row[name] != null && clean(row[name])) return row[name];
  }
  const normalized = Object.fromEntries(Object.keys(row).map((key) => [normalizeHeader(key), key]));
  for (const name of names) {
    const key = normalized[normalizeHeader(name)];
    if (key && clean(row[key])) return row[key];
  }
  return "";
}

function canUseQuotation(user, rows) {
  const username = clean(user).toLowerCase();
  if (!username) return false;
  const row = rows.find((r) => clean(r["Login Username"]).toLowerCase() === username);
  if (!row) return false;
  if (clean(row.Role).toLowerCase() === "admin") return true;
  return clean(row["Page Access"]).split(",").map((x) => clean(x).toLowerCase()).includes("quotation");
}

function isAdmin(user, rows) {
  const username = clean(user).toLowerCase();
  return rows.some((row) => clean(row["Login Username"]).toLowerCase() === username && clean(row.Role).toLowerCase() === "admin");
}

function isRegisterUnavailable(error) {
  return /Quotation Register is not writable/i.test(error?.message || "");
}

function tableSpreadsheet(definition) {
  return definition.book === "athletic"
    ? SHEETS.quotations.athleticSpreadsheetId
    : SHEETS.quotations.referenceSpreadsheetId;
}

async function getAdminTable(table, user) {
  const definition = ADMIN_TABLES[table];
  if (!definition) throw new Error(`Unknown quotation configuration table: ${table}`);
  const loginRows = await getLoginRows();
  if (!isAdmin(user, loginRows)) { const error = new Error("Admin access is required"); error.status = 403; throw error; }
  const spreadsheetId = tableSpreadsheet(definition);
  const sheetName = await resolveSheetTitle(spreadsheetId, definition.sheetNames);
  const values = await getValues(spreadsheetId, sheetName);
  const parsed = parseQuotationAdminTable(values);
  return { ok: true, table, sheetName, ...parsed, readOnly: definition.readOnly, engineVersion: QUOTATION_ENGINE_VERSION };
}

async function saveAdminRow(table, user, submitted) {
  const definition = ADMIN_TABLES[table];
  if (!definition) throw new Error(`Unknown quotation configuration table: ${table}`);
  const loginRows = await getLoginRows();
  if (!isAdmin(user, loginRows)) { const error = new Error("Admin access is required"); error.status = 403; throw error; }
  const spreadsheetId = tableSpreadsheet(definition);
  const sheetName = await resolveSheetTitle(spreadsheetId, definition.sheetNames);
  const values = await getValues(spreadsheetId, sheetName);
  const { headers } = parseQuotationAdminTable(values);
  if (!headers.length) throw new Error(`No headers were found in quotation configuration sheet: ${sheetName}`);
  const editableHeaders = headers.filter((header) => header && !definition.readOnly.includes(header));
  const rowNumber = Number(submitted.__rowNumber) || 0;

  if (rowNumber >= 2) {
    await Promise.all(editableHeaders.map((header) => updateCell(spreadsheetId, sheetName, rowNumber, headers.indexOf(header) + 1, submitted[header] ?? "")));
    return { ok: true, created: false, rowNumber, engineVersion: QUOTATION_ENGINE_VERSION };
  }

  const appended = await appendValues(spreadsheetId, sheetName, buildRow(headers, submitted, { timestampFields: [] }));
  const createdRow = appendedRowNumber(appended);
  if (table === "equipment" && createdRow && headers.includes("concat")) {
    const concatColumn = headers.indexOf("concat") + 1;
    await updateCell(spreadsheetId, sheetName, createdRow, concatColumn, `=A${createdRow}&" : "&B${createdRow}&" : "&C${createdRow}`);
  }
  return { ok: true, created: true, rowNumber: createdRow, engineVersion: QUOTATION_ENGINE_VERSION };
}

async function getLoginRows() {
  const sheetName = await resolveSheetTitle(SHEETS.validation.spreadsheetId, ["CRM Login"]);
  const values = await getValues(SHEETS.validation.spreadsheetId, sheetName);
  return rowsToObjects(values);
}

async function getCatalog() {
  const sheetName = await resolveSheetTitle(
    SHEETS.quotations.referenceSpreadsheetId,
    SHEETS.quotations.equipmentSheetNames
  );
  const values = await getValues(SHEETS.quotations.referenceSpreadsheetId, sheetName);
  const rows = rowsToObjects(values);

  const categories = new Set();
  const subMap = {};
  const items = {};

  rows.forEach((row) => {
    const category = clean(pick(row, ["Court", "Category", "Cat"]));
    const subCategory = clean(pick(row, ["SubCategory", "Sub Category", "Sub-Category", "Sub"]));
    const itemCode = clean(pick(row, ["Item", "ItemCode", "Item Code", "Code"]));
    if (!category || !subCategory || !itemCode) return;

    categories.add(category);
    if (!subMap[category]) subMap[category] = new Set();
    subMap[category].add(subCategory);

    const key = `${category}|||${subCategory}`;
    if (!items[key]) items[key] = [];
    items[key].push({
      code: itemCode,
      name: clean(pick(row, ["Item Definition", "Item Name", "Name"])) || itemCode,
      unit: clean(pick(row, ["Unit"])),
      rate: Number(clean(pick(row, ["Unit Price", "Rate"])).replace(/[,\s₹]/g, "")) || 0,
      desc: clean(pick(row, ["Description", "Item Definition"])),
      imageUrl: clean(pick(row, ["Images", "ImageURL", "Image URL"])),
      itemType: category === "Flooring" ? "Non Equipment" : "Equipment",
    });
  });

  const terms = await getTermsCatalog();
  return {
    ok: true,
    data: {
      categories: [...categories],
      subcategories: Object.fromEntries(Object.entries(subMap).map(([key, set]) => [key, [...set]])),
      items,
      ...terms,
    },
  };
}

async function getAthleticCatalog() {
  const spreadsheetId = SHEETS.quotations.athleticSpreadsheetId;
  const presetsSheet = await resolveSheetTitle(spreadsheetId, ["Presets"]);
  const listsSheet = await resolveSheetTitle(spreadsheetId, ["Lists"]);
  const ratesSheet = await resolveSheetTitle(spreadsheetId, ["Rate Library"]);
  const presets = rowsToObjects(await getValues(spreadsheetId, presetsSheet))
    .filter((row) => clean(row.Preset));
  const rateLibrary = rowsToObjects(await getValues(spreadsheetId, ratesSheet))
    .map((row, index) => ({ ...row, __rowNumber: index + 2 }))
    .filter((row) => clean(row.Item));
  const listValues = await getValues(spreadsheetId, listsSheet);
  const [headers = [], ...rows] = listValues;
  const lists = Object.fromEntries(headers.map((header, columnIndex) => [
    clean(header),
    [...new Set(rows.map((row) => clean(row[columnIndex])).filter(Boolean))],
  ]).filter(([header]) => header));
  const equipmentCatalog = await getCatalog();
  return {
    ok: true,
    data: {
      ...equipmentCatalog.data,
      presets,
      lists,
      rateLibrary,
    },
  };
}

async function getTermsCatalog() {
  try {
    const sheetName = await resolveSheetTitle(SHEETS.quotations.referenceSpreadsheetId, SHEETS.quotations.termsSheetNames);
    const values = await getValues(SHEETS.quotations.referenceSpreadsheetId, sheetName, "A1:Z200");
    const result = buildTermsCatalog(values);
    return result.tcOptions.length ? result : { tcOptions: ["Equipment", "Flooring", "Athletic"], tcTerms: {} };
  } catch {
    return { tcOptions: ["Equipment", "Flooring", "Athletic"], tcTerms: {} };
  }
}

async function getLeadsForUser(user) {
  const loginRows = await getLoginRows();
  if (!canUseQuotation(user, loginRows)) throw new Error("Unauthorized: no access to Quotation");
  const role = clean(loginRows.find((r) => clean(r["Login Username"]).toLowerCase() === clean(user).toLowerCase())?.Role);
  const isAdmin = role.toLowerCase() === "admin";

  const sheetName = await resolveSheetTitle(SHEETS.leads.spreadsheetId, SHEETS.leads.sheetNames);
  const leads = rowsToObjects(await getValues(SHEETS.leads.spreadsheetId, sheetName));
  const leadOptions = leads
    .filter((lead) => isAdmin || clean(lead["Lead Owner"]).toLowerCase() === clean(user).toLowerCase())
    .map((lead) => {
      const contactName = `${clean(lead["First Name"])} ${clean(lead["Last Name"])}`.trim();
      const company = clean(lead.Company);
      const mobile = clean(lead["Mobile Number"]);
      const display = [company, contactName, mobile].filter(Boolean).join(" | ");
      const sourceIdentity = resolveLeadSourceIdentity(lead["Lead Source"], loginRows);
      return {
        value: display,
        display,
        leadId: clean(lead["Lead ID"]),
        company,
        contactName,
        mobile,
        email: clean(lead["Email ID"]),
        billingAddress: [lead.Street, lead.City, lead.State, lead.Country, lead.PinCode].map(clean).filter(Boolean).join(", "),
        gstNumber: clean(pick(lead, ["GST Number", "GSTIN", "GST No.", "Client GST Number"])),
        leadSourceName: sourceIdentity.name,
        leadSourceEmail: sourceIdentity.email,
      };
    })
    .filter((lead) => lead.value);

  const unique = new Map();
  leadOptions.forEach((lead) => unique.set(lead.value.toLowerCase(), lead));
  const availableLeads = [...unique.values()].sort((a, b) => a.display.localeCompare(b.display));

  return { ok: true, entries: availableLeads.map((lead) => lead.value), leads: availableLeads };
}

async function attachQuotationToLead(payload, pdfUrl) {
  const leadDisplay = clean(payload?.attach?.leadDisplay);
  if (!leadDisplay || !pdfUrl) return;
  const [company = "", , mobile = ""] = leadDisplay.split("|").map(clean);
  if (!company || !mobile) return;
  const sheetName = await resolveSheetTitle(SHEETS.leads.spreadsheetId, SHEETS.leads.sheetNames);
  const values = await getValues(SHEETS.leads.spreadsheetId, sheetName);
  const headers = values[0] || [];
  const companyColumn = headers.findIndex((header) => normalizeHeader(header) === "company");
  const mobileColumn = headers.findIndex((header) => normalizeHeader(header) === "mobilenumber");
  const linkColumn = headers.findIndex((header) => normalizeHeader(header) === "quotationlink");
  if (companyColumn < 0 || mobileColumn < 0 || linkColumn < 0) return;
  const rowIndex = values.slice(1).findIndex((row) => clean(row[companyColumn]).toLowerCase() === company.toLowerCase() && clean(row[mobileColumn]) === mobile);
  if (rowIndex >= 0) await updateCell(SHEETS.leads.spreadsheetId, sheetName, rowIndex + 2, linkColumn + 1, pdfUrl);
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const action = clean(req.query.action);
      if (action === "getCatalog") {
        return res.status(200).json(req.query.type === "athletic" ? await getAthleticCatalog() : await getCatalog());
      }
      if (action === "getLeadsForUser") return res.status(200).json(await getLeadsForUser(req.query.user));
      if (action === "listQuotes") {
        try { return res.status(200).json(await listSavedQuotes(req.query.user)); }
        catch (error) {
          if (isRegisterUnavailable(error)) return res.status(200).json({ ok: false, registerUnavailable: true, error: error.message });
          throw error;
        }
      }
      if (action === "getQuote") {
        try { return res.status(200).json(await getSavedQuote(req.query.user, req.query.quoteId, req.query.revision)); }
        catch (error) {
          if (isRegisterUnavailable(error)) return res.status(200).json({ ok: false, registerUnavailable: true, error: error.message });
          throw error;
        }
      }
      if (action === "getAdminTable") return res.status(200).json(await getAdminTable(clean(req.query.table), req.query.user));
      return res.status(400).json({ ok: false, error: "Invalid action" });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      if (body.action === "saveAdminRow") return res.status(200).json(await saveAdminRow(clean(body.table), body.user, body.row || {}));
      if (body.action === "saveQuote") {
        try { return res.status(200).json(await saveQuoteRevision(body.user, body.quote || {}, QUOTATION_ENGINE_VERSION)); }
        catch (error) {
          if (isRegisterUnavailable(error)) return res.status(200).json({ ok: false, registerUnavailable: true, error: error.message });
          throw error;
        }
      }
      if (body.action === "exportPdf") {
        const loginRows = await getLoginRows();
        if (!canUseQuotation(body.user, loginRows)) { const error = new Error("Unauthorized: no access to Quotation"); error.status = 403; throw error; }
        const output = await exportQuotationToDrive(body.payload || {});
        await attachQuotationToLead(body.payload || {}, output.pdfUrl).catch((error) => console.warn("Quotation lead link update failed", error));
        return res.status(200).json(output);
      }
      if (body.action === "exportSetWorkbook") {
        const loginRows = await getLoginRows();
        if (!canUseQuotation(body.user, loginRows)) { const error = new Error("Unauthorized: no access to Quotation"); error.status = 403; throw error; }
        const output = await buildQuotationSetWorkbook(body.payload || {});
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${output.fileName.replace(/"/g, "")}"`);
        return res.status(200).send(output.buffer);
      }
      return res.status(400).json({ ok: false, error: "Invalid action" });
    }
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, error: err.message || String(err) });
  }
}
