import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mutateCosting } from "../api/_lib/costingMutations.js";
import { openCostingStore, TABLE, COST_HEADERS, LINE_HEADERS, ADVANCE_HEADERS, REQUEST_HEADERS, dateMs } from "../api/_lib/costingStore.js";
import { prepareExport, renderExport } from "../api/_lib/costingExports.js";
import { readCosting } from "../api/_lib/costingReads.js";
import { postCosting } from "../src/utils/costingApi.js";

const cost = { "Cost Sheet ID": "CS-1", "Linked Entity Type": "Project", "Linked Entity ID": "P-1", "Linked Entity Name": "Project One", Owner: "Owner" };
const item = { "Cost Sheet ID": "CS-1", "Line Item ID": "LI-1", "Entry Timestamp": "2026-09-15T06:30:00.000Z", Particular: "Materials", "Head Name": "Materials", Amount: 100, "GST Amount": 18, "Total Amount": 118, Active: "Yes" };
const request = { "Request ID": "REQ-1", Particular: "Materials", Amount: 100, "Approval Status": "Approved", "Existing Cost Sheet ID": "CS-1", "Synced To Cost Line": "No", Active: "Yes" };
const validation = { validationHeaders: ["Cost Heads", "Payment Status", "Materials"] };
function fixture({ costs = [cost], lines = [item], advances = [], requests = [request], failCommit = false } = {}) {
  const tables = [
    { name: TABLE.costs, headers: [...COST_HEADERS, "Materials"], rows: costs },
    { name: TABLE.lines, headers: LINE_HEADERS, rows: lines },
    { name: TABLE.advances, headers: ADVANCE_HEADERS, rows: advances },
    { name: TABLE.requests, headers: REQUEST_HEADERS, rows: requests },
  ];
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    if (url.includes(":batchUpdate")) {
      if (failCommit) throw new Error("connection closed");
      return {};
    }
    if (url.includes("values:batchGet")) {
      const params = new URL(url).searchParams;
      return { valueRanges: params.getAll("ranges").map((range) => {
        const table = tables.find((t) => range.startsWith(`'${t.name}'`));
        return { values: [table.headers, ...(range.endsWith("!1:1") ? [] : table.rows.map((r) => table.headers.map((h) => r[h] ?? "")))] };
      }) };
    }
    return { sheets: tables.map((t, sheetId) => ({ properties: { sheetId, title: t.name, gridProperties: { columnCount: 60 } } })) };
  };
  return {
    calls,
    open: (names, options) => openCostingStore(names, options, fetcher),
    batches: () => calls.filter((c) => c.init?.method === "POST").map((c) => JSON.parse(c.init.body).requests),
  };
}
const appended = (batch, id) => batch.filter((r) => r.appendCells?.sheetId === id).flatMap((r) => r.appendCells.rows);
const value = (row, headers, name) => Object.values(row.values[headers.indexOf(name)].userEnteredValue)[0];

test("batch add commits once, preserves manual amounts, and reads only line headers", async () => {
  const f = fixture();
  const result = await mutateCosting({ action: "addLineItemsBatch", data: { costSheetId: "CS-1", items: [{ ...item, QTY: 10, Rate: 100, Amount: 90, "Total Amount": 108 }] } }, validation, f.open);
  assert.equal(result.success, true);
  assert.equal(result.count, 1);
  assert.equal(f.batches().length, 1);
  const batch = f.batches()[0];
  const row = appended(batch, 1)[0];
  assert.equal(value(row, LINE_HEADERS, "Amount"), 90);
  assert.equal(value(row, LINE_HEADERS, "Total Amount"), 108);
  assert.match(value(row, LINE_HEADERS, "Line Item ID"), /^LI-/);
  assert.ok(f.calls.some((c) => decodeURIComponent(c.url).includes("'Cost+Line+Items'!1:1")));
  assert.ok(batch.some((r) => r.updateCells?.rows[0].values[0].userEnteredValue.formulaValue?.startsWith("=SUMIFS(")));
});

test("new sheet and first items are in the same commit (frontend action alias)", async () => {
  const f = fixture();
  const result = await mutateCosting({ action: "createCostSheetAndAddLineItems", data: { costSheetData: cost, items: [item, item] } }, validation, f.open);
  assert.match(result.costSheetId, /^CS-/);
  const batch = f.batches()[0];
  assert.equal(appended(batch, 0).length, 1);
  assert.equal(appended(batch, 1).length, 2);
  assert.equal(value(appended(batch, 1)[0], LINE_HEADERS, "Cost Sheet ID"), result.costSheetId);
});

test("edit deactivates the exact old row and appends replacement atomically", async () => {
  const f = fixture({ lines: [item, { ...item, "Line Item ID": "LI-2" }] });
  await mutateCosting({ action: "updateLineItem", data: { costSheetId: "CS-1", lineItemId: "LI-2", updated: { ...item, Amount: 200 } } }, validation, f.open);
  const batch = f.batches()[0];
  assert.ok(batch.some((r) => r.updateCells?.start.sheetId === 1 && r.updateCells.start.rowIndex === 2 && r.updateCells.rows[0].values[0].userEnteredValue.stringValue === "No"));
  assert.equal(appended(batch, 1).length, 1);
  assert.equal(batch.filter((r) => r.addNamedRange).length, 1);
});

