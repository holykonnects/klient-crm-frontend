/************************************************************
 * INVENTORY CALCULATOR + BOOKING ENGINE (RIDO/KK)
 * Sheet-driven | Editable pack sizes | Stock reservation
 *
 * Inventory Spreadsheet:
 *  - Inventory Stock
 *  - Inventory Bookings
 *  - Inventory Transactions
 *  - Inventory Calc Inputs
 *  - Inventory Calc Config
 *
 * Validation Spreadsheet:
 *  - Inventory Validation
 ************************************************************/

const INVENTORY_SPREADSHEET_ID = "1yoh-yySFEvjZBpsPC9CBmghhldt7sZBD-wquTYktFPY";
const VALIDATION_SPREADSHEET_ID = "1YxYSLVuBrNOp8fYdA3s1dLzR3KFW0IaVMUvJ2AvY4aQ";
const VALIDATION_SHEET_NAME = "Inventory Validation";

const SHEET_SKU = "SKU";
const SHEET_STOCK = "Inventory Stock";
const SHEET_BOOKINGS = "Inventory Bookings";
const SHEET_TXN = "Inventory Transactions";
const SHEET_INPUTS = "Inventory Calc Inputs";
const SHEET_CONFIG = "Inventory Calc Config";

const STATUS_PENDING_REVIEW = "Pending Review";
const STATUS_HOLD = "Hold";
const STATUS_APPROVED = "Approved";
const STATUS_RELEASED = "Released";
const STATUS_DECLINED = "Declined";
const STATUS_DISPATCHED = "Dispatched";
const DEFAULT_BOOKING_HOLD_DAYS = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const CRM_LOGIN_SHEET_NAMES = ["crm login", "CRM Login", "Validation Tables"];

const INVENTORY_BOOKING_STATUS_CC = [
  "sidhant@ridosports.com",
  "sandeep@ridosports.com",
  "sarabjeet@ridosports.com",
  "info@klientkonnect.com",
];

const INVENTORY_BOOKING_REQUIREMENT_TO = [
  "sarabjeet@ridosports.com",
  "info@klientkonnect.com",
];

const EMAIL_FONT_STACK = "Montserrat, Arial, sans-serif";
const EMAIL_BODY_FONT_SIZE = "11px";
const EMAIL_TABLE_FONT_SIZE = "10px";


/** ---------- Output (JSON + JSONP) ---------- **/
function jsonOut_(obj, callback) {
  const json = JSON.stringify(obj);

  // JSONP mode (no CORS)
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  // Plain JSON
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/** OPTIONS: (Apps Script may ignore in some deployments, but kept) **/
function doOptions() {
  const out = ContentService.createTextOutput("");
  out.setHeader("Access-Control-Allow-Origin", "*");
  out.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  out.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return out;
}

/** ---------- Helpers ---------- **/
function getSheet_(ssId, name) {
  const ss = SpreadsheetApp.openById(ssId);
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`Missing sheet: ${name}`);
  return sh;
}

function safeStr_(v) {
  return String(v ?? "").trim();
}

