export function quotationChargeAmount(value) {
  const text = String(value ?? '').trim().replace(/^₹\s*/, '').replace(/,/g, '');
  return /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : 0;
}

export function quotationCommercialSummary(items = [], field) {
  const entries = items.flatMap((item, index) => {
    const value = String(item[field] ?? '').trim();
    return value ? [{ serial: index + 1, item: item.displayItem || item.libraryItem || item.item || item.itemCode || `Item ${index + 1}`, value }] : [];
  });
  return { entries, amount: entries.reduce((sum, entry) => sum + quotationChargeAmount(entry.value), 0) };
}

export function quotationCommercialLabel(label) {
  return label;
}

export function quotationCommercialValue(summary, globalValue = '') {
  const values = [globalValue, ...summary.entries.map(entry => entry.value)].map(value => String(value ?? '').trim()).filter(Boolean);
  const wording = [...new Set(values.filter(value => !/^(?:₹\s*)?\d[\d,]*(?:\.\d+)?$/.test(value)))];
  const amount = quotationChargeAmount(globalValue) + summary.amount;
  if (!wording.length) return values.length ? amount : 'Extra';
  return [...(amount ? [`₹ ${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`] : []), ...wording].join('; ');
}
