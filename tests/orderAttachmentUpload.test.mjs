import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ORDER_ATTACHMENT_BYTES,
  removeOrderAttachment,
  uploadOrderAttachment,
} from "../src/utils/orderAttachmentUpload.js";

test("order attachments upload immediately in an individual request", async () => {
  const OriginalFileReader = globalThis.FileReader;
  globalThis.FileReader = class {
    readAsDataURL() {
      this.result = "data:application/pdf;base64,ZmlsZQ==";
      this.onload();
    }
  };
  try {
    let request;
    const uploaded = await uploadOrderAttachment({
      file: { name: "order.pdf", type: "application/pdf", size: 4 },
      field: "Attach Purchase Order",
      orderId: "ORD-123",
      fetcher: async (url, options) => {
        request = { url, options, body: JSON.parse(options.body) };
        return { ok: true, status: 200, json: async () => ({ ok: true, url: "https://drive.test/file", receipt: "signed" }) };
      },
    });
    assert.equal(request.url, "/api/order-attachments");
    assert.equal(request.body.file.base64, "ZmlsZQ==");
    assert.equal(uploaded.status, "uploaded");
    assert.equal(uploaded.url, "https://drive.test/file");
  } finally {
    globalThis.FileReader = OriginalFileReader;
  }
});

test("order attachment removal sends only its signed receipt", async () => {
  let request;
  await removeOrderAttachment("signed-receipt", async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  });
  assert.equal(request.options.method, "DELETE");
  assert.deepEqual(request.body, { receipt: "signed-receipt" });
});

test("order attachment upload rejects files over 2 MB before reading them", async () => {
  await assert.rejects(() => uploadOrderAttachment({
    file: { name: "large.pdf", size: MAX_ORDER_ATTACHMENT_BYTES + 1 },
    field: "Attach Purchase Order",
    orderId: "ORD-123",
    fetcher: async () => { throw new Error("fetch should not run"); },
  }), /2 MB attachment limit/);
});