function normalizeKey_(v) {
  // ✅ Fixes spacing + underscore issues reliably
  return safeStr_(v)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function asNum_(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2_(n) {
  return Math.round(asNum_(n) * 100) / 100;
}

function now_() {
  return new Date();
}

function idxMap_(headers) {
  const map = {};
  headers.forEach((h, i) => (map[String(h).trim()] = i));
  return map;
}

function getTable_(sheet) {
  const values = sheet.getDataRange().getValues();

  if (!values || !values.length) {
    return { headers: [], rows: [] };
  }

  const headers = values[0].map((h) => String(h).trim());

  if (values.length < 2) {
    return { headers, rows: [] };
  }

  const rows = values
    .slice(1)
    .filter((r) => r.some((c) => String(c).trim() !== ""));

  return { headers, rows };
}

// Concurrency-safe booking id
function buildBookingId_() {
  const d = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyyMMdd-HHmmss");
  const rnd = Math.floor(Math.random() * 900 + 100);
  return `INV-${d}-${rnd}`;
}

function isAdminRole_(role) {
  return String(role || "").toLowerCase().includes("admin");
}

function setIfPresent_(row, headerMap, headerName, value) {
  if (headerMap[headerName] != null) row[headerMap[headerName]] = value;
}

function getLocationFromData_(data) {
  return safeStr_(
    data.location ||
    data.stockLocation ||
    data.stockAvailableAt ||
    data.Location ||
    data["Stock Location"] ||
    data["Stock Available At"]
  );
}

function getLocationFromRow_(row, m) {
  if (m["Location"] != null) return safeStr_(row[m["Location"]]);
  if (m["Stock Location"] != null) return safeStr_(row[m["Stock Location"]]);
  if (m["Stock Available At"] != null) return safeStr_(row[m["Stock Available At"]]);
  return "";
}

function makeBlankRow_(headers) {
  return new Array(headers.length).fill("");
}

/** ---------- Routing ---------- **/
function doGet(e) {
  try {
    const action = safeStr_(e?.parameter?.action);
    const callback = safeStr_(e?.parameter?.callback); // JSONP

    if (action === "ping") return jsonOut_({ ok: true, ts: now_().toISOString() }, callback);

    if (action === "getValidation") {
      return jsonOut_({ ok: true, data: getValidation_() }, callback);
    }

    if (action === "getInputs") {
      const category = safeStr_(e.parameter.category);
      const variant = safeStr_(e.parameter.variant);
      return jsonOut_({ ok: true, data: getInputs_(category, variant) }, callback);
    }

    if (action === "getCalcConfig") {
      const category = safeStr_(e.parameter.category);
      const variant = safeStr_(e.parameter.variant);
      return jsonOut_({ ok: true, data: getCalcConfig_(category, variant) }, callback);
    }

    if (action === "getStock") {
      const category = safeStr_(e.parameter.category);
      return jsonOut_({ ok: true, data: getStock_(category) }, callback);
    }

    if (action === "getBookings") {
      const requestedBy = safeStr_(e.parameter.requestedBy);
      const role = safeStr_(e.parameter.role);
      return jsonOut_({ ok: true, data: getBookings_(requestedBy, role) }, callback);
    }

    if (action === "getInventoryMaterialValidation") {
      return jsonOut_({ ok: true, data: getInventoryMaterialValidation_() }, callback);
    }

    if (action === "getSkuMaster") {
      return jsonOut_({ ok: true, data: getSkuMaster_() }, callback);
    }

    if (action === "mutation") {
      const payloadRaw = safeStr_(e.parameter.payload);
      if (!payloadRaw) return jsonOut_({ ok: false, error: "Missing mutation payload" }, callback);

      const body = JSON.parse(payloadRaw);
      const result = runMutation_(body);

      return jsonOut_({ ok: true, data: result }, callback);
    }

    return jsonOut_({ ok: false, error: "Unknown action", action }, callback);
  } catch (err) {
    const callback = safeStr_(e?.parameter?.callback);
    return jsonOut_({ ok: false, error: String(err) }, callback);
  }
}

function doPost(e) {
  try {
    const raw = e.postData && e.postData.contents ? e.postData.contents : "";
    Logger.log("doPost raw payload => " + raw);

    const body = raw ? JSON.parse(raw) : {};
    Logger.log("doPost parsed body => " + JSON.stringify(body));

    const action = safeStr_(body.action);
    Logger.log("doPost action => " + action);

    if (action === "calculate") {
      Logger.log("Routing to calculate_");
      const result = calculate_(body.data || {});
      Logger.log("calculate_ result => " + JSON.stringify(result));
      return jsonOut_({ ok: true, data: result });
    }

    if (action === "createBooking") {
      Logger.log("Routing to createBooking_ with data => " + JSON.stringify(body.data || {}));
      const result = createBooking_(body.data || {});
      Logger.log("createBooking_ result => " + JSON.stringify(result));
      return jsonOut_({ ok: true, data: result });
    }

    if (action === "updateStock") {
      Logger.log("Routing to updateStock_ with data => " + JSON.stringify(body.data || {}));
      const result = updateStock_(body.data || {});
      Logger.log("updateStock_ result => " + JSON.stringify(result));
      return jsonOut_({ ok: true, data: result });
    }

    if (action === "setStock") {
      Logger.log("Routing to setStock_ with data => " + JSON.stringify(body.data || {}));
      const result = setStock_(body.data || {});
      Logger.log("setStock_ result => " + JSON.stringify(result));
      return jsonOut_({ ok: true, data: result });
    }

    if (action === "updateBookingStatus") {
      Logger.log("Routing to updateBookingStatus_ with data => " + JSON.stringify(body.data || {}));
      const result = updateBookingStatus_(body.data || {});
      Logger.log("updateBookingStatus_ result => " + JSON.stringify(result));
      return jsonOut_({ ok: true, data: result });
    }

    if (action === "createStockItem") {
      Logger.log("Routing to createStockItem_ with data => " + JSON.stringify(body.data || {}));
      const result = createStockItem_(body.data || {});
      Logger.log("createStockItem_ result => " + JSON.stringify(result));
      return jsonOut_({ ok: true, data: result });
    }

    Logger.log("Unknown action received => " + action);
    return jsonOut_({ ok: false, error: "Unknown action", action });
  } catch (err) {
    Logger.log("doPost error => " + (err && err.stack ? err.stack : String(err)));
    return jsonOut_({ ok: false, error: String(err) });
  }
}

/** ---------- Validation ---------- **/
function getValidation_() {
  const sh = getSheet_(VALIDATION_SPREADSHEET_ID, VALIDATION_SHEET_NAME);
  const { headers, rows } = getTable_(sh);
  const m = idxMap_(headers);

  const out = {};
  headers.forEach((h) => (out[h] = []));

  rows.forEach((r) => {
    headers.forEach((h) => {
      const v = safeStr_(r[m[h]]);
      if (v) out[h].push(v);
    });
  });

  Object.keys(out).forEach((k) => (out[k] = Array.from(new Set(out[k]))));
  return out;
}

/** ---------- Inputs + Config (Space-safe) ---------- **/
function getInputs_(category, variant) {
  const sh = getSheet_(INVENTORY_SPREADSHEET_ID, SHEET_INPUTS);
  const { headers, rows } = getTable_(sh);
  const m = idxMap_(headers);

  const catN = normalizeKey_(category);
  const varN = normalizeKey_(variant);

  return rows
    .filter((r) => normalizeKey_(r[m["Active"]]) !== "FALSE")
    .filter((r) => !catN || normalizeKey_(r[m["Category"]]) === catN)
    .filter((r) => !varN || normalizeKey_(r[m["Variant"]]) === varN)
    .map((r) => ({
      category: safeStr_(r[m["Category"]]),
      variant: safeStr_(r[m["Variant"]]),
      inputKey: safeStr_(r[m["Input Key"]]),
      label: safeStr_(r[m["Label"]]),
      unit: safeStr_(r[m["Unit"]]),
      defaultValue: r[m["Default Value"]],
      active: safeStr_(r[m["Active"]]),
      sortOrder: asNum_(r[m["Sort Order"]]),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function runMutation_(body) {
  const action = safeStr_(body.action);
  const data = body.data || {};

  if (action === "calculate") return calculate_(data);
  if (action === "createBooking") return createBooking_(data);
  if (action === "updateStock") return updateStock_(data);
  if (action === "setStock") return setStock_(data);
  if (action === "updateBookingStatus") return updateBookingStatus_(data);
  if (action === "createStockItem") return createStockItem_(data);

  throw new Error("Unknown mutation action: " + action);
}

function getCalcConfig_(category, variant) {
  const sh = getSheet_(INVENTORY_SPREADSHEET_ID, SHEET_CONFIG);
  const { headers, rows } = getTable_(sh);
  const m = idxMap_(headers);

  const catN = normalizeKey_(category);
  const varN = normalizeKey_(variant);

  return rows
    .filter((r) => normalizeKey_(r[m["Active"]]) !== "FALSE")
    .filter((r) => !catN || normalizeKey_(r[m["Category"]]) === catN)
    .filter((r) => !varN || normalizeKey_(r[m["Variant"]]) === varN)
    .map((r) => ({
      category: safeStr_(r[m["Category"]]),
      variant: safeStr_(r[m["Variant"]]),
      materialName: safeStr_(r[m["Material Name"]]),
      unit: safeStr_(r[m["Unit"]]),
      calcType: safeStr_(r[m["Calc Type"]]),
      baseRate: safeStr_(r[m["Base Rate"]]),
      inputKey: safeStr_(r[m["Input Key"]]),
      dependsOn: safeStr_(r[m["Depends On"]]),
      formula: safeStr_(r[m["Formula"]]),
      active: safeStr_(r[m["Active"]]),
    }));
}

/** ---------- Stock (Space-safe category + material) ---------- **/
function getStock_(category) {
  const sh = getSheet_(INVENTORY_SPREADSHEET_ID, SHEET_STOCK);
  const { headers, rows } = getTable_(sh);
  const m = idxMap_(headers);

  const catN = normalizeKey_(category);

  return rows
    .filter((r) => normalizeKey_(r[m["Active"]]) !== "FALSE")
    .filter((r) => !catN || normalizeKey_(r[m["Category"]]) === catN)
    .map((r) => {
      const packSize = asNum_(r[m["Pack Size"]]);
      const packaged = asNum_(r[m["Packaged Stock Qty"]]);
      const loose = asNum_(r[m["Loose Stock Qty"]]);
      const resPack = asNum_(r[m["Reserved Packaged Qty"]]);
      const resLoose = asNum_(r[m["Reserved Loose Qty"]]);

      return {
        timestamp: m["Timestamp"] != null ? r[m["Timestamp"]] : "",
        skuCode: m["SKU Code"] != null ? safeStr_(r[m["SKU Code"]]) : "",
        category: safeStr_(r[m["Category"]]),
        materialName: safeStr_(r[m["Material Name"]]),
        variant: m["Variant"] != null ? safeStr_(r[m["Variant"]]) : "",
        location: getLocationFromRow_(r, m),
        unit: safeStr_(r[m["Unit"]]),
        packSize,
        packSizeOptions: m["Pack Size Options"] != null ? safeStr_(r[m["Pack Size Options"]]) : "",
        packagedStockQty: packaged,
        looseStockQty: loose,
        reservedPackagedQty: resPack,
        reservedLooseQty: resLoose,
        availablePackagedQty: Math.max(0, packaged - resPack),
        availableLooseQty: Math.max(0, loose - resLoose),
        minStockLevel: m["Min Stock Level"] != null ? asNum_(r[m["Min Stock Level"]]) : 0,
        active: m["Active"] != null ? safeStr_(r[m["Active"]]) : "TRUE",
        updatedBy: m["Updated By"] != null ? safeStr_(r[m["Updated By"]]) : "",
      };
    });
}

/** ---------- Bookings List ---------- **/
function getBookings_(requestedBy, role) {
  const sh = getSheet_(INVENTORY_SPREADSHEET_ID, SHEET_BOOKINGS);
  const { headers, rows } = getTable_(sh);
  const m = idxMap_(headers);
  const isAdmin = isAdminRole_(role);
  const reqN = normalizeKey_(requestedBy);

  const wanted = [
    "Timestamp", "Booking ID", "Parent Booking ID", "Row Type", "Requested By", "Category",
    "Variant / Base Type", "Status", "Remarks", "Inputs JSON",

    "SKU Code", "Material Name", "Variant", "Allocated Area", "Total Allocated Area",
    "Location", "Unit", "Required Qty", "Pack Size", "Packs Needed", "Packaging Qty",
    "Available Total Qty", "Shortage Qty", "Can Fulfill",

    "Total Required Qty", "Allocation Package Qty", "Allocation Loose Qty",
    "Approved By", "Dispatch Details", "Booking Hold Days", "Hold Expires At",
    "Reserved Packaged Qty", "Reserved Loose Qty", "Released At", "Released By",
    "Updated At", "Updated By"
  ];

  const data = rows
    .filter((r) => isAdmin || (reqN && normalizeKey_(r[m["Requested By"]]) === reqN))
    .map((r) => {
      const out = {};
      wanted.forEach((h) => out[h] = m[h] != null ? r[m[h]] : "");
      return out;
    });

  data.sort((a, b) => (new Date(b["Timestamp"]).getTime() || 0) - (new Date(a["Timestamp"]).getTime() || 0));
  return data;
}


/** ---------- Calculation Engine ---------- **/
function calculate_(data) {
  const category = normalizeKey_(data.category);
  const variant = normalizeKey_(data.variant);

  const inputs = data.inputs || {};
  const wearCoatType = normalizeKey_(inputs.wearCoatType || "SD");

  const cfg = getCalcConfig_(category, variant);
  const stock = getStock_(category);

  const area = asNum_(inputs.areaSqf || inputs.areaSqm || 0);

  const computed = {};
  const lineItems = [];

  cfg.forEach((row) => {
    const calcType = safeStr_(row.calcType);

    if (calcType === "FORMULA") return;

    if (calcType === "AREA_X_RATE_IF") {
      const should = normalizeKey_(row.formula); // SD/HD
      if (should && should !== wearCoatType) return;
    }

    let qty = 0;

    if (calcType === "AREA_X_RATE" || calcType === "AREA_X_RATE_IF") {
      qty = area * evalRate_(row.baseRate);
    } else if (calcType === "AREA_X_LAYER") {
      const v = asNum_(inputs[row.inputKey] || 0);
      qty = area * evalRate_(row.baseRate) * v;
    } else if (calcType === "AREA_X_THICKNESS_RATE") {
      const thick = asNum_(inputs[row.inputKey] || 0);
      qty = area * evalRate_(row.baseRate) * thick;
    } else if (calcType === "AREA_X_FIXED") {
      qty = area * evalRate_(row.baseRate);
    } else {
      return;
    }

    qty = round2_(qty);
    computed[row.materialName] = qty;
    lineItems.push({ materialName: row.materialName, unit: row.unit, requiredQty: qty, calcType });
  });

  cfg.filter((r) => safeStr_(r.calcType) === "FORMULA").forEach((row) => {
    const qty = round2_(evalFormula_(row.formula, area, computed));
    computed[row.materialName] = qty;
    lineItems.push({ materialName: row.materialName, unit: row.unit, requiredQty: qty, calcType: "FORMULA", formula: row.formula });
  });

  const stockMap = {};
  stock.forEach((s) => (stockMap[normalizeKey_(s.materialName)] = s));

  const items = lineItems.map((li) => {
    const s = stockMap[normalizeKey_(li.materialName)] || null;

    const packSize = s ? asNum_(s.packSize) : 0;
    const required = asNum_(li.requiredQty);

    const packsNeeded = packSize > 0 ? Math.ceil(required / packSize) : 0;
    const packagingQty = packSize > 0 ? packsNeeded * packSize : required;

    const availablePackaged = s ? asNum_(s.availablePackagedQty) : 0;
    const availableLoose = s ? asNum_(s.availableLooseQty) : 0;
    const availableTotal = availablePackaged + availableLoose;

    const shortageQty = Math.max(0, required - availableTotal);
    const canFulfill = shortageQty <= 0;

    return {
      ...li,
      packSize,
      packsNeeded,
      packagingQty: round2_(packagingQty),
      availablePackagedQty: round2_(availablePackaged),
      availableLooseQty: round2_(availableLoose),
      availableTotalQty: round2_(availableTotal),
      shortageQty: round2_(shortageQty),
      canFulfill,
    };
  });

  return { category, variant, area, wearCoatType, items };
}

function evalRate_(expr) {
  if (!expr) return 0;
  const cleaned = String(expr).replace(/[^0-9+\-*/(). ]/g, "");
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict"; return (${cleaned});`)();
    return asNum_(v);
  } catch {
    return 0;
  }
}

function evalFormula_(formula, area, computed) {
  if (!formula) return 0;

  const ctx = {
    Area: area,
    SBR: computed["SBR"] || 0,
    Color: computed["Acrylic Color"] || computed["Color"] || 0,
    Resurfacer: computed["Acrylic Resurfacer"] || 0,
    Cushion: computed["Acrylic Cushion"] || 0,
    EPDM: computed["EPDM Granule"] || 0,
  };

  let expr = String(formula);
  Object.keys(ctx).forEach((k) => {
    expr = expr.replace(new RegExp(`\\b${k}\\b`, "g"), String(ctx[k]));
  });

  const cleaned = expr.replace(/[^0-9+\-*/(). ]/g, "");
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict"; return (${cleaned});`)();
    return asNum_(v);
  } catch {
    return 0;
  }
}

/** ---------- Transactions (Header-driven) ---------- **/
function appendTxn_(txnSheet, txnObj) {
  const { headers } = getTable_(txnSheet);
  if (!headers || !headers.length) throw new Error("Inventory Transactions sheet has no headers");

  const m = idxMap_(headers);
  const row = new Array(headers.length).fill("");

  if (m["Timestamp"] != null) row[m["Timestamp"]] = txnObj.timestamp || now_();
  if (m["Transaction Type"] != null) row[m["Transaction Type"]] = txnObj.type || "";
  if (m["Booking ID"] != null) row[m["Booking ID"]] = txnObj.bookingId || "";
  if (m["SKU Code"] != null) row[m["SKU Code"]] = txnObj.skuCode || "";
  if (m["Category"] != null) row[m["Category"]] = txnObj.category || "";
  if (m["Material Name"] != null) row[m["Material Name"]] = txnObj.materialName || "";
  if (m["Variant"] != null) row[m["Variant"]] = txnObj.variant || "";
  if (m["Location"] != null) row[m["Location"]] = txnObj.location || "";
  if (m["Qty"] != null) row[m["Qty"]] = txnObj.qty || 0;
  if (m["Bucket"] != null) row[m["Bucket"]] = txnObj.bucket || "";
  if (m["Done By"] != null) row[m["Done By"]] = txnObj.doneBy || "";
  if (m["Notes"] != null) row[m["Notes"]] = txnObj.notes || "";

  txnSheet.appendRow(row);
}

/** ---------- Booking + Stock Reservation (SAFE) ---------- **/
function createBooking_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const category = normalizeKey_(data.category);
    const variant = normalizeKey_(data.variant);
    const requestedBy = safeStr_(data.requestedBy || "");
    const inputs = data.inputs || {};
    const remarks = safeStr_(data.remarks || "");
    const calc = calculate_({ category, variant, inputs });
    const itemsFromPayload = Array.isArray(data.items) ? data.items : [];

    const effectiveItems = itemsFromPayload.length
      ? itemsFromPayload.map((it) => ({
          skuCode: getSkuFromData_(it),
          materialName: safeStr_(it.materialName),
          variant: getVariantFromData_(it),
          allocatedArea: asNum_(it.allocatedArea),
          totalAllocatedArea: asNum_(it.totalAllocatedArea),
          unit: safeStr_(it.unit),
          requiredQty: asNum_(it.requiredQty),
          calcType: safeStr_(it.calcType),
          formula: safeStr_(it.formula),
          calculatedMaterialName: safeStr_(it.calculatedMaterialName),
        }))
      : (calc.items || []).map((it) => ({
          skuCode: "",
          materialName: safeStr_(it.materialName),
          variant: "",
          allocatedArea: 0,
          totalAllocatedArea: 0,
          unit: safeStr_(it.unit),
          requiredQty: asNum_(it.requiredQty),
          calcType: safeStr_(it.calcType),
          formula: safeStr_(it.formula),
          calculatedMaterialName: safeStr_(it.materialName),
        }));

    const stockTotals = {};
    getStock_(category).forEach((s) => {
      const key = makeStockTotalKey_(s.skuCode, s.category, s.materialName, s.variant);
      if (!stockTotals[key]) {
        stockTotals[key] = {
          packSize: asNum_(s.packSize),
          availablePackagedQty: 0,
          availableLooseQty: 0,
        };
      }

      stockTotals[key].availablePackagedQty += asNum_(s.availablePackagedQty);
      stockTotals[key].availableLooseQty += asNum_(s.availableLooseQty);

      if (!stockTotals[key].packSize && asNum_(s.packSize) > 0) {
        stockTotals[key].packSize = asNum_(s.packSize);
      }
    });

    const bookingId = buildBookingId_();
    const bookingSheet = getSheet_(INVENTORY_SPREADSHEET_ID, SHEET_BOOKINGS);
    const bookingTable = getTable_(bookingSheet);
    const bh = bookingTable.headers;
    const bm = idxMap_(bh);
    const rowsToAppend = [];

    const childData = effectiveItems.map((item) => {
      const stockKey = makeStockTotalKey_(
        item.skuCode,
        category,
        item.materialName,
        item.variant
      );
      const stock = stockTotals[stockKey] || {};
      const availableTotalQty = round2_(
        asNum_(stock.availablePackagedQty) + asNum_(stock.availableLooseQty)
      );
      const shortageQty = round2_(Math.max(0, asNum_(item.requiredQty) - availableTotalQty));

      return {
        ...item,
        packSize: asNum_(stock.packSize),
        availableTotalQty,
        shortageQty,
        canFulfill: shortageQty <= 0,
      };
    });

    const totalReq = round2_(childData.reduce((s, r) => s + asNum_(r.requiredQty), 0));
    const totalShort = round2_(childData.reduce((s, r) => s + asNum_(r.shortageQty), 0));

    const parentRow = makeBlankRow_(bh);
    setIfPresent_(parentRow, bm, "Timestamp", now_());
    setIfPresent_(parentRow, bm, "Booking ID", bookingId);
    setIfPresent_(parentRow, bm, "Parent Booking ID", bookingId);
    setIfPresent_(parentRow, bm, "Row Type", "PARENT");
    setIfPresent_(parentRow, bm, "Requested By", requestedBy);
    setIfPresent_(parentRow, bm, "Category", category);
    setIfPresent_(parentRow, bm, "Variant / Base Type", variant);
    setIfPresent_(parentRow, bm, "Status", STATUS_PENDING_REVIEW);
    setIfPresent_(parentRow, bm, "Remarks", remarks);
    setIfPresent_(parentRow, bm, "Inputs JSON", JSON.stringify(inputs));
    setIfPresent_(parentRow, bm, "Total Required Qty", totalReq);
    setIfPresent_(parentRow, bm, "Shortage Qty", totalShort);
    setIfPresent_(parentRow, bm, "Allocation Package Qty", 0);
    setIfPresent_(parentRow, bm, "Allocation Loose Qty", 0);
    rowsToAppend.push(parentRow);

    childData.forEach((r) => {
      const childRow = makeBlankRow_(bh);
      setIfPresent_(childRow, bm, "Timestamp", now_());
      setIfPresent_(childRow, bm, "Booking ID", bookingId);
      setIfPresent_(childRow, bm, "Parent Booking ID", bookingId);
      setIfPresent_(childRow, bm, "Row Type", "CHILD");
      setIfPresent_(childRow, bm, "Requested By", requestedBy);
      setIfPresent_(childRow, bm, "Category", category);
      setIfPresent_(childRow, bm, "Variant / Base Type", variant);
      setIfPresent_(childRow, bm, "Status", STATUS_PENDING_REVIEW);
      setIfPresent_(childRow, bm, "Remarks", remarks);
      setIfPresent_(childRow, bm, "SKU Code", r.skuCode || "");
      setIfPresent_(childRow, bm, "Material Name", r.materialName);
      setIfPresent_(childRow, bm, "Location", "ONSITE");
      setIfPresent_(childRow, bm, "Variant", r.variant || "");
      setIfPresent_(childRow, bm, "Allocated Area", round2_(r.allocatedArea || 0));
      setIfPresent_(childRow, bm, "Total Allocated Area", round2_(r.totalAllocatedArea || 0));
      setIfPresent_(childRow, bm, "Unit", r.unit);
      setIfPresent_(childRow, bm, "Required Qty", round2_(r.requiredQty));
      setIfPresent_(childRow, bm, "Pack Size", round2_(r.packSize));
      setIfPresent_(childRow, bm, "Packs Needed", "");
      setIfPresent_(childRow, bm, "Packaging Qty", "");
      setIfPresent_(childRow, bm, "Available Total Qty", r.availableTotalQty);
      setIfPresent_(childRow, bm, "Shortage Qty", r.shortageQty);
      setIfPresent_(childRow, bm, "Can Fulfill", r.canFulfill ? "Yes" : "No");
      setIfPresent_(childRow, bm, "Allocation Package Qty", 0);
      setIfPresent_(childRow, bm, "Allocation Loose Qty", 0);
      setIfPresent_(childRow, bm, "Reserved Packaged Qty", 0);
      setIfPresent_(childRow, bm, "Reserved Loose Qty", 0);
      rowsToAppend.push(childRow);
    });

    bookingSheet
      .getRange(bookingSheet.getLastRow() + 1, 1, rowsToAppend.length, bh.length)
      .setValues(rowsToAppend);

    const email = sendBookingRequirementEmail_(
      bookingId,
      { category, variant, requestedBy, remarks },
      childData
    );

    return {
      bookingId,
      status: STATUS_PENDING_REVIEW,
      rowsWritten: rowsToAppend.length,
      email,
    };
  } finally {
    lock.releaseLock();
  }
}

/** ---------- ADMIN: Stock Update (INWARD / ADJUST) ---------- **/
function updateStock_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const role = safeStr_(data.role || "");
    if (!isAdminRole_(role)) throw new Error("Unauthorized: Admin role required");

    const category = normalizeKey_(data.category);
    const materialNameRaw = safeStr_(data.materialName);
    const materialNameN = normalizeKey_(materialNameRaw);

    if (!category) throw new Error("Missing category");
    if (!materialNameRaw) throw new Error("Missing materialName");

    const deltaPackaged = asNum_(data.deltaPackaged || 0);
    const deltaLoose = asNum_(data.deltaLoose || 0);

    const doneBy = safeStr_(data.doneBy || "");
    const notes = safeStr_(data.notes || "Stock update");
    const txnType = safeStr_(data.transactionType || "INWARD"); // INWARD / ADJUSTMENT

    const stockSheet = getSheet_(INVENTORY_SPREADSHEET_ID, SHEET_STOCK);
    const values = stockSheet.getDataRange().getValues();
    const headers = values[0].map((h) => String(h).trim());
    const m = idxMap_(headers);

    // Find row
    let sheetRow = -1;
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (!row.some((c) => String(c).trim() !== "")) continue;

      const active = normalizeKey_(row[m["Active"]]) !== "FALSE";
      if (!active) continue;

      const cat = normalizeKey_(row[m["Category"]]);
      const mat = normalizeKey_(row[m["Material Name"]]);
      if (cat === category && mat === materialNameN) {
        sheetRow = r + 1; // actual sheet row
        break;
      }
    }

    if (sheetRow === -1) throw new Error(`Material not found in Inventory Stock: ${category} / ${materialNameRaw}`);

    const idx = sheetRow - 1;
    const row = values[idx];

    const packaged = asNum_(row[m["Packaged Stock Qty"]]);
    const loose = asNum_(row[m["Loose Stock Qty"]]);

    const nextPackaged = Math.max(0, round2_(packaged + deltaPackaged));
    const nextLoose = Math.max(0, round2_(loose + deltaLoose));

    row[m["Packaged Stock Qty"]] = nextPackaged;
    row[m["Loose Stock Qty"]] = nextLoose;

    // ✅ Keep available qty columns updated
    const reservedPackagedQty =
      m["Reserved Packaged Qty"] != null ? asNum_(row[m["Reserved Packaged Qty"]]) : 0;
    const reservedLooseQty =
      m["Reserved Loose Qty"] != null ? asNum_(row[m["Reserved Loose Qty"]]) : 0;

    if (m["Available Packaged Qty"] != null) {
      row[m["Available Packaged Qty"]] = round2_(Math.max(0, nextPackaged - reservedPackagedQty));
    }
    if (m["Available Loose Qty"] != null) {
      row[m["Available Loose Qty"]] = round2_(Math.max(0, nextLoose - reservedLooseQty));
    }

    // Optional editable pack size update
    if (m["Pack Size"] != null && data.packSize != null && safeStr_(data.packSize) !== "") {
      row[m["Pack Size"]] = asNum_(data.packSize);
    }
    if (m["Updated By"] != null) row[m["Updated By"]] = doneBy || "Admin";
    if (m["Timestamp"] != null) row[m["Timestamp"]] = now_();

    // Write back (batch full sheet)
    stockSheet.getRange(1, 1, values.length, values[0].length).setValues(values);

    // Transactions
    const txnSheet = getSheet_(INVENTORY_SPREADSHEET_ID, SHEET_TXN);

    if (deltaPackaged !== 0) {
      appendTxn_(txnSheet, {
        timestamp: now_(),
        type: txnType,
        bookingId: "", // not tied to booking
        category,
        materialName: materialNameRaw,
        qty: deltaPackaged,
        bucket: "Packaged",
        doneBy,
        notes,
      });
    }

    if (deltaLoose !== 0) {
      appendTxn_(txnSheet, {
        timestamp: now_(),
        type: txnType,
        bookingId: "",
        category,
        materialName: materialNameRaw,
        qty: deltaLoose,
        bucket: "Loose",
        doneBy,
        notes,
      });
    }

    return {
      category,
      materialName: materialNameRaw,
      updated: {
        packagedStockQty: nextPackaged,
        looseStockQty: nextLoose,
        availablePackagedQty: round2_(Math.max(0, nextPackaged - reservedPackagedQty)),
        availableLooseQty: round2_(Math.max(0, nextLoose - reservedLooseQty)),
      },
    };
  } finally {
    lock.releaseLock();
  }
}

