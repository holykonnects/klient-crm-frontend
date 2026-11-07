import test from 'node:test';
import assert from 'node:assert/strict';
import { addEmailTracking, readEmailTrackingToken } from '../api/_lib/emailTracking.js';
import { createSignedToken } from '../api/_lib/sessionAuth.js';
import { campaignPerformance } from '../src/utils/campaignMetrics.js';

test('campaign emails receive signed open and click tracking links', () => {
  let sequence = 0;
  const payloads = new Map();
  const html = addEmailTracking('<html><body><a href="https://example.com/quote?a=1&amp;b=2">Quote</a></body></html>', {
    origin: 'https://crm.example.test', campaign: 'Autumn', recipient: 'lead@example.test', subject: 'Hello', templateId: 'template-1', template: 'Greeting', sentBy: 'owner',
  }, { createToken: payload => { const token = `token-${++sequence}`; payloads.set(token, payload); return token; } });
  assert.match(html, /action=emailTrack/);
  assert.match(html, /width="1" height="1"/);
  const tokens = [...html.matchAll(/token=([^&"']+)/g)].map(match => decodeURIComponent(match[1]));
  assert.equal(tokens.length, 2);
  const click = [...payloads.values()].find(payload => payload.event === 'click');
  const open = [...payloads.values()].find(payload => payload.event === 'open');
  assert.equal(click.url, 'https://example.com/quote?a=1&b=2');
  assert.equal(open.recipient, 'lead@example.test');
});

test('tracking tokens reject unsafe click destinations', () => {
  const unsafe = createSignedToken({ type: 'email-campaign-track', event: 'click', recipient: 'lead@example.test', url: 'javascript:alert(1)' }, { secret: 'test' });
  assert.throws(() => readEmailTrackingToken(unsafe, { secret: 'test' }), /Invalid tracked link/);
});

test('campaign success uses unique recipient engagement', () => {
  const metrics = campaignPerformance([
    { campaign: 'Autumn', to: 'one@example.test', status: 'ACCEPTED_BY_GMAIL', timestamp: '2026-11-07T10:00:00Z' },
    { campaign: 'Autumn', to: 'two@example.test', status: 'ACCEPTED_BY_GMAIL', timestamp: '2026-11-07T10:00:01Z' },
    { campaign: 'Autumn', to: 'one@example.test', status: 'OPENED', timestamp: '2026-11-07T10:01:00Z' },
    { campaign: 'Autumn', to: 'one@example.test', status: 'OPENED', timestamp: '2026-11-07T10:02:00Z' },
    { campaign: 'Autumn', to: 'two@example.test', status: 'CLICKED', timestamp: '2026-11-07T10:03:00Z' },
  ])[0];
  assert.deepEqual({ accepted: metrics.accepted, opened: metrics.opened, clicked: metrics.clicked, successRate: metrics.successRate },
    { accepted: 2, opened: 1, clicked: 1, successRate: 100 });
});