test("invalid replacement leaves original untouched", async () => {
  const f = fixture();
  await assert.rejects(mutateCosting({ action: "updateLineItem", data: { costSheetId: "CS-1", lineItemId: "LI-1", updated: { Amount: "invalid" } } }, validation, f.open), /Invalid Amount/);
  assert.equal(f.batches().length, 0);
});

test("legacy delete matches date and particular, never guesses among duplicates", async () => {
  const f = fixture({ lines: [item, { ...item, "Line Item ID": "LI-2" }] });
  await assert.rejects(mutateCosting({ action: "softDeleteLineItem", data: { costSheetId: "CS-1", particular: "Materials", entryTimestamp: item["Entry Timestamp"] } }, validation, f.open), /Multiple matching/);
  assert.equal(f.batches().length, 0);
  assert.equal(dateMs("15/09/2026 12:00:00"), dateMs(item["Entry Timestamp"]));
});

test("advance balance formulas update in the same batch as funded expenses", async () => {
  const f = fixture({ advances: [{ "Advance ID": "ADV-1", "Cost Sheet ID": "CS-1", "Advance Amount": 500, Active: "Yes" }] });
  await mutateCosting({ action: "addLineItemsBatch", data: { costSheetId: "CS-1", items: [{ ...item, "Advance ID": "ADV-1", "Advance Applied Amount": 118 }] } }, validation, f.open);
  assert.ok(f.batches()[0].some((r) => r.updateCells?.start.sheetId === 2 && r.updateCells.rows[0].values[0].userEnteredValue.formulaValue?.startsWith("=MAX(500-")));
});

test("bulk sync is all-or-nothing and marks requests in the same write", async () => {
  const f = fixture();
  const result = await mutateCosting({ action: "bulkSyncExpenseRequestsToCostLine", data: { requestIds: ["REQ-1"], gstPct: 18 } }, validation, f.open);
  assert.equal(result.processed, 1);
  assert.equal(value(appended(f.batches()[0], 1)[0], LINE_HEADERS, "Expense Request ID"), "REQ-1");
  assert.ok(f.batches()[0].some((r) => r.updateCells?.start.sheetId === 3 && r.updateCells.start.columnIndex === REQUEST_HEADERS.indexOf("Synced To Cost Line") && r.updateCells.rows[0].values[0].userEnteredValue.stringValue === "Yes"));
  const invalid = fixture({ requests: [request, { ...request, "Request ID": "REQ-2", "Approval Status": "Pending" }] });
  await assert.rejects(mutateCosting({ action: "bulkSyncExpenseRequestsToCostLine", data: { requestIds: ["REQ-1", "REQ-2"] } }, validation, invalid.open), /not approved/);
  assert.equal(invalid.batches().length, 0);
});

test("competing sync attempts use the same atomic consumption marker", async () => {
  const a = fixture(), b = fixture();
  const payload = { action: "syncExpenseRequestToCostLine", data: { requestId: "REQ-1" } };
  await Promise.all([mutateCosting(payload, validation, a.open), mutateCosting(payload, validation, b.open)]);
  const marker = (f) => f.batches()[0].find((r) => r.addNamedRange).addNamedRange.namedRange.namedRangeId;
  assert.equal(marker(a), marker(b));
});

test("bulk review updates audit fields in one batch and supports zero amounts", async () => {
  const f = fixture({ requests: [{ ...request, "Approval Status": "Pending" }] });
  const result = await mutateCosting({ action: "bulkReviewExpenseRequests", data: { actionBy: "Manager", rows: [{ requestId: "REQ-1", approvalStatus: "Approved", amount: 0 }] } }, validation, f.open);
  assert.equal(result.updatedCount, 1);
  const batch = f.batches()[0];
  assert.ok(batch.some((r) => r.updateCells?.start.columnIndex === REQUEST_HEADERS.indexOf("Approved By") && r.updateCells.rows[0].values[0].userEnteredValue.stringValue === "Manager"));
});

test("a lost commit response is reported as unconfirmed, without retry", async () => {
  const f = fixture({ failCommit: true });
  await assert.rejects(mutateCosting({ action: "addLineItem", data: item }, validation, f.open), { code: "SAVE_UNCONFIRMED" });
  assert.equal(f.batches().length, 1);
});

test("finance exports honor dates, active status, selection and subtotals", async () => {
  const headers = ["Particular", "Expense Date", "Total Amount", "Active"];
  const data = prepareExport(headers, [
    { Particular: "A", "Expense Date": "15/09/2026", "Total Amount": 100, Active: "Yes" },
    { Particular: "A", "Expense Date": "2026-09-15", "Total Amount": 18, Active: "Yes" },
    { Particular: "A", "Expense Date": "2026-09-15", "Total Amount": 999, Active: "No" },
    { Particular: "B", "Expense Date": "2026-09-14", "Total Amount": 999, Active: "Yes" },
  ], { action: "exportFinance", from: "2026-09-15", to: "2026-09-15", subtotalBy: "Particular", fields: '["Particular","Total Amount"]' });
  assert.equal(data.rows.length, 4);
  assert.deepEqual(data.rows[2].values, ["A subtotal", 118]);
  assert.deepEqual(data.rows[3].values, ["Grand total", 118]);
  const csv = await renderExport(data, "csv");
  assert.match(csv.toString(), /"Grand total","118"/);
});