function updateBookingStatus_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const bookingId = safeStr_(data.bookingId);
    const status = safeStr_(data.status);
    const updatedBy = safeStr_(data.updatedBy || "");
    const allocationItems = Array.isArray(data.items) ? data.items : [];
    const holdDays = asNum_(data.bookingHoldDays || DEFAULT_BOOKING_HOLD_DAYS);
    const holdExpiresAt = isHoldStatus_(status) ? calcHoldExpiry_(holdDays) : "";

    if (!bookingId) throw new Error("Missing bookingId");
    if (!status) throw new Error("Missing status");

    const bookingSheet = getSheet_(INVENTORY_SPREADSHEET_ID, SHEET_BOOKINGS);
    const bookingValues = bookingSheet.getDataRange().getValues();
    const bh = bookingValues[0].map((h) => String(h).trim());
    const bm = idxMap_(bh);
    const bookingRows = findBookingRows_(bookingValues, bm, bookingId);
    if (!bookingRows.length) throw new Error(`No booking rows found for Booking ID: ${bookingId}`);

    const category = normalizeKey_(bookingValues[bookingRows[0]][bm["Category"]]);
    const stockState = getStockSheetState_();
    const txnSheet = getSheet_(INVENTORY_SPREADSHEET_ID, SHEET_TXN);

    if (isHoldStatus_(status)) {
      reserveBookingStock_(bookingValues, bm, bookingRows, stockState, txnSheet, category, bookingId, allocationItems, updatedBy);
    } else if (isReleaseStatus_(status)) {
      releaseReservedStock_(bookingValues, bm, bookingRows, stockState, txnSheet, category, bookingId, updatedBy);
    } else if (isDispatchStatus_(status)) {
      dispatchReservedStock_(bookingValues, bm, bookingRows, stockState, txnSheet, category, bookingId, updatedBy);
    }

    bookingRows.forEach((r) => writeBookingAuditFields_(bookingValues[r], bm, status, updatedBy, holdDays, holdExpiresAt));
    refreshParentBookingTotals_(bookingValues, bm, bookingRows);

    bookingSheet.getRange(1, 1, bookingValues.length, bookingValues[0].length).setValues(bookingValues);
    stockState.stockSheet.getRange(1, 1, stockState.values.length, stockState.values[0].length).setValues(stockState.values);

    const email = sendBookingStatusEmail_(bookingValues, bm, bookingRows, status, updatedBy);

    return { bookingId, status, updatedBy, updatedRows: bookingRows.length, email };
  } finally {
    lock.releaseLock();
  }
}

