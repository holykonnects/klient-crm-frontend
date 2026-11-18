import test from "node:test";
import assert from "node:assert/strict";
import { anchoredAppendRange } from "../api/_lib/googleSheets.js";
import { newDealId, resolveDeal } from "../api/_lib/dealIdentity.js";

import {
  applyAmountUpdate,
  assertValidAttachment,
  assertValidAttachmentBatch,
  MAX_ORDER_ATTACHMENT_BYTES,
  MAX_ORDER_ATTACHMENTS_TOTAL_BYTES,
} from "../api/_lib/crmHandlers.js";

test("sheet appends are anchored to column A for the complete row width", () => {
  assert.equal(anchoredAppendRange("Qualified Leads", 29), "'Qualified Leads'!A:AC");
  assert.equal(anchoredAppendRange("Client's Deals", 1), "'Client''s Deals'!A:A");
});

test("amount updates keep the previous total unless the user explicitly adds", () => {
  const kept = { "Deal Amount": 999, amountUpdate: { field: "Deal Amount", mode: "keep" } };
  applyAmountUpdate(kept, { "Deal Amount": "1,250" }, "Deal Amount");
  assert.equal(kept["Deal Amount"], "1,250");

  const added = { amountUpdate: { field: "Order Amount", mode: "add", addition: "₹ 250.50" } };
  applyAmountUpdate(added, { "Order Amount": "1,000" }, "Order Amount");
  assert.equal(added["Order Amount"], 1250.5);
});

test("amount updates reject ambiguous or non-positive additions", () => {
  assert.throws(() => applyAmountUpdate(
    { amountUpdate: { field: "Deal Amount", mode: "replace", addition: 10 } },
    { "Deal Amount": 100 },
    "Deal Amount",
  ), /Invalid/);
  assert.throws(() => applyAmountUpdate(
    { amountUpdate: { field: "Deal Amount", mode: "add", addition: 0 } },
    { "Deal Amount": 100 },
    "Deal Amount",
  ), /greater than zero/);
});

test("order attachments cannot be replaced by failed-upload placeholders", () => {
  assert.equal(MAX_ORDER_ATTACHMENT_BYTES, 2 * 1024 * 1024);
  assert.equal(MAX_ORDER_ATTACHMENTS_TOTAL_BYTES, 3 * 1024 * 1024);
  assert.doesNotThrow(() => assertValidAttachment(
    "Attach Purchase Order",
    "https://drive.google.com/file/d/123/view",
  ));
  assert.doesNotThrow(() => assertValidAttachment(
    "Attach Purchase Order",
    { base64: "ZmlsZQ==" },
  ));
  assert.throws(
    () => assertValidAttachment("Attach Purchase Order", "FILE_TOO_LARGE: order.pdf"),
    /was not uploaded/,
  );
  assert.throws(
    () => assertValidAttachment("Attach Purchase Order", { name: "order.pdf", base64: "" }),
    /missing its file content/,
  );
  assert.throws(
    () => assertValidAttachment("Attach Purchase Order", {
      name: "large-order.pdf",
      base64: Buffer.alloc(MAX_ORDER_ATTACHMENT_BYTES + 1).toString("base64"),
    }),
    /exceeds the 2 MB attachment limit/,
  );
});

test("order attachment batches stay below the serverless request limit", () => {
  const oneAndAHalfMb = Buffer.alloc(1.5 * 1024 * 1024).toString("base64");
  assert.doesNotThrow(() => assertValidAttachmentBatch({
    "Attach Purchase Order": { base64: oneAndAHalfMb },
    "Attach Drawing": { base64: oneAndAHalfMb },
  }));
  assert.throws(() => assertValidAttachmentBatch({
    "Attach Purchase Order": { base64: Buffer.alloc(2 * 1024 * 1024).toString("base64") },
    "Attach Drawing": { base64: Buffer.alloc(2 * 1024 * 1024).toString("base64") },
  }), /3 MB combined/);
});

const dealHeaders = ["Deal ID", "Order Distribution ID", "Order ID", "Account ID", "Lead ID", "Deal Name", "Deal Amount", "Timestamp", "Company", "Mobile Number", "Account Owner", "Order Amount", "Stage"];
const dealValues = (...deals) => [dealHeaders, ...deals.map((deal) => dealHeaders.map((field) => deal[field] ?? ""))];

test("new deal IDs are unique even for multiple deals from the same account", () => {
  const first = newDealId();
  assert.match(first, /^DEAL-/);
  assert.notEqual(newDealId(), first);
});

