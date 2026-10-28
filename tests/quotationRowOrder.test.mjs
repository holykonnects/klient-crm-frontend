import test from 'node:test';
import assert from 'node:assert/strict';
import { moveQuotationRow, moveQuotationRowTo } from '../src/utils/quotationRowOrder.js';

test('quotation rows move up and down without mutating the original list', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(moveQuotationRow(rows, 1, -1).map(row => row.id), ['b', 'a', 'c']);
  assert.deepEqual(moveQuotationRow(rows, 1, 1).map(row => row.id), ['a', 'c', 'b']);
  assert.deepEqual(rows.map(row => row.id), ['a', 'b', 'c']);
});

test('quotation rows do not move beyond the list boundaries', () => {
  const rows = [{ id: 'a' }, { id: 'b' }];
  assert.equal(moveQuotationRow(rows, 0, -1), rows);
  assert.equal(moveQuotationRow(rows, 1, 1), rows);
});

test('quotation rows move directly to a selected or dragged position', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  assert.deepEqual(moveQuotationRowTo(rows, 0, 2).map(row => row.id), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveQuotationRowTo(rows, 3, 1).map(row => row.id), ['a', 'd', 'b', 'c']);
  assert.equal(moveQuotationRowTo(rows, 1, 1), rows);
  assert.equal(moveQuotationRowTo(rows, -1, 2), rows);
});
