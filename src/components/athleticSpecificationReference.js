import { athleticCalculationLabel } from './athleticRateLibrary.js';

export const QUOTATION_SPECIFICATION_REFERENCE = [
  ['Athletic track', 'Ground clearing', 'Surface area', 'SQM', 'Yash / GOI'],
  ['Athletic track', 'Subgrade preparation', '225 mm average excavation', 'SQM; depth included in scope', 'Yash / GOI'],
  ['Athletic track', 'Weedicide / pesticide', '0.05 litre/SQM', 'SQM', 'Yash / GOI'],
  ['Athletic track', 'GSB - granular sub-base', '100 mm calculated; 125 mm in conflicting descriptions', 'Area x thickness = CUM; approval required', 'Yash / GOI'],
  ['Athletic track', 'WMM - wet mix macadam', '100 mm compacted', 'Area x 0.10 m = CUM', 'Yash / GOI'],
  ['Athletic track', 'Tack coat over WMM', '0.75 kg/SQM', 'SQM', 'Yash / GOI'],
  ['Athletic track', 'Tack coat over bituminous layer', '0.25 or 0.50 kg/SQM', 'SQM; project-specific rate', 'GOI / Yash'],
  ['Athletic track', 'BM - bituminous macadam', '50 mm compacted', 'Area x 0.05 m = CUM', 'Yash / GOI'],
  ['Athletic track', 'BC - bituminous concrete', '25 mm compacted', 'Area x 0.025 m = CUM', 'Yash / GOI'],
  ['Athletic track', 'Sandwich synthetic surface', '15 mm total: 11 mm base + 4 mm wear layer', 'SQM; alternative surface system', 'Yash'],
  ['Athletic track', 'Full PUR / EPDM surface', '15 mm total: 5 + 5 + 5 mm', 'SQM; alternative surface system', 'GOI'],
  ['Athletic track', 'Drainage PCC bed', '150 mm', 'Drain geometry = CUM, not whole track area', 'Yash / GOI'],
  ['Athletic track', 'Drain covers', '600 x 450 x 75 mm', 'RMT', 'Yash / GOI'],
  ['Athletic track', 'RCC drainage pipe', '300 mm diameter', 'RMT', 'Yash / GOI'],
  ['Court', 'PU flooring', '9 mm: 7 mm rubber + 2 mm PU', 'SQFT in the example', 'GOI'],
  ['Natural football', 'Perforated drainage pipe', '100 mm diameter; 5 m centres', 'Metres', 'Jan Mitram'],
  ['Natural football', 'Geotextile', '140 / 150 GSM', 'SQM', 'Jan Mitram'],
  ['Natural football', 'River sand', '30 mm', 'Area x 0.03 m = CUM', 'Jan Mitram'],
  ['Natural football', 'Good earth', '150 mm implied by quantity; description says up to 60 mm', '975 CUM / 6,500 SQM; approval required', 'Jan Mitram'],
  ['Natural football', 'Natural grass turf', '1 x 1 m turf pieces in the example', 'SQM', 'Jan Mitram'],
];

export function athleticSpecificationDetails(row = {}) {
  const volume = ['CUM', 'M3', 'M\u00b3'].includes(String(row.unit || '').trim().toUpperCase());
  const reference = row.libraryQtyDriver === 'AREA_X_FACTOR' && String(row.libraryUnit || '').toUpperCase() === 'CUM'
    ? Number(row.libraryFactor) * 1000 : null;
  const current = volume && !row.qtyEdited && row.qtyDriver === 'AREA_X_FACTOR' ? Number(row.factor) * 1000 : null;
  const text = `${row.libraryItem || ''} ${row.desc || ''}`;
  const stated = [...text.matchAll(/(\d+(?:\.\d+)?)\s*mm\s*(?:compacted\s*)?(?:thick(?:ness)?|depth)|(?:thickness|depth)\s*[:=]?\s*\(?\s*(\d+(?:\.\d+)?)\s*mm/gi)]
    .map(match => Number(match[1] || match[2]));
  const conflicts = current > 0 ? [...new Set(stated.filter(value => Math.abs(value - current) > 0.001))] : [];
  return {
    referenceThickness: reference > 0 ? `${Number(reference.toFixed(6))} mm` : 'Not specified as area depth',
    currentThickness: current > 0 ? `${Number(current.toFixed(6))} mm` : row.qtyEdited ? 'Manual quantity' : 'Not an area-depth calculation',
    basis: athleticCalculationLabel(row),
    warning: conflicts.length ? `Approval required: calculation uses ${Number(current.toFixed(6))} mm, but item wording also states ${conflicts.join(', ')} mm. Verify the approved specification.` : '',
  };
}
