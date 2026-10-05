import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRow } from '../api/_lib/googleSheets.js';
import { generateLeadId } from '../api/_lib/crmHandlers.js';

test('long numeric identifiers are submitted to Sheets as text', () => {
  const row = buildRow(['Lead ID', 'Mobile Number', 'Company'], {
    'Lead ID': '20261003123456789', 'Mobile Number': '9999999999', Company: 'Example',
  }, { timestampFields: [] });
  assert.deepEqual(row, ["'20261003123456789", '9999999999', 'Example']);
});

test('Lead IDs interpret comma-separated dates as day-first and retain milliseconds', () => {
  const id = generateLeadId('03/10/2026, 12:16:40', [], new Date('2026-10-03T06:46:40.789Z'));
  assert.equal(id, '20261003121640789');
  assert.deepEqual(buildRow(['Lead ID'], { 'Lead ID': id }, { timestampFields: [] }), ["'20261003121640789"]);
});

test('Lead IDs are different for separate submissions within the same millisecond', () => {
  const now = new Date('2026-10-05T01:30:00.456Z');
  const first = generateLeadId('05/10/2026 07:00:00', [], now);
  const second = generateLeadId('05/10/2026 07:00:00', [], now);
  assert.equal(first, '20261005070000456');
  assert.equal(second, '20261005070000457');
});

test('Lead IDs skip occupied IDs and roll into the next second without changing the format', () => {
  const id = generateLeadId('31/12/2026 23:59:59.999', ['20261231235959999']);
  assert.equal(id, '20270101000000000');
  assert.equal(id.length, 17);
});

test('ISO timestamps generate Lead IDs in India time independently of the server timezone', () => {
  assert.equal(generateLeadId('2026-10-07T20:30:00.123Z'), '20261008020000123');
});
