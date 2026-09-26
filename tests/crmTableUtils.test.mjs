import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crmRowUpdatedAt,
  latestCrmRows,
  newestCrmRows,
  parseCrmTimestamp,
} from '../src/utils/crmTableUtils.js';

test('parses CRM day-first, short-year, compact and ISO timestamps', () => {
  assert.ok(parseCrmTimestamp('26/09/2026 14:05:09') > 0);
  assert.ok(parseCrmTimestamp('26-09-26 14:05:09') > 0);
  assert.ok(parseCrmTimestamp('26092026140509123') > 0);
  assert.equal(parseCrmTimestamp('not a date'), 0);
});

test('Updated At takes part in effective row recency even when Timestamp is unchanged', () => {
  const original = { Timestamp: '01/01/2026 09:00:00' };
  const update = { Timestamp: '01/01/2026 09:00:00', 'Updated At': '02/01/2026 10:00:00' };
  assert.ok(crmRowUpdatedAt(update) > crmRowUpdatedAt(original));
});

test('latest rows prefer effective update time and appended order breaks ties', () => {
  const rows = [
    { id: 'A', value: 'old', Timestamp: '01/01/2026 09:00:00' },
    { id: 'A', value: 'new', Timestamp: '01/01/2026 09:00:00', 'Updated At': '02/01/2026 09:00:00' },
    { id: 'B', value: 'first' },
    { id: 'B', value: 'last' },
  ];
  const latest = latestCrmRows(rows, row => row.id);
  assert.deepEqual(latest.map(row => row.value), ['new', 'last']);
});

test('history is ordered newest first', () => {
  const rows = [
    { value: 'old', Timestamp: '01/01/2026 09:00:00' },
    { value: 'new', 'Updated At': '02/01/2026 09:00:00' },
  ];
  assert.deepEqual(newestCrmRows(rows).map(row => row.value), ['new', 'old']);
});
