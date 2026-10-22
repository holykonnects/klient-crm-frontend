import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { athleticSpecificationDetails, QUOTATION_SPECIFICATION_REFERENCE } from '../src/components/athleticSpecificationReference.js';

test('reference chart display omits source names and uses a generic benchmark note', async () => {
  const source = await readFile(new URL('../src/components/QuotationSpecificationReference.js', import.meta.url), 'utf8');
  assert.match(source, /row\.slice\(0, 4\)/);
  assert.doesNotMatch(source, /Yash|GOI Mumbai|Jan Mitram|'Source'/);
  assert.match(source, /Based on previous quotations/);
});

test('reference chart includes source-labelled alternatives and conflicting historical values', () => {
  assert.ok(QUOTATION_SPECIFICATION_REFERENCE.every(row => row.length === 5 && row[4]));
  assert.match(QUOTATION_SPECIFICATION_REFERENCE.find(row => row[1].startsWith('GSB'))[2], /100 mm.*125 mm/);
  assert.match(QUOTATION_SPECIFICATION_REFERENCE.find(row => row[1] === 'Good earth')[2], /150 mm.*60 mm/);
});

test('GSB conflicting description and calculation are flagged without changing the row', () => {
  const row = { unit: 'CUM', qtyDriver: 'AREA_X_FACTOR', factor: 0.1,
    libraryQtyDriver: 'AREA_X_FACTOR', libraryFactor: 0.1, libraryUnit: 'CUM',
    libraryItem: 'GSB Compacted thickness (100mm)', desc: 'Grade-I aggregate 75 mm to 0.075 mm. (125 mm depth)' };
  const before = JSON.stringify(row);
  const result = athleticSpecificationDetails(row);
  assert.equal(result.currentThickness, '100 mm');
  assert.equal(result.referenceThickness, '100 mm');
  assert.match(result.warning, /Approval required.*125 mm/);
  assert.doesNotMatch(result.warning, /75 mm/);
  assert.equal(JSON.stringify(row), before);
});

test('matching depths and non-area dimensions do not generate false conflicts', () => {
  assert.equal(athleticSpecificationDetails({ unit: 'CUM', qtyDriver: 'AREA_X_FACTOR', factor: 0.1, desc: '100 mm compacted thickness; aggregate 53 mm' }).warning, '');
  assert.equal(athleticSpecificationDetails({ unit: 'CUM', qtyDriver: 'PERIMETER_X_FACTOR', factor: 1.125, desc: '150 mm thickness' }).warning, '');
  assert.equal(athleticSpecificationDetails({ unit: 'CUM', qtyDriver: 'AREA_X_FACTOR', factor: 0.1, qtyEdited: true, desc: '125 mm depth' }).currentThickness, 'Manual quantity');
  assert.match(athleticSpecificationDetails({ unit: 'M3', qtyDriver: 'AREA_X_FACTOR', factor: 0.075, desc: 'Thickness=100 mm' }).warning, /100 mm/);
});
