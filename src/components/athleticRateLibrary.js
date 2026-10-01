const clean = value => String(value ?? '').trim();

const numberValue = value => {
  const parsed = Number(clean(value).replace(/[₹,%\s,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const enabled = value => ['yes', 'true', '1', 'enabled', 'include'].includes(clean(value).toLowerCase());

const normalized = value => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const pick = (row, names) => {
  for (const name of names) if (clean(row?.[name])) return row[name];
  const keys = Object.keys(row || {});
  for (const name of names) {
    const key = keys.find(candidate => normalized(candidate) === normalized(name));
    if (key && clean(row[key])) return row[key];
  }
  return '';
};

export function athleticQuantity(driver, factor, context = {}) {
  const mode = clean(driver).toUpperCase();
  const multiplier = numberValue(factor);
  const area = numberValue(context.area);
  const perimeter = numberValue(context.perimeter);
  if (mode === 'AREA') return area;
  if (mode === 'AREA_X_FACTOR') return area * multiplier;
  if (mode === 'PERIMETER') return perimeter;
  if (mode === 'PERIMETER_X_FACTOR') return perimeter * multiplier;
  return multiplier || 1;
}

export function athleticRateApplies(row, config = {}) {
  if (!enabled(pick(row, ['Include Default']))) return false;
  const scope = normalized(pick(row, ['Scope']));
  if (scope === 'civil' && normalized(config.civilWorks) !== 'yes') return false;
  if (scope === 'drainage' && normalized(config.drainageWorks) !== 'yes') return false;
  if (scope === 'equipment' && normalized(config.trackEquipment) !== 'yes') return false;
  if (scope === 'installation' && normalized(config.installation) === 'extra') return false;
  const system = normalized(pick(row, ['System']));
  return !system || system === 'all' || system === normalized(config.surfaceSystem);
}

export function buildAthleticDefaultRows(rateLibrary = [], config = {}, context = {}, catalog = {}) {
  return rateLibrary.filter(row => athleticRateApplies(row, config)).map((libraryRow, index) => {
    const category = clean(pick(libraryRow, ['Category', 'Court']));
    const subCategory = clean(pick(libraryRow, ['Sub Category', 'SubCategory', 'Sub-Category']));
    const itemCode = clean(pick(libraryRow, ['Item Code', 'Equipment Item Code', 'Catalog Item']));
    const catalogItem = (catalog.items?.[`${category}|||${subCategory}`] || []).find(item => item.code === itemCode);
    const libraryItem = clean(pick(libraryRow, ['Item'])) || `Athletic item ${index + 1}`;
    const driver = clean(pick(libraryRow, ['Qty Driver', 'Quantity Driver'])) || 'MANUAL';
    const factor = numberValue(pick(libraryRow, ['Thickness/Factor', 'Factor']));
    const qty = athleticQuantity(driver, factor, context);
    const rowNumber = numberValue(libraryRow.__rowNumber) || index + 2;
    return {
      source: 'rate-library',
      libraryKey: `rate-library:${rowNumber}:${normalized(libraryItem)}`,
      libraryRowNumber: rowNumber,
      libraryItem,
      scope: clean(pick(libraryRow, ['Scope'])),
      system: clean(pick(libraryRow, ['System'])),
      qtyDriver: driver,
      factor,
      suggestedQty: qty,
      qty,
      qtyEdited: false,
      category,
      subCategory,
      itemCode,
      rate: numberValue(pick(libraryRow, ['Rate', 'Unit Price'])),
      rateOverride: '',
      unit: clean(pick(libraryRow, ['Unit'])) || catalogItem?.unit || '',
      desc: clean(pick(libraryRow, ['Description'])) || catalogItem?.desc || libraryItem,
      descHtml: '',
      imageUrl: catalogItem?.imageUrl || '',
      itemType: normalized(pick(libraryRow, ['Scope'])) === 'equipment' ? 'Equipment' : 'Non Equipment',
    };
  });
}

export function reconcileAthleticRows(existingRows = [], generatedRows = [], excludedKeys = []) {
  const excluded = new Set(excludedKeys);
  const existingLibrary = new Map(existingRows.filter(row => row.source === 'rate-library').map(row => [row.libraryKey, row]));
  const defaults = generatedRows.filter(row => !excluded.has(row.libraryKey)).map(row => {
    const existing = existingLibrary.get(row.libraryKey);
    if (!existing) return row;
    return {
      ...row,
      ...existing,
      rate: row.rate,
      unit: existing.unitEdited ? existing.unit : row.unit,
      desc: existing.descEdited ? existing.desc : row.desc,
      descHtml: existing.descEdited ? existing.descHtml : row.descHtml,
      suggestedQty: row.suggestedQty,
      qty: existing.qtyEdited ? existing.qty : row.qty,
    };
  });
  return [...defaults, ...existingRows.filter(row => row.source !== 'rate-library')];
}

export function applyAthleticImageMapping(row = {}, mapping = {}, catalog = {}) {
  const category = clean(mapping.category);
  const subCategory = clean(mapping.subCategory);
  const itemCode = clean(mapping.itemCode);
  const selectedItem = (catalog.items?.[`${category}|||${subCategory}`] || []).find(item => item.code === itemCode);
  return {
    ...row,
    category,
    subCategory,
    itemCode,
    imageUrl: selectedItem?.imageUrl || '',
  };
}
