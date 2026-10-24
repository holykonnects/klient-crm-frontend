import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { quotationChargeAmount, quotationCommercialSummary, quotationCommercialValue } from '../src/utils/quotationCommercials.js';
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
    assert.equal(templateCommercials(rows, {}, 'freight').label, 'Freight');
    assert.equal(templateCommercials(rows, {}, 'freight').value, 'Excluded');
    assert.equal(templateCommercials(rows, {}, 'installation').label, 'Installation');
    assert.equal(templateCommercials(rows, {}, 'installation').value, 'Included');
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
  assert.equal(rows.some(row => row.getCell(1).value === 'Freight & Installation'), false);
  assert.equal(rows.filter(row => row.getCell(1).value === 'Freight').length, 1);
  assert.equal(rows.find(row => row.getCell(1).value === 'Freight').getCell(8).value, '₹ 200; Included');
  assert.equal(rows.find(row => row.getCell(1).value === 'Installation').getCell(8).value, '₹ 100; Excluded');
  assert.equal(rows.find(row => row.getCell(1).value === 'Grand Total').getCell(8).value, 2714);
});

test('commercial summary stays compact without dropping wording or charging it twice', () => {
  const included = quotationCommercialSummary([{ freight: 'Included' }, { freight: 'Included' }], 'freight');
  assert.equal(quotationCommercialValue(included), 'Included');
  const mixed = quotationCommercialSummary([{ freight: 'Included' }, { freight: 'Excluded' }, { freight: '200' }], 'freight');
  assert.equal(quotationCommercialValue(mixed, 100), '₹ 300; Included; Excluded');
  assert.equal(quotationCommercialValue(quotationCommercialSummary([], 'freight')), 'Extra');
  assert.equal(quotationCommercialValue(quotationCommercialSummary([], 'freight'), 0), 0);
});
