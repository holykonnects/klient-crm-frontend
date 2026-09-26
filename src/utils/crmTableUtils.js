export const CRM_TABLE_SX = {
  '& .MuiTableCell-root': {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 9.5,
    lineHeight: 1.45,
    padding: '7px 9px',
    verticalAlign: 'top'
  },
  '& .MuiTableCell-head': {
    fontSize: 9.5,
    fontWeight: 700,
    whiteSpace: 'nowrap'
  }
};

export function parseCrmTimestamp(value) {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : 0;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  const compact = raw.match(/^(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})(\d{3})$/);
  if (compact) {
    const [, day, month, year, hour, minute, second, millisecond] = compact;
    return new Date(+year, +month - 1, +day, +hour, +minute, +second, +millisecond).getTime();
  }

  const local = raw.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})(?:[ T]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.(\d{1,3}))?)?$/
  );
  if (local) {
    const [, day, month, rawYear, hour = '0', minute = '0', second = '0', rawMs = '0'] = local;
    const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
    const date = new Date(year, Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), Number(rawMs.padEnd(3, '0')));
    const time = date.getTime();
    return Number.isFinite(time) ? time : 0;
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

const DEFAULT_UPDATE_FIELDS = [
  'Updated At',
  'Lead Updated Time',
  'Deal Updated Time',
  'Order Updated Time',
  'Project Updated Time',
  'Tender Updated Time',
  'Account Updated Time',
  'Timestamp',
  'Created Time'
];

export function crmRowUpdatedAt(row, preferredFields = []) {
  const fields = [...new Set([...preferredFields, ...DEFAULT_UPDATE_FIELDS])];
  return fields.reduce((latest, field) => Math.max(latest, parseCrmTimestamp(row?.[field])), 0);
}

export function latestCrmRows(rows, getKey, preferredFields = []) {
  const latest = new Map();
  (rows || []).forEach((row, index) => {
    const key = String(getKey(row) ?? '').trim();
    if (!key) return;
    const candidate = { row, index, time: crmRowUpdatedAt(row, preferredFields) };
    const current = latest.get(key);
    if (!current || candidate.time > current.time || (candidate.time === current.time && index > current.index)) {
      latest.set(key, candidate);
    }
  });

  return [...latest.values()]
    .sort((a, b) => b.time - a.time || b.index - a.index)
    .map(({ row }) => row);
}

export function newestCrmRows(rows, preferredFields = []) {
  return (rows || [])
    .map((row, index) => ({ row, index, time: crmRowUpdatedAt(row, preferredFields) }))
    .sort((a, b) => b.time - a.time || b.index - a.index)
    .map(({ row }) => row);
}
