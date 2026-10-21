import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('browser icons use the existing Rido Sports logo and tab title', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /<title>Rido CRM<\/title>/);
  assert.doesNotMatch(html, /favicon\.ico|Klient Konnect CRM/);
  for (const rel of ['icon', 'apple-touch-icon']) {
    const href = html.match(new RegExp(`<link rel="${rel}"[^>]*href="([^"]+)"`))?.[1];
    assert.ok(href, `${rel} link is missing`);
    const path = href.replace('%PUBLIC_URL%/', '').split('?')[0];
    assert.equal(path, 'assets/rido-sports-logo.png');
    const logo = await readFile(new URL(`../public/${path}`, import.meta.url));
    assert.deepEqual(logo.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
});
