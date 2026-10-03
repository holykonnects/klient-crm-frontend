import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRow } from '../api/_lib/googleSheets.js';

test('long numeric identifiers are submitted to Sheets as text', () => {
  const row = buildRow(['Lead ID', 'Mobile Number', 'Company'], {
    'Lead ID': '20261003123456789', 'Mobile Number': '9999999999', Company: 'Example',
  }, { timestampFields: [] });
  assert.deepEqual(row, ["'20261003123456789", '9999999999', 'Example']);
});
