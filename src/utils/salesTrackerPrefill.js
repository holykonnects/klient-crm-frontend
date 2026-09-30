const clean = (value) => String(value ?? '').trim();

const joinLabel = (parts) => parts.map(clean).filter(Boolean).join(' - ');

export function salesTrackerOrderLabel(order = {}) {
  return joinLabel([
    order['Order ID'],
    order['Deal Name'] || order['Order Name'],
    order.Company,
  ]);
}

export function buildOrderSalePrefill({
  order = {},
  user = {},
  columns = [],
  entityFieldColumn = 'Field',
  entitySelectionColumn = 'Field Selection',
  date = new Date(),
} = {}) {
  const allowed = new Set(columns);
  const result = {};
  const assign = (field, value) => {
    if (allowed.has(field) && clean(value)) result[field] = value;
  };
  const orderLabel = salesTrackerOrderLabel(order);
  const salesperson =
    order['Sales Person Name'] || order['Account Owner'] || order['Deal Owner'] ||
    order['Lead Owner'] || order['Order Owner'] || order.Owner || user.username || user.email || '';

  result[entityFieldColumn] = 'Order';
  result[entitySelectionColumn] = orderLabel;
  assign('Account / Deal / Order', orderLabel);
  assign('Company', order.Company);
  assign('Sales Person Name', salesperson);
  assign('Basic Value', order['Order Amount']);
  assign('Description', order['Product Required'] || order['Deal Name'] || order['Order Remarks']);
  assign('Date', date.toISOString().slice(0, 10));
  return result;
}
