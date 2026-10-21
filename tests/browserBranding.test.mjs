import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('browser icons use square Rido assets and keep the original wordmark unchanged', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /<title>Rido CRM<\/title>/);
  assert.doesNotMatch(html, /favicon\.ico|Klient Konnect CRM/);
  for (const [rel, file, size] of [['icon', 'rido-favicon-64.png', 64], ['apple-touch-icon', 'rido-touch-icon-180.png', 180]]) {
    const href = html.match(new RegExp(`<link rel="${rel}"[^>]*href="([^"]+)"`))?.[1];
    assert.ok(href, `${rel} link is missing`);
    const path = href.replace('%PUBLIC_URL%/', '').split('?')[0];
    assert.equal(path, `assets/${file}`);
    const logo = await readFile(new URL(`../public/${path}`, import.meta.url));
    assert.deepEqual(logo.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.equal(logo.readUInt32BE(16), size);
    assert.equal(logo.readUInt32BE(20), size);
  }
  const original = await readFile(new URL('../public/assets/rido-sports-logo.png', import.meta.url));
  assert.equal(original.readUInt32BE(16), 977);
  assert.equal(original.readUInt32BE(20), 253);
});
