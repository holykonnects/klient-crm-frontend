import test from "node:test";
import assert from "node:assert/strict";
import { anchoredAppendRange } from "../api/_lib/googleSheets.js";
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
