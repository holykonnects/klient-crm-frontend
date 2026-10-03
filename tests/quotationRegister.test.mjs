import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../api/_lib/quotationRegister.js', import.meta.url), 'utf8');

test('quotation register freezes its header through valid addSheet grid properties', () => {
  assert.match(source, /properties:\s*\{\s*title:\s*sheetName,\s*gridProperties:\s*\{\s*frozenRowCount:\s*1\s*\}/);
  assert.doesNotMatch(source, /properties:\s*\{\s*title:\s*sheetName,\s*frozenRowCount:/);
});
