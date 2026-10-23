import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFieldEventRows, fieldEventIssues, isFieldEventRate } from '../src/components/fieldEventPackages.js';
import { reconcileAthleticRows, isExportableQuotationRow } from '../src/components/athleticRateLibrary.js';
import { templateItems } from '../api/_lib/quotationPdfExport.js';
import { athleticLayout, TRACK_DRAWING_REFERENCE } from '../src/utils/athleticLayout.js';

const selections = { longJump: { enabled: true, baseDepth: 100, sandDepth: 300, layoutReviewed: true } };

test('field event dimensions generate scoped quantities, independent of track area', () => {
  const rows = buildFieldEventRows(selections);
  assert.equal(rows.find(row => row.libraryKey.endsWith(':surface')).qty, 48.8);
  assert.equal(rows.find(row => row.libraryKey.endsWith(':apron')).qty, 2.44);
  assert.ok(Math.abs(rows.find(row => row.libraryKey.endsWith(':base')).qty - 5.124) < 1e-9);
  assert.equal(rows.find(row => row.libraryKey.endsWith(':sand')).qty, 7.425);
  assert.equal(rows.length, 6);
  assert.equal(buildFieldEventRows({}).length, 0);
  assert.equal(isFieldEventRate({ Item: rows[0].libraryItem }), true);
  const double = buildFieldEventRows({ longJump: { ...selections.longJump, count: 2 } });
  assert.equal(double[0].qty, 97.6);
});

test('circle, ring, stop board, cage and landing sector are complete packages', () => {
  const shot = buildFieldEventRows({ shot: { enabled: true, baseDepth: 150, sectorLength: 25 } });
  assert.equal(shot.length, 5);
  assert.ok(Math.abs(shot[0].qty - Math.PI * (2.135 / 2) ** 2) < 1e-10);
  const discus = buildFieldEventRows({ discus: { enabled: true } });
  assert.ok(discus.some(row => row.libraryKey.endsWith(':cage')));
  const javelin = buildFieldEventRows({ javelin: { enabled: true, length: 36.5, width: 4 } });
  assert.equal(javelin[0].qty, 146);
  assert.match(javelin.find(row => row.libraryKey.endsWith(':landing')).desc, /not inferred from track area/);
});

test('library rates require unique exact item and unit matches; missing prices cannot silently export', () => {
  const unpriced = buildFieldEventRows(selections);
  assert.ok(fieldEventIssues(selections, unpriced).some(issue => issue.includes('unit price required')));
  const library = unpriced.map(row => ({ Item: row.libraryItem, Unit: row.unit, Rate: 100 }));
  const priced = buildFieldEventRows(selections, library);
  assert.deepEqual(fieldEventIssues(selections, priced), []);
  assert.ok(priced.every(row => row.rate === 100));
  const ambiguous = buildFieldEventRows(selections, [...library, library[0]]);
  assert.equal(ambiguous[0].fieldEventRateMissing, true);
  const explicit = unpriced.map(row => ({ ...row, rateOverride: 0 }));
  assert.deepEqual(fieldEventIssues(selections, explicit), []);
  assert.ok(fieldEventIssues(selections, priced.slice(1)).some(issue => issue.includes('component is missing')));
});

test('dimension changes refresh quantities, preserve edits and images, and deselection removes generated rows', () => {
  const original = buildFieldEventRows(selections);
  original[0] = { ...original[0], imageUrl: '/manual-image.png', imageMappingEdited: true, desc: 'Edited scope', descEdited: true, rateOverride: 250 };
  const changed = { longJump: { ...selections.longJump, length: 45 } };
  const next = reconcileAthleticRows(original, buildFieldEventRows(changed), [], { area: 6600 });
  assert.equal(next[0].qty, 54.9);
  assert.equal(next[0].rateOverride, 250);
  assert.equal(next[0].imageUrl, '/manual-image.png');
  assert.equal(next[0].desc, 'Edited scope');
  const manual = { source: 'manual', desc: 'Separate scope', qty: 1 };
  assert.deepEqual(reconcileAthleticRows([...next, manual], []), [manual]);
  assert.equal(templateItems({ quoteType: 'athletic', items: next }).length, next.length);
  assert.ok(next.every(row => isExportableQuotationRow(row, 'athletic')));
  assert.equal(JSON.parse(JSON.stringify(changed)).longJump.length, 45);
});

test('missing construction depths, safety review and off-reference geometry are flagged', () => {
  const incomplete = { shot: { enabled: true, diameter: 3, count: 1.5 } };
  const issues = fieldEventIssues(incomplete, buildFieldEventRows(incomplete));
  assert.ok(issues.some(issue => issue.includes('Base depth')));
  assert.ok(issues.some(issue => issue.includes('safety')));
  assert.ok(issues.some(issue => issue.includes('Approval required')));
  assert.ok(issues.some(issue => issue.includes('whole number')));
});

test('supplied drawing geometry does not replace its quoted track or green areas', () => {
  const config = { laneQuantity: 8, laneWidth: 1.22, ...TRACK_DRAWING_REFERENCE };
  const model = athleticLayout(config);
  assert.ok(Math.abs(model.width - 176.91) < 1e-9);
  assert.ok(Math.abs(model.height - 92.52) < 1e-9);
  assert.equal(config.quotedArea, 6600);
  assert.equal(config.greenArea, 8087);
  assert.notEqual(model.trackArea, config.quotedArea);
});
