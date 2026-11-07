import test from 'node:test';
import assert from 'node:assert/strict';
import { EMAIL_INTERVAL_MS, waitForCampaign, sendWithQuotaRetry } from '../src/components/email/campaignPacing.js';
import { readEmailResponse } from '../src/components/email/emailApiResponse.js';
import { emailGoogleRead } from '../api/_lib/emailAccess.js';

test('pacing waits for the full interval and Pause cancels promptly', async () => {
  let elapsed = 0;
  assert.equal(await waitForCampaign(EMAIL_INTERVAL_MS, () => false, async ms => { elapsed += ms; }), true);
  assert.equal(elapsed, 10000);
  let paused = false;
  elapsed = 0;
  assert.equal(await waitForCampaign(60000, () => paused, async ms => { elapsed += ms; paused = true; }), false);
  assert.equal(elapsed, 500);
});

test('only explicitly safe quota responses retry, with bounded increasing waits', async () => {
  const delays = [];
  let calls = 0;
  const result = await sendWithQuotaRetry(async () => {
    calls += 1;
    if (calls < 4) throw { retryable: true, retryAfterSeconds: 60 };
    return { status: 'Accepted by Gmail' };
  }, { paused: () => false, wait: async delay => { delays.push(delay); return true; } });
  assert.equal(result.status, 'Accepted by Gmail');
  assert.deepEqual(delays, [60000, 120000, 240000]);
  calls = 0;
  await assert.rejects(sendWithQuotaRetry(async () => { calls += 1; throw Object.assign(new Error('Quota'), { retryable: true }); },
    { paused: () => false, wait: async () => true }), /Quota/);
  assert.equal(calls, 4);
  for (const message of ['Connection lost', 'Delivery could not be confirmed', 'Quota exceeded after dispatch started']) {
    calls = 0;
    await assert.rejects(sendWithQuotaRetry(async () => { calls += 1; throw new Error(message); }, { paused: () => false }), new RegExp(message));
    assert.equal(calls, 1);
  }
});

test('Pause during a quota cooldown never starts the next request', async () => {
  let calls = 0;
  const result = await sendWithQuotaRetry(async () => { calls += 1; throw { retryable: true }; },
    { paused: () => false, wait: async () => false });
  assert.equal(result, null);
  assert.equal(calls, 1);
});

test('client retains retry permission only on explicit HTTP 429 responses', async () => {
  for (const [status, retryable] of [[429, true], [429, false], [502, true]]) {
    await assert.rejects(readEmailResponse(new Response(JSON.stringify({ ok: false, error: 'Google quota', retryable, retryAfterSeconds: 60 }), { status })),
      error => error.retryable === (status === 429 && retryable) && error.status === status);
  }
});

test('quota failures stop Google identity fallback instead of amplifying requests', async () => {
  let calls = 0;
  await assert.rejects(emailGoogleRead('Sheets', 'test', async () => {
    calls += 1;
    throw Object.assign(new Error('Quota exceeded'), { googleStatus: 429 });
  }, ['first', 'second']), error => error.status === 429);
  assert.equal(calls, 1);
});
