import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { campaignColumns, campaignRecipients, campaignDispatchKey, campaignPlaceholders, dispatchCampaign, leadEmailRecipients, validEmail } from '../api/_lib/emailCampaigns.js';
import { templateEmailHtml } from '../api/_lib/emailTemplates.js';

test('campaign columns preserve actual sheet row numbers and ignore non-email rows', () => {
  const values = [['Campaign contacts'], ['First Name', 'Company Name', 'Email', 'Email Status', 'Email Shared Date', 'Template Sent'],
    ['Test', 'School', 'TEST@EXAMPLE.INVALID', 'Sent', 'Yesterday', 'Greeting'], [], ['Invalid', '', 'bad-address']];
  const result = campaignRecipients(values);
  assert.equal(result.recipients.length, 2);
  assert.deepEqual(result.recipients[0], { rowNumber: 3, firstName: 'Test', company: 'School', email: 'test@example.invalid', status: 'Sent', sentAt: 'Yesterday', template: 'Greeting', valid: true });
  assert.equal(result.recipients[1].rowNumber, 5);
  assert.equal(result.recipients[1].valid, false);
  assert.equal(campaignColumns(['Email ID', 'Company']).company, 1);
  assert.throws(() => campaignRecipients([['Unrelated table']]), /needs an Email/);
  for (const value of ['a@b.invalid\r\nBcc:x@y.invalid', 'a@b.invalid,c@d.invalid', 'a@b.invalid;c@d.invalid']) assert.equal(validEmail(value), false);
});

test('lead recipient selection exposes only rows with valid email addresses', () => {
  const rows = [['Lead ID', 'First Name', 'Last Name', 'Company', 'Email ID', 'Lead Owner', 'Lead Status'],
    ['L-1', 'Ada', 'Lovelace', 'Analytical', 'ADA@EXAMPLE.INVALID', 'Owner One', 'Qualified'],
    ['L-2', 'No', 'Email', 'Hidden', '', 'Owner Two', 'New'],
    ['L-3', 'Bad', 'Email', 'Hidden', 'not-an-email', 'Owner Two', 'New']];
  assert.deepEqual(leadEmailRecipients(rows), [{ rowNumber: 2, leadId: 'L-1', firstName: 'Ada', lastName: 'Lovelace',
    company: 'Analytical', email: 'ada@example.invalid', owner: 'Owner One', status: 'Qualified', valid: true }]);
});

test('campaign keys deduplicate repeated email rows but allow a deliberately new campaign', () => {
  const details = { campaign: 'November greeting', sheet: 'Contacts', email: 'test@example.invalid', templateId: 'template-1' };
  assert.equal(campaignDispatchKey(details), campaignDispatchKey({ ...details, email: 'TEST@example.invalid', campaign: ' November greeting ' }));
  assert.notEqual(campaignDispatchKey(details), campaignDispatchKey({ ...details, campaign: 'December greeting' }));
  assert.throws(() => campaignDispatchKey({ ...details, campaign: '' }), /campaign name/);
});

test('preview and send map identical safe placeholders, including quotation buttons', () => {
  const placeholders = campaignPlaceholders({ firstName: '<Test>', company: 'A & B', email: 'test@example.invalid' }, 'https://example.invalid/quote?x=1&y=2', new Date('2026-11-04T23:00:00Z'));
  assert.equal(placeholders.DATE, '05/11/2026');
  const html = templateEmailHtml('<p>{{FIRST_NAME}} {{COMPANY_NAME}} {{DATE}}</p>{{QUOTATION_BUTTON}}', placeholders);
  assert.match(html, /&lt;Test&gt; A &amp; B 05\/11\/2026/);
  assert.match(html, /href="https:\/\/example.invalid\/quote\?x=1&amp;y=2"/);
  assert.throws(() => campaignPlaceholders({}, 'javascript:alert(1)'), /must begin/);
});

function fakeDispatch() {
  const rows = [];
  let sends = 0;
  return { rows, get sends() { return sends; }, io: {
    key: 'campaign-key', readClaims: async () => rows.map(row => [...row]), claim: async row => { rows.push(row); },
    updateClaim: async (token, status, messageId, detail) => { const row = rows.find(item => item[1] === token); row[2] = status; row[4] = messageId; row[5] = detail; },
    send: async () => { sends += 1; return { id: 'gmail-fixture-id' }; },
  } };
}

test('durable dispatch sends once and reload or resume skips the existing claim', async () => {
  const fixture = fakeDispatch();
  const result = await dispatchCampaign(fixture.io);
  assert.equal(result.status, 'Sent');
  assert.equal(result.messageId, 'gmail-fixture-id');
  assert.equal((await dispatchCampaign(fixture.io)).skipped, true);
  assert.equal(fixture.sends, 1);
});

test('concurrent dispatches elect the first appended claim and send only once', async () => {
  const fixture = fakeDispatch();
  const results = await Promise.all([dispatchCampaign(fixture.io), dispatchCampaign(fixture.io)]);
  assert.equal(fixture.sends, 1);
  assert.equal(results.filter(result => result.skipped).length, 1);
});

test('unknown Gmail outcome is marked for review and never automatically retried', async () => {
  const fixture = fakeDispatch();
  let attempts = 0;
  const io = { ...fixture.io, send: async () => { attempts += 1; throw new Error('Connection lost'); } };
  await assert.rejects(dispatchCampaign(io), /Delivery could not be confirmed/);
  assert.equal(fixture.rows[0][2], 'Needs review');
  assert.equal((await dispatchCampaign(io)).skipped, true);
  assert.equal(attempts, 1);
});

test('post-send ledger failure returns sent with warning and blocks retries', async () => {
  const fixture = fakeDispatch();
  const io = { ...fixture.io, updateClaim: async () => { throw new Error('Sheets unavailable'); } };
  const result = await dispatchCampaign(io);
  assert.equal(result.status, 'Sent');
  assert.match(result.warning, /Do not resend/);
  assert.equal((await dispatchCampaign(io)).skipped, true);
  assert.equal(fixture.sends, 1);
});

test('no Gmail call occurs when the persistent claim cannot be created', async () => {
  const fixture = fakeDispatch();
  await assert.rejects(dispatchCampaign({ ...fixture.io, claim: async () => { throw new Error('No permission'); } }), /No permission/);
  assert.equal(fixture.sends, 0);
});

test('native sender replaces Apps Script and bulk routes require signed sessions', () => {
  const dashboard = readFileSync(new URL('../src/components/email/EmailDashboard.js', import.meta.url), 'utf8');
  assert.match(dashboard, /<BulkEmailSender/);
  assert.ok(!dashboard.includes('script.google.com'));
  assert.ok(!dashboard.includes('<iframe'));
  const handler = readFileSync(new URL('../api/_handlers/email.js', import.meta.url), 'utf8');
  assert.match(handler, /const session = requireSession\(req\)/);
  assert.match(handler, /expectedEmail/);
  assert.match(handler, /body.version !== template.version/);
  const sender = readFileSync(new URL('../src/components/email/BulkEmailSender.jsx', import.meta.url), 'utf8');
  assert.match(sender, /for \(const recipient of queue\)/);
  assert.match(sender, /Confirm send/);
  assert.match(sender, /Save draft/);
  assert.match(sender, /<Tab label="Leads"/);
  assert.match(sender, /getLeadRecipients/);
});
