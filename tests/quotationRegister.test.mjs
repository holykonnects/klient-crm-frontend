import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getSheetsAuthSubjects } from '../api/_lib/googleSheets.js';

const source = await readFile(new URL('../api/_lib/quotationRegister.js', import.meta.url), 'utf8');

test('quotation register freezes its header through valid addSheet grid properties', () => {
  assert.match(source, /properties:\s*\{\s*title:\s*sheetName,\s*gridProperties:\s*\{\s*frozenRowCount:\s*1\s*\}/);
  assert.doesNotMatch(source, /properties:\s*\{\s*title:\s*sheetName,\s*frozenRowCount:/);
});

test('quotation register carries delegated Sheets authorization through reads and writes', () => {
  assert.match(source, /getSheetsAuthSubjects\(\)/);
  assert.match(source, /getValues\(register\.spreadsheetId, register\.sheetName, "", register\.auth\)/);
  assert.match(source, /appendValues\(spreadsheetId, sheetName,[\s\S]*auth\)/);
});

test('quotation register can reuse the configured Drive delegated identity', () => {
  assert.deepEqual(getSheetsAuthSubjects({ GOOGLE_DRIVE_DELEGATED_USER_EMAIL: 'crm@ridosports.com' }), ['crm@ridosports.com', '']);
});
