import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProjectRecipients } from '../api/_lib/projectRecipients.js';

const headers = ['Lead Owner', 'Email', 'CC', 'BCC', 'Project CC', 'Project BCC'];
const rows = [
  ['Manager', 'manager@example.test', 'sales@example.test', 'shared-hidden@example.test', 'sarabjeet@ridosports.com', 'project-hidden@example.test'],
  ['Updater', 'updater@example.test', '', '', 'chanchal@ridosports.com;navneet@ridosports.com', ''],
];
const data = { 'Project Manager': 'Manager', 'Client Email ID': 'client@example.test', updatedByEmail: 'updater@example.test' };

test('projects use their group and exclude shared CC/BCC lists', () => {
  assert.deepEqual(resolveProjectRecipients(headers, rows, data), {
    to: 'client@example.test',
    cc: 'manager@example.test,sarabjeet@ridosports.com,chanchal@ridosports.com,navneet@ridosports.com,updater@example.test',
    bcc: 'project-hidden@example.test', updaterEmail: 'updater@example.test',
  });
});

test('missing project columns never fall back to shared recipients', () => {
  const result = resolveProjectRecipients(headers.slice(0, 4), rows, data);
  assert.equal(result.cc, 'manager@example.test,updater@example.test');
  assert.equal(result.bcc, '');
});

test('deduplicates across recipient roles and rejects malformed addresses', () => {
  const result = resolveProjectRecipients(headers, [
    ['Manager', 'manager@example.test', '', '', 'CLIENT@example.test, bad, team@example.test; TEAM@example.test', 'team@example.test, hidden@example.test'],
  ], { ...data, updatedByEmail: 'unverified@example.test' });
  assert.equal(result.cc, 'manager@example.test,team@example.test');
  assert.equal(result.bcc, 'hidden@example.test');
  assert.equal(result.updaterEmail, '');
});

test('uses owners when no valid client exists and supports normalized headers', () => {
  const result = resolveProjectRecipients(headers.map((header) => ` ${header.toUpperCase()} `), rows,
    { 'Project Manager': 'manager', 'Client Email ID': 'invalid' });
  assert.equal(result.to, 'manager@example.test');
  assert.equal(result.cc.includes('manager@example.test'), false);
});

test('group alone does not become the primary recipient', () => {
  const result = resolveProjectRecipients(headers, rows, {});
  assert.equal(result.to, '');
});