test("a legacy order snapshot resolves the prior deal amount and backfills its history", () => {
  const base = { "Account ID": "A-1", "Deal Name": "Old name" };
  const snapshot = { ...base, "Order ID": "ORD-1" };
  const legacy = dealValues({ ...base, "Deal Amount": "1,250" }, snapshot);
  const resolved = resolveDeal(legacy, snapshot, "deals");
  assert.deepEqual(resolved.rowsToBackfill, [3, 2]);
  assert.equal(resolveDeal(legacy, snapshot, "deals").dealId, resolved.dealId);

  const update = { "Deal Name": "New name", amountUpdate: { field: "Deal Amount", mode: "add", addition: 250 } };
  applyAmountUpdate(update, resolved.previous, "Deal Amount");
  assert.equal(update["Deal Amount"], 1500);

  const migrated = dealValues(
    { ...base, "Deal ID": resolved.dealId, "Deal Amount": 1250 },
    { ...snapshot, "Deal ID": resolved.dealId, "Deal Name": "New name", "Deal Amount": 1500 },
  );
  const latest = resolveDeal(migrated, snapshot, "deals");
  assert.equal(latest.previous["Deal Name"], "New name");
  assert.equal(latest.previous["Deal Amount"], 1500);
  assert.deepEqual(latest.rowsToBackfill, []);
});

test("legacy deals can be identified by Order ID alone or by the qualified Lead ID", () => {
  const orderOnly = { "Order ID": "ORD-1", "Deal Name": "Legacy", "Deal Amount": 120 };
  const leadOnly = { "Lead ID": "L-1", "Deal Name": "Legacy", "Deal Amount": 900 };
  const values = dealValues(orderOnly, leadOnly);
  assert.equal(resolveDeal(values, { "Order ID": "ORD-1" }, "deals").previous["Deal Amount"], 120);
  assert.equal(resolveDeal(values, { "Account ID": "L-1", "Deal Name": "Legacy" }, "deals").previous["Deal Amount"], 900);
});

test("an ID-less record requires a unique original name and timestamp", () => {
  const selected = { "Deal Name": "Legacy", Timestamp: "18/11/2026 08:00:00" };
  assert.deepEqual(resolveDeal(dealValues(selected, { ...selected, Timestamp: "18/11/2026 09:00:00" }), selected, "deals").rowsToBackfill, [2]);
  assert.throws(() => resolveDeal(dealValues(selected, selected), selected, "deals"), { status: 409 });
});

test("legacy name matches cannot merge distinct deals and a stale Deal ID cannot target a different deal", () => {
  const base = { "Account ID": "A-1", "Deal Name": "Same name" };
  const values = dealValues({ ...base, "Order Distribution ID": "OD-1" }, { ...base, "Order Distribution ID": "OD-2" });
  assert.throws(() => resolveDeal(values, base, "deals"), { status: 409 });
  assert.throws(() => resolveDeal(values, { ...base, "Deal ID": "missing" }, "deals"), { status: 409 });
});

test("editing a legacy order snapshot recovers the original deal amount through the customer match", () => {
  const contact = { "Deal Name": "Example deal", Company: "Example", "Account Owner": "Owner", "Mobile Number": "9000000000" };
  const closed = { ...contact, "Account ID": "A-1", "Deal Amount": 1250, Stage: "Closed Won" };
  const order = { ...contact, "Order ID": "ORD-1", "Order Amount": 800 };
  const resolved = resolveDeal(dealValues(closed, order), order, "deals");
  assert.deepEqual(resolved.rowsToBackfill, [3, 2]);
  assert.equal(resolved.previous["Account ID"], "A-1");
  assert.equal(resolved.previous.Stage, "Closed Won");
  assert.equal(resolved.previous["Order Amount"], 800);
  const update = { amountUpdate: { field: "Deal Amount", mode: "add", addition: 250 } };
  applyAmountUpdate(update, resolved.previous, "Deal Amount");
  assert.equal(update["Deal Amount"], 1500);
  assert.equal(resolveDeal(dealValues(closed, order), closed, "deals").dealId, resolved.dealId);
});

test("a legacy order recovers its Closed Won deal amount even when both rows have no Account ID", () => {
  const contact = { "Deal Name": "Example deal", Company: "Example", "Account Owner": "Owner", "Mobile Number": "9000000000" };
  const closed = { ...contact, "Deal Amount": "1,68,958", Stage: "Closed Won", Timestamp: "31/10/26 13:44:03" };
  const order = { ...contact, "Order ID": "ORD-1", "Order Amount": "1,68,958 acrylic material" };
  const values = dealValues(closed, order);
  const resolved = resolveDeal(values, order, "deals");
  assert.equal(resolved.previous["Deal Amount"], "1,68,958");
  assert.equal(resolved.previous["Order ID"], "ORD-1");
  assert.deepEqual(resolved.rowsToBackfill, [3, 2]);
  assert.equal(resolveDeal(values, closed, "deals").dealId, resolved.dealId);
});
