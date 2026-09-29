import templates from '../data/quotationSetTemplates.json';

export const quotationSetTemplates = templates;

let sequence = 0;

export function createId(prefix = 'item') {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

export function emptySetItem() {
  return {
    id: createId('item'), item: '', description: '', descHtml: '', unit: '',
    qty: 1, rate: 0, qtyMode: 'manual', factor: 1,
  };
}

export function emptyQuotationSet(title = 'New set') {
  return { id: createId('set'), title, baseQuantity: 1, items: [emptySetItem()] };
}

export function normalizeSets(sets = []) {
  return sets.map((set) => ({
    ...set,
    id: set.id || createId('set'),
    baseQuantity: Number(set.baseQuantity) || 0,
    items: (set.items || []).map((item) => ({
      ...item,
      id: item.id || createId('item'),
      descHtml: item.descHtml || '',
      qtyMode: item.qtyMode === 'factor' ? 'factor' : 'manual',
      factor: Number(item.factor) || 0,
      qty: Number(item.qty) || 0,
      rate: Number(item.rate) || 0,
    })),
  }));
}

export function setsFromTemplate(templateId) {
  const template = templates.find((entry) => entry.id === templateId);
  return template ? normalizeSets(JSON.parse(JSON.stringify(template.sets || []))) : [];
}

export function itemQuantity(set, item) {
  return item.qtyMode === 'factor'
    ? (Number(set.baseQuantity) || 0) * (Number(item.factor) || 0)
    : Number(item.qty) || 0;
}

export function setSubtotal(set) {
  return (set.items || []).reduce((sum, item) => sum + itemQuantity(set, item) * (Number(item.rate) || 0), 0);
}

export function setQuoteTotals(sets, gstPct) {
  const subtotal = (sets || []).reduce((sum, set) => sum + setSubtotal(set), 0);
  const gst = subtotal * ((Number(gstPct) || 0) / 100);
  return { subtotal, gst, grand: Math.round(subtotal + gst) };
}

