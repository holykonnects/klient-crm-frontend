import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getSheetsAuthSubjects } from '../api/_lib/googleSheets.js';

const source = await readFile(new URL('../api/_lib/quotationRegister.js', import.meta.url), 'utf8');
const handlerSource = await readFile(new URL('../api/_handlers/quotations.js', import.meta.url), 'utf8');

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

test('Sheets tries every configured delegated editor and removes repeated identities', () => {
  assert.deepEqual(getSheetsAuthSubjects({
    GOOGLE_SHEETS_DELEGATED_USER_EMAIL: ' blocked@example.com ',
    GOOGLE_DELEGATED_USER_EMAIL: 'editor@example.com',
    GOOGLE_DRIVE_DELEGATED_USER_EMAIL: 'EDITOR@example.com',
    GMAIL_SENDER_EMAIL: 'sender@example.com',
  }), ['blocked@example.com', 'editor@example.com', 'sender@example.com', '']);
});

test('an unavailable quotation register returns a non-500 browser fallback response', () => {
  assert.match(handlerSource, /res\.status\(200\)\.json\(\{ ok: false, registerUnavailable: true/);
});