function setStock_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const skuCode = getSkuFromData_(data);
    const skuCodeN = normalizeKey_(skuCode);
    const category = normalizeKey_(data.category);
    const materialNameRaw = safeStr_(data.materialName);
    const materialNameN = normalizeKey_(materialNameRaw);
    const variant = getVariantFromData_(data);
    const variantN = normalizeKey_(variant);
    const location = getLocationFromData_(data);
    const locationN = normalizeKey_(location);

    if (!category) throw new Error("Missing category");
    if (!materialNameRaw) throw new Error("Missing materialName");
    if (!location) throw new Error("Missing location");

    const packSize = asNum_(data.packSize || 0);
    const readyPacksCount = asNum_(data.readyPacksCount || 0);
    const packagedStockQty = asNum_(data.packagedStockQty || readyPacksCount * packSize);
    const looseStockQty = asNum_(data.looseStockQty || 0);
    const minStockLevel = asNum_(data.minStockLevel || 0);
    const packSizeOptions = safeStr_(data.packSizeOptions || "");
    const active = safeStr_(data.active || "TRUE");
    const doneBy = safeStr_(data.doneBy || "");
    const notes = safeStr_(data.notes || "Set stock");

    const stockSheet = getSheet_(INVENTORY_SPREADSHEET_ID, SHEET_STOCK);
    const values = stockSheet.getDataRange().getValues();
    const headers = values[0].map((h) => String(h).trim());
    const m = idxMap_(headers);

    let sheetRow = -1;

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (!row.some((c) => String(c).trim() !== "")) continue;

      const rowSku = m["SKU Code"] != null ? normalizeKey_(row[m["SKU Code"]]) : "";
      const rowCat = normalizeKey_(row[m["Category"]]);
      const rowMat = normalizeKey_(row[m["Material Name"]]);
      const rowVariant = m["Variant"] != null ? normalizeKey_(row[m["Variant"]]) : "";
      const rowLoc = normalizeKey_(getLocationFromRow_(row, m));

      const match = skuCodeN
        ? rowSku === skuCodeN && rowLoc === locationN
        : rowCat === category &&
          rowMat === materialNameN &&
          rowVariant === variantN &&
          rowLoc === locationN;

      if (match) {
        sheetRow = r + 1;
        break;
      }
    }

    if (sheetRow === -1) {
      throw new Error(
        `Material not found in Inventory Stock: ${skuCode || category + " / " + materialNameRaw}` +
          (variant ? ` / ${variant}` : "") +
          (location ? ` / ${location}` : "")
      );
    }

    const row = values[sheetRow - 1];

    if (m["Timestamp"] != null) row[m["Timestamp"]] = now_();
    if (m["SKU Code"] != null) row[m["SKU Code"]] = skuCode;
    if (m["Category"] != null) row[m["Category"]] = category;
    if (m["Material Name"] != null) row[m["Material Name"]] = materialNameRaw;
    if (m["Variant"] != null) row[m["Variant"]] = variant;
    if (m["Location"] != null) row[m["Location"]] = location;
    if (m["Unit"] != null && safeStr_(data.unit)) row[m["Unit"]] = safeStr_(data.unit);
    if (m["Pack Size"] != null) row[m["Pack Size"]] = round2_(packSize);
    if (m["Pack Size Options"] != null) row[m["Pack Size Options"]] = packSizeOptions;
    if (m["Packaged Stock Qty"] != null) row[m["Packaged Stock Qty"]] = round2_(packagedStockQty);
    if (m["Loose Stock Qty"] != null) row[m["Loose Stock Qty"]] = round2_(looseStockQty);

    const reservedPackagedQty =
      m["Reserved Packaged Qty"] != null ? asNum_(row[m["Reserved Packaged Qty"]]) : 0;
    const reservedLooseQty =
      m["Reserved Loose Qty"] != null ? asNum_(row[m["Reserved Loose Qty"]]) : 0;

    if (m["Available Packaged Qty"] != null) {
      row[m["Available Packaged Qty"]] = round2_(Math.max(0, packagedStockQty - reservedPackagedQty));
    }
    if (m["Available Loose Qty"] != null) {
      row[m["Available Loose Qty"]] = round2_(Math.max(0, looseStockQty - reservedLooseQty));
    }

    if (m["Min Stock Level"] != null) row[m["Min Stock Level"]] = round2_(minStockLevel);
    if (m["Active"] != null) row[m["Active"]] = active;
    if (m["Updated By"] != null) row[m["Updated By"]] = doneBy || "User";

    stockSheet.getRange(1, 1, values.length, values[0].length).setValues(values);

    appendTxn_(getSheet_(INVENTORY_SPREADSHEET_ID, SHEET_TXN), {
      timestamp: now_(),
      type: "SET_STOCK",
      bookingId: "",
      category,
      materialName: materialNameRaw,
      qty: round2_(packagedStockQty + looseStockQty),
      bucket: "Mixed",
      doneBy,
      notes,
      skuCode,
      variant,
      location,
    });

    return {
      skuCode,
      category,
      materialName: materialNameRaw,
      variant,
      location,
      packSize: round2_(packSize),
      readyPacksCount: round2_(readyPacksCount),
      packagedStockQty: round2_(packagedStockQty),
      looseStockQty: round2_(looseStockQty),
      minStockLevel: round2_(minStockLevel),
      active,
    };
  } finally {
    lock.releaseLock();
  }
}

