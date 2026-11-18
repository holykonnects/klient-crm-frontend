import test from 'node:test';
import assert from 'node:assert/strict';
import { dealRowGroups, recoverDealSnapshot } from '../src/utils/dealTableRows.js';

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

test('deals show one latest row when snapshots acquire stable IDs', () => {
  const created = { 'Deal Name': 'New campus', 'Lead ID': 'LEAD-1' };
  const closed = { 'Deal Name': 'New campus', 'Account ID': 'LEAD-1', 'Order Distribution ID': 'DIST-1', 'Order ID': 'ORD-1' };
  const renamed = { 'Deal Name': 'New campus phase 1', 'Deal ID': 'DEAL-1', 'Order ID': 'ORD-1' };
  const rows = [created, closed, renamed];
  const groups = dealRowGroups(rows);
  assert.deepEqual(latestCrmRows(rows, row => groups.get(row)), [renamed]);
  assert.deepEqual(rows.filter(row => groups.get(row) === groups.get(renamed)), rows);
});

test('separate deals with the same name stay separate when their IDs or accounts differ', () => {
  const legacy = { 'Deal Name': 'New campus', 'Account ID': 'A-1' };
  const rows = [
    legacy,
    { ...legacy, 'Deal ID': 'D-1' },
    { ...legacy, 'Deal ID': 'D-2' },
    { ...legacy, 'Account ID': 'A-2' },
  ];
  const groups = dealRowGroups(rows);
  assert.equal(new Set(groups.values()).size, rows.length);
});

test('rows with one Deal ID stay together throughout changes to order fields', () => {
  const deal = { 'Deal ID': 'D-1', 'Order ID': 'O-1' };
  const updated = { ...deal, 'Order ID': 'O-2' };
  const groups = dealRowGroups([deal, updated]);
  assert.equal(groups.get(deal), groups.get(updated));
});

test('deal names alone do not join rows without identifiers', () => {
  const first = { 'Deal Name': 'New campus', Timestamp: '01/01/2026 09:00:00' };
  const updated = { ...first, 'Updated At': '03/01/2026 09:00:00' };
  const other = { ...first, Timestamp: '02/01/2026 09:00:00' };
  const groups = dealRowGroups([first, updated, other]);
  assert.equal(groups.get(first), groups.get(updated));
  assert.notEqual(groups.get(updated), groups.get(other));
});

test('a sparse legacy order joins its unique earlier deal and exposes fields from both rows', () => {
  const contact = { 'Deal Name': 'Example deal', Company: 'Example', 'Account Owner': 'Owner', 'Mobile Number': '9000000000' };
  const closed = { ...contact, 'Account ID': 'A-1', 'Deal Amount': 1250, Stage: 'Closed Won' };
  const order = { ...contact, 'Order ID': 'ORD-1', 'Order Amount': 800, Timestamp: '01/01/2026 09:00:00' };
  const rows = [closed, order];
  const groups = dealRowGroups(rows);
  assert.deepEqual(latestCrmRows(rows, row => groups.get(row)), [order]);
  assert.deepEqual(recoverDealSnapshot(order, [closed]), { ...closed, ...order });
  assert.deepEqual([closed, order].map(row => groups.get(row)), [0, 0]);
});

test('a sparse order stays separate when two earlier deals match the customer', () => {
  const contact = { 'Deal Name': 'Example deal', Company: 'Example', 'Account Owner': 'Owner', 'Mobile Number': '9000000000' };
  const first = { ...contact, 'Account ID': 'A-1', 'Deal ID': 'D-1', 'Deal Amount': 1250 };
  const second = { ...first, 'Deal ID': 'D-2' };
  const order = { ...contact, 'Order ID': 'ORD-1' };
  assert.equal(new Set(dealRowGroups([first, second, order]).values()).size, 3);
  assert.equal(new Set(dealRowGroups([first, { ...order, Company: 'Different company' }]).values()).size, 2);
});

test('legacy Closed Won deals and order snapshots group even when both lack an Account ID', () => {
  const contact = { 'Deal Name': 'Example deal', Company: 'Example', 'Account Owner': 'Owner', 'Mobile Number': '9000000000' };
  const deal = { ...contact, Stage: 'Closed Won', 'Deal Amount': '1,68,958', Timestamp: '31/10/26 13:44:03' };
  const order = { ...contact, 'Order ID': 'ORD-1', 'Order Amount': '1,68,958 acrylic material', Timestamp: '31/10/2026 13:55:02' };
  const rows = [deal, order];
  const groups = dealRowGroups(rows);
  assert.deepEqual(latestCrmRows(rows, row => groups.get(row)), [order]);
  assert.equal(recoverDealSnapshot(order, [deal])['Deal Amount'], '1,68,958');
  assert.equal(new Set(dealRowGroups([deal, { ...deal, Timestamp: '31/10/26 13:50:00' }, order]).values()).size, 3);
  assert.equal(new Set(dealRowGroups([{ ...deal, Stage: 'Needs Analysis' }, order]).values()).size, 2);
});