test("Excel exports are real workbooks with numeric totals and merged groups", async () => {
  const { default: ExcelJS } = await import("exceljs");
  const table = { headers: ["Particular", "Total Amount"], rows: [{ values: ["A", 10] }, { values: ["A", 20] }], merge: "Particular" };
  const bytes = await renderExport(table, "xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const sheet = workbook.worksheets[0];
  assert.equal(sheet.getCell("B3").value, 20);
  assert.equal(sheet.getCell("A3").isMerged, true);
});

test("PDF exports produce a PDF including wide selections", async () => {
  const bytes = await renderExport({ headers: Array.from({ length: 8 }, (_, i) => `Column ${i}`), rows: [{ values: Array(8).fill("Test") }], merge: "" }, "pdf");
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.ok(bytes.length > 1000);
});

test("browser requires explicit success and does not retry non-JSON responses", async () => {
  const original = global.fetch;
  let calls = 0;
  try {
    global.fetch = async () => { calls++; return { status: 404, ok: false, json: async () => { throw new Error("HTML"); } }; };
    await assert.rejects(postCosting({ action: "addLineItem" }), /could not be confirmed/);
    assert.equal(calls, 1);
    global.fetch = async () => ({ ok: true, json: async () => ({}) });
    await assert.rejects(postCosting({}), /could not be confirmed/);
  } finally { global.fetch = original; }
});

test("the costing runtime has no GAS fallback", () => {
  for (const file of ["api/_handlers/costing.js", "api/_lib/costingStore.js", "api/_lib/costingMutations.js", "api/_lib/costingReads.js", "api/_lib/costingExports.js"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /script\.google|COSTING_GAS_URL|proxyPost|proxyGet/);
  }
});


test("expense read queues preserve role filtering and approved/hold states", async () => {
  const f = fixture({ requests: [
    { ...request, "Raised By Email": "one@example.test", "Approval Status": "Pending" },
    { ...request, "Request ID": "REQ-2", "Raised By Email": "two@example.test", "Approval Status": "Approved" },
    { ...request, "Request ID": "REQ-3", "Approval Status": "On Hold" },
    { ...request, "Request ID": "REQ-4", Active: "No" },
  ] });
  const read = (action, query = {}) => readCosting(action, query, async () => [cost], f.open);
  assert.equal((await read("getExpenseRequests", { raisedByEmail: "ONE@example.test" })).length, 1);
  assert.equal((await read("getExpenseRequests", { role: "admin" })).length, 3);
  assert.equal((await read("getExpenseApprovalQueue")).length, 2);
  assert.equal((await read("getExpenseAccountsQueue")).length, 1);
  assert.equal((await read("getCostSheetsForMapping"))[0].costSheetId, "CS-1");
  assert.equal((await read("getLinkedEntitiesForMapping"))[0].linkedEntityId, "P-1");
});

test("advance reads calculate usage from active items including blank Active", async () => {
  const f = fixture({
    advances: [{ "Advance ID": "ADV-1", "Cost Sheet ID": "CS-1", "Advance Amount": 500 }],
    lines: [{ ...item, "Advance ID": "ADV-1", "Advance Applied Amount": 118, Active: "" }, { ...item, "Advance ID": "ADV-1", "Advance Applied Amount": 200, Active: "No" }],
  });
  const rows = await readCosting("getAdvancesForCostSheet", { costSheetId: "CS-1" }, async () => [cost], f.open);
  assert.equal(rows[0]["Amount Used"], 118);
  assert.equal(rows[0]["Balance Available"], 382);
});

test("advance recording and expense batch creation use native atomic writes", async () => {
  const f = fixture();
  const advance = await mutateCosting({ action: "recordAdvancePayment", data: { "Cost Sheet ID": "CS-1", "Advance Amount": 500, "Advance Paid To": "Supplier" } }, validation, f.open);
  assert.match(advance.advanceId, /^ADV-/);
  assert.equal(appended(f.batches()[0], 2).length, 1);
  const requests = fixture();
  const result = await mutateCosting({ action: "createExpenseRequestBatch", data: { raisedBy: "User", rows: [{ particular: "Travel", amount: 200 }] } }, validation, requests.open);
  assert.equal(result.count, 1);
  assert.equal(value(appended(requests.batches()[0], 3)[0], REQUEST_HEADERS, "Approval Status"), "Pending");
});

test("empty line items cannot create a new sheet", async () => {
  const f = fixture();
  await assert.rejects(mutateCosting({ action: "createCostSheetAndAddLineItems", data: { costSheetData: cost, items: [{}] } }, validation, f.open), /empty/);
  assert.equal(f.batches().length, 0);
});
