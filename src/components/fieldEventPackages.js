import { buildAthleticDefaultRows } from './athleticRateLibrary.js';

const manualUrl = 'https://worldathletics.org/download/download?filename=7d39b677-8043-45f4-89f4-6c8814023057.pdf&urlslug=Track+and+Field+Facilities+Manual+2019+Edition+-+Chapters+1-3';
export const FIELD_EVENTS = [
  { id: 'shot', label: 'Shot put', defaults: { diameter: 2.135, sectorLength: '', baseDepth: '' },
    fields: [['diameter', 'Circle internal diameter (m)'], ['sectorLength', 'Reviewed landing-sector length (m)'], ['baseDepth', 'Base depth (mm)']],
    reference: '2.135 m circle; stop board; 34.92 degree landing sector.', url: manualUrl },
  { id: 'discus', label: 'Discus', defaults: { diameter: 2.5, sectorLength: '', baseDepth: '' },
    fields: [['diameter', 'Circle internal diameter (m)'], ['sectorLength', 'Reviewed landing-sector length (m)'], ['baseDepth', 'Base depth (mm)']],
    reference: '2.50 m circle; protective cage; 34.92 degree landing sector.', url: manualUrl },
  { id: 'javelin', label: 'Javelin', defaults: { length: 30, width: 4, sectorLength: '', baseDepth: '' },
    fields: [['length', 'Runway length (m)'], ['width', 'Runway width (m)'], ['sectorLength', 'Reviewed landing-sector length (m)'], ['baseDepth', 'Base depth (mm)']],
    reference: '30 m x 4 m baseline runway; 8 m throwing-arc radius. Competition level may require a longer runway.', url: manualUrl },
  { id: 'longJump', label: 'Long jump', defaults: { length: 40, width: 1.22, pitLength: 9, pitWidth: 2.75, boardOffset: 2, baseDepth: '', sandDepth: '' },
    fields: [['length', 'Runway length to take-off line (m)'], ['width', 'Runway width (m)'], ['pitLength', 'Sand pit length (m)'], ['pitWidth', 'Sand pit width (m)'], ['boardOffset', 'Take-off line to pit (m)'], ['baseDepth', 'Runway base depth (mm)'], ['sandDepth', 'Sand depth (mm)']],
    reference: '40 m x 1.22 m baseline runway (45 m for major international competitions in the facilities manual); pit width at least 2.75 m. The 9 m pit and 2 m board offset are editable planning values.', url: manualUrl },
];
export const fieldEventConfig = (event, selections = {}) => ({ count: 1, ...event.defaults, ...selections[event.id] });
const number = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0;
const key = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

export function fieldEventComponents(event, config) {
  const circle = ['shot', 'discus'].includes(event.id);
  const area = circle ? Math.PI * (number(config.diameter) / 2) ** 2 : number(config.length) * number(config.width);
  const prefix = event.label;
  const dimensions = circle ? `${config.diameter} m internal diameter` : `${config.length} m x ${config.width} m runway`;
  const baseArea = area + (event.id === 'longJump' ? number(config.boardOffset) * number(config.width) : 0);
  const rows = [
    ['surface', `${prefix} - ${circle ? 'circle surface' : 'runway surface'}`, 'SQM', area, `${prefix}: ${dimensions}. Surface specification and finish as approved.`],
    ['base', `${prefix} - base construction`, 'CUM', baseArea * number(config.baseDepth) / 1000, `${prefix}: ${dimensions}; ${config.baseDepth || 'unspecified'} mm base depth.${event.id === 'longJump' ? ' Includes board-to-pit apron base.' : ''} Material and build-up as approved.`],
  ];
  if (circle) rows.push(['ring', `${prefix} - throwing ring`, 'Nos', 1, `${prefix} throwing ring and installation for ${config.diameter} m internal diameter.`]);
  if (event.id === 'shot') rows.push(['board', 'Shot put - stop board', 'Nos', 1, 'Shot put stop board and fixing, to the approved facility specification.']);
  if (event.id === 'discus') rows.push(['cage', 'Discus - protective cage', 'Set', 1, 'Complete protective cage, netting, foundations and installation to an approved safety design.']);
  if (event.id === 'javelin') rows.push(['arc', 'Javelin - arc and markings', 'Job', 1, 'Throwing arc of 8 m radius and runway markings; reviewed event layout required.']);
  if (event.id !== 'longJump') rows.push(['landing', `${prefix} - landing-sector preparation`, 'LS', 1, `${prefix} landing-sector preparation: reviewed length ${config.sectorLength || 'unspecified'} m. Extent, clearances and safety provisions per approved layout; not inferred from track area.`]);
  else rows.push(
    ['apron', 'Long jump - board-to-pit apron', 'SQM', number(config.boardOffset) * number(config.width), `Surfaced apron: ${config.boardOffset} m x ${config.width} m. Base included in runway base quantity.`],
    ['sand', 'Long jump - sand filling', 'CUM', number(config.pitLength) * number(config.pitWidth) * number(config.sandDepth) / 1000, `Sand pit ${config.pitLength} m x ${config.pitWidth} m x ${config.sandDepth || 'unspecified'} mm sand depth. Sand specification as approved.`],
    ['pit', 'Long jump - pit edging and drainage', 'LS', 1, `Complete pit civil works, edging and drainage package for ${config.pitLength} m x ${config.pitWidth} m pit, per approved design.`],
    ['board', 'Long jump - take-off board', 'Set', 1, `Take-off board assembly and installation, ${config.boardOffset} m before the near edge of the sand pit.`],
  );
  return rows.map(([id, name, unit, qty, desc]) => ({ id, name, unit, qty: qty * number(config.count ?? 1), desc: `${config.count ?? 1} facility/facilities. ${desc}`, area }));
}

