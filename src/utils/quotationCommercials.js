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

export function quotationCommercialLabel(label, summary) {
  return [label, ...summary.entries.map((entry) => `${entry.serial}. ${entry.item}: ${entry.value}`)].join('\n');
}
