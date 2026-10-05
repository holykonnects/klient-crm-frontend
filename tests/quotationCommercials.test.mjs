import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { quotationChargeAmount, quotationCommercialSummary } from '../src/utils/quotationCommercials.js';
import { templateCommercials, templateItems, quotationLineDescription } from '../api/_lib/quotationPdfExport.js';
import { buildQuotationSetWorkbook } from '../api/_lib/quotationSetExport.js';

test('inclusion/exclusion text never adds a charge, while currency values do', () => {
  for (const value of ['Included', 'Inclusive', 'Excluded', 'Exclusive', 'Extra', 'Included for 20 items', '']) assert.equal(quotationChargeAmount(value), 0);
  assert.equal(quotationChargeAmount('₹ 1,250.50'), 1250.5);
  const summary = quotationCommercialSummary([{ freight: 'Included' }, { freight: 'Excluded' }, { freight: '₹ 1,250.50' }], 'freight');
  assert.equal(summary.amount, 1250.5);
  assert.equal(summary.entries.length, 3);
});

test('athletic and BOQ PDF keep row commercial terms outside descriptions', () => {
  const item = { item: 'Drainage', displayItem: 'Drainage', description: 'Civil works', freight: 'Excluded', installation: 'Included', qty: 1, rate: 100 };
  for (const payload of [{ quoteType: 'athletic', items: [item] }, { quoteType: 'project-set', setQuotation: { sets: [{ title: 'Civil', items: [item] }] } }]) {
    const rows = templateItems(payload);
    assert.equal(quotationLineDescription(rows[0]), 'Civil works');
    assert.match(templateCommercials(rows, {}, 'freight').label, /1\. Drainage: Excluded/);
    assert.match(templateCommercials(rows, {}, 'installation').label, /1\. Drainage: Included/);
    assert.equal(templateCommercials(rows, {}, 'installation').value, 'As specified');
  }
  assert.equal(templateCommercials([{ freight: '200' }], { freightAmount: 100 }, 'freight').value, 300);
});

test('BOQ Excel includes commercial wording and taxes numeric row charges once', async () => {
  const output = await buildQuotationSetWorkbook({ setQuotation: { gstPct: 18, sets: [{ title: 'Civil', items: [
    { item: 'Drainage', description: 'Civil works', qty: 1, rate: 1000, freight: 'Included', installation: 'Excluded' },
    { item: 'Kerbing', qty: 1, rate: 1000, freight: '200', installation: '100' },
  ] }] } });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(output.buffer);
  const sheet = workbook.getWorksheet('Quotation');
  const rows = [];
  sheet.eachRow(row => rows.push(row));
  const commercialRow = rows.find(row => row.getCell(2).value === 'Drainage' && row.getCell(3).value === 'Freight');
  assert.equal(commercialRow.getCell(4).value, 'Included');
  assert.equal(commercialRow.getCell(6).value, 'Excluded');
  assert.equal(rows.find(row => row.getCell(1).value === 'Grand Total').getCell(8).value, 2714);
});
