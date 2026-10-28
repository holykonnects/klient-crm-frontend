import test from 'node:test';
import assert from 'node:assert/strict';
import { moveQuotationRow, moveQuotationRowTo, quotationDragScrollDelta } from '../src/utils/quotationRowOrder.js';

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

test('dragging near or outside the table edges produces bounded auto-scroll', () => {
  assert.equal(quotationDragScrollDelta(90, 100, 500), -28);
  assert.equal(quotationDragScrollDelta(130, 100, 500), -18);
  assert.equal(quotationDragScrollDelta(300, 100, 500), 0);
  assert.equal(quotationDragScrollDelta(470, 100, 500), 18);
  assert.equal(quotationDragScrollDelta(520, 100, 500), 28);
  assert.equal(quotationDragScrollDelta(100, 500, 100), 0);
});
