import {
  openCostingStore, TABLE, COST_HEADERS, LINE_HEADERS, ADVANCE_HEADERS, REQUEST_HEADERS,
  clean, number, active, newId, dateMs, costFormulas, advanceFormulas,
} from "./costingStore.js";

export const POST_ACTIONS = new Set([
  "recomputeTotals", "createCostSheet", "addLineItem", "addLineItemsBatch", "updateLineItem", "softDeleteLineItem",
  "createCostSheetAndAddLineItems", "createCostSheetAndAddLineItem", "createCostSheetAndAddLineItemsBatch",
  "recordAdvancePayment", "createExpenseRequestBatch", "updateExpenseRequestApproval",
  "bulkUpdateExpenseRequestApproval", "bulkReviewExpenseRequests", "syncExpenseRequestToCostLine", "bulkSyncExpenseRequestsToCostLine",
]);
const mappingFields = ["Linked Entity Type", "Linked Entity ID", "Linked Entity Name", "Existing Cost Sheet ID", "Existing Cost Sheet Name"];
const amountFields = ["QTY", "Rate", "Amount", "GST %", "GST Amount", "Total Amount", "Advance Applied Amount"];
const requiredList = (value, name) => {
  if (!Array.isArray(value) || !value.length) throw new Error(`${name} must contain at least one item`);
  return value;
};