function createStockItem_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const skuCode = getSkuFromData_(data);
    const skuCodeN = normalizeKey_(skuCode);
    const category = normalizeKey_(data.category);
    const materialNameRaw = safeStr_(data.materialName);
    const materialNameN = normalizeKey_(materialNameRaw);
    const variant = getVariantFromData_(data);
    const variantN = normalizeKey_(variant);
    const location = getLocationFromData_(data);
    const locationN = normalizeKey_(location);

    if (!category) throw new Error("Missing category");
    if (!materialNameRaw) throw new Error("Missing materialName");
    if (!location) throw new Error("Missing location");

    const unit = safeStr_(data.unit || "");
    const packSize = asNum_(data.packSize || 0);
    const readyPacksCount = asNum_(data.readyPacksCount || 0);
    const packagedStockQty = asNum_(data.packagedStockQty || readyPacksCount * packSize);
    const looseStockQty = asNum_(data.looseStockQty || 0);
    const minStockLevel = asNum_(data.minStockLevel || 0);
    const packSizeOptions = safeStr_(data.packSizeOptions || "");
    const active = safeStr_(data.active || "TRUE");
    const doneBy = safeStr_(data.doneBy || "");
    const notes = safeStr_(data.notes || "Create stock item");

    const stockSheet = getSheet_(INVENTORY_SPREADSHEET_ID, SHEET_STOCK);
    const { headers, rows } = getTable_(stockSheet);
    const m = idxMap_(headers);

    const exists = rows.some((r) => {
      const rowSku = m["SKU Code"] != null ? normalizeKey_(r[m["SKU Code"]]) : "";
      const rowCat = normalizeKey_(r[m["Category"]]);
      const rowMat = normalizeKey_(r[m["Material Name"]]);
      const rowVariant = m["Variant"] != null ? normalizeKey_(r[m["Variant"]]) : "";
      const rowLoc = normalizeKey_(getLocationFromRow_(r, m));

      return skuCodeN
        ? rowSku === skuCodeN && rowLoc === locationN
        : rowCat === category &&
          rowMat === materialNameN &&
          rowVariant === variantN &&
          rowLoc === locationN;
    });

    if (exists) {
      throw new Error(
        `Material already exists in Inventory Stock: ${skuCode || category + " / " + materialNameRaw}` +
          (variant ? ` / ${variant}` : "") +
          (location ? ` / ${location}` : "")
      );
    }

    const row = new Array(headers.length).fill("");

    if (m["Timestamp"] != null) row[m["Timestamp"]] = now_();
    if (m["SKU Code"] != null) row[m["SKU Code"]] = skuCode;
    if (m["Category"] != null) row[m["Category"]] = category;
    if (m["Material Name"] != null) row[m["Material Name"]] = materialNameRaw;
    if (m["Variant"] != null) row[m["Variant"]] = variant;
    if (m["Location"] != null) row[m["Location"]] = location;
    if (m["Unit"] != null) row[m["Unit"]] = unit;
    if (m["Pack Size"] != null) row[m["Pack Size"]] = round2_(packSize);
    if (m["Pack Size Options"] != null) row[m["Pack Size Options"]] = packSizeOptions;
    if (m["Packaged Stock Qty"] != null) row[m["Packaged Stock Qty"]] = round2_(packagedStockQty);
    if (m["Loose Stock Qty"] != null) row[m["Loose Stock Qty"]] = round2_(looseStockQty);
    if (m["Reserved Packaged Qty"] != null) row[m["Reserved Packaged Qty"]] = 0;
    if (m["Reserved Loose Qty"] != null) row[m["Reserved Loose Qty"]] = 0;
    if (m["Available Packaged Qty"] != null) row[m["Available Packaged Qty"]] = round2_(packagedStockQty);
    if (m["Available Loose Qty"] != null) row[m["Available Loose Qty"]] = round2_(looseStockQty);
    if (m["Min Stock Level"] != null) row[m["Min Stock Level"]] = round2_(minStockLevel);
    if (m["Active"] != null) row[m["Active"]] = active;
    if (m["Updated By"] != null) row[m["Updated By"]] = doneBy || "User";

    stockSheet.appendRow(row);

    appendTxn_(getSheet_(INVENTORY_SPREADSHEET_ID, SHEET_TXN), {
      timestamp: now_(),
      type: "CREATE_STOCK_ITEM",
      bookingId: "",
      category,
      materialName: materialNameRaw,
      qty: round2_(packagedStockQty + looseStockQty),
      bucket: "Mixed",
      doneBy,
      notes,
      skuCode,
      variant,
      location,
    });

    return {
      skuCode,
      category,
      materialName: materialNameRaw,
      variant,
      location,
      unit,
      packSize: round2_(packSize),
      readyPacksCount: round2_(readyPacksCount),
      packagedStockQty: round2_(packagedStockQty),
      looseStockQty: round2_(looseStockQty),
      minStockLevel: round2_(minStockLevel),
      active,
    };
  } finally {
    lock.releaseLock();
  }
}

function getInventoryMaterialValidation_() {
  const sh = getSheet_(VALIDATION_SPREADSHEET_ID, VALIDATION_SHEET_NAME);
  const { headers, rows } = getTable_(sh);
  const m = idxMap_(headers);

  if (m["Category"] == null || m["Material Name"] == null || m["Unit"] == null) {
    throw new Error('Validation sheet must contain "Category", "Material Name", and "Unit" headers');
  }

  return rows
    .map((r) => ({
      category: safeStr_(r[m["Category"]]),
      materialName: safeStr_(r[m["Material Name"]]),
      unit: safeStr_(r[m["Unit"]]),
    }))
    .filter((r) => r.category && r.materialName);
}

function test_createStockItem_() {
  const sample = {
    category: "Acrylic Material",
    materialName: "Acrylic Primer Test",
    unit: "kg",
    packSize: 25,
    packSizeOptions: "25|50|100",
    readyPacksCount: 2,
    packagedStockQty: 50,
    looseStockQty: 10,
    minStockLevel: 5,
    active: "TRUE",
    doneBy: "Test User",
    notes: "Manual test from GAS",
  };

  const result = createStockItem_(sample);
  Logger.log("test_createStockItem_ result => " + JSON.stringify(result));
}

/** --------- Newly Added Features --------- */

function isHoldStatus_(status) {
  const s = normalizeKey_(status);
  return s === normalizeKey_(STATUS_HOLD) || s === normalizeKey_(STATUS_APPROVED);
}

function isReleaseStatus_(status) {
  const s = normalizeKey_(status);
  return s === normalizeKey_(STATUS_RELEASED) || s === normalizeKey_(STATUS_DECLINED);
}

function isDispatchStatus_(status) {
  return normalizeKey_(status) === normalizeKey_(STATUS_DISPATCHED);
}

function calcHoldExpiry_(days) {
  return new Date(now_().getTime() + Math.max(1, asNum_(days) || DEFAULT_BOOKING_HOLD_DAYS) * MS_PER_DAY);
}

function getStockSheetState_() {
  const stockSheet = getSheet_(INVENTORY_SPREADSHEET_ID, SHEET_STOCK);
  const values = stockSheet.getDataRange().getValues();
  const headers = values[0].map((h) => String(h).trim());
  const m = idxMap_(headers);

  const keyToIndexes = {};
  const keyLocationToIndex = {};

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row.some((c) => String(c).trim() !== "")) continue;
    if (normalizeKey_(row[m["Active"]]) === "FALSE") continue;

    const skuCode = getSkuFromRow_(row, m);
    const category = safeStr_(row[m["Category"]]);
    const materialName = safeStr_(row[m["Material Name"]]);
    const variant = getVariantFromRow_(row, m);
    const location = getLocationFromRow_(row, m);

    const totalKey = makeStockTotalKey_(skuCode, category, materialName, variant);
    const locationKey = makeStockKey_(skuCode, category, materialName, variant, location);

    if (!keyToIndexes[totalKey]) keyToIndexes[totalKey] = [];
    keyToIndexes[totalKey].push(r);

    keyLocationToIndex[locationKey] = r;
  }

  return { stockSheet, values, headers, m, keyToIndexes, keyLocationToIndex };
}

function syncStockAvailable_(row, m) {
  const packaged = m["Packaged Stock Qty"] != null ? asNum_(row[m["Packaged Stock Qty"]]) : 0;
  const loose = m["Loose Stock Qty"] != null ? asNum_(row[m["Loose Stock Qty"]]) : 0;
  const reservedPack = m["Reserved Packaged Qty"] != null ? asNum_(row[m["Reserved Packaged Qty"]]) : 0;
  const reservedLoose = m["Reserved Loose Qty"] != null ? asNum_(row[m["Reserved Loose Qty"]]) : 0;

  if (m["Available Packaged Qty"] != null) {
    row[m["Available Packaged Qty"]] = round2_(Math.max(0, packaged - reservedPack));
  }
  if (m["Available Loose Qty"] != null) {
    row[m["Available Loose Qty"]] = round2_(Math.max(0, loose - reservedLoose));
  }
}

function findBookingRows_(values, m, bookingId) {
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    if (safeStr_(values[r][m["Booking ID"]]) === bookingId) rows.push(r);
  }
  return rows;
}

function findAllocationForMaterial_(items, materialName, skuCode, variant) {
  const skuN = normalizeKey_(skuCode);
  const matN = normalizeKey_(materialName);
  const variantN = normalizeKey_(variant);

  return (items || []).find((it) => {
    const itemSkuN = normalizeKey_(it.skuCode || it["SKU Code"]);
    const itemMatN = normalizeKey_(it.materialName);
    const itemVariantN = normalizeKey_(it.variant || it["Variant"]);

    if (skuN && itemSkuN) return itemSkuN === skuN;

    return itemMatN === matN && (!variantN || itemVariantN === variantN);
  }) || {};
}

function getChildBookingRows_(bookingValues, bm, bookingRowIndexes) {
  return bookingRowIndexes.filter((r) => normalizeKey_(bookingValues[r][bm["Row Type"]]) === "CHILD");
}

