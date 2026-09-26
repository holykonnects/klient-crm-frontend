import { SHEETS } from "../_lib/crmConfig.js";
import { formatTimestamp, getSpreadsheet, getValues, googleFetch, rowsToObjects } from "../_lib/googleSheets.js";
import { notifyInventoryBookingCreated, notifyInventoryBookingUpdated } from "../_lib/operationalEmails.js";

const STATUS_PENDING_REVIEW = "Pending Review";
const STATUS_HOLD = "Hold";
const STATUS_APPROVED = "Approved";
const STATUS_RELEASED = "Released";
const STATUS_DECLINED = "Declined";
const STATUS_DISPATCHED = "Dispatched";
const DEFAULT_BOOKING_HOLD_DAYS = 2;
const CALC_MATRIX_ADMIN_EMAILS = new Set([
  "holy@klientkonnect.com",
  "sidhant@ridosports.com",
]);

const config = SHEETS.inventory;
const spreadsheetTitlePromises = new Map();
let mutationQueue = Promise.resolve();

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      const data = await handleGet(req.query || {});
      return res.status(200).json({ ok: true, data });
    }

    if (req.method === "POST") {
      const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const started = Date.now();
      const data = await enqueueMutation(() => handlePost(payload));
      res.setHeader("Server-Timing", `inventory;dur=${Date.now() - started}`);
      return res.status(200).json({ ok: true, data });
    }

    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  } catch (error) {
    console.error("INVENTORY_API_ERROR", error.cause?.message || error.message);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || String(error),
    });
  }
}

function enqueueMutation(task) {
  const next = mutationQueue.catch(() => {}).then(task);
  mutationQueue = next.catch(() => {});
  return next;
}

async function handleGet(query) {
  const action = clean(query.action);
  if (action === "ping") return { ts: new Date().toISOString() };
  if (action === "getValidation") return getValidation();
  if (action === "getInputs") return getInputs(query.category, query.variant);
  if (action === "getCalcConfig") return getCalcConfig(query.category, query.variant);
  if (action === "getStock") return getStock(query.category);
  if (action === "getBookings") return getBookings(query.requestedBy, query.role);
  if (action === "getInventoryMaterialValidation") return getInventoryMaterialValidation();
  if (action === "getSkuMaster") return getSkuMaster();
  throw badRequest(`Unknown inventory action: ${action || "(empty)"}`);
}

async function handlePost(payload) {
  const action = clean(payload.action);
  const data = payload.data || {};
  if (action === "createBooking") return createBooking(data);
  if (action === "updateBookingStatus") return updateBookingStatus(data);
  if (action === "setStock") return setStock(data);
  if (action === "createStockItem") return createStockItem(data);
  if (action === "transferStock") return transferStock(data);
  if (action === "upsertCalcMatrixRule") return upsertCalcMatrixRule(data);
  throw badRequest(`Unknown inventory mutation: ${action || "(empty)"}`);
}

async function getValidation() {
  const { values } = await readTable("validation");
  const [headers = [], ...rows] = values;
  return Object.fromEntries(headers.map((header, index) => [
    header,
    [...new Set(rows.map((row) => clean(row[index])).filter(Boolean))],
  ]));
}

async function getInventoryMaterialValidation() {
  const rows = rowsToObjects((await readTable("validation")).values);
  return rows.map((row) => ({
    category: clean(row.Category),
    materialName: clean(row["Material Name"]),
    unit: clean(row.Unit),
  })).filter((row) => row.category && row.materialName);
}

async function getSkuMaster() {
  return rowsToObjects((await readTable("sku")).values).map((row) => ({
    skuCode: clean(row["SKU Code"]),
    category: clean(row.Category),
    materialName: clean(row["Material Name"]),
    variant: clean(row.Variant),
  })).filter((row) => row.skuCode || row.materialName);
}

