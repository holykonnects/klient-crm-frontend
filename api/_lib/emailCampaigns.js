import { createHash, randomUUID } from 'node:crypto';

const normalize = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = {
  email: ['Email', 'Email ID', 'Email Address'], firstName: ['First Name', 'Name', 'Contact Name'],
  company: ['Company Name', 'Company'], status: ['Email Status'], sentAt: ['Email Shared Date', 'Email Sent Date'], template: ['Template Sent'],
};
const leadAliases = {
  email: aliases.email, firstName: aliases.firstName, lastName: ['Last Name'], company: aliases.company,
  owner: ['Lead Owner', 'Owner'], status: ['Lead Status', 'Status'], leadId: ['Lead ID', 'Lead Id'],
};
export const validEmail = value => /^[^\s@<>;,\r\n]+@[^\s@<>;,\r\n]+\.[^\s@<>;,\r\n]+$/.test(String(value || ''));

export function campaignColumns(headers) {
  return Object.fromEntries(Object.entries(aliases).map(([field, names]) => [field, headers.findIndex(header => names.some(name => normalize(name) === normalize(header)))]));
}

export function campaignRecipients(values) {
  const headerIndex = values.slice(0, 10).findIndex(row => campaignColumns(row).email >= 0);
  if (headerIndex < 0) throw new Error('This campaign sheet needs an Email, Email ID or Email Address column.');
  const columns = campaignColumns(values[headerIndex]);
  const recipients = values.slice(headerIndex + 1).flatMap((row, index) => {
    const email = String(row[columns.email] || '').trim().toLowerCase();
    if (!email) return [];
    return [{ rowNumber: headerIndex + index + 2, email, firstName: String(row[columns.firstName] || ''),
      company: String(row[columns.company] || ''), status: String(row[columns.status] || ''),
      sentAt: String(row[columns.sentAt] || ''), template: String(row[columns.template] || ''), valid: validEmail(email) }];
  });
  return { columns, recipients };
}

export function leadEmailRecipients(values) {
  const headerIndex = values.slice(0, 10).findIndex(row => campaignColumns(row).email >= 0);
  if (headerIndex < 0) throw new Error('The leads table needs an Email, Email ID or Email Address column.');
  const headers = values[headerIndex] || [];
  const columns = Object.fromEntries(Object.entries(leadAliases).map(([field, names]) =>
    [field, headers.findIndex(header => names.some(name => normalize(name) === normalize(header)))]));
  return values.slice(headerIndex + 1).flatMap((row, index) => {
    const email = String(row[columns.email] || '').trim().toLowerCase();
    if (!validEmail(email)) return [];
    return [{ rowNumber: headerIndex + index + 2, email, valid: true,
      firstName: String(row[columns.firstName] || ''), lastName: String(row[columns.lastName] || ''),
      company: String(row[columns.company] || ''), owner: String(row[columns.owner] || ''),
      status: String(row[columns.status] || ''), leadId: String(row[columns.leadId] || '') }];
  });
}

export function campaignDispatchKey({ campaign, sheet, email, templateId }) {
  if (!String(campaign || '').trim()) throw new Error('Enter a campaign name before sending.');
  return createHash('sha256').update(JSON.stringify([String(campaign).trim().toLowerCase(), sheet, String(email).toLowerCase(), templateId])).digest('hex');
}

export function campaignPlaceholders(recipient, quotationLink = '', date = new Date()) {
  const link = String(quotationLink || '').trim();
  if (link && !/^https?:\/\//i.test(link)) throw new Error('The quotation link must begin with https:// or http://.');
  return { FIRST_NAME: recipient.firstName || '', COMPANY: recipient.company || '', COMPANY_NAME: recipient.company || '',
    EMAIL: recipient.email, DATE: date.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }), QUOTATION_LINK: link };
}

// Sheets append orders claims durably. The first claim for a key owns the send;
// later invocations never retry a send whose Gmail outcome may be unknown.
export async function dispatchCampaign({ key, claim, readClaims, send, updateClaim, now = new Date().toISOString() }) {
  const existing = (await readClaims()).find(row => row[0] === key);
  if (existing) return { ok: true, skipped: true, status: existing[2] || 'Needs review' };
  const token = randomUUID();
  await claim([key, token, 'Sending', now, '', '']);
  const first = (await readClaims()).find(row => row[0] === key);
  if (!first || first[1] !== token) return { ok: true, skipped: true, status: first?.[2] || 'Needs review' };
  let result;
  try { result = await send(); }
  catch (error) {
    try { await updateClaim(token, 'Needs review', '', error.message); } catch {}
    throw Object.assign(new Error(`Delivery could not be confirmed. Check Gmail Sent before trying another campaign. ${error.message}`), { status: 502 });
  }
  let warning = '';
  try { await updateClaim(token, 'Sent', result?.id || '', ''); }
  catch { warning = 'Email sent, but the send ledger could not be updated. Do not resend; check Gmail Sent.'; }
  return { ok: true, status: 'Accepted by Gmail', messageId: result?.id || '', warning };
}

// Google Docs exports may contain changing resource URLs. Version the source file,
// rather than generated export bytes, while retaining a content fallback.
export function emailTemplateVersion(meta, html) {
  return createHash('sha256').update(JSON.stringify(meta.modifiedTime
    ? [meta.id, meta.mimeType, meta.modifiedTime]
    : [meta.id, meta.mimeType, html])).digest('hex');
}
