import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateLogin } from '../api/_lib/loginCredentials.js';
import { createLoginRequest } from '../src/utils/loginRequest.js';

const row = { Email: 'contact@example.test', 'Login Email': 'login@example.test', 'Login Username': 'member', Password: 'Secret123', Role: 'Accounts', 'Page Access': 'Costing, Expense Requests' };

test('accepts each configured identifier even when Email is populated', () => {
  for (const identity of ['contact@example.test', ' LOGIN@example.test ', 'MEMBER']) {
    const user = authenticateLogin([row], identity, 'Secret123');
    assert.equal(user.username, 'member');
    assert.equal(user.email, 'login@example.test');
    assert.deepEqual(user.pageAccess, ['Costing', 'Expense Requests']);
    assert.equal(user.Password, undefined);
  }
});
test('password comparison preserves spaces and case', () => {
  assert.ok(authenticateLogin([{ ...row, Password: ' Secret123 ' }], 'member', ' Secret123 '));
  assert.equal(authenticateLogin([{ ...row, Password: ' Secret123 ' }], 'member', 'Secret123'), null);
  assert.equal(authenticateLogin([row], 'member', 'secret123'), null);
});
test('supports normalized column headers and legacy username-only rows', () => {
  assert.equal(authenticateLogin([{ ' username ': 'member', ' login password ': 'test', ' user role ': 'Accounts' }], 'member', 'test').role, 'Accounts');
});
test('rejects incorrect, missing, or ambiguous credentials', () => {
  assert.equal(authenticateLogin([row], 'member', 'wrong'), null);
  assert.equal(authenticateLogin([row], '', 'Secret123'), null);
  assert.equal(authenticateLogin([row], 'member', ''), null);
  assert.equal(authenticateLogin([row, { ...row, 'Login Email': 'another@example.test' }], 'member', 'Secret123'), null);
});
test('duplicate submission produces one request, with no retries', async () => {
  let release, calls = 0;
  const request = createLoginRequest(async () => { calls++; await new Promise((resolve) => { release = resolve; }); return { ok: true, status: 200, json: async () => ({ success: true, username: 'member' }) }; });
  const first = request('member', 'Secret123');
  assert.equal(await request('member', 'Secret123'), null);
  release();
  assert.equal((await first).username, 'member');
  assert.equal(calls, 1);
});
test('401 remains a credential error and permits a corrected submission', async () => {
  let calls = 0;
  const request = createLoginRequest(async () => { calls++; return calls === 1 ? { ok: false, status: 401, json: async () => ({ success: false }) } : { ok: true, status: 200, json: async () => ({ success: true }) }; });
  await assert.rejects(request('member', 'wrong'), /Invalid email, username or password/);
  assert.equal((await request('member', 'Secret123')).success, true);
  assert.equal(calls, 2);
});
test('server and malformed response errors are not reported as wrong credentials', async () => {
  const server = createLoginRequest(async () => ({ ok: false, status: 500, json: async () => ({ error: 'internal details' }) }));
  await assert.rejects(server('member', 'Secret123'), /temporarily unavailable/);
  const malformed = createLoginRequest(async () => ({ ok: false, status: 502, json: async () => { throw new Error('HTML'); } }));
  await assert.rejects(malformed('member', 'Secret123'), /unexpected response/);
  const network = createLoginRequest(async () => { throw new Error('offline'); });
  await assert.rejects(network('member', 'Secret123'), /Check your connection/);
});
test('only an explicit successful response establishes login', async () => {
  const request = createLoginRequest(async () => ({ ok: true, status: 200, json: async () => ({}) }));
  await assert.rejects(request('member', 'Secret123'), /Unable to sign in/);
});