const eventRateNames = new Set(FIELD_EVENTS.flatMap(event => fieldEventComponents(event, event.defaults).map(row => key(row.name))));
export const isFieldEventRate = row => eventRateNames.has(key(row.Item));

export function buildFieldEventRows(selections = {}, rateLibrary = [], catalog = {}) {
  return FIELD_EVENTS.filter(event => selections[event.id]?.enabled).flatMap(event => {
    const config = fieldEventConfig(event, selections);
    return fieldEventComponents(event, config).map(component => {
      const candidates = rateLibrary.filter(row => key(row.Item) === key(component.name) && key(row.Unit) === key(component.unit));
      const matched = candidates.length === 1 ? candidates[0] : null;
      const rawRate = String(matched?.Rate ?? matched?.['Unit Price'] ?? '').replace(/[,\s\u20b9]/g, '');
      const hasRate = Boolean(matched && rawRate !== '' && Number.isFinite(Number(rawRate)) && Number(rawRate) >= 0);
      const [mapped] = buildAthleticDefaultRows([{ ...matched, Item: component.name, Scope: 'Field Events', System: 'ALL', Unit: component.unit,
        'Include Default': 'Yes', 'Qty Driver': 'MANUAL', 'Thickness/Factor': component.qty }], {}, {}, catalog);
      return { ...mapped, libraryKey: `field-event:${event.id}:${component.id}`, fieldEventId: event.id,
        fieldEventArea: component.area, fieldEventRateMissing: !hasRate, libraryItem: component.name,
        qty: component.qty, suggestedQty: component.qty, factor: component.qty,
        desc: component.desc, rate: hasRate ? Number(rawRate) : '', qtyDriver: 'MANUAL' };
    });
  });
}

export function fieldEventIssues(selections = {}, rows = []) {
  const issues = [];
  for (const event of FIELD_EVENTS.filter(event => selections[event.id]?.enabled)) {
    const config = fieldEventConfig(event, selections);
    if (!Number.isInteger(Number(config.count)) || number(config.count) < 1) issues.push(`${event.label}: number of facilities must be a positive whole number.`);
    for (const [field, label] of event.fields) if (!number(config[field])) issues.push(`${event.label}: ${label} is required.`);
    for (const component of fieldEventComponents(event, config)) if (!rows.some(row => row.libraryKey === `field-event:${event.id}:${component.id}`)) issues.push(`${component.name}: package component is missing.`);
    if (!config.layoutReviewed) issues.push(`${event.label}: site layout / safety review acknowledgement required.`);
    if (!config.referenceOverrideAccepted) {
      if (event.id === 'longJump' && (number(config.length) < 40 || Math.abs(number(config.width) - 1.22) > 0.01 || number(config.pitWidth) < 2.75 || number(config.pitWidth) > 3 || number(config.boardOffset) < 1 || number(config.boardOffset) > 3 || number(config.boardOffset) + number(config.pitLength) < 10)) issues.push('Long jump: dimensions differ from the baseline reference. Approval required.');
      if (event.id === 'javelin' && (number(config.length) < 30 || number(config.width) !== 4)) issues.push('Javelin: baseline runway is at least 30 m x 4 m. Approval required.');
      if (['shot', 'discus'].includes(event.id) && Math.abs(number(config.diameter) - event.defaults.diameter) > 0.005) issues.push(`${event.label}: circle diameter differs from the reference tolerance. Approval required.`);
    }
  }
  for (const row of rows.filter(row => row.fieldEventId)) {
    const explicit = row.rateOverride !== '' && row.rateOverride !== undefined && Number.isFinite(Number(row.rateOverride)) && Number(row.rateOverride) >= 0;
    if (!explicit && (row.fieldEventRateMissing || row.unit !== row.libraryUnit)) issues.push(`${row.libraryItem || row.displayItem}: unit price required (${row.unit}).`);
    if (!Number.isFinite(Number(row.qty)) || Number(row.qty) <= 0) issues.push(`${row.libraryItem || row.displayItem}: positive quantity required.`);
  }
  return issues;
}
