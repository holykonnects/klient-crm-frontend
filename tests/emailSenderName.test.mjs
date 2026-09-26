import test from 'node:test';
import assert from 'node:assert/strict';
import { mimeMessage } from '../api/_lib/emailRenderer.js';

test('API emails use the Rido CRM sender display name', () => {
  const previous = process.env.GMAIL_SENDER_EMAIL;
  process.env.GMAIL_SENDER_EMAIL = 'crm@example.test';
  try {
    const message = mimeMessage({
      to: 'recipient@example.test',
      subject: 'Test',
      html: '<p>Test</p>',
    });
    assert.match(message, /^From: Rido CRM <crm@example\.test>$/m);
  } finally {
    if (previous === undefined) delete process.env.GMAIL_SENDER_EMAIL;
    else process.env.GMAIL_SENDER_EMAIL = previous;
  }
});
