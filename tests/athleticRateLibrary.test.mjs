import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAthleticImageMapping, applyAthleticVolume, athleticVolume, athleticUnitDepth, convertAthleticUnit, athleticDrainPerimeter, athleticQuantity, athleticRateApplies, buildAthleticDefaultRows, isExportableQuotationRow, reconcileAthleticRows } from '../src/components/athleticRateLibrary.js';

test('unit changes convert quantities both ways and retain area linkage', () => {
  const original = { unit: 'SQM', qty: 6600, qtyDriver: 'AREA', rate: 100, desc: 'GSB', imageUrl: '/gsb.png' };
  assert.equal(convertAthleticUnit(original, 'CUM'), null);
  const volume = convertAthleticUnit(original, 'CUM', 0.075);
  assert.equal(volume.qty, 495);
  assert.equal(volume.qtyDriver, 'AREA_X_FACTOR');
  assert.equal(volume.qtyEdited, false);
  const area = convertAthleticUnit(volume, 'SQM');
  assert.equal(area.qty, 6600);
  assert.equal(area.qtyDriver, 'AREA');
  assert.equal(area.rate, 100);
  assert.equal(area.desc, original.desc);
  assert.equal(area.imageUrl, original.imageUrl);
  assert.equal(convertAthleticUnit(area, 'CUM').qty, 495);
  assert.equal(athleticUnitDepth({ ...volume, factor: 0.1 }), 0.1);
});

test('library volume factors are reused but drainage section factors are not treated as depth', () => {
  assert.equal(convertAthleticUnit({ unit: 'CUM', qty: 495, qtyDriver: 'AREA_X_FACTOR', factor: 0.075 }, 'SQM').qty, 6600);
  assert.equal(convertAthleticUnit({ unit: 'CUM', qty: 450, qtyDriver: 'PERIMETER_X_FACTOR', factor: 1.125 }, 'SQM'), null);
  assert.equal(convertAthleticUnit({ unit: 'SQM', qty: 100 }, 'CUM', -1), null);
});

test('manual unit conversions remain fixed, aliases do not double-convert, and unrelated units retain quantities', () => {
  const volume = convertAthleticUnit({ unit: 'sqm', qty: 100, qtyEdited: true }, 'm3', 0.15);
  assert.equal(volume.qty, 15);
  assert.equal(volume.qtyDriver, 'MANUAL');
  assert.equal(volume.qtyEdited, true);
  assert.equal(convertAthleticUnit(volume, 'CUM').qty, 15);
  assert.equal(convertAthleticUnit(volume, 'SQM').qty, 100);
  assert.equal(convertAthleticUnit(volume, 'NOS').qty, 15);
  const restored = JSON.parse(JSON.stringify(volume));
  assert.equal(convertAthleticUnit(restored, 'SQM').qty, 100);
});

test('SQM to CUM converts millimetres, centimetres and metres consistently', () => {
  for (const [depth, unit] of [[75, 'mm'], [7.5, 'cm'], [0.075, 'm']]) {
    assert.deepEqual(athleticVolume('6,600', depth, unit), { depthMetres: 0.075, volume: 495 });
  }
  assert.equal(athleticVolume(12.5, 200, 'mm').volume, 2.5);
  for (const [area, depth, unit] of [['', 75, 'mm'], [6600, '', 'mm'], [0, 75, 'mm'], [-1, 75, 'mm'], [10, -1, 'm'], [Infinity, 1, 'm'], [10, 'abc', 'mm'], [10, 1, 'ft'], [1e308, 1e308, 'm']]) {
    assert.equal(athleticVolume(area, depth, unit), null);
  }
});

test('linked volume follows quoted area and preserves rate, description and images', () => {
  const original = { source: 'rate-library', libraryKey: 'civil', rate: 3525, desc: 'GSB', imageUrl: '/gsb.png', unit: 'SQM' };
  const applied = applyAthleticVolume(original, { area: 6600, depth: 75, depthUnit: 'mm', linkedArea: true });
  assert.equal(applied.qty, 495);
  assert.equal(applied.unit, 'CUM');
  assert.equal(applied.qtyDriver, 'AREA_X_FACTOR');
  assert.equal(applied.factor, 0.075);
  assert.equal(applied.qtyEdited, false);
  const updated = reconcileAthleticRows([applied], [{ ...original, qty: 8000, suggestedQty: 8000 }], [], { area: 8000 });
  assert.equal(updated[0].qty, 600);
  assert.equal(updated[0].unit, 'CUM');
  assert.equal(updated[0].rate, original.rate);
  assert.equal(updated[0].desc, original.desc);
  assert.equal(updated[0].imageUrl, original.imageUrl);
  assert.equal(original.unit, 'SQM');
});

test('custom area volume stays fixed and survives draft serialization', () => {
  const applied = applyAthleticVolume({ desc: 'Manual work' }, { area: 100, depth: 15, depthUnit: 'cm', linkedArea: false });
  const saved = JSON.parse(JSON.stringify(applied));
  const updated = reconcileAthleticRows([saved], [], [], { area: 8000 });
  assert.equal(updated[0].qty, 15);
  assert.equal(updated[0].qtyDriver, 'MANUAL');
  assert.equal(updated[0].unit, 'CUM');
  assert.throws(() => applyAthleticVolume({}, { area: 10, depth: '' }), /positive/);
});

test('athletic quantity drivers calculate from area and perimeter', () => {
  assert.equal(athleticQuantity('AREA', 0, { area: 7500 }), 7500);
  assert.equal(athleticQuantity('AREA_X_FACTOR', 0.075, { area: 7500 }), 562.5);
  assert.equal(athleticQuantity('PERIMETER', 0, { perimeter: 400 }), 400);
  assert.equal(athleticQuantity('PERIMETER_X_FACTOR', 1.125, { perimeter: 400 }), 450);
  assert.equal(athleticQuantity('MANUAL', 0, {}), 0);
  assert.equal(athleticQuantity('MANUAL', '', {}), 1);
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
