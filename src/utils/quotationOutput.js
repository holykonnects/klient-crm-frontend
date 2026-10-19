export function quotationOutputRows(rows = [], pricing = {}) {
  const amount = Number(pricing.certificationAmount) || 0;
  return amount > 0 ? [...rows, {
    displayItem: 'Line Marking & Class II Certification', libraryItem: 'Line Marking & Class II Certification',
    desc: 'Line Marking & Class II Certification', descOverride: 'Line Marking & Class II Certification',
    qty: 1, rate: amount, rateOverride: '', unit: 'Job', itemType: 'Non Equipment', source: 'certification',
  }] : rows;
}

export function applyQuotationCommercialSettings(rows = [], settings = {}) {
  return rows.map(row => {
    const next = { ...row };
    for (const field of ['freight', 'installation']) {
      const setting = settings[field];
      if (setting?.enabled === false) next[field] = '';
      else if (setting?.mode === 'all') next[field] = setting.value ?? 'Included';
    }
    return next;
  });
}
