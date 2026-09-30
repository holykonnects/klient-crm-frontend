import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderSalePrefill, salesTrackerOrderLabel } from '../src/utils/salesTrackerPrefill.js';

test('order sale prefill links the order and carries relevant sale fields', () => {
  const order = {
    'Order ID': 'ORD-42',
    'Deal Name': 'Sports Flooring',
    Company: 'Example School',
    'Account Owner': 'sales@example.com',
    'Order Amount': '125000',
    'Product Required': 'Indoor court flooring',
  };
  const columns = [
    'Field', 'Field Selection', 'Account / Deal / Order', 'Company',
    'Sales Person Name', 'Basic Value', 'Description', 'Date', 'Invoice No.',
  ];
  const result = buildOrderSalePrefill({
    order,
    columns,
    date: new Date('2026-09-30T00:00:00.000Z'),
  });

  assert.equal(salesTrackerOrderLabel(order), 'ORD-42 - Sports Flooring - Example School');
  assert.equal(result.Field, 'Order');
  assert.equal(result['Field Selection'], 'ORD-42 - Sports Flooring - Example School');
  assert.equal(result['Account / Deal / Order'], result['Field Selection']);
  assert.equal(result.Company, 'Example School');
  assert.equal(result['Sales Person Name'], 'sales@example.com');
  assert.equal(result['Basic Value'], '125000');
  assert.equal(result.Description, 'Indoor court flooring');
  assert.equal(result.Date, '2026-09-30');
  assert.equal(result['Invoice No.'], undefined);
});

test('order sale prefill falls back to the logged-in salesperson', () => {
  const result = buildOrderSalePrefill({
    order: { 'Order ID': 'ORD-7' },
    user: { username: 'owner@example.com' },
    columns: ['Field', 'Field Selection', 'Sales Person Name'],
  });
  assert.equal(result['Sales Person Name'], 'owner@example.com');
});
