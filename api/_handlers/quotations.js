import { SHEETS } from "../_lib/crmConfig.js";
import { getValues, resolveSheetTitle, rowsToObjects } from "../_lib/googleSheets.js";

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
    const category = clean(pick(row, ["Category", "Cat"]));
    const subCategory = clean(pick(row, ["SubCategory", "Sub Category", "Sub-Category", "Sub"]));
    const itemCode = clean(pick(row, ["ItemCode", "Item Code", "Code"]));
    if (!category || !subCategory || !itemCode) return;

    categories.add(category);
    if (!subMap[category]) subMap[category] = new Set();
    subMap[category].add(subCategory);

    const key = `${category}|||${subCategory}`;
    if (!items[key]) items[key] = [];
    items[key].push({
      code: itemCode,
      name: clean(pick(row, ["Item Name", "Name"])) || itemCode,
      unit: clean(pick(row, ["Unit"])),
      rate: Number(clean(pick(row, ["Rate"])).replace(/[,\s₹]/g, "")) || 0,
      desc: clean(pick(row, ["Description", "Item Definition"])),
      imageUrl: clean(pick(row, ["ImageURL", "Image URL"])),
      itemType: category === "Flooring" ? "Non Equipment" : "Equipment",
    });
  });

  return {
    ok: true,
    data: {
      categories: [...categories],
      subcategories: Object.fromEntries(Object.entries(subMap).map(([key, set]) => [key, [...set]])),
      items,
      tcOptions: await getTcOptions(),
    },
  };
}

async function getAthleticCatalog() {
  const spreadsheetId = SHEETS.quotations.athleticSpreadsheetId;
  const presetsSheet = await resolveSheetTitle(spreadsheetId, ["Presets"]);
  const listsSheet = await resolveSheetTitle(spreadsheetId, ["Lists"]);
  const presets = rowsToObjects(await getValues(spreadsheetId, presetsSheet))
    .filter((row) => clean(row.Preset));
  const listValues = await getValues(spreadsheetId, listsSheet);
  const [headers = [], ...rows] = listValues;
  const lists = Object.fromEntries(headers.map((header, columnIndex) => [
    clean(header),
    [...new Set(rows.map((row) => clean(row[columnIndex])).filter(Boolean))],
  ]).filter(([header]) => header));
  return { ok: true, data: { presets, lists } };
}

async function getTcOptions() {
  try {
    const sheetName = await resolveSheetTitle(SHEETS.quotations.referenceSpreadsheetId, SHEETS.quotations.termsSheetNames);
    const values = await getValues(SHEETS.quotations.referenceSpreadsheetId, sheetName, "2:2");
    return (values[0] || []).map(clean).filter(Boolean);
  } catch {
    return ["Equipment", "Flooring"];
  }
}

async function getLeadsForUser(user) {
  const loginRows = await getLoginRows();
  if (!canUseQuotation(user, loginRows)) throw new Error("Unauthorized: no access to Quotation");
  const role = clean(loginRows.find((r) => clean(r["Login Username"]).toLowerCase() === clean(user).toLowerCase())?.Role);
  const isAdmin = role.toLowerCase() === "admin";

  const sheetName = await resolveSheetTitle(SHEETS.leads.spreadsheetId, SHEETS.leads.sheetNames);
  const leads = rowsToObjects(await getValues(SHEETS.leads.spreadsheetId, sheetName));
  const entries = leads
    .filter((lead) => isAdmin || clean(lead["Lead Owner"]).toLowerCase() === clean(user).toLowerCase())
    .map((lead) => [lead.Company, `${clean(lead["First Name"])} ${clean(lead["Last Name"])}`.trim(), lead["Mobile Number"]]
      .map(clean)
      .filter(Boolean)
      .join(" | "))
    .filter(Boolean);

  return { ok: true, entries: [...new Set(entries)] };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    const action = clean(req.query.action);
    if (action === "getCatalog") {
      return res.status(200).json(req.query.type === "athletic" ? await getAthleticCatalog() : await getCatalog());
    }
    if (action === "getLeadsForUser") return res.status(200).json(await getLeadsForUser(req.query.user));
    return res.status(400).json({ ok: false, error: "Invalid action" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}
