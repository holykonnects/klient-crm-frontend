import test from 'node:test';
import assert from 'node:assert/strict';
import { athleticQuantity, reconcileAthleticRows, updateAthleticCalculation } from '../src/components/athleticRateLibrary.js';
import { applyQuotationCommercialSettings, quotationOutputRows } from '../src/utils/quotationOutput.js';
import { resolveLeadOwnerIdentity } from '../api/_lib/leadSourceIdentity.js';
import { quotationSignoffText } from '../api/_lib/quotationSignoff.js';
import { templateItems, waitForQuotationImages } from '../api/_lib/quotationPdfExport.js';

test('Yash reference quantities and rates reconcile including separate certification', () => {
  const area = 6600;
  const values = [
    ['AREA', 0, 32], ['AREA', 0, 200], ['AREA', 0, 47.5],
    ['AREA_X_FACTOR', 0.10, 3255], ['AREA_X_FACTOR', 0.10, 3360],
    ['AREA', 0, 63], ['AREA', 0, 47.5], ['AREA_X_FACTOR', 0.05, 18500], ['AREA_X_FACTOR', 0.025, 23000],
    ['MANUAL', 1075, 400], ['MANUAL', 102, 7900], ['MANUAL', 102, 10290], ['MANUAL', 25, 9975],
    ['PERIMETER', 0, 3045], ['MANUAL', 190, 2850], ['MANUAL', 14, 6500], ['AREA', 0, 5350],
  ];
  const rows = values.map(([driver, factor, rate]) => ({ qty: athleticQuantity(driver, factor, { area, perimeter: 400 }), rate }));
  assert.equal(rows.reduce((sum, row) => sum + row.qty * row.rate, 0), 56535155);
  assert.deepEqual(rows.slice(3, 5).map(row => row.qty), [660, 660]);
  assert.equal(rows[7].qty, 330);
  assert.equal(rows[8].qty, 165);
  const output = quotationOutputRows(rows, { certificationAmount: 1500000 });
  const taxable = output.reduce((sum, row) => sum + row.qty * row.rate, 0);
  assert.equal(taxable, 58035155);
  assert.equal(Math.round(taxable * 0.18 * 10) / 10, 10446327.9);
  assert.equal(Math.ceil(taxable * 1.18), 68481483);
  assert.equal(templateItems({ quoteType: 'athletic', items: rows, pricing: { certificationAmount: 1500000 } }).at(-1).rate, 1500000);
});

test('quote-local depth calculations recalculate without changing library rates', () => {
  const generated = { source: 'rate-library', libraryKey: 'gsb', qty: 495, qtyDriver: 'AREA_X_FACTOR', factor: 0.075, rate: 3525 };
  const edited = updateAthleticCalculation(generated, 'AREA_X_FACTOR', 0.1, { area: 6600 });
  assert.equal(edited.qty, 660);
  const refreshed = reconcileAthleticRows([edited], [{ ...generated, qty: 600, rate: 3600 }], [], { area: 8000 });
  assert.equal(refreshed[0].qty, 800);
  assert.equal(refreshed[0].rate, 3600);
  assert.equal(refreshed[0].factor, 0.1);
  assert.equal(generated.factor, 0.075);
  assert.equal(updateAthleticCalculation(generated, 'MANUAL', 0, {}).qty, 0);
  const manual = updateAthleticCalculation({ qty: 0 }, 'AREA_X_FACTOR', 0.1, { area: 6600 });
  assert.equal(reconcileAthleticRows([manual], [], [], { area: 8000 })[0].qty, 800);
});

test('all-items settings are reversible and also apply to newly added items', () => {
  const rows = [{ freight: '100', installation: 'Extra' }, { freight: '200', installation: 'Excluded' }];
  const settings = { freight: { enabled: false }, installation: { mode: 'all', value: 'Included' } };
  assert.deepEqual(applyQuotationCommercialSettings(rows, settings), [{ freight: '', installation: 'Included' }, { freight: '', installation: 'Included' }]);
  assert.equal(applyQuotationCommercialSettings([...rows, {}], settings)[2].installation, 'Included');
  assert.deepEqual(applyQuotationCommercialSettings(rows, {}), rows);
  assert.equal(rows[0].freight, '100');
});

test('owner signoff resolves email and login IDs, never source channels, and preserves bank text', () => {
  const login = [{ 'Login Username': 'user123', Name: 'Asha Rao', Email: 'asha@example.com', 'User ID': '123' }];
  for (const owner of ['user123', '123', 'asha@example.com']) assert.deepEqual(resolveLeadOwnerIdentity(owner, login), { name: 'Asha Rao', email: 'asha@example.com' });
  assert.deepEqual(resolveLeadOwnerIdentity('Website', login), { name: 'Team Rido', email: '' });
  const bank = 'BANK OF MAHARASTRA\nA/c No. 60432516878\nIFSC MAHB0001347\n\n';
  assert.equal(quotationSignoffText(`${bank}Best Regards,\nOld Owner\n12345`, { leadSourceName: 'Asha Rao', leadSourceEmail: 'asha@example.com' }), `${bank}Warm Regards,\nAsha Rao\nasha@example.com`);
  assert.equal(quotationSignoffText(bank, {}), bank);
});

test('image loading retries temporary errors and rejects broken exports', async () => {
  const payload = { items: [{ imageUrl: 'https://example.com/image.png', displayItem: 'Surface' }] };
  let reads = 0;
  await waitForQuotationImages('test', {}, payload, { sleep: async () => {}, read: async () => ({ sheets: [{ data: [{ rowData: [{ values: [++reads < 2 ? { effectiveValue: { errorValue: { type: 'LOADING' } } } : {}] }] }] }] }) });
  assert.equal(reads, 2);
  await assert.rejects(waitForQuotationImages('test', {}, payload, { attempts: 2, sleep: async () => {}, read: async () => ({ sheets: [{ data: [{ rowData: [{ values: [{ formattedValue: '#REF!' }] }] }] }] }) }), /photographs could not load: Surface/);
});
