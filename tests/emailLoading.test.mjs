import test from 'node:test';
import assert from 'node:assert/strict';
import { emailGoogleRead, emailLoginAccess } from '../api/_lib/emailAccess.js';
import { readEmailResponse } from '../src/components/email/emailApiResponse.js';
import { normalizeEmailEvents } from '../src/utils/emailEvents.js';

test('Client Comms tries configured delegation with a service-account fallback for reads', async () => {
  const identities = [];
  const result = await emailGoogleRead('Sheets', 'email logs', async auth => {
    identities.push(auth.subject);
    assert.deepEqual(auth.scopes, ['https://www.googleapis.com/auth/spreadsheets']);
    if (auth.subject) throw new Error('Caller does not have permission');
    return 'fixture logs';
  }, ['workspace@example.invalid', '']);
  assert.equal(result, 'fixture logs');
  assert.deepEqual(identities, ['workspace@example.invalid', '']);
  await assert.rejects(emailGoogleRead('Drive', 'template folder', async () => { throw new Error('Not found'); }, ['']), /template folder.*service account: Not found/);
  await assert.rejects(emailGoogleRead('Sheets', 'logs', async () => { throw new Error('Missing Google service account env vars'); }, ['']), error => error.status === 503);
});

test('email authorization accepts the same identity/header aliases as login without merging roles', () => {
  const rows = [{ Username: 'Fixture User', 'Login Email': 'fixture@example.invalid', 'User Role': 'Admin' }];
  assert.equal(emailLoginAccess(rows, 'fixture user').role, 'Admin');
  assert.equal(emailLoginAccess(rows, 'FIXTURE@example.invalid').role, 'Admin');
  assert.throws(() => emailLoginAccess([...rows, ...rows], 'fixture user'), /uniquely matched/);
  assert.throws(() => emailLoginAccess([{ Username: 'Fixture', Role: 'User', Pages: 'Leads' }], 'fixture'), /Email page access/);
  assert.equal(emailLoginAccess([{ Username: 'Fixture', Role: 'User', Pages: 'Email, Leads' }], 'fixture').pageAccess.includes('email'), true);
});

test('email clients expose the server error instead of a generic HTTP 500 or empty list', async () => {
  await assert.rejects(readEmailResponse(new Response(JSON.stringify({ ok: false, error: 'Drive denied access to email templates' }), { status: 502 })), /Drive denied access/);
  await assert.rejects(readEmailResponse(new Response('<!doctype html><html></html>')), /local native API/);
  assert.deepEqual(await readEmailResponse(new Response('{"ok":true,"data":[]}')), { ok: true, data: [] });
});

test('historic and native event headers map to readable logs, latest first', () => {
  const logs = normalizeEmailEvents([
    { Timestamp: '03/11/2026 10:00:00', To: 'old@example.invalid', Subject: 'Old', 'Email Status': 'Sent' },
    { timestamp: '04/11/2026 09:00:00', to: 'new@example.invalid', subject: 'New', templateText: 'Greeting' },
  ]);
  assert.equal(logs[0].subject, 'New');
  assert.equal(logs[1].to, 'old@example.invalid');
  assert.equal(logs[1].status, 'Sent');
  assert.ok(Number.isFinite(Date.parse(logs[0].timestamp)));
});
