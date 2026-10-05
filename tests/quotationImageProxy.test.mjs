import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("the API router exposes the signed quotation image proxy", async () => {
  const router = await readFile(new URL("../api/index.js", import.meta.url), "utf8");
  const handler = await readFile(new URL("../api/_handlers/quotation-image.js", import.meta.url), "utf8");
  assert.match(router, /"quotation-image": quotationImage/);
  assert.match(handler, /verifySignedToken\(token\)/);
  assert.match(handler, /payload\.type !== "quotation-image"/);
  assert.match(handler, /startsWith\("image\/"\)/);
  assert.match(handler, /downloadQuotationImage/);
});