async function getInputs(category, variant) {
  const categoryKey = normalize(category);
  const variantKey = normalize(variant);
  return rowsToObjects((await readTable("inputs")).values)
    .filter((row) => normalize(row.Active) !== "FALSE")
    .filter((row) => !categoryKey || normalize(row.Category) === categoryKey)
    .filter((row) => !variantKey || normalize(row.Variant) === variantKey)
    .map((row) => ({
      category: clean(row.Category),
      variant: clean(row.Variant),
      inputKey: clean(row["Input Key"]),
      label: clean(row.Label),
      unit: clean(row.Unit),
      defaultValue: row["Default Value"] ?? "",
      active: clean(row.Active),
      sortOrder: number(row["Sort Order"]),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

async function getCalcConfig(category, variant) {
  const categoryKey = normalize(category);
  const variantKey = normalize(variant);
  const wildcards = new Set(["", "ALL", "DEFAULT", "ALL VARIANTS", "ALL COLORS"]);
  return rowsToObjects((await readTable("config")).values)
    .filter((row) => normalize(row.Active) !== "FALSE")
    .filter((row) => !categoryKey || normalize(row.Category) === categoryKey)
    .filter((row) => {
      const rowVariant = normalize(row.Variant);
      return !variantKey || rowVariant === variantKey || wildcards.has(rowVariant);
    })
    .map((row) => ({
      category: clean(row.Category),
      variant: clean(row.Variant),
      materialName: clean(row["Material Name"]),
      unit: clean(row.Unit),
      calcType: clean(row["Calc Type"]),
      baseRate: clean(row["Base Rate"]),
      inputKey: clean(row["Input Key"]),
      dependsOn: clean(row["Depends On"]),
      formula: clean(row.Formula),
      active: clean(row.Active),
    }));
}

async function getStock(category) {
  const categoryKey = normalize(category);
  return rowsToObjects((await readTable("stock")).values)
    .filter((row) => normalize(row.Active) !== "FALSE")
    .filter((row) => !categoryKey || normalize(row.Category) === categoryKey)
    .map(stockObject);
}

function stockObject(row) {
  const packSize = number(row["Pack Size"]);
  const packaged = number(first(row, ["Packaged Stock Qty", "Packaged Stock Qty (Kg/Litre)"]));
  const loose = number(first(row, ["Loose Stock Qty", "Loose Stock Qty (Kg/Litre)"]));
  const reservedPackaged = number(row["Reserved Packaged Qty"]);
  const reservedLoose = number(row["Reserved Loose Qty"]);
  return {
    timestamp: row.Timestamp || "",
    skuCode: clean(row["SKU Code"]),
    category: clean(row.Category),
    materialName: clean(row["Material Name"]),
    variant: clean(row.Variant),
    location: clean(first(row, ["Location", "Stock Location", "Stock Available At"])),
    unit: clean(row.Unit),
    packSize,
    packSizeOptions: clean(row["Pack Size Options"]),
    packagesAvailable: row["Packages Available"] === "" || row["Packages Available"] == null
      ? (packSize > 0 ? round(packaged / packSize) : 0)
      : number(row["Packages Available"]),
    packagedStockQty: packaged,
    looseStockQty: loose,
    reservedPackagedQty: reservedPackaged,
    reservedLooseQty: reservedLoose,
    availablePackagedQty: Math.max(0, packaged - reservedPackaged),
    availableLooseQty: Math.max(0, loose - reservedLoose),
    minStockLevel: number(row["Min Stock Level"]),
    active: clean(row.Active) || "TRUE",
    updatedBy: clean(row["Updated By"]),
  };
}

async function getBookings(requestedBy, role) {
  const rows = rowsToObjects((await readTable("bookings")).values);
  const requestedByKey = normalize(requestedBy);
  const isAdmin = normalize(role).includes("ADMIN");
  return rows
    .filter((row) => isAdmin || (requestedByKey && normalize(row["Requested By"]) === requestedByKey))
    .sort((a, b) => dateMs(b.Timestamp) - dateMs(a.Timestamp));
}

async function createBooking(data) {
  const category = normalize(data.category);
  const variant = normalize(data.variant);
  const requestedBy = clean(data.requestedBy) || "End User";
  const remarks = clean(data.remarks);
  const items = Array.isArray(data.items) ? data.items : [];
  if (!category) throw badRequest("Missing category");
  if (!items.length) throw badRequest("At least one booking item is required");

  const [stockTable, bookingTable] = await Promise.all([readTable("stock"), readTable("bookings")]);
  const stockTotals = new Map();
  rowsToObjects(stockTable.values).filter((row) => normalize(row.Active) !== "FALSE").forEach((row) => {
    const stock = stockObject(row);
    if (normalize(stock.category) !== category) return;
    const key = stockTotalKey(stock.skuCode, stock.category, stock.materialName, stock.variant);
    const current = stockTotals.get(key) || { packSize: 0, availablePackagedQty: 0, availableLooseQty: 0 };
    current.packSize ||= stock.packSize;
    current.availablePackagedQty += stock.availablePackagedQty;
    current.availableLooseQty += stock.availableLooseQty;
    stockTotals.set(key, current);
  });

  const children = items.map((item) => {
    const normalizedItem = {
      skuCode: clean(first(item, ["skuCode", "SKU Code", "sku", "SKU"])),
      materialName: clean(item.materialName),
      variant: clean(first(item, ["variant", "Variant", "colorVariant", "Color Variant"])),
      allocatedArea: number(item.allocatedArea),
      totalAllocatedArea: number(item.totalAllocatedArea),
      unit: clean(item.unit),
      requiredQty: number(item.requiredQty),
    };
    const stock = stockTotals.get(stockTotalKey(normalizedItem.skuCode, category, normalizedItem.materialName, normalizedItem.variant)) || {};
    const availableTotalQty = round(number(stock.availablePackagedQty) + number(stock.availableLooseQty));
    const shortageQty = round(Math.max(0, normalizedItem.requiredQty - availableTotalQty));
    return { ...normalizedItem, packSize: number(stock.packSize), availableTotalQty, shortageQty, canFulfill: shortageQty <= 0 };
  });

  const bookingId = buildBookingId();
  const headers = bookingTable.values[0] || [];
  assertHeaders(headers, ["Booking ID", "Row Type", "Category", "Status"]);
  const rows = [];
  rows.push(buildRow(headers, {
    Timestamp: formatTimestamp(), "Booking ID": bookingId, "Parent Booking ID": bookingId,
    "Row Type": "PARENT", "Requested By": requestedBy, Category: category,
    "Variant / Base Type": variant, Status: STATUS_PENDING_REVIEW, Remarks: remarks,
    "Inputs JSON": JSON.stringify(data.inputs || {}),
    "Total Required Qty": round(children.reduce((sum, item) => sum + item.requiredQty, 0)),
    "Shortage Qty": round(children.reduce((sum, item) => sum + item.shortageQty, 0)),
    "Allocation Package Qty": 0, "Allocation Loose Qty": 0,
  }));
  children.forEach((item) => rows.push(buildRow(headers, {
    Timestamp: formatTimestamp(), "Booking ID": bookingId, "Parent Booking ID": bookingId,
    "Row Type": "CHILD", "Requested By": requestedBy, Category: category,
    "Variant / Base Type": variant, Status: STATUS_PENDING_REVIEW, Remarks: remarks,
    "SKU Code": item.skuCode, "Material Name": item.materialName, Variant: item.variant,
    Location: "ONSITE", Unit: item.unit, "Allocated Area": round(item.allocatedArea),
    "Total Allocated Area": round(item.totalAllocatedArea), "Required Qty": round(item.requiredQty),
    "Pack Size": round(item.packSize), "Available Total Qty": item.availableTotalQty,
    "Shortage Qty": item.shortageQty, "Can Fulfill": item.canFulfill ? "Yes" : "No",
    "Allocation Package Qty": 0, "Allocation Loose Qty": 0,
    "Reserved Packaged Qty": 0, "Reserved Loose Qty": 0,
  })));

  await appendRows(bookingTable, rows);
  const email = await notifySafely(() => notifyInventoryBookingCreated({
    bookingId, requestedBy, category, variant, remarks, items: children,
  }));
  return { bookingId, status: STATUS_PENDING_REVIEW, rowsWritten: rows.length, email };
}

async function updateBookingStatus(data) {
  const bookingId = clean(data.bookingId);
  const status = clean(data.status);
  const updatedBy = clean(data.updatedBy);
  const allocationItems = Array.isArray(data.items) ? data.items : [];
  if (!bookingId) throw badRequest("Missing bookingId");
  if (!status) throw badRequest("Missing status");

  const [bookingTable, stockTable, transactionTable] = await Promise.all([
    readTable("bookings"), readTable("stock"), readTable("transactions"),
  ]);
  const bookings = padTable(bookingTable.values);
  const stocks = padTable(stockTable.values);
  const bookingMap = headerMap(bookings[0]);
  const stockMap = headerMap(stocks[0]);
  const bookingIndexes = bookings.map((row, index) => clean(row[bookingMap["Booking ID"]]) === bookingId ? index : -1).filter((index) => index > 0);
  if (!bookingIndexes.length) throw badRequest(`No booking rows found for Booking ID: ${bookingId}`);

  const category = normalize(bookings[bookingIndexes[0]][bookingMap.Category]);
  const stockIndex = new Map();
  stocks.slice(1).forEach((row, offset) => {
    if (!row.some((cell) => clean(cell)) || normalize(row[stockMap.Active]) === "FALSE") return;
    stockIndex.set(stockKey(
      value(row, stockMap, "SKU Code"), value(row, stockMap, "Category"),
      value(row, stockMap, "Material Name"), value(row, stockMap, "Variant"),
      firstRowValue(row, stockMap, ["Location", "Stock Location", "Stock Available At"]),
    ), offset + 1);
  });

  const transactions = [];
  const children = bookingIndexes.filter((index) => normalize(value(bookings[index], bookingMap, "Row Type")) === "CHILD");
  if (isHoldStatus(status)) reserveStock({ children, bookings, bookingMap, stocks, stockMap, stockIndex, allocationItems, category, bookingId, updatedBy, transactions, transactionHeaders: transactionTable.values[0] || [] });
  else if (isReleaseStatus(status)) releaseStock({ children, bookings, bookingMap, stocks, stockMap, stockIndex, category, bookingId, updatedBy, transactions, transactionHeaders: transactionTable.values[0] || [] });
  else if (normalize(status) === normalize(STATUS_DISPATCHED)) dispatchStock({ children, bookings, bookingMap, stocks, stockMap, stockIndex, category, bookingId, updatedBy, transactions, transactionHeaders: transactionTable.values[0] || [] });

  const holdDays = Math.max(1, number(data.bookingHoldDays) || DEFAULT_BOOKING_HOLD_DAYS);
  const holdExpiresAt = isHoldStatus(status) ? new Date(Date.now() + holdDays * 86400000).toISOString() : "";
  bookingIndexes.forEach((index) => writeBookingAudit(bookings[index], bookingMap, status, updatedBy, holdDays, holdExpiresAt));
  refreshParentTotals(bookings, bookingMap, bookingIndexes, children);

  const writes = [tableWrite(bookingTable, bookings), tableWrite(stockTable, stocks)];
  if (transactions.length) writes.push(appendWrite(transactionTable, transactions));
  await batchWrite(writes);
  const parentIndex = bookingIndexes.find((index) => normalize(value(bookings[index], bookingMap, "Row Type")) === "PARENT") ?? bookingIndexes[0];
  const parent = bookings[parentIndex];
  const emailItems = children.map((index) => ({
    materialName: value(bookings[index], bookingMap, "Material Name"),
    requiredQty: number(value(bookings[index], bookingMap, "Required Qty")),
    allocatedPackagedQty: number(value(bookings[index], bookingMap, "Allocation Package Qty")),
    allocatedLooseQty: number(value(bookings[index], bookingMap, "Allocation Loose Qty")),
    shortageQty: number(value(bookings[index], bookingMap, "Shortage Qty")),
  }));
  const email = await notifySafely(() => notifyInventoryBookingUpdated({
    bookingId,
    requestedBy: value(parent, bookingMap, "Requested By"),
    category: value(parent, bookingMap, "Category"),
    variant: value(parent, bookingMap, "Variant / Base Type"),
    status,
    updatedBy,
    holdExpiresAt,
    remarks: value(parent, bookingMap, "Remarks"),
    items: emailItems,
  }));
  return { bookingId, status, updatedBy, updatedRows: bookingIndexes.length, email };
}

function reserveStock(ctx) {
  for (const index of ctx.children) {
    const row = ctx.bookings[index];
    if (number(value(row, ctx.bookingMap, "Reserved Packaged Qty")) > 0 || number(value(row, ctx.bookingMap, "Reserved Loose Qty")) > 0) continue;
    const item = bookingIdentity(row, ctx.bookingMap);
    const allocation = findAllocation(ctx.allocationItems, item);
    const packSize = number(allocation.selectedPackSize || value(row, ctx.bookingMap, "Pack Size"));
    const allocatedPackQty = number(allocation.allocatedPackQty);
    const allocatedLooseQty = number(allocation.allocatedLooseQty);
    const reservePackagedQty = round(packSize * allocatedPackQty);
    const reserveLooseQty = round(allocatedLooseQty);
    const location = normalize(item.location || "ONSITE");
    const stockRow = findStockRow(ctx, item, location);
    const availablePackaged = Math.max(0, number(value(stockRow, ctx.stockMap, "Packaged Stock Qty")) - number(value(stockRow, ctx.stockMap, "Reserved Packaged Qty")));
    const availableLoose = Math.max(0, number(value(stockRow, ctx.stockMap, "Loose Stock Qty")) - number(value(stockRow, ctx.stockMap, "Reserved Loose Qty")));
    if (reservePackagedQty > availablePackaged) throw badRequest(`Not enough packaged stock at ${location} for ${item.skuCode || item.materialName}. Transfer required.`);
    if (reserveLooseQty > availableLoose) throw badRequest(`Not enough loose stock at ${location} for ${item.skuCode || item.materialName}. Transfer required.`);
    setValue(stockRow, ctx.stockMap, "Reserved Packaged Qty", round(number(value(stockRow, ctx.stockMap, "Reserved Packaged Qty")) + reservePackagedQty));
    setValue(stockRow, ctx.stockMap, "Reserved Loose Qty", round(number(value(stockRow, ctx.stockMap, "Reserved Loose Qty")) + reserveLooseQty));
    syncStockRow(stockRow, ctx.stockMap);
    const mapped = round(reservePackagedQty + reserveLooseQty);
    setValues(row, ctx.bookingMap, {
      "SKU Code": item.skuCode, Variant: item.variant, Location: location, "Pack Size": packSize,
      "Packs Needed": allocatedPackQty, "Packaging Qty": mapped,
      "Allocation Package Qty": reservePackagedQty, "Allocation Loose Qty": reserveLooseQty,
      "Reserved Packaged Qty": reservePackagedQty, "Reserved Loose Qty": reserveLooseQty,
      "Shortage Qty": round(Math.max(0, number(value(row, ctx.bookingMap, "Required Qty")) - mapped)),
      "Can Fulfill": mapped >= number(value(row, ctx.bookingMap, "Required Qty")) ? "Yes" : "No",
    });
    pushStockTransactions(ctx, "RESERVE", item, location, reservePackagedQty, reserveLooseQty, "Admin reserve");
  }
}

function releaseStock(ctx) {
  for (const index of ctx.children) {
    const row = ctx.bookings[index];
    const item = bookingIdentity(row, ctx.bookingMap);
    const reservedPackaged = number(value(row, ctx.bookingMap, "Reserved Packaged Qty"));
    const reservedLoose = number(value(row, ctx.bookingMap, "Reserved Loose Qty"));
    if (reservedPackaged <= 0 && reservedLoose <= 0) continue;
    const location = normalize(item.location || "ONSITE");
    const stockRow = findStockRow(ctx, item, location);
    setValue(stockRow, ctx.stockMap, "Reserved Packaged Qty", round(Math.max(0, number(value(stockRow, ctx.stockMap, "Reserved Packaged Qty")) - reservedPackaged)));
    setValue(stockRow, ctx.stockMap, "Reserved Loose Qty", round(Math.max(0, number(value(stockRow, ctx.stockMap, "Reserved Loose Qty")) - reservedLoose)));
    syncStockRow(stockRow, ctx.stockMap);
    setValue(row, ctx.bookingMap, "Reserved Packaged Qty", 0);
    setValue(row, ctx.bookingMap, "Reserved Loose Qty", 0);
    pushStockTransactions(ctx, "RELEASE", item, location, reservedPackaged, reservedLoose, "Release reserved stock");
  }
}

function dispatchStock(ctx) {
  for (const index of ctx.children) {
    const row = ctx.bookings[index];
    const item = bookingIdentity(row, ctx.bookingMap);
    const reservedPackaged = number(value(row, ctx.bookingMap, "Reserved Packaged Qty"));
    const reservedLoose = number(value(row, ctx.bookingMap, "Reserved Loose Qty"));
    if (reservedPackaged <= 0 && reservedLoose <= 0) continue;
    const location = "ONSITE";
    const stockRow = findStockRow(ctx, item, location);
    setValue(stockRow, ctx.stockMap, "Packaged Stock Qty", round(Math.max(0, number(value(stockRow, ctx.stockMap, "Packaged Stock Qty")) - reservedPackaged)));
    setValue(stockRow, ctx.stockMap, "Loose Stock Qty", round(Math.max(0, number(value(stockRow, ctx.stockMap, "Loose Stock Qty")) - reservedLoose)));
    setValue(stockRow, ctx.stockMap, "Reserved Packaged Qty", round(Math.max(0, number(value(stockRow, ctx.stockMap, "Reserved Packaged Qty")) - reservedPackaged)));
    setValue(stockRow, ctx.stockMap, "Reserved Loose Qty", round(Math.max(0, number(value(stockRow, ctx.stockMap, "Reserved Loose Qty")) - reservedLoose)));
    syncStockRow(stockRow, ctx.stockMap);
    setValue(row, ctx.bookingMap, "Location", location);
    setValue(row, ctx.bookingMap, "Reserved Packaged Qty", 0);
    setValue(row, ctx.bookingMap, "Reserved Loose Qty", 0);
    pushStockTransactions(ctx, "DISPATCH", item, location, reservedPackaged, reservedLoose, "Dispatch reserved stock from onsite");
  }
}

function findStockRow(ctx, item, location) {
  const index = ctx.stockIndex.get(stockKey(item.skuCode, ctx.category, item.materialName, item.variant, location));
  if (index == null) throw badRequest(`Missing ${location} stock row for ${item.skuCode || `${ctx.category} / ${item.materialName}`}`);
  return ctx.stocks[index];
}

function pushStockTransactions(ctx, type, item, location, packaged, loose, notes) {
  if (packaged > 0) ctx.transactions.push(transactionRow(ctx.transactionHeaders, { type, bookingId: ctx.bookingId, ...item, category: ctx.category, location, qty: packaged, bucket: "Packaged", doneBy: ctx.updatedBy, notes }));
  if (loose > 0) ctx.transactions.push(transactionRow(ctx.transactionHeaders, { type, bookingId: ctx.bookingId, ...item, category: ctx.category, location, qty: loose, bucket: "Loose", doneBy: ctx.updatedBy, notes }));
}

async function setStock(data) {
  const stockTable = await readTable("stock");
  const transactionTable = await readTable("transactions");
  const values = padTable(stockTable.values);
  const map = headerMap(values[0]);
  const identity = stockDataIdentity(data);
  const index = findStockIndex(values, map, identity);
  if (index < 0) throw badRequest(`Material not found in Inventory Stock: ${identity.skuCode || `${identity.category} / ${identity.materialName}`} / ${identity.location}`);
  const row = values[index];
  const packSize = number(data.packSize);
  const packaged = number(data.packagedStockQty || number(data.readyPacksCount) * packSize);
  const loose = number(data.looseStockQty);
  setValues(row, map, {
    Timestamp: formatTimestamp(), "SKU Code": identity.skuCode, Category: identity.category,
    "Material Name": identity.materialName, Variant: identity.variant, Location: identity.location,
    Unit: clean(data.unit) || value(row, map, "Unit"), "Pack Size": round(packSize),
    "Pack Size Options": clean(data.packSizeOptions), "Packaged Stock Qty": round(packaged),
    "Loose Stock Qty": round(loose), "Min Stock Level": round(number(data.minStockLevel)),
    Active: clean(data.active) || "TRUE", "Updated By": clean(data.doneBy) || "User",
  });
  syncStockRow(row, map);
  const txn = transactionRow(transactionTable.values[0] || [], {
    type: "SET_STOCK", ...identity, qty: round(packaged + loose), bucket: "Mixed",
    doneBy: clean(data.doneBy), notes: clean(data.notes) || "Set stock",
  });
  await batchWrite([tableWrite(stockTable, values), appendWrite(transactionTable, [txn])]);
  return { ...identity, packSize: round(packSize), packagedStockQty: round(packaged), looseStockQty: round(loose), active: clean(data.active) || "TRUE" };
}

async function createStockItem(data) {
  const [stockTable, transactionTable] = await Promise.all([readTable("stock"), readTable("transactions")]);
  const values = padTable(stockTable.values);
  const headers = values[0] || [];
  const map = headerMap(headers);
  const identity = stockDataIdentity(data);
  if (findStockIndex(values, map, identity) >= 0) return { ...identity, skipped: true, reason: "Material already exists for this location" };
  const packSize = number(data.packSize);
  const packaged = number(data.packagedStockQty || number(data.readyPacksCount) * packSize);
  const loose = number(data.looseStockQty);
  const row = buildRow(headers, {
    Timestamp: formatTimestamp(), "SKU Code": identity.skuCode, Category: identity.category,
    "Material Name": identity.materialName, Variant: identity.variant, Location: identity.location,
    Unit: clean(data.unit), "Pack Size": round(packSize), "Pack Size Options": clean(data.packSizeOptions),
    "Packaged Stock Qty": round(packaged), "Loose Stock Qty": round(loose),
    "Reserved Packaged Qty": 0, "Reserved Loose Qty": 0,
    "Available Packaged Qty": round(packaged), "Available Loose Qty": round(loose),
    "Min Stock Level": round(number(data.minStockLevel)), Active: clean(data.active) || "TRUE",
    "Updated By": clean(data.doneBy) || "User",
  });
  syncStockRow(row, map);
  const txn = transactionRow(transactionTable.values[0] || [], {
    type: "CREATE_STOCK_ITEM", ...identity, qty: round(packaged + loose), bucket: "Mixed",
    doneBy: clean(data.doneBy), notes: clean(data.notes) || "Create stock item",
  });
  await batchWrite([appendWrite(stockTable, [row]), appendWrite(transactionTable, [txn])]);
  return { ...identity, unit: clean(data.unit), packSize: round(packSize), packagedStockQty: round(packaged), looseStockQty: round(loose), active: clean(data.active) || "TRUE" };
}

async function transferStock(data) {
  const [stockTable, transactionTable] = await Promise.all([readTable("stock"), readTable("transactions")]);
  const values = padTable(stockTable.values);
  const headers = values[0] || [];
  const map = headerMap(headers);
  const base = stockDataIdentity({ ...data, location: data.fromLocation });
  const destination = { ...base, location: clean(data.toLocation) };
  if (!base.location || !destination.location || normalize(base.location) === normalize(destination.location)) throw badRequest("Source and destination locations must be different");
  const packaged = round(number(data.packagedQty));
  const loose = round(number(data.looseQty));
  if (packaged <= 0 && loose <= 0) throw badRequest("Transfer packagedQty or looseQty is required");
  const sourceIndex = findStockIndex(values, map, base);
  if (sourceIndex < 0) throw badRequest(`Source material/location not found: ${base.skuCode || `${base.category} / ${base.materialName}`} / ${base.location}`);
  const source = values[sourceIndex];
  const sourcePackaged = number(value(source, map, "Packaged Stock Qty"));
  const sourceLoose = number(value(source, map, "Loose Stock Qty"));
  if (packaged > sourcePackaged - number(value(source, map, "Reserved Packaged Qty"))) throw badRequest("Transfer packaged qty exceeds available packaged qty at source");
  if (loose > sourceLoose - number(value(source, map, "Reserved Loose Qty"))) throw badRequest("Transfer loose qty exceeds available loose qty at source");
  let destinationIndex = findStockIndex(values, map, destination);
  const destinationCreated = destinationIndex < 0;
  if (destinationCreated) {
    values.push(buildRow(headers, {
      Timestamp: formatTimestamp(), "SKU Code": base.skuCode, Category: base.category,
      "Material Name": base.materialName, Variant: base.variant, Location: destination.location,
      Unit: clean(data.unit) || value(source, map, "Unit"),
      "Pack Size": number(data.packSize) || number(value(source, map, "Pack Size")),
      "Pack Size Options": clean(data.packSizeOptions) || clean(value(source, map, "Pack Size Options")),
      "Packaged Stock Qty": 0, "Loose Stock Qty": 0, "Reserved Packaged Qty": 0,
      "Reserved Loose Qty": 0, "Available Packaged Qty": 0, "Available Loose Qty": 0,
      "Min Stock Level": number(data.minStockLevel) || number(value(source, map, "Min Stock Level")),
      Active: clean(data.active) || "TRUE", "Updated By": clean(data.doneBy) || "User",
    }));
    destinationIndex = values.length - 1;
  }
  const target = values[destinationIndex];
  setValue(source, map, "Packaged Stock Qty", round(sourcePackaged - packaged));
  setValue(source, map, "Loose Stock Qty", round(sourceLoose - loose));
  setValue(target, map, "Packaged Stock Qty", round(number(value(target, map, "Packaged Stock Qty")) + packaged));
  setValue(target, map, "Loose Stock Qty", round(number(value(target, map, "Loose Stock Qty")) + loose));
  for (const row of [source, target]) {
    setValue(row, map, "Timestamp", formatTimestamp());
    setValue(row, map, "Updated By", clean(data.doneBy) || "User");
    syncStockRow(row, map);
  }
  const txnHeaders = transactionTable.values[0] || [];
  const notes = clean(data.notes) || "Stock transfer";
  const txns = [];
  if (packaged > 0) {
    txns.push(transactionRow(txnHeaders, { type: "TRANSFER_OUT", ...base, qty: packaged, bucket: "Packaged", doneBy: clean(data.doneBy), notes: `${notes} to ${destination.location}` }));
    txns.push(transactionRow(txnHeaders, { type: "TRANSFER_IN", ...destination, qty: packaged, bucket: "Packaged", doneBy: clean(data.doneBy), notes: `${notes} from ${base.location}` }));
  }
  if (loose > 0) {
    txns.push(transactionRow(txnHeaders, { type: "TRANSFER_OUT", ...base, qty: loose, bucket: "Loose", doneBy: clean(data.doneBy), notes: `${notes} to ${destination.location}` }));
    txns.push(transactionRow(txnHeaders, { type: "TRANSFER_IN", ...destination, qty: loose, bucket: "Loose", doneBy: clean(data.doneBy), notes: `${notes} from ${base.location}` }));
  }
  await batchWrite([tableWrite(stockTable, values), appendWrite(transactionTable, txns)]);
  return { skuCode: base.skuCode, category: base.category, materialName: base.materialName, variant: base.variant, fromLocation: base.location, toLocation: destination.location, packagedQty: packaged, looseQty: loose, destinationCreated };
}

async function upsertCalcMatrixRule(data) {
  const email = clean(data.userEmail || data.email).toLowerCase();
  if (!CALC_MATRIX_ADMIN_EMAILS.has(email)) throw forbidden("Only calculation matrix admins can update calculation rules");
  const rule = data.rule || {};
  const category = normalize(rule.category);
  const variant = clean(rule.variant) || "ALL VARIANTS";
  const materialName = clean(rule.materialName);
  if (!category || !materialName || !clean(rule.unit) || !clean(rule.calcType)) throw badRequest("Category, Material Name, Unit and Calc Type are required");
  if (clean(rule.calcType) === "FORMULA" ? !clean(rule.formula) : !clean(rule.baseRate)) throw badRequest(clean(rule.calcType) === "FORMULA" ? "Formula is required for FORMULA rules" : "Base Rate / Factor is required");
  const table = await readTable("config");
  const values = padTable(table.values);
  const headers = values[0] || [];
  const map = headerMap(headers);
  let index = values.findIndex((row, rowIndex) => rowIndex > 0 && normalize(value(row, map, "Category")) === category && normalize(value(row, map, "Variant")) === normalize(variant) && normalize(value(row, map, "Material Name")) === normalize(materialName));
  const created = index < 0;
  if (created) { values.push(new Array(headers.length).fill("")); index = values.length - 1; }
  setValues(values[index], map, {
    Category: category, Variant: variant, "Material Name": materialName, Unit: clean(rule.unit),
    "Calc Type": clean(rule.calcType), "Base Rate": clean(rule.baseRate), "Input Key": clean(rule.inputKey),
    "Depends On": clean(rule.dependsOn), Formula: clean(rule.formula), Active: clean(rule.active) || "TRUE",
    "Updated By": clean(data.updatedBy || email), "Updated At": formatTimestamp(),
  });
  await batchWrite([tableWrite(table, values)]);
  return { category, variant, materialName, updatedBy: clean(data.updatedBy || email), created };
}

function refreshParentTotals(bookings, map, bookingIndexes, children) {
  const totalRequired = round(children.reduce((sum, index) => sum + number(value(bookings[index], map, "Required Qty")), 0));
  const totalPackaged = round(children.reduce((sum, index) => sum + number(value(bookings[index], map, "Allocation Package Qty")), 0));
  const totalLoose = round(children.reduce((sum, index) => sum + number(value(bookings[index], map, "Allocation Loose Qty")), 0));
  const totalShortage = round(children.reduce((sum, index) => sum + number(value(bookings[index], map, "Shortage Qty")), 0));
  bookingIndexes.filter((index) => normalize(value(bookings[index], map, "Row Type")) === "PARENT").forEach((index) => setValues(bookings[index], map, {
    "Total Required Qty": totalRequired, "Allocation Package Qty": totalPackaged,
    "Allocation Loose Qty": totalLoose, "Shortage Qty": totalShortage,
  }));
}

function writeBookingAudit(row, map, status, updatedBy, holdDays, holdExpiresAt) {
  setValues(row, map, { Status: status, "Booking Hold Days": holdDays || "", "Hold Expires At": holdExpiresAt, "Updated At": formatTimestamp(), "Updated By": updatedBy });
  if (isHoldStatus(status)) setValue(row, map, "Approved By", updatedBy);
  if (isReleaseStatus(status)) setValues(row, map, { "Released At": formatTimestamp(), "Released By": updatedBy });
  if (normalize(status) === normalize(STATUS_DISPATCHED)) setValue(row, map, "Dispatch Details", `Dispatched by ${updatedBy || "Admin"} at ${formatTimestamp()}`);
}

function bookingIdentity(row, map) {
  return {
    skuCode: clean(value(row, map, "SKU Code")), materialName: clean(value(row, map, "Material Name")),
    variant: clean(value(row, map, "Variant")), location: clean(firstRowValue(row, map, ["Location", "Stock Location", "Stock Available At"])),
  };
}

function findAllocation(items, identity) {
  const sku = normalize(identity.skuCode);
  return items.find((item) => {
    const itemSku = normalize(first(item, ["skuCode", "SKU Code"]));
    if (sku && itemSku) return sku === itemSku;
    return normalize(item.materialName) === normalize(identity.materialName) && (!identity.variant || normalize(first(item, ["variant", "Variant"])) === normalize(identity.variant));
  }) || {};
}

function stockDataIdentity(data) {
  const identity = {
    skuCode: clean(first(data, ["skuCode", "SKU Code", "sku", "SKU"])),
    category: normalize(data.category), materialName: clean(data.materialName),
    variant: clean(first(data, ["variant", "Variant", "colorVariant", "Color Variant"])),
    location: clean(first(data, ["location", "Location", "stockLocation", "Stock Location", "Stock Available At"])),
  };
  if (!identity.category) throw badRequest("Missing category");
  if (!identity.materialName) throw badRequest("Missing materialName");
  if (!identity.location) throw badRequest("Missing location");
  return identity;
}

function findStockIndex(values, map, identity) {
  return values.findIndex((row, index) => {
    if (index === 0 || !row.some((cell) => clean(cell))) return false;
    const location = normalize(firstRowValue(row, map, ["Location", "Stock Location", "Stock Available At"]));
    if (normalize(identity.skuCode)) return normalize(value(row, map, "SKU Code")) === normalize(identity.skuCode) && location === normalize(identity.location);
    return normalize(value(row, map, "Category")) === normalize(identity.category) && normalize(value(row, map, "Material Name")) === normalize(identity.materialName) && normalize(value(row, map, "Variant")) === normalize(identity.variant) && location === normalize(identity.location);
  });
}

function syncStockRow(row, map) {
  const packaged = number(value(row, map, "Packaged Stock Qty"));
  const loose = number(value(row, map, "Loose Stock Qty"));
  const reservedPackaged = number(value(row, map, "Reserved Packaged Qty"));
  const reservedLoose = number(value(row, map, "Reserved Loose Qty"));
  setValue(row, map, "Available Packaged Qty", round(Math.max(0, packaged - reservedPackaged)));
  setValue(row, map, "Available Loose Qty", round(Math.max(0, loose - reservedLoose)));
  const packSize = number(value(row, map, "Pack Size"));
  setValue(row, map, "Packages Available", packSize > 0 ? round(packaged / packSize) : 0);
}

function transactionRow(headers, data) {
  return buildRow(headers, {
    Timestamp: formatTimestamp(), "Transaction Type": data.type, "Booking ID": data.bookingId || "",
    "SKU Code": data.skuCode || "", Category: data.category || "", "Material Name": data.materialName || "",
    Variant: data.variant || "", Location: data.location || "", Qty: data.qty || 0,
    Bucket: data.bucket || "", "Done By": data.doneBy || "", Notes: data.notes || "",
  });
}

async function readTable(kind) {
  const definitions = {
    validation: [config.validationSpreadsheetId, config.validationSheetNames],
    sku: [config.spreadsheetId, config.skuSheetNames],
    stock: [config.spreadsheetId, config.stockSheetNames],
    bookings: [config.spreadsheetId, config.bookingSheetNames],
    transactions: [config.spreadsheetId, config.transactionSheetNames],
    inputs: [config.spreadsheetId, config.inputSheetNames],
    config: [config.spreadsheetId, config.configSheetNames],
  };
  const [spreadsheetId, candidates] = definitions[kind] || [];
  if (!spreadsheetId) throw new Error(`Unknown inventory table: ${kind}`);
  const sheetName = await resolveCachedSheetTitle(spreadsheetId, candidates);
  return { spreadsheetId, sheetName, values: await getValues(spreadsheetId, sheetName) };
}

async function resolveCachedSheetTitle(spreadsheetId, candidates) {
  if (!spreadsheetTitlePromises.has(spreadsheetId)) {
    spreadsheetTitlePromises.set(spreadsheetId, getSpreadsheet(spreadsheetId).then((spreadsheet) =>
      (spreadsheet.sheets || []).map((sheet) => clean(sheet.properties?.title)).filter(Boolean)
    ));
  }
  const titles = await spreadsheetTitlePromises.get(spreadsheetId);
  for (const candidate of candidates) {
    const exact = titles.find((title) => title === candidate);
    if (exact) return exact;
  }
  for (const candidate of candidates) {
    const loose = titles.find((title) => normalize(title) === normalize(candidate));
    if (loose) return loose;
  }
  throw new Error(`Sheet not found. Tried: ${candidates.join(", ")}`);
}

async function appendRows(table, rows) {
  if (!rows.length) return;
  return batchWrite([appendWrite(table, rows)]);
}

async function batchWrite(writes) {
  const grouped = new Map();
  writes.filter((write) => write.values?.length).forEach((write) => {
    const list = grouped.get(write.spreadsheetId) || [];
    list.push({ range: rangeFor(write.sheetName, write.startRow, write.values), values: write.values });
    grouped.set(write.spreadsheetId, list);
  });
  for (const [spreadsheetId, data] of grouped) {
    await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
    });
  }
}

function tableWrite(table, values) { return { spreadsheetId: table.spreadsheetId, sheetName: table.sheetName, startRow: 1, values }; }
function appendWrite(table, values) { return { spreadsheetId: table.spreadsheetId, sheetName: table.sheetName, startRow: Math.max(2, table.values.length + 1), values }; }
function rangeFor(sheetName, startRow, values) {
  const width = Math.max(...values.map((row) => row.length), 1);
  return `'${String(sheetName).replace(/'/g, "''")}'!A${startRow}:${columnName(width)}${startRow + values.length - 1}`;
}

function buildRow(headers, data) { return headers.map((header) => data[header] ?? ""); }
function padTable(values) {
  const width = (values[0] || []).length;
  return values.map((row) => [...row, ...new Array(Math.max(0, width - row.length)).fill("")]);
}
function headerMap(headers = []) {
  const map = Object.fromEntries(headers.map((header, index) => [clean(header), index]));
  const aliases = [
    ["Packaged Stock Qty", "Packaged Stock Qty (Kg/Litre)"],
    ["Loose Stock Qty", "Loose Stock Qty (Kg/Litre)"],
  ];
  aliases.forEach(([canonical, alternate]) => {
    if (map[canonical] == null && map[alternate] != null) map[canonical] = map[alternate];
    if (map[alternate] == null && map[canonical] != null) map[alternate] = map[canonical];
  });
  return map;
}
function assertHeaders(headers, required) { const map = headerMap(headers); required.forEach((header) => { if (map[header] == null) throw new Error(`Inventory sheet missing "${header}" header`); }); }
function value(row, map, header) { return map[header] == null ? "" : row[map[header]]; }
function setValue(row, map, header, next) { if (map[header] != null) row[map[header]] = next; }
function setValues(row, map, data) { Object.entries(data).forEach(([header, next]) => setValue(row, map, header, next)); }
function firstRowValue(row, map, headers) { for (const header of headers) { const found = value(row, map, header); if (clean(found)) return found; } return ""; }
function first(object, keys) { for (const key of keys) { const found = object?.[key]; if (found !== "" && found != null) return found; } return ""; }
function clean(value) { return String(value ?? "").trim(); }
function normalize(value) { return clean(value).replace(/_/g, " ").replace(/\s+/g, " ").toUpperCase(); }
function number(value) { const parsed = Number(typeof value === "string" ? value.replace(/,/g, "") : value); return Number.isFinite(parsed) ? parsed : 0; }
function round(value) { return Math.round(number(value) * 100) / 100; }
function dateMs(value) { const parsed = new Date(value).getTime(); return Number.isFinite(parsed) ? parsed : 0; }
function isHoldStatus(status) { return [normalize(STATUS_HOLD), normalize(STATUS_APPROVED)].includes(normalize(status)); }
function isReleaseStatus(status) { return [normalize(STATUS_RELEASED), normalize(STATUS_DECLINED)].includes(normalize(status)); }
function stockKey(skuCode, category, materialName, variant, location) { return normalize(skuCode) ? `SKU||${normalize(skuCode)}||${normalize(location)}` : ["LEGACY", normalize(category), normalize(materialName), normalize(variant), normalize(location)].join("||"); }
function stockTotalKey(skuCode, category, materialName, variant) { return normalize(skuCode) ? `SKU||${normalize(skuCode)}` : ["LEGACY", normalize(category), normalize(materialName), normalize(variant)].join("||"); }
function buildBookingId() { const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14); return `INV-${stamp}-${String(Math.floor(Math.random() * 900) + 100)}`; }
function columnName(index) { let name = ""; let current = index; while (current > 0) { const remainder = (current - 1) % 26; name = String.fromCharCode(65 + remainder) + name; current = Math.floor((current - 1) / 26); } return name; }
function badRequest(message) { const error = new Error(message); error.statusCode = 400; return error; }
function forbidden(message) { const error = new Error(message); error.statusCode = 403; return error; }
async function notifySafely(task) { try { return await task(); } catch (error) { return { sent: false, reason: error.message || String(error) }; } }
