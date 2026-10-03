import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAthleticImageMapping, athleticDrainPerimeter, athleticQuantity, athleticRateApplies, buildAthleticDefaultRows, isExportableQuotationRow, reconcileAthleticRows } from '../src/components/athleticRateLibrary.js';

test('athletic quantity drivers calculate from area and perimeter', () => {
  assert.equal(athleticQuantity('AREA', 0, { area: 7500 }), 7500);
  assert.equal(athleticQuantity('AREA_X_FACTOR', 0.075, { area: 7500 }), 562.5);
  assert.equal(athleticQuantity('PERIMETER', 0, { perimeter: 400 }), 400);
  assert.equal(athleticQuantity('PERIMETER_X_FACTOR', 1.125, { perimeter: 400 }), 450);
  assert.equal(athleticQuantity('MANUAL', 0, {}), 1);
});

test('athletic drainage uses the selected preset perimeter until explicitly overridden', () => {
  const presets = [{ Preset: '400m - 8 lane benchmark', 'Drain Perimeter': 400 }];
  const config = { preset: '400m - 8 lane benchmark', drainPerimeter: '', lengthPerimeter: '' };
  assert.equal(athleticDrainPerimeter(config, presets), 400);
  assert.equal(athleticDrainPerimeter({ ...config, drainPerimeter: 520 }, presets), 520);
  assert.equal(athleticDrainPerimeter({ preset: 'Custom geometry', lengthPerimeter: 460 }, presets), 460);
});

test('drainage CUM defaults calculate from the benchmark drain perimeter', () => {
  const library = [{
    __rowNumber: 2, 'Include Default': 'Yes', Scope: 'Drainage', System: 'ALL', Item: 'Drain Excavation',
    Unit: 'CUM', 'Qty Driver': 'PERIMETER_X_FACTOR', 'Thickness/Factor': 1.125, Rate: 380,
  }];
  const config = { drainageWorks: 'Yes', surfaceSystem: 'Full PUR System' };
  const rows = buildAthleticDefaultRows(library, config, { area: 7500, perimeter: 400 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].qty, 450);
  assert.equal(rows[0].unit, 'CUM');
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

test('image mapping cannot replace athletic scope or pricing details', () => {
  const row = {
    source: 'rate-library', libraryItem: 'Full PUR surface', scope: 'Surface', system: 'Full PUR System',
    desc: 'Approved surface specification', unit: 'SQM', qty: 7200, rate: 2300,
  };
  const catalog = { items: { 'Track|||Surface': [{ code: 'PUR-IMAGE', imageUrl: 'https://example.com/pur.png' }] } };
  const mapped = applyAthleticImageMapping(row, { category: 'Track', subCategory: 'Surface', itemCode: 'PUR-IMAGE' }, catalog);

  assert.equal(mapped.imageUrl, 'https://example.com/pur.png');
  assert.equal(mapped.libraryItem, row.libraryItem);
  assert.equal(mapped.scope, row.scope);
  assert.equal(mapped.system, row.system);
  assert.equal(mapped.desc, row.desc);
  assert.equal(mapped.unit, row.unit);
  assert.equal(mapped.qty, row.qty);
  assert.equal(mapped.rate, row.rate);
});

test('athletic export keeps rate-library and manually described items', () => {
  assert.equal(isExportableQuotationRow({ libraryItem: 'Full PUR surface' }, 'athletic'), true);
  assert.equal(isExportableQuotationRow({ desc: 'Manual athletic work', qty: 2, rate: 100 }, 'athletic'), true);
  assert.equal(isExportableQuotationRow({ qty: 1, itemType: 'Equipment' }, 'athletic'), false);
  assert.equal(isExportableQuotationRow({ category: 'Court', subCategory: 'Nets', itemCode: 'HEAV' }, 'standard'), true);
  assert.equal(isExportableQuotationRow({ itemCode: 'HEAV' }, 'standard'), false);
});
