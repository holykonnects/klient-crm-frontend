import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { downloadQuotationImage, quotationImageAuthSubjects, quotationImageReference, resolveQuotationImages } from "../api/_lib/quotationImages.js";
import { templateImageFormula, templateItems } from "../api/_lib/quotationPdfExport.js";
import { buildQuotationSetWorkbook } from "../api/_lib/quotationSetExport.js";

const id = "1obzLMUEVUyb2n7t1yv_PU6K4Ak4_bE_X";
const url = `https://drive.google.com/file/d/${id}/view`;
const catalog = { items: { "Track|||Kerbing": [{ code: "KERB", imageUrl: url }] } };

test("all quotation types use the same image reference and New Template formula", () => {
  for (const input of [url, id, `=IMAGE("${url}",1)`, `https://drive.google.com/uc?id=${id}`]) {
    assert.equal(quotationImageReference(input).fileId, id);
    assert.equal(templateImageFormula(input, { proxyUrl: "https://crm.example/api/image" }), '=IMAGE("https://crm.example/api/image",1)');
  }
  const external = "https://example.com/abcdefghijklmnopqrstuvwxyz.png";
  assert.equal(quotationImageReference(external).fileId, "");
  assert.equal(templateImageFormula(external), `=IMAGE("${external}",1)`);
  assert.equal(quotationImageReference("#REF!"), null);
});

test("athletic and BOQ selections recover images without replacing scope or pricing", () => {
  const athletic = resolveQuotationImages({ quoteType: "athletic", items: [{ category: "Track", subCategory: "Kerbing", itemCode: "KERB", displayItem: "Drainage", descOverride: "Civil scope", qty: 10, rate: 20 }] }, catalog);
  assert.equal(templateItems(athletic)[0].imageUrl, url);
  assert.equal(athletic.items[0].descOverride, "Civil scope");
  assert.equal(athletic.items[0].rate, 20);
  const boq = resolveQuotationImages({ quoteType: "project-set", setQuotation: { sets: [{ title: "Civil", items: [{ item: "Drainage", imageCategory: "Track", imageSubCategory: "Kerbing", imageItemCode: "KERB", description: "BOQ scope", qty: 5, rate: 30 }] }] } }, catalog);
  assert.equal(templateItems(boq)[0].imageUrl, url);
  assert.equal(templateItems(boq)[0].descOverride, "BOQ scope");
  assert.equal(templateItems(boq)[0].rate, 30);
});

test("image extraction includes the configured Sheets identity and surfaces permission failures", async () => {
  assert.deepEqual(quotationImageAuthSubjects({ GOOGLE_DRIVE_DELEGATED_USER_EMAIL: "drive@example.com", GOOGLE_SHEETS_DELEGATED_USER_EMAIL: "sheets@example.com" }), ["drive@example.com", "sheets@example.com", ""]);
  const attempts = [];
  const image = await downloadQuotationImage(`=IMAGE("${url}")`, {
    subjects: ["drive@example.com", "sheets@example.com"],
    download: async (fileId, auth) => {
      assert.equal(fileId, id);
      attempts.push(auth.subject);
      if (auth.subject === "drive@example.com") throw new Error("permission denied");
      return { contentType: "image/png", body: Buffer.from("image") };
    },
  });
  assert.deepEqual(attempts, ["drive@example.com", "sheets@example.com"]);
  assert.equal(image.contentType, "image/png");
  await assert.rejects(downloadQuotationImage(url, { subjects: [""], download: async () => { throw new Error("permission denied"); } }), /could not be downloaded: permission denied/);
});

test("BOQ Excel embeds image bytes and keeps their aspect ratio", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT1cAAAAASUVORK5CYII=", "base64");
  const payload = { setQuotation: { sets: [{ title: "Civil", items: [{ item: "Kerbing", imageUrl: url, qty: 1, rate: 10 }] }] } };
  const output = await buildQuotationSetWorkbook(payload, { loadImage: async () => ({ contentType: "image/png", body: png }) });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(output.buffer);
  const images = workbook.getWorksheet("Quotation").getImages();
  assert.equal(images.length, 1);
  assert.deepEqual(workbook.getImage(images[0].imageId).buffer, png);
  assert.equal(images[0].range.ext.width, images[0].range.ext.height);
  await assert.rejects(buildQuotationSetWorkbook(payload, { loadImage: async () => { throw new Error("Image access denied"); } }), /Image access denied/);
});
