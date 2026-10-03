import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLeadSourceIdentity } from '../api/_lib/leadSourceIdentity.js';

test('lead source identity resolves the display name and email from CRM Login', () => {
  const rows = [{ 'Lead Owner': 'Asha Rao', Email: 'asha@ridosports.com' }];
  assert.deepEqual(resolveLeadSourceIdentity('Asha Rao', rows), {
    name: 'Asha Rao', email: 'asha@ridosports.com',
  });
});

test('lead source identity retains a source even when no CRM Login email exists', () => {
  assert.deepEqual(resolveLeadSourceIdentity('Website', []), { name: 'Website', email: '' });
  assert.deepEqual(resolveLeadSourceIdentity('quotes@ridosports.com', []), {
    name: 'quotes@ridosports.com', email: 'quotes@ridosports.com',
  });
});