function refreshParentBookingTotals_(bookingValues, bm, bookingRowIndexes) {
  const childRows = getChildBookingRows_(bookingValues, bm, bookingRowIndexes);
  const totalReq = round2_(childRows.reduce((s, r) => s + asNum_(bookingValues[r][bm["Required Qty"]]), 0));
  const totalAllocatedPack = round2_(childRows.reduce((s, r) => s + asNum_(bookingValues[r][bm["Allocation Package Qty"]]), 0));
  const totalAllocatedLoose = round2_(childRows.reduce((s, r) => s + asNum_(bookingValues[r][bm["Allocation Loose Qty"]]), 0));
  const totalShort = round2_(childRows.reduce((s, r) => s + asNum_(bookingValues[r][bm["Shortage Qty"]]), 0));

  bookingRowIndexes.forEach((r) => {
    if (normalizeKey_(bookingValues[r][bm["Row Type"]]) !== "PARENT") return;
    setIfPresent_(bookingValues[r], bm, "Total Required Qty", totalReq);
    setIfPresent_(bookingValues[r], bm, "Allocation Package Qty", totalAllocatedPack);
    setIfPresent_(bookingValues[r], bm, "Allocation Loose Qty", totalAllocatedLoose);
    setIfPresent_(bookingValues[r], bm, "Shortage Qty", totalShort);
  });
}

function writeBookingAuditFields_(row, bm, status, updatedBy, holdDays, holdExpiresAt) {
  setIfPresent_(row, bm, "Status", status);
  setIfPresent_(row, bm, "Booking Hold Days", holdDays || "");
  setIfPresent_(row, bm, "Hold Expires At", holdExpiresAt || "");
  setIfPresent_(row, bm, "Updated At", now_());
  setIfPresent_(row, bm, "Updated By", updatedBy);

  if (isHoldStatus_(status)) setIfPresent_(row, bm, "Approved By", updatedBy);
  if (isReleaseStatus_(status)) {
    setIfPresent_(row, bm, "Released At", now_());
    setIfPresent_(row, bm, "Released By", updatedBy);
  }
  if (isDispatchStatus_(status)) {
    setIfPresent_(row, bm, "Dispatch Details", `Dispatched by ${updatedBy || "Admin"} at ${now_()}`);
  }
}

function reserveBookingStock_(bookingValues, bm, bookingRows, stockState, txnSheet, category, bookingId, allocationItems, updatedBy) {
  getChildBookingRows_(bookingValues, bm, bookingRows).forEach((r) => {
    const row = bookingValues[r];

    if (asNum_(row[bm["Reserved Packaged Qty"]]) > 0 || asNum_(row[bm["Reserved Loose Qty"]]) > 0) return;

    const skuCode = getSkuFromRow_(row, bm);
    const materialName = safeStr_(row[bm["Material Name"]]);
    const variant = getVariantFromRow_(row, bm);
    const location = getBookingLineLocation_(row, bm);
    const locationN = normalizeKey_(location || "ONSITE");

    const allocation = findAllocationForMaterial_(allocationItems, materialName, skuCode, variant);
    const packSize = asNum_(allocation.selectedPackSize || row[bm["Pack Size"]]);
    const allocatedPackQty = asNum_(allocation.allocatedPackQty);
    const allocatedLooseQty = asNum_(allocation.allocatedLooseQty);

    const reservePackagedQty = round2_(packSize * allocatedPackQty);
    const reserveLooseQty = round2_(allocatedLooseQty);
    const mappedStockQty = round2_(reservePackagedQty + reserveLooseQty);
    const requiredQty = asNum_(row[bm["Required Qty"]]);

    const stockKey = makeStockKey_(skuCode, category, materialName, variant, locationN);
    const stockIndex = stockState.keyLocationToIndex[stockKey];

    if (stockIndex == null) {
      throw new Error(`Missing ${locationN} stock row for ${skuCode || category + " / " + materialName}`);
    }

    const stockRow = stockState.values[stockIndex];

    const availablePackaged = Math.max(
      0,
      asNum_(stockRow[stockState.m["Packaged Stock Qty"]]) -
      asNum_(stockRow[stockState.m["Reserved Packaged Qty"]])
    );

    const availableLoose = Math.max(
      0,
      asNum_(stockRow[stockState.m["Loose Stock Qty"]]) -
      asNum_(stockRow[stockState.m["Reserved Loose Qty"]])
    );

    if (reservePackagedQty > availablePackaged) {
      throw new Error(`Not enough packaged stock at ${locationN} for ${skuCode || materialName}. Transfer required.`);
    }

    if (reserveLooseQty > availableLoose) {
      throw new Error(`Not enough loose stock at ${locationN} for ${skuCode || materialName}. Transfer required.`);
    }

    stockRow[stockState.m["Reserved Packaged Qty"]] = round2_(
      asNum_(stockRow[stockState.m["Reserved Packaged Qty"]]) + reservePackagedQty
    );
    stockRow[stockState.m["Reserved Loose Qty"]] = round2_(
      asNum_(stockRow[stockState.m["Reserved Loose Qty"]]) + reserveLooseQty
    );

    syncStockAvailable_(stockRow, stockState.m);

    setIfPresent_(row, bm, "SKU Code", skuCode);
    setIfPresent_(row, bm, "Variant", variant);
    setIfPresent_(row, bm, "Location", locationN);
    setIfPresent_(row, bm, "Pack Size", packSize);
    setIfPresent_(row, bm, "Packs Needed", allocatedPackQty);
    setIfPresent_(row, bm, "Packaging Qty", mappedStockQty);
    setIfPresent_(row, bm, "Allocation Package Qty", reservePackagedQty);
    setIfPresent_(row, bm, "Allocation Loose Qty", reserveLooseQty);
    setIfPresent_(row, bm, "Reserved Packaged Qty", reservePackagedQty);
    setIfPresent_(row, bm, "Reserved Loose Qty", reserveLooseQty);
    setIfPresent_(row, bm, "Shortage Qty", round2_(Math.max(0, requiredQty - mappedStockQty)));
    setIfPresent_(row, bm, "Can Fulfill", mappedStockQty >= requiredQty ? "Yes" : "No");

    if (reservePackagedQty > 0) {
      appendTxn_(txnSheet, {
        timestamp: now_(),
        type: "RESERVE",
        bookingId,
        skuCode,
        category,
        materialName,
        variant,
        location: locationN,
        qty: reservePackagedQty,
        bucket: "Packaged",
        doneBy: updatedBy,
        notes: "Admin reserve",
      });
    }

    if (reserveLooseQty > 0) {
      appendTxn_(txnSheet, {
        timestamp: now_(),
        type: "RESERVE",
        bookingId,
        skuCode,
        category,
        materialName,
        variant,
        location: locationN,
        qty: reserveLooseQty,
        bucket: "Loose",
        doneBy: updatedBy,
        notes: "Admin reserve",
      });
    }
  });
}

function releaseReservedStock_(bookingValues, bm, bookingRows, stockState, txnSheet, category, bookingId, updatedBy) {
  getChildBookingRows_(bookingValues, bm, bookingRows).forEach((r) => {
    const row = bookingValues[r];

    const skuCode = getSkuFromRow_(row, bm);
    const materialName = safeStr_(row[bm["Material Name"]]);
    const variant = getVariantFromRow_(row, bm);
    const location = getBookingLineLocation_(row, bm);
    const locationN = normalizeKey_(location || "ONSITE");

    const reservedPack = asNum_(row[bm["Reserved Packaged Qty"]]);
    const reservedLoose = asNum_(row[bm["Reserved Loose Qty"]]);

    if (reservedPack <= 0 && reservedLoose <= 0) return;

    const stockKey = makeStockKey_(skuCode, category, materialName, variant, locationN);
    const stockIndex = stockState.keyLocationToIndex[stockKey];

    if (stockIndex == null) {
      throw new Error(`Missing ${locationN} stock row for ${skuCode || category + " / " + materialName}`);
    }

    const stockRow = stockState.values[stockIndex];

    stockRow[stockState.m["Reserved Packaged Qty"]] = round2_(
      Math.max(0, asNum_(stockRow[stockState.m["Reserved Packaged Qty"]]) - reservedPack)
    );
    stockRow[stockState.m["Reserved Loose Qty"]] = round2_(
      Math.max(0, asNum_(stockRow[stockState.m["Reserved Loose Qty"]]) - reservedLoose)
    );

    syncStockAvailable_(stockRow, stockState.m);

    setIfPresent_(row, bm, "Reserved Packaged Qty", 0);
    setIfPresent_(row, bm, "Reserved Loose Qty", 0);

    if (reservedPack > 0) {
      appendTxn_(txnSheet, {
        timestamp: now_(),
        type: "RELEASE",
        bookingId,
        skuCode,
        category,
        materialName,
        variant,
        location: locationN,
        qty: reservedPack,
        bucket: "Packaged",
        doneBy: updatedBy,
        notes: "Release reserved stock",
      });
    }

    if (reservedLoose > 0) {
      appendTxn_(txnSheet, {
        timestamp: now_(),
        type: "RELEASE",
        bookingId,
        skuCode,
        category,
        materialName,
        variant,
        location: locationN,
        qty: reservedLoose,
        bucket: "Loose",
        doneBy: updatedBy,
        notes: "Release reserved stock",
      });
    }
  });
}

