import test from 'node:test';
import assert from 'node:assert/strict';
import { athleticQuantity, athleticRateApplies, buildAthleticDefaultRows, reconcileAthleticRows } from '../src/components/athleticRateLibrary.js';

test('athletic quantity drivers calculate from area and perimeter', () => {
  assert.equal(athleticQuantity('AREA', 0, { area: 7500 }), 7500);
  assert.equal(athleticQuantity('AREA_X_FACTOR', 0.075, { area: 7500 }), 562.5);
  assert.equal(athleticQuantity('PERIMETER', 0, { perimeter: 400 }), 400);
  assert.equal(athleticQuantity('PERIMETER_X_FACTOR', 1.125, { perimeter: 400 }), 450);
  assert.equal(athleticQuantity('MANUAL', 0, {}), 1);
});

test('default rules respect scope switches and selected surface system', () => {
  const config = { civilWorks: 'Yes', drainageWorks: 'No', trackEquipment: 'No', surfaceSystem: 'Full PUR System' };
  assert.equal(athleticRateApplies({ 'Include Default': 'Yes', Scope: 'Civil', System: 'ALL' }, config), true);
  assert.equal(athleticRateApplies({ 'Include Default': 'Yes', Scope: 'Drainage', System: 'ALL' }, config), false);
  assert.equal(athleticRateApplies({ 'Include Default': 'Yes', Scope: 'Surface', System: 'Sandwich System' }, config), false);
  assert.equal(athleticRateApplies({ 'Include Default': 'Yes', Scope: 'Surface', System: 'Full PUR System' }, config), true);
});

test('library defaults preserve user quantity overrides while rates refresh', () => {
  const library = [{ __rowNumber: 2, 'Include Default': 'Yes', Scope: 'Civil', System: 'ALL', Item: 'GSB', Unit: 'CUM', 'Qty Driver': 'AREA_X_FACTOR', 'Thickness/Factor': 0.075, Rate: 3525 }];
  const config = { civilWorks: 'Yes', drainageWorks: 'Yes', trackEquipment: 'No', surfaceSystem: 'Full PUR System' };
  const generated = buildAthleticDefaultRows(library, config, { area: 7500, perimeter: 400 });
  const edited = [{ ...generated[0], qty: 650, qtyEdited: true }];
  const refreshed = buildAthleticDefaultRows([{ ...library[0], Rate: 3600 }], config, { area: 8000, perimeter: 400 });
  const reconciled = reconcileAthleticRows(edited, refreshed);
  assert.equal(reconciled[0].qty, 650);
  assert.equal(reconciled[0].suggestedQty, 600);
  assert.equal(reconciled[0].rate, 3600);
});

test('library text refreshes unless the quotation has an explicit override', () => {
  const base = {
    source: 'rate-library', libraryKey: 'rate-library:2:gsb', qty: 1, suggestedQty: 1,
    rate: 100, unit: 'SQM', desc: 'Old description', descHtml: '',
  };
  const refreshed = [{ ...base, rate: 120, unit: 'CUM', desc: 'New description' }];

  assert.equal(reconcileAthleticRows([base], refreshed)[0].desc, 'New description');
  const edited = { ...base, unit: 'RMT', unitEdited: true, desc: 'Quote-specific note', descEdited: true };
  const result = reconcileAthleticRows([edited], refreshed)[0];
  assert.equal(result.unit, 'RMT');
  assert.equal(result.desc, 'Quote-specific note');
  assert.equal(result.rate, 120);
});