export async function mutateCosting(payload, validation, openStore = openCostingStore) {
  const action = clean(payload.action);
  if (!POST_ACTIONS.has(action)) throw new Error(`Unknown costing action: ${action}`);
  const data = payload.data || {};
  const stamp = new Date().toISOString();
  const requestOnly = ["createExpenseRequestBatch", "updateExpenseRequestApproval", "bulkUpdateExpenseRequestApproval", "bulkReviewExpenseRequests"].includes(action);
  const sync = action === "syncExpenseRequestToCostLine" || action === "bulkSyncExpenseRequestsToCostLine";
  const store = await openStore(requestOnly ? [TABLE.requests] : [TABLE.costs, TABLE.lines, TABLE.advances, ...(sync ? [TABLE.requests] : [])], { headerOnly: ["updateLineItem", "softDeleteLineItem"].includes(action) ? [] : [TABLE.lines] });
  const heads = (validation.validationHeaders || []).filter((h) => h && !["Cost Heads", "Payment Status", "Active", ...COST_HEADERS].includes(h));
  const costs = !requestOnly ? store.table(TABLE.costs, [...COST_HEADERS, ...heads]) : null;
  const lines = !requestOnly ? store.table(TABLE.lines, LINE_HEADERS) : null;
  const advances = !requestOnly ? store.table(TABLE.advances, ADVANCE_HEADERS) : null;
  const requests = requestOnly || sync ? store.table(TABLE.requests, REQUEST_HEADERS) : null;
  const changedSheets = new Set();
  const changedAdvances = new Set();
  const added = [];
  const created = new Map();
  let result;
  function findCost(id) {
    const row = created.get(clean(id)) || costs.rows.find((r) => clean(r["Cost Sheet ID"]) === clean(id));
    if (!row) throw new Error(`Cost Sheet not found: ${id}`);
    return row;
  }
  function createCost(input) {
    if (!clean(input["Linked Entity Type"]) || !clean(input["Linked Entity ID"])) throw new Error("Linked Entity Type and ID are required");
    const id = newId("CS");
    const row = { ...input, "Cost Sheet ID": id, Timestamp: stamp, "Last Calculated At": stamp };
    created.set(id, row);
    changedSheets.add(id);
    return id;
  }
  function addItems(items, id) {
    requiredList(items, "items");
    for (const input of items) {
      const csId = clean(id || input["Cost Sheet ID"]);
      const parent = findCost(csId);
      const row = Object.fromEntries(Object.entries(input).filter(([key]) => !key.startsWith("__")));
      for (const field of ["Owner", "Linked Entity Type", "Linked Entity ID", "Linked Entity Name", "Client Name", "Project Type"]) row[field] = parent[field] || row[field] || "";
      Object.assign(row, { "Cost Sheet ID": csId, "Line Item ID": newId("LI"), "Entry Timestamp": stamp, Active: "Yes" });
      for (const field of amountFields) {
        if (row[field] !== "" && row[field] != null) {
          const value = Number(String(row[field]).replace(/[,₹\s]/g, ""));
          if (!Number.isFinite(value)) throw new Error(`Invalid ${field}`);
          row[field] = value;
        }
      }
      if (!["Particular", "Details", "Amount", "Total Amount"].some((key) => clean(row[key]))) throw new Error("Line item is empty");
      if (row["Total Amount"] === "" || row["Total Amount"] == null) row["Total Amount"] = number(row.Amount) + number(row["GST Amount"]);
      const advanceId = clean(row["Advance ID"]);
      if (advanceId) {
        if (!advances.rows.some((a) => active(a) && clean(a["Advance ID"]) === advanceId && clean(a["Cost Sheet ID"]) === csId)) throw new Error("Advance does not belong to this cost sheet");
        if (number(row["Advance Applied Amount"]) <= 0) throw new Error("Advance applied amount must be greater than zero");
        changedAdvances.add(advanceId);
      }
      changedSheets.add(csId);
      added.push(row);
    }
  }
  function deleteItem(input) {
    const id = clean(input.costSheetId);
    findCost(id);
    const matches = lines.rows.map((row, index) => ({ row, index })).filter(({ row }) => {
      if (!active(row) || clean(row["Cost Sheet ID"]) !== id) return false;
      if (input.lineItemId) return clean(row["Line Item ID"]) === clean(input.lineItemId);
      const timestamp = clean(input.entryTimestamp);
      if (timestamp) {
        const same = clean(row["Entry Timestamp"]) === timestamp || (dateMs(timestamp) && dateMs(row["Entry Timestamp"]) === dateMs(timestamp));
        return same && (!input.particular || clean(row.Particular) === clean(input.particular));
      }
      return input.particular && clean(row.Particular) === clean(input.particular);
    });
    if (matches.length !== 1) throw new Error(matches.length ? "Multiple matching line items; refresh and select the exact item" : "Line item not found or already inactive");
    const { row, index } = matches[0];
    const changes = { Active: "No" };
    for (const field of ["Updated At", "Last Updated At", "Deleted At"]) if (lines.headers.includes(field)) { changes[field] = stamp; break; }
    store.consumeOnce(lines, index, `line:${row["Line Item ID"] || `${id}:${index}:${row["Entry Timestamp"]}:${row.Particular}`}`);
    store.patch(lines, index, changes);
    changedSheets.add(id);
    if (row["Advance ID"]) changedAdvances.add(clean(row["Advance ID"]));
    return row;
  }
  function findRequest(id) {
    const index = requests.rows.findIndex((r) => clean(r["Request ID"]) === clean(id) && active(r));
    if (index < 0) throw new Error(`Expense request not found: ${id}`);
    return { row: requests.rows[index], index };
  }
  function review(input) {
    const { row, index } = findRequest(input.requestId);
    if (clean(row["Synced To Cost Line"]) === "Yes") throw new Error(`Request ${input.requestId} is already synced`);
    const status = clean(input.approvalStatus || row["Approval Status"]);
    if (!["Approved", "Rejected", "On Hold", "Pending"].includes(status)) throw new Error("Invalid approval status");
    const changes = { "Approval Status": status, "Last Updated On": stamp, "Action By": data.actionBy || "", "Action By Email": data.actionByEmail || "", "Action By Role": data.actionByRole || "" };
    for (const field of mappingFields) if (input[field] !== undefined) changes[field] = clean(input[field]);
    for (const [key, field] of Object.entries({ particular: "Particular", description: "Description", amount: "Amount", operationsRemarks: "Operations Remarks", rejectionRemarks: "Rejection Remarks", holdRemarks: "Hold Remarks" })) {
      if (input[key] !== undefined) changes[field] = key === "amount" ? number(input[key]) : clean(input[key]);
      else if (input[field] !== undefined) changes[field] = clean(input[field]);
    }
    const mapped = { ...row, ...changes };
    changes["Attribution Status"] = mappingFields.some((key) => clean(mapped[key])) ? "Mapped" : "Unmapped";
    const prefix = { Approved: "Approved", Rejected: "Rejected", "On Hold": "Hold" }[status];
    if (prefix) Object.assign(changes, { [`${prefix} By`]: data.actionBy || input.actionBy || "", [`${prefix} On`]: stamp });
    if (status === "Approved") for (const field of ["Rejected By", "Rejected On", "Rejection Remarks", "Hold By", "Hold On", "Hold Remarks"]) changes[field] = "";
    store.patch(requests, index, changes);
  }
  function syncRequest(id) {
    const { row, index } = findRequest(id);
    if (row["Approval Status"] !== "Approved") throw new Error(`Request ${id} is not approved`);
    if (row["Synced To Cost Line"] === "Yes") throw new Error(`Request ${id} is already synced`);
    const mapped = Object.fromEntries(mappingFields.map((key) => [key, clean(data[key] || row[key])]));
    let cost;
    if (mapped["Existing Cost Sheet ID"]) cost = findCost(mapped["Existing Cost Sheet ID"]);
    else {
      const type = mapped["Linked Entity Type"], entityId = mapped["Linked Entity ID"], name = mapped["Linked Entity Name"];
      if (!entityId && !name) throw new Error(`Request ${id} needs a cost sheet or linked entity mapping`);
      const candidates = costs.rows.filter((c) => (!type || clean(c["Linked Entity Type"]) === type) && (entityId ? clean(c["Linked Entity ID"]) === entityId : clean(c["Linked Entity Name"]) === name));
      if (candidates.length !== 1) throw new Error(`Request ${id}: select an explicit cost sheet (${candidates.length} matches)`);
      cost = candidates[0];
    }
    store.consumeOnce(requests, index, `expense:${id}`);
    const costId = cost["Cost Sheet ID"];
    const amount = data.amount === undefined || data.amount === "" ? number(row.Amount) : number(data.amount);
    const gst = number(data.gstPct);
    addItems([{
      "Expense Request ID": id, "Head Name": data.headName || "Miscellaneous", Subcategory: data.subcategory || "",
      "Expense Date": data.expenseDate || stamp, "Entered By": data.syncedBy || row["Raised By"], "Entry Tag": "Expense Request",
      Particular: data.particular || row.Particular, Details: data.details || row.Description, QTY: 1, Rate: amount, Amount: amount,
      "GST %": gst, "GST Amount": amount * gst / 100, "Total Amount": amount * (1 + gst / 100),
      "Voucher/Invoice No": data.voucherNo || "", "Payment Status": data.paymentStatus || "Pending",
    }], costId);
    store.patch(requests, index, {
      "Existing Cost Sheet ID": costId, "Existing Cost Sheet Name": data["Existing Cost Sheet Name"] || row["Existing Cost Sheet Name"] || costId,
      ...Object.fromEntries(mappingFields.slice(0, 3).map((key) => [key, cost[key] || mapped[key]])),
      "Attribution Status": "Mapped", "Synced To Cost Line": "Yes", "Synced On": stamp, "Last Updated On": stamp,
    });
    return { requestId: id, costSheetId: costId, success: true };
  }

  if (action === "recomputeTotals") {
    findCost(data.costSheetId);
    changedSheets.add(clean(data.costSheetId));
    result = { costSheetId: clean(data.costSheetId) };
  } else if (action === "createCostSheet") result = { costSheetId: createCost(data) };
  else if (action.startsWith("createCostSheetAndAdd")) {
    const items = data.items || data.lineItems || (data.lineItemData ? [data.lineItemData] : []);
    requiredList(items, "items");
    const id = createCost(data.costSheetData || {});
    addItems(items, id);
    result = { costSheetId: id, count: items.length };
  } else if (action === "addLineItem" || action === "addLineItemsBatch") {
    addItems(action === "addLineItem" ? [data] : data.items, data.costSheetId);
    result = { count: added.length };
  } else if (action === "softDeleteLineItem" || action === "updateLineItem") {
    deleteItem(data);
    if (action === "updateLineItem") {
      if (!data.updated) throw new Error("Updated line item is required");
      addItems([data.updated], data.costSheetId);
    }
    result = { costSheetId: data.costSheetId };
  } else if (action === "recordAdvancePayment") {
    findCost(data["Cost Sheet ID"]);
    if (number(data["Advance Amount"]) <= 0) throw new Error("Advance Amount must be greater than zero");
    const advanceId = newId("ADV");
    const row = { ...data, "Advance ID": advanceId, "Advance Amount": number(data["Advance Amount"]), Timestamp: stamp, "Advance Date": data["Advance Date"] || stamp, Active: "Yes", "Amount Used": 0, "Balance Available": number(data["Advance Amount"]) };
    store.append(advances, [row], (a) => advanceFormulas(lines, a));
    result = { advanceId, advances: [...advances.rows.filter((a) => active(a) && a["Cost Sheet ID"] === data["Cost Sheet ID"]), row] };
  } else if (action === "createExpenseRequestBatch") {
    const batchId = newId("BATCH");
    const rows = requiredList(data.rows, "rows").map((input) => {
      if (!clean(input.particular) || number(input.amount) <= 0) throw new Error("Each request requires a particular and a positive amount");
      return { "Batch ID": batchId, "Request ID": newId("REQ"), Timestamp: stamp, "Raised By": clean(data.raisedBy), "Raised By Email": clean(data.raisedByEmail), Owner: clean(data.owner || data.raisedBy), Particular: clean(input.particular), Description: clean(input.description), Amount: number(input.amount), "Approval Status": "Pending", "Attribution Status": "Unmapped", "Synced To Cost Line": "No", Active: "Yes", "Last Updated On": stamp };
    });
    store.append(requests, rows);
    result = { batchId, count: rows.length };
  } else if (sync) {
    const ids = action === "syncExpenseRequestToCostLine" ? [data.requestId] : requiredList(data.requestIds, "requestIds");
    const results = [...new Set(ids)].map(syncRequest);
    result = action === "syncExpenseRequestToCostLine" ? results[0] : { processed: results.length, failed: 0, results, errors: [] };
  } else {
    const rows = action === "bulkReviewExpenseRequests" ? requiredList(data.rows, "rows") : action === "bulkUpdateExpenseRequestApproval" ? requiredList(data.requestIds, "requestIds").map((requestId) => ({ ...data, requestId })) : [data];
    rows.forEach(review);
    result = { updatedCount: rows.length, updated: rows.map((r) => r.requestId), missing: [], skipped: [] };
  }
  if (added.length) store.append(lines, added);
  for (const id of changedSheets) {
    if (created.has(id)) store.append(costs, [created.get(id)], () => costFormulas(lines, id, heads));
    else store.patch(costs, costs.rows.findIndex((r) => clean(r["Cost Sheet ID"]) === id), { "Last Calculated At": stamp }, costFormulas(lines, id, heads));
  }
  for (const id of changedAdvances) {
    const index = advances.rows.findIndex((r) => clean(r["Advance ID"]) === id);
    if (index >= 0) store.patch(advances, index, {}, advanceFormulas(lines, advances.rows[index]));
  }
  await store.commit();
  return { success: true, ...result };
}
