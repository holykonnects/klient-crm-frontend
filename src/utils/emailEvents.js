const key = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function normalizeEmailEvents(rows = []) {
  const aliases = { timestamp: ['timestamp', 'sentat', 'emailshareddate'], to: ['to', 'email', 'emailid', 'recipient'],
    subject: ['subject', 'emailsubject'], status: ['status', 'emailstatus'], companyName: ['companyname', 'company'],
    firstName: ['firstname'], templateText: ['templatetext', 'templatename', 'templatesent', 'templateid'],
    templateUrl: ['templateurl'], quotationLink: ['quotationlink'], mode: ['mode'], error: ['error'], cc: ['cc'] };
  return rows.map(row => {
    const next = { ...row };
    for (const [field, names] of Object.entries(aliases)) next[field] = Object.entries(row).find(([header]) => names.includes(key(header)))?.[1] ?? '';
    const match = String(next.timestamp).match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,T]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (match) next.timestamp = `${match[3]}-${match[2]}-${match[1]}T${match[4] || '00'}:${match[5] || '00'}:${match[6] || '00'}+05:30`;
    return next;
  }).sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
}