function dispatchReservedStock_(bookingValues, bm, bookingRows, stockState, txnSheet, category, bookingId, updatedBy) {
  getChildBookingRows_(bookingValues, bm, bookingRows).forEach((r) => {
    const row = bookingValues[r];

    const skuCode = getSkuFromRow_(row, bm);
    const materialName = safeStr_(row[bm["Material Name"]]);
    const variant = getVariantFromRow_(row, bm);

    const locationN = "ONSITE";

    const reservedPack = asNum_(row[bm["Reserved Packaged Qty"]]);
    const reservedLoose = asNum_(row[bm["Reserved Loose Qty"]]);

    if (reservedPack <= 0 && reservedLoose <= 0) return;

    const stockKey = makeStockKey_(skuCode, category, materialName, variant, locationN);
    const stockIndex = stockState.keyLocationToIndex[stockKey];

    if (stockIndex == null) {
      throw new Error(`Cannot dispatch ${skuCode || materialName}: no ONSITE stock row found.`);
    }

    const stockRow = stockState.values[stockIndex];

    stockRow[stockState.m["Packaged Stock Qty"]] = round2_(
      Math.max(0, asNum_(stockRow[stockState.m["Packaged Stock Qty"]]) - reservedPack)
    );
    stockRow[stockState.m["Loose Stock Qty"]] = round2_(
      Math.max(0, asNum_(stockRow[stockState.m["Loose Stock Qty"]]) - reservedLoose)
    );
    stockRow[stockState.m["Reserved Packaged Qty"]] = round2_(
      Math.max(0, asNum_(stockRow[stockState.m["Reserved Packaged Qty"]]) - reservedPack)
    );
    stockRow[stockState.m["Reserved Loose Qty"]] = round2_(
      Math.max(0, asNum_(stockRow[stockState.m["Reserved Loose Qty"]]) - reservedLoose)
    );

    syncStockAvailable_(stockRow, stockState.m);

    setIfPresent_(row, bm, "Location", locationN);
    setIfPresent_(row, bm, "Reserved Packaged Qty", 0);
    setIfPresent_(row, bm, "Reserved Loose Qty", 0);

    if (reservedPack > 0) {
      appendTxn_(txnSheet, {
        timestamp: now_(),
        type: "DISPATCH",
        bookingId,
        skuCode,
        category,
        materialName,
        variant,
        location: locationN,
        qty: reservedPack,
        bucket: "Packaged",
        doneBy: updatedBy,
        notes: "Dispatch reserved stock from onsite",
      });
    }

    if (reservedLoose > 0) {
      appendTxn_(txnSheet, {
        timestamp: now_(),
        type: "DISPATCH",
        bookingId,
        skuCode,
        category,
        materialName,
        variant,
        location: locationN,
        qty: reservedLoose,
        bucket: "Loose",
        doneBy: updatedBy,
        notes: "Dispatch reserved stock from onsite",
      });
    }
  });
}

function releaseExpiredBookings() {
  const sh = getSheet_(INVENTORY_SPREADSHEET_ID, SHEET_BOOKINGS);
  const { headers, rows } = getTable_(sh);
  const m = idxMap_(headers);
  const now = now_().getTime();
  const expiredIds = {};

  rows.forEach((row) => {
    if (normalizeKey_(row[m["Row Type"]]) !== "PARENT") return;
    if (!isHoldStatus_(row[m["Status"]])) return;
    const expiresAt = new Date(row[m["Hold Expires At"]]).getTime();
    if (expiresAt && expiresAt < now) expiredIds[safeStr_(row[m["Booking ID"]])] = true;
  });

  Object.keys(expiredIds).forEach((bookingId) => {
    updateBookingStatus_({
      bookingId,
      status: STATUS_RELEASED,
      updatedBy: "Auto Release",
      bookingAction: "autoReleaseExpiredHold",
    });
  });

  return { released: Object.keys(expiredIds) };
}

function firstPresent_(row, m, names) {
  for (const name of names) {
    if (m[name] != null && safeStr_(row[m[name]])) return safeStr_(row[m[name]]);
  }
  return "";
}

