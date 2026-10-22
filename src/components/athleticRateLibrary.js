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
  return clean(factor) === '' ? 1 : multiplier;
}

export function updateAthleticCalculation(row, driver, factor, context) {
  const qty = athleticQuantity(driver, factor, context);
  return { ...row, qtyDriver: driver, factor, calculationEdited: true, qtyEdited: driver === 'MANUAL', qty, suggestedQty: qty };
}

export function athleticVolume(area, depth, depthUnit = 'mm') {
  const divisor = { mm: 1000, cm: 100, m: 1 }[depthUnit];
  const sqm = Number(String(area ?? '').trim().replace(/,/g, ''));
  const thickness = Number(String(depth ?? '').trim());
  if (!divisor || !String(area ?? '').trim() || !String(depth ?? '').trim()
    || !Number.isFinite(sqm) || !Number.isFinite(thickness) || sqm <= 0 || thickness <= 0) return null;
  const depthMetres = thickness / divisor;
  const volume = sqm * depthMetres;
  return Number.isFinite(volume) && volume > 0 ? { depthMetres, volume } : null;
}

export function applyAthleticVolume(row, { area, depth, depthUnit, linkedArea }) {
  const result = athleticVolume(area, depth, depthUnit);
  if (!result) throw new Error('Enter a positive area and thickness.');
  return {
    ...updateAthleticCalculation(row, linkedArea ? 'AREA_X_FACTOR' : 'MANUAL',
      linkedArea ? result.depthMetres : result.volume, { area }),
    unit: 'CUM', unitEdited: true, volumeDepthMetres: result.depthMetres,
  };
}

const volumeUnit = value => {
  const unit = clean(value).toUpperCase().replace(/\s/g, '');
  if (['SQM', 'M2', 'M²'].includes(unit)) return 'SQM';
  if (['CUM', 'M3', 'M³'].includes(unit)) return 'CUM';
  return unit;
};

export function athleticUnitDepth(row) {
  const depth = volumeUnit(row.unit) === 'CUM' && row.qtyDriver === 'AREA_X_FACTOR'
    ? Number(row.factor) : Number(row.volumeDepthMetres)
      || (volumeUnit(row.libraryUnit) === 'CUM' && row.libraryQtyDriver === 'AREA_X_FACTOR' ? Number(row.libraryFactor) : 0);
  return Number.isFinite(depth) && depth > 0 ? depth : null;
}

export function athleticCalculationLabel(row) {
  if (row.qtyEdited || row.qtyDriver === 'MANUAL') return 'Manual quantity';
  const factor = numberValue(row.factor);
  if (row.qtyDriver === 'AREA') return 'Quoted surface area';
  if (row.qtyDriver === 'AREA_X_FACTOR') return volumeUnit(row.unit) === 'CUM'
    ? `Area x ${Number((factor * 1000).toFixed(6))} mm depth` : `Area x ${factor}`;
  if (row.qtyDriver === 'PERIMETER') return 'Drain / edge perimeter';
  if (row.qtyDriver === 'PERIMETER_X_FACTOR') return `Perimeter x ${factor} section / factor`;
  return 'Manual quantity';
}

export function convertAthleticUnit(row, unit, depthMetres = athleticUnitDepth(row)) {
  const from = volumeUnit(row.unit);
  const to = volumeUnit(unit);
  if (from === to || !['SQM', 'CUM'].includes(from) || !['SQM', 'CUM'].includes(to)) {
    return { ...row, unit, unitEdited: true };
  }
  if (!Number.isFinite(depthMetres) || depthMetres <= 0) return null;
  const quantity = numberValue(row.qty);
  const qty = to === 'CUM' ? quantity * depthMetres : quantity / depthMetres;
  if (!Number.isFinite(qty)) return null;
  const linked = !row.qtyEdited && (from === 'SQM' ? row.qtyDriver === 'AREA' : row.qtyDriver === 'AREA_X_FACTOR');
  return {
    ...row, unit, unitEdited: true, volumeDepthMetres: depthMetres,
    qty, suggestedQty: qty, calculationEdited: true, qtyEdited: !linked,
    qtyDriver: linked ? (to === 'CUM' ? 'AREA_X_FACTOR' : 'AREA') : 'MANUAL',
    factor: linked ? (to === 'CUM' ? depthMetres : 1) : qty,
  };
}

export function athleticDrainPerimeter(config = {}, presets = []) {
  const override = clean(config.drainPerimeter);
  if (override !== '') return numberValue(override);
  const preset = (presets || []).find(row => clean(row?.Preset) === clean(config.preset));
  return numberValue(pick(preset, ['Drain Perimeter'])) || numberValue(config.lengthPerimeter);
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
    const factorValue = pick(libraryRow, ['Thickness/Factor', 'Factor']);
    const factor = driver.toUpperCase() === 'MANUAL' && numberValue(factorValue) === 0 ? '' : numberValue(factorValue);
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
      libraryQtyDriver: driver,
      libraryFactor: factor,
      libraryUnit: clean(pick(libraryRow, ['Unit'])) || catalogItem?.unit || '',
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
      imageUrl: catalogItem?.imageUrl || clean(pick(libraryRow, ['Images', 'Image URL', 'ImageURL'])),
      itemType: normalized(pick(libraryRow, ['Scope'])) === 'equipment' ? 'Equipment' : 'Non Equipment',
      freight: clean(pick(libraryRow, ['Freight'])),
      installation: clean(pick(libraryRow, ['Installation'])),
    };
  });
}

export function reconcileAthleticRows(existingRows = [], generatedRows = [], excludedKeys = [], context = {}) {
  const excluded = new Set(excludedKeys);
  const existingLibrary = new Map(existingRows.filter(row => row.source === 'rate-library').map(row => [row.libraryKey, row]));
  const defaults = generatedRows.filter(row => !excluded.has(row.libraryKey)).map(row => {
    const existing = existingLibrary.get(row.libraryKey);
    if (!existing) return row;
    return {
      ...row,
      ...existing,
      rate: row.rate,
      libraryQtyDriver: row.libraryQtyDriver,
      libraryFactor: row.libraryFactor,
      libraryUnit: row.libraryUnit,
      qtyDriver: existing.calculationEdited ? existing.qtyDriver : row.qtyDriver,
      factor: existing.calculationEdited ? existing.factor : row.factor,
      imageUrl: existing.imageMappingEdited || existing.imageUrl ? existing.imageUrl : row.imageUrl,
      unit: existing.unitEdited ? existing.unit : row.unit,
      desc: existing.descEdited ? existing.desc : row.desc,
      descHtml: existing.descEdited ? existing.descHtml : row.descHtml,
      suggestedQty: row.suggestedQty,
      qty: existing.qtyEdited ? existing.qty : existing.calculationEdited
        ? athleticQuantity(existing.qtyDriver, existing.factor, context) : row.qty,
    };
  });
  const manualRows = existingRows.filter(row => row.source !== 'rate-library').map(row => row.calculationEdited && !row.qtyEdited
    ? { ...row, qty: athleticQuantity(row.qtyDriver, row.factor, context) } : row);
  return [...defaults, ...manualRows];
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
    imageMappingEdited: true,
  };
}

export function isExportableQuotationRow(row = {}, quoteType = 'standard') {
  if (quoteType === 'athletic') {
    return Boolean(
      clean(row.libraryItem)
      || clean(row.itemCode)
      || clean(row.desc)
      || clean(row.descHtml)
    );
  }
  return Boolean(clean(row.category) && clean(row.subCategory) && clean(row.itemCode));
}
