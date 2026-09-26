import test from 'node:test';
import assert from 'node:assert/strict';
import { getLeadSaveMessage } from '../src/utils/leadTransferStatus.js';

test('confirms a Qualified lead was converted only after a completed transfer', () => {
  const status = getLeadSaveMessage(
    { qualifiedTransfer: { transferred: true } },
    'Qualified'
  );

  assert.equal(status.confirmed, true);
  assert.match(status.message, /converted to an Account/);
  assert.match(status.message, /Qualified Leads \(Accounts\)/);
});

test('explains when the Qualified Account already exists without claiming a new transfer', () => {
  const status = getLeadSaveMessage(
    { qualifiedTransfer: { transferred: false, reason: 'already_exists' } },
    'Qualified'
  );

  assert.equal(status.confirmed, true);
  assert.match(status.message, /already available/);
  assert.match(status.message, /no duplicate was created/);
});

test('warns when a Qualified transfer is not confirmed', () => {
  const status = getLeadSaveMessage({}, 'Qualified');

  assert.equal(status.confirmed, false);
  assert.match(status.message, /transfer was not confirmed/);
});

test('keeps the standard success message for other lead statuses', () => {
  assert.deepEqual(getLeadSaveMessage({}, 'Open', 'submitted'), {
    message: 'Lead submitted successfully.',
    confirmed: true
  });
});