function htmlEscape_(value) {
  return safeStr_(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getLoginEmailForUser_(requestedBy) {
  const reqN = normalizeKey_(requestedBy);
  if (!reqN) return "";

  const ss = SpreadsheetApp.openById(VALIDATION_SPREADSHEET_ID);
  let sh = null;
  for (const sheetName of CRM_LOGIN_SHEET_NAMES) {
    sh = ss.getSheetByName(sheetName);
    if (sh) break;
  }
  if (!sh) throw new Error(`Missing CRM login sheet. Tried: ${CRM_LOGIN_SHEET_NAMES.join(", ")}`);

  const { headers, rows } = getTable_(sh);
  const m = idxMap_(headers);

  for (const row of rows) {
    const candidates = [
      firstPresent_(row, m, ["Username", "User Name", "Login Username", "loginUsername"]),
      firstPresent_(row, m, ["Name", "Full Name", "Employee Name"]),
      firstPresent_(row, m, ["Email", "Email ID", "Email Address", "Login Email"]),
    ].filter(Boolean);

    if (candidates.some((value) => normalizeKey_(value) === reqN)) {
      return firstPresent_(row, m, ["Email", "Email ID", "Email Address", "Login Email"]);
    }
  }

  return "";
}

function summarizeBookingItemsForEmail_(bookingValues, bm, bookingRows) {
  const lines = getChildBookingRows_(bookingValues, bm, bookingRows).map((r) => {
    const row = bookingValues[r];
    const material = safeStr_(row[bm["Material Name"]]);
    const required = round2_(row[bm["Required Qty"]]);
    const packSize = round2_(row[bm["Pack Size"]]);
    const allocatedPack = round2_(row[bm["Allocation Package Qty"]]);
    const allocatedLoose = round2_(row[bm["Allocation Loose Qty"]]);
    const shortage = round2_(row[bm["Shortage Qty"]]);

    return `- ${material}: Required ${required}, Package Size ${packSize || "-"}, Allocated Package Qty ${allocatedPack || 0}, Allocated Loose Qty ${allocatedLoose || 0}, Shortage ${shortage || 0}`;
  });

  return lines.length ? lines.join("\n") : "- No line items found";
}

function summarizeBookingItemsForEmailHtml_(bookingValues, bm, bookingRows) {
  const rows = getChildBookingRows_(bookingValues, bm, bookingRows).map((r) => {
    const row = bookingValues[r];
    const material = htmlEscape_(row[bm["Material Name"]]);
    const required = round2_(row[bm["Required Qty"]]);
    const packSize = round2_(row[bm["Pack Size"]]);
    const allocatedPack = round2_(row[bm["Allocation Package Qty"]]);
    const allocatedLoose = round2_(row[bm["Allocation Loose Qty"]]);
    const shortage = round2_(row[bm["Shortage Qty"]]);

    return `
      <tr>
        <td style="padding:8px;border:1px solid #e5e7eb;">${material}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${required}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${packSize || "-"}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${allocatedPack || 0}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${allocatedLoose || 0}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${shortage || 0}</td>
      </tr>
    `;
  });

  if (!rows.length) return `<p style="margin:0;color:#6b7280;">No line items found.</p>`;

  return `
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:${EMAIL_FONT_STACK};font-size:${EMAIL_BODY_FONT_SIZE};">
      <thead>
        <tr style="background:#f3f7ff;">
          <th style="padding:8px;border:1px solid #dbeafe;text-align:left;">Material</th>
          <th style="padding:8px;border:1px solid #dbeafe;text-align:right;">Required</th>
          <th style="padding:8px;border:1px solid #dbeafe;text-align:right;">Package Size</th>
          <th style="padding:8px;border:1px solid #dbeafe;text-align:right;">Allocated Package Qty</th>
          <th style="padding:8px;border:1px solid #dbeafe;text-align:right;">Allocated Loose Qty</th>
          <th style="padding:8px;border:1px solid #dbeafe;text-align:right;">Shortage</th>
        </tr>
      </thead>
      <tbody>${rows.join("")}</tbody>
    </table>
  `;
}

function sendBookingStatusEmail_(bookingValues, bm, bookingRows, status, updatedBy) {
  try {
    const parentRowIndex =
      bookingRows.find((r) => normalizeKey_(bookingValues[r][bm["Row Type"]]) === "PARENT") ||
      bookingRows[0];
    const parent = bookingValues[parentRowIndex];

    const requestedBy = safeStr_(parent[bm["Requested By"]]);
    const to = getLoginEmailForUser_(requestedBy);
    if (!to) {
      Logger.log(`Booking status email skipped: no email found for requestedBy=${requestedBy}`);
      return { sent: false, reason: "missing_requester_email" };
    }

    const bookingId = safeStr_(parent[bm["Booking ID"]]);
    const category = safeStr_(parent[bm["Category"]]);
    const variant = safeStr_(parent[bm["Variant / Base Type"]]);
    const remarks = safeStr_(parent[bm["Remarks"]]);
    const holdExpiresAt = bm["Hold Expires At"] != null ? parent[bm["Hold Expires At"]] : "";
    const itemSummary = summarizeBookingItemsForEmail_(bookingValues, bm, bookingRows);
    const itemSummaryHtml = summarizeBookingItemsForEmailHtml_(bookingValues, bm, bookingRows);

    const subject = `Inventory booking ${bookingId} updated to ${status}`;
    const body = [
      `Hi ${requestedBy || "there"},`,
      "",
      `Your inventory booking has been updated.`,
      "",
      `Booking ID: ${bookingId}`,
      `Status: ${status}`,
      `Category: ${category}`,
      `Variant / Base Type: ${variant}`,
      `Updated By: ${updatedBy || "Admin"}`,
      holdExpiresAt ? `Hold Expires At: ${holdExpiresAt}` : "",
      remarks ? `Remarks: ${remarks}` : "",
      "",
      "Items:",
      itemSummary,
      "",
      "Regards,",
      "Rido Sports Inventory Team",
    ].filter((line) => line !== "").join("\n");
    const htmlBody = `
      <div style="font-family:${EMAIL_FONT_STACK};color:#111827;font-size:${EMAIL_BODY_FONT_SIZE};line-height:1.5;">
        <div style="border-bottom:3px solid #6495ED;padding-bottom:10px;margin-bottom:18px;">
          <h2 style="margin:0;color:#6495ED;font-size:20px;">Inventory Booking Update</h2>
          <p style="margin:4px 0 0;color:#6b7280;">Rido Sports Inventory</p>
        </div>

        <p>Hi ${htmlEscape_(requestedBy || "there")},</p>
        <p>Your inventory booking has been updated.</p>

        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;width:100%;font-family:${EMAIL_FONT_STACK};font-size:${EMAIL_TABLE_FONT_SIZE};">
          <tr><td style="padding:6px 0;color:#6b7280;width:170px;">Booking ID</td><td style="padding:6px 0;font-weight:700;">${htmlEscape_(bookingId)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Status</td><td style="padding:6px 0;font-weight:700;">${htmlEscape_(status)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Category</td><td style="padding:6px 0;">${htmlEscape_(category)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Variant / Base Type</td><td style="padding:6px 0;">${htmlEscape_(variant)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Updated By</td><td style="padding:6px 0;">${htmlEscape_(updatedBy || "Admin")}</td></tr>
          ${holdExpiresAt ? `<tr><td style="padding:6px 0;color:#6b7280;">Hold Expires At</td><td style="padding:6px 0;">${htmlEscape_(holdExpiresAt)}</td></tr>` : ""}
          ${remarks ? `<tr><td style="padding:6px 0;color:#6b7280;">Remarks</td><td style="padding:6px 0;">${htmlEscape_(remarks)}</td></tr>` : ""}
        </table>

        <h3 style="font-size:15px;margin:20px 0 8px;">Items</h3>
        ${itemSummaryHtml}

        <p style="margin-top:20px;">Regards,<br/>Rido Sports Inventory Team</p>
      </div>
    `;

    GmailApp.sendEmail(
      to,
      subject,
      body,
      {
        cc: INVENTORY_BOOKING_STATUS_CC
          .filter((email) => safeStr_(email) && !/@example\.com$/i.test(email))
          .join(","),
        htmlBody,
        name: "Rido Sports Inventory",
      }
    );


    Logger.log(`Booking status email sent for ${bookingId} to ${to}`);
    return { sent: true, to };
  } catch (err) {
    Logger.log("Booking status email failed => " + (err && err.stack ? err.stack : String(err)));
    return { sent: false, reason: String(err) };
  }
}

function authorizeInventoryEmail() {
  const me = Session.getEffectiveUser().getEmail();

  GmailApp.sendEmail(
    me,
    "Inventory email authorization test",
    "Inventory email authorization is working.",
    {
      htmlBody: `
        <div style="font-family:${EMAIL_FONT_STACK};">
          <h3>Inventory Email Authorization</h3>
          <p>Gmail authorization is working for the inventory workflow.</p>
        </div>
      `,
      name: "Rido Sports Inventory",
    }
  );

  SpreadsheetApp.openById(INVENTORY_SPREADSHEET_ID).getName();
  SpreadsheetApp.openById(VALIDATION_SPREADSHEET_ID).getName();

  Logger.log("Inventory email authorization completed for: " + me);
}

function summarizeRequirementItemsForEmail_(items) {
  const lines = (items || []).map((item) => {
    return `- ${safeStr_(item.materialName)}: Required ${round2_(item.requiredQty)} ${safeStr_(item.unit)}, Available ${round2_(item.availableTotalQty)}, Shortage ${round2_(item.shortageQty)}`;
  });

  return lines.length ? lines.join("\n") : "- No line items found";
}

function summarizeRequirementItemsForEmailHtml_(items) {
  const rows = (items || []).map((item) => `
    <tr>
      <td style="padding:8px;border:1px solid #e5e7eb;">${htmlEscape_(item.materialName)}</td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${htmlEscape_(item.unit)}</td>
      <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${round2_(item.requiredQty)}</td>
      <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${round2_(item.availableTotalQty)}</td>
      <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${round2_(item.shortageQty)}</td>
      <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${item.canFulfill ? "Yes" : "No"}</td>
    </tr>
  `);

  if (!rows.length) return `<p style="margin:0;color:#6b7280;">No line items found.</p>`;

  return `
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:${EMAIL_FONT_STACK};font-size:${EMAIL_TABLE_FONT_SIZE};">
      <thead>
        <tr style="background:#f3f7ff;">
          <th style="padding:8px;border:1px solid #dbeafe;text-align:left;">Material</th>
          <th style="padding:8px;border:1px solid #dbeafe;text-align:left;">Unit</th>
          <th style="padding:8px;border:1px solid #dbeafe;text-align:right;">Required</th>
          <th style="padding:8px;border:1px solid #dbeafe;text-align:right;">Available</th>
          <th style="padding:8px;border:1px solid #dbeafe;text-align:right;">Shortage</th>
          <th style="padding:8px;border:1px solid #dbeafe;text-align:center;">Can Fulfill</th>
        </tr>
      </thead>
      <tbody>${rows.join("")}</tbody>
    </table>
  `;
}

function sendBookingRequirementEmail_(bookingId, data, childData) {
  try {
    const requestedBy = safeStr_(data.requestedBy || "");
    const requesterEmail = getLoginEmailForUser_(requestedBy);
    const to = INVENTORY_BOOKING_REQUIREMENT_TO
      .filter((email) => safeStr_(email) && !/@example\.com$/i.test(email))
      .join(",");

    if (!to) {
      Logger.log("Booking requirement email skipped: no admin recipients configured");
      return { sent: false, reason: "missing_admin_recipients" };
    }

    const category = safeStr_(data.category);
    const variant = safeStr_(data.variant);
    const remarks = safeStr_(data.remarks || "");
    const totalRequired = round2_((childData || []).reduce((sum, item) => sum + asNum_(item.requiredQty), 0));
    const totalShortage = round2_((childData || []).reduce((sum, item) => sum + asNum_(item.shortageQty), 0));
    const itemSummary = summarizeRequirementItemsForEmail_(childData);
    const itemSummaryHtml = summarizeRequirementItemsForEmailHtml_(childData);
    const subject = `New inventory booking requirement ${bookingId}`;

    const body = [
      "Hi Team,",
      "",
      "A new inventory booking requirement has been submitted.",
      "",
      `Booking ID: ${bookingId}`,
      `Requested By: ${requestedBy}`,
      `Category: ${category}`,
      `Variant / Base Type: ${variant}`,
      `Status: ${STATUS_PENDING_REVIEW}`,
      `Total Required Qty: ${totalRequired}`,
      `Total Shortage Qty: ${totalShortage}`,
      remarks ? `Remarks: ${remarks}` : "",
      "",
      "Items:",
      itemSummary,
      "",
      "Regards,",
      "Rido Sports Inventory",
    ].filter((line) => line !== "").join("\n");

    const htmlBody = `
      <div style="font-family:${EMAIL_FONT_STACK};color:#111827;font-size:${EMAIL_BODY_FONT_SIZE};line-height:1.45;">
        <div style="border-bottom:3px solid #6495ED;padding-bottom:10px;margin-bottom:18px;">
          <h2 style="margin:0;color:#6495ED;font-size:16px;">New Inventory Booking Requirement</h2>
          <p style="margin:4px 0 0;color:#6b7280;">Pending admin review</p>
        </div>

        <p>Hi Team,</p>
        <p>A new inventory booking requirement has been submitted.</p>

        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;width:100%;font-family:${EMAIL_FONT_STACK};font-size:${EMAIL_BODY_FONT_SIZE};">
          <tr><td style="padding:6px 0;color:#6b7280;width:170px;">Booking ID</td><td style="padding:6px 0;font-weight:700;">${htmlEscape_(bookingId)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Requested By</td><td style="padding:6px 0;">${htmlEscape_(requestedBy)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Category</td><td style="padding:6px 0;">${htmlEscape_(category)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Variant / Base Type</td><td style="padding:6px 0;">${htmlEscape_(variant)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Status</td><td style="padding:6px 0;font-weight:700;">${STATUS_PENDING_REVIEW}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Total Required Qty</td><td style="padding:6px 0;">${totalRequired}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Total Shortage Qty</td><td style="padding:6px 0;">${totalShortage}</td></tr>
          ${remarks ? `<tr><td style="padding:6px 0;color:#6b7280;">Remarks</td><td style="padding:6px 0;">${htmlEscape_(remarks)}</td></tr>` : ""}
        </table>

        <h3 style="font-size:13px;margin:20px 0 8px;">Requirement Items</h3>
        ${itemSummaryHtml}

        <p style="margin-top:20px;">Regards,<br/>Rido Sports Inventory</p>
      </div>
    `;

    GmailApp.sendEmail(
      to,
      subject,
      body,
      {
        cc: requesterEmail || "",
        htmlBody,
        name: "Rido Sports Inventory",
      }
    );

    Logger.log(`Booking requirement email sent for ${bookingId} to ${to}`);
    return { sent: true, to, cc: requesterEmail || "" };
  } catch (err) {
    Logger.log("Booking requirement email failed => " + (err && err.stack ? err.stack : String(err)));
    return { sent: false, reason: String(err) };
  }
}

function getSkuMaster_() {
  const sh = getSheet_(INVENTORY_SPREADSHEET_ID, SHEET_SKU);
  const { headers, rows } = getTable_(sh);
  const m = idxMap_(headers);

  return rows.map((r) => ({
    skuCode: safeStr_(r[m["SKU Code"]]),
    category: safeStr_(r[m["Category"]]),
    materialName: safeStr_(r[m["Material Name"]]),
    variant: safeStr_(r[m["Variant"]]),
  })).filter((r) => r.skuCode || r.materialName);
}

function makeStockKey_(skuCode, category, materialName, variant, location) {
  const skuN = normalizeKey_(skuCode);
  const locN = normalizeKey_(location);

  if (skuN) return `SKU||${skuN}||${locN}`;

  return [
    "LEGACY",
    normalizeKey_(category),
    normalizeKey_(materialName),
    normalizeKey_(variant),
    locN,
  ].join("||");
}

function makeStockTotalKey_(skuCode, category, materialName, variant) {
  const skuN = normalizeKey_(skuCode);

  if (skuN) return `SKU||${skuN}`;

  return [
    "LEGACY",
    normalizeKey_(category),
    normalizeKey_(materialName),
    normalizeKey_(variant),
  ].join("||");
}

function getSkuFromData_(data) {
  return safeStr_(data.skuCode || data["SKU Code"] || data.sku || data.SKU || "");
}

function getVariantFromData_(data) {
  return safeStr_(data.variant || data["Variant"] || data.colorVariant || data["Color Variant"] || "");
}

function getSkuFromRow_(row, m) {
  return m["SKU Code"] != null ? safeStr_(row[m["SKU Code"]]) : "";
}

function getVariantFromRow_(row, m) {
  return m["Variant"] != null ? safeStr_(row[m["Variant"]]) : "";
}

function getBookingLineKey_(row, m, fallbackCategory) {
  const skuCode = getSkuFromRow_(row, m);
  const category = fallbackCategory || safeStr_(row[m["Category"]]);
  const materialName = m["Material Name"] != null ? safeStr_(row[m["Material Name"]]) : "";
  const variant = getVariantFromRow_(row, m);

  return makeStockTotalKey_(skuCode, category, materialName, variant);
}

function getBookingLineLocation_(row, m) {
  return (
    getLocationFromRow_(row, m) ||
    "ONSITE"
  );
}
