import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import handler from '../api/_handlers/email.js';
import { DRIVE_FOLDERS } from '../api/_lib/crmConfig.js';
import { createSessionToken } from '../api/_lib/sessionAuth.js';

test('native campaign API previews, sends once, updates only status cells and rejects changed rows', async () => {
  const priorFetch = globalThis.fetch;
  const envNames = ['CRM_SESSION_SECRET', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GMAIL_SENDER_EMAIL'];
  const previous = Object.fromEntries(envNames.map(key => [key, process.env[key]]));
  process.env.CRM_SESSION_SECRET = 'fixture-only-secret';
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'fixture@example.invalid';
  process.env.GOOGLE_PRIVATE_KEY = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
  process.env.GMAIL_SENDER_EMAIL = 'fixture@example.invalid';
  let ledgerExists = false;
  const claims = [];
  const updates = [];
  const eventRows = [];
  let deliveries = 0;
  const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    if (url.hostname === 'oauth2.googleapis.com') return response({ access_token: 'fixture-token', expires_in: 3600 });
    if (url.hostname === 'gmail.googleapis.com') { deliveries += 1; return response({ id: 'fixture-gmail-id' }); }
    if (url.hostname === 'www.googleapis.com') {
      if (url.pathname.endsWith('/export') || url.searchParams.get('alt') === 'media') return new Response('<html><head><style>p{color:red}</style></head><body><p>Hello {{FIRST_NAME}}</p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5V0AAAAASUVORK5CYII="></body></html>');
      return response({ id: 'fixture-template', name: 'Greeting', mimeType: 'text/html', parents: [DRIVE_FOLDERS.emailTemplates], modifiedTime: 'fixture-time' });
    }
    if (url.hostname !== 'sheets.googleapis.com') throw new Error(`Unexpected fixture network request: ${input}`);
    if (url.pathname.endsWith(':batchUpdate')) { ledgerExists = true; return response({}); }
    const range = decodeURIComponent(url.pathname.split('/values/')[1] || '');
    if (!range) return response({ sheets: ['CRM Login', 'Contacts', 'Email_Events', ...(ledgerExists ? ['CRM_Email_Dispatches'] : [])].map(title => ({ properties: { title } })) });
    if (range.includes('CRM Login')) return response({ values: [['Login Username', 'Role'], ['fixture@example.invalid', 'Admin']] });
    if (range.includes('CRM_Email_Dispatches')) {
      if (!ledgerExists) return response({ error: { message: 'Unable to parse range' } }, 400);
      if (options.method === 'POST') { claims.push(JSON.parse(options.body).values[0]); return response({}); }
      if (options.method === 'PUT') {
        const match = range.match(/!([A-F])(\d+)/);
        claims[Number(match[2]) - 1][match[1].charCodeAt(0) - 65] = JSON.parse(options.body).values[0][0];
        return response({});
      }
      return response({ values: claims });
    }
    if (range.includes('Contacts')) {
      if (options.method === 'PUT') { updates.push(range); return response({}); }
      return response({ values: [['First Name', 'Email', 'Email Status', 'Email Shared Date', 'Template Sent'], ['Test', 'recipient@example.invalid', '', '', '']] });
    }
    if (range.includes('Email_Events')) {
      if (options.method === 'POST') { eventRows.push(JSON.parse(options.body).values[0]); return response({}); }
      return response({ values: [['Timestamp', 'Campaign ID', 'Recipient ID', 'Event (Sent/Open/Click/Bounce/Unsubscribe)',
        'URL (for clicks)', 'User Agent (if available)', 'IP (if available)', 'Meta (JSON blob)']] });
    }
    throw new Error(`Unexpected range: ${range}`);
  };
  const invoke = async (body, cookie = true, method = 'POST') => {
    const result = {};
    const res = { status(code) { result.status = code; return this; }, json(value) { result.body = value; return this; }, setHeader() {}, send(value) { result.body = value; return this; } };
    await handler({ method, query: method === 'GET' ? body : {}, headers: cookie ? { cookie: `kk_session=${createSessionToken({ username: 'fixture@example.invalid', email: 'fixture@example.invalid', role: 'Admin' })}` } : {}, body: method === 'POST' ? body : {} }, res);
    return result;
  };
  try {
    assert.equal((await invoke({ action: 'previewCampaignEmail' }, false)).status, 401);
    const preview = await invoke({ action: 'previewCampaignEmail', templateId: 'fixture-template', recipient: { firstName: 'Test' } });
    assert.equal(preview.status, 200);
    assert.match(preview.body.html, /<style>p\{color:red\}<\/style>/);
    assert.ok(!preview.body.html.includes('data:image'));
    const token = new URL(preview.body.html.match(/src="([^"]+)"/)[1].replace(/&amp;/g, '&'), 'https://example.invalid').searchParams.get('token');
    const image = await invoke({ action: 'emailTemplateImage', token }, false, 'GET');
    assert.equal(image.status, 200);
    assert.ok(Buffer.isBuffer(image.body));
    assert.equal((await invoke({ action: 'emailTemplateImage', token: `${token}broken` }, false, 'GET')).status, 403);
    const payload = { action: 'sendCampaignEmail', campaign: 'Fixture campaign', sheet: 'Contacts', rowNumber: 2, expectedEmail: 'recipient@example.invalid', templateId: 'fixture-template', subject: 'Fixture', replyTo: 'fixture@example.invalid', version: preview.body.version };
    const sent = await invoke(payload);
    assert.equal(sent.status, 200);
    assert.equal(sent.body.status, 'Accepted by Gmail');
    assert.equal(deliveries, 1);
    assert.deepEqual(updates, ["'Contacts'!C2", "'Contacts'!D2", "'Contacts'!E2"]);
    assert.equal(eventRows.length, 1);
    assert.equal(eventRows[0][1], 'Fixture campaign');
    assert.equal(eventRows[0][2], 'recipient@example.invalid');
    assert.equal(eventRows[0][3], 'ACCEPTED_BY_GMAIL');
    assert.deepEqual(JSON.parse(eventRows[0][7]), { messageId: 'fixture-gmail-id', subject: 'Fixture', templateId: 'fixture-template',
      template: 'Greeting', sentBy: 'fixture@example.invalid', recipient: 'recipient@example.invalid' });
    assert.equal((await invoke(payload)).body.skipped, true);
    assert.equal(deliveries, 1);
    assert.match((await invoke({ ...payload, expectedEmail: 'changed@example.invalid' })).body.error, /row changed/);
    const stale = await invoke({ ...payload, version: 'stale' });
    assert.equal(stale.status, 409);
    assert.match(stale.body.error, /template has changed/);
  } finally {
    globalThis.fetch = priorFetch;
    for (const name of envNames) if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
  }
});
