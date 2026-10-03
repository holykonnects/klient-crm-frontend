import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildQuotationPdf, quotationLineDescription, templateImageFormula, templateItemRowHeight, templateRichCell,
} from "../api/_lib/quotationPdfExport.js";
import { verifySignedToken } from "../api/_lib/sessionAuth.js";

test("native quotation PDF renders without Apps Script", async () => {
  const pdf = await buildQuotationPdf({
    quoteType: "standard",
    meta: { quotationTitle: "Native Quote", clientName: "Client", termsAndConditions: ["Term one"] },
    pricing: { equipmentGstPct: 18, nonEquipmentGstPct: 18, freightInstallGstPct: 18 },
    items: [{
      category: "Equipment", subCategory: "Goals", itemCode: "GOAL-1", displayItem: "Goal Post",
      descHtml: "<p><strong>Approved</strong> specification</p>", freight: "Included", installation: "Excluded",
      unit: "No.", qty: 2, rate: 1000, itemType: "Equipment",
    }],
  });
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 1000);
  assert.equal(quotationLineDescription({ descHtml: "<p><strong>Approved</strong> specification</p>" }), "Approved specification");
});

test("quotation builder posts PDF exports to the native quotations API", async () => {
  const source = await readFile(new URL("../src/components/QuotationBuilder.js", import.meta.url), "utf8");
  const exporter = await readFile(new URL("../api/_lib/quotationPdfExport.js", import.meta.url), "utf8");
  assert.match(source, /action:\s*'exportPdf'/);
  assert.doesNotMatch(source, /QUOTATION_EXPORT_URL|\/api\/gas/);
  assert.match(source, /freight:\s*r\.freight/);
  assert.match(source, /installation:\s*r\.installation/);
  assert.match(exporter, /const TEMPLATE_SHEET = "New Template"/);
  assert.match(exporter, /const \{ copy, auth \} = await copyNewTemplate\(baseName\)/);
  assert.match(exporter, /populateNewTemplate\(copy\.id, auth, payload\)/);
  assert.match(exporter, /range: "E2:L105"/);
  assert.match(exporter, /top_margin: "0\.2"/);
  assert.match(exporter, /startIndex: 79 \+ terms\.length, endIndex: 99/);
  assert.match(exporter, /wrapStrategy: "WRAP"/);
  assert.match(exporter, /importFunctionsExternalUrlAccessAllowed: true/);
  assert.match(exporter, /setTimeout\(resolve, 1500\)/);
  assert.doesNotMatch(exporter, /export async function exportQuotationToDrive[\s\S]{0,250}buildQuotationPdf/);
});

test("New Template images use signed CRM URLs and never export Drive references", () => {
  assert.equal(templateImageFormula("#REF!"), "");
  assert.equal(templateImageFormula("not-a-url"), "");
  const previousSecret = process.env.CRM_SESSION_SECRET;
  process.env.CRM_SESSION_SECRET = "quotation-image-test-secret";
  const formula = templateImageFormula("https://drive.google.com/file/d/15Xvn48C8KN2ImDg-OIEMjt9Xfk-Sbw6b/view");
  if (previousSecret === undefined) delete process.env.CRM_SESSION_SECRET;
  else process.env.CRM_SESSION_SECRET = previousSecret;
  assert.match(formula, /crm\.klientkonnect\.com\/api\/quotation-image/);
  assert.doesNotMatch(formula, /drive\.google\.com/);
  assert.match(formula, /,1\)$/);
  assert.doesNotMatch(formula, /,4,/);
  const token = decodeURIComponent(formula.match(/token=([^"&]+)/)?.[1] || "");
  const payload = verifySignedToken(token, { secret: "quotation-image-test-secret" });
  assert.deepEqual(payload, { type: "quotation-image", fileId: "15Xvn48C8KN2ImDg-OIEMjt9Xfk-Sbw6b" });
});

test("New Template descriptions retain rich text and append row commercial terms", () => {
  const cell = templateRichCell("<p><strong>Approved</strong> <em>specification</em></p>", "", {
    freight: "Included", installation: "Excluded",
  });
  assert.equal(cell.userEnteredValue.stringValue, "Approved specification\nFreight: Included\nInstallation: Excluded");
  assert.ok(cell.textFormatRuns.some((run) => run.format.bold));
  assert.ok(cell.textFormatRuns.some((run) => run.format.italic));
});

test("New Template item rows expand for long wrapped descriptions", () => {
  const shortHeight = templateItemRowHeight({ description: "Short description" });
  const longHeight = templateItemRowHeight({ description: "Long quotation specification ".repeat(40) });
  const imageHeight = templateItemRowHeight({
    description: "Short description",
    imageUrl: "https://drive.google.com/file/d/15Xvn48C8KN2ImDg-OIEMjt9Xfk-Sbw6b/view",
  });
  assert.equal(shortHeight, 60);
  assert.ok(longHeight > shortHeight);
  assert.equal(imageHeight, 160);
});
