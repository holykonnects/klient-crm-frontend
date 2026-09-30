import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { buildQuotationSetWorkbook } from "../api/_lib/quotationSetExport.js";

const templates = JSON.parse(await readFile(new URL("../src/data/quotationSetTemplates.json", import.meta.url), "utf8"));

function resolvedSets(template) {
  return template.sets.map((set) => ({
    ...set,
    items: set.items.map((item) => ({
      ...item,
      qty: item.qtyMode === "factor" ? set.baseQuantity * item.factor : item.qty,
    })),
  }));
}

test("GOI workbook templates preserve all five quotation patterns", () => {
  assert.deepEqual(templates.map((template) => template.id), [
    "7-2-pu", "football-hockey-asphalt", "1-fifa-standard-futball-track", "futsal-48x31", "sheet1",
  ]);
  assert.equal(templates.find((template) => template.id === "futsal-48x31").sets[0].items.length, 19);
  assert.equal(templates.find((template) => template.id === "sheet1").sets.length, 2);
  assert.equal(templates.find((template) => template.id === "sheet1").sets[0].baseQuantity, 7500);
});

test("linked quantities scale with a set base while manual quantities remain fixed", () => {
  const futsal = templates.find((template) => template.id === "futsal-48x31");
  const set = resolvedSets(futsal)[0];
  const aggregate = set.items.find((item) => item.item.startsWith("40mm Aggregate"));
  const manual = set.items.find((item) => item.item.startsWith("Excavation for Toe wall"));
  assert.equal(aggregate.qty, 297.6);
  assert.equal(manual.qty, 205);
  const doubled = { ...set, baseQuantity: set.baseQuantity * 2 };
  const recalculated = doubled.items.map((item) => item.qtyMode === "factor" ? doubled.baseQuantity * item.factor : item.qty);
  assert.equal(recalculated[set.items.indexOf(aggregate)], 595.2);
  assert.equal(recalculated[set.items.indexOf(manual)], 205);
});

test("set workbook export keeps quantity, unit price, and amount as the final columns", async () => {
  const template = templates.find((entry) => entry.id === "1-fifa-standard-futball-track");
  const output = await buildQuotationSetWorkbook({
    meta: {
      quotationTitle: "GOI Mumbai Review", clientName: "Client", projectName: "Project",
      tcType: "Flooring", termsAndConditions: ["<p><strong>Flooring term one</strong></p>", "Flooring term two"],
    },
    setQuotation: { gstPct: 18, sets: resolvedSets(template) },
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(output.buffer);
  const sheet = workbook.getWorksheet("Quotation");
  const header = sheet.getRow(8).values.slice(1);
  assert.deepEqual(header.slice(-3), ["Quantity", "Unit Price", "Amount"]);
  assert.equal(sheet.columnCount, 7);
  let grandTotalRow;
  let termsHeadingRow;
  sheet.eachRow((row) => { if (row.getCell(1).value === "Grand Total") grandTotalRow = row; });
  sheet.eachRow((row) => { if (row.getCell(1).value === "Terms & Conditions: Flooring") termsHeadingRow = row; });
  assert.ok(Number(grandTotalRow.getCell(7).value) > 0);
  assert.ok(termsHeadingRow);
  assert.equal(sheet.getRow(termsHeadingRow.number + 1).getCell(2).value, "Flooring term one");
});
