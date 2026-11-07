import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL(`../src/components/email/${name}`, import.meta.url), 'utf8');

test('client comms sender uses a full-screen mobile workflow with recipient cards', () => {
  const sender = source('BulkEmailSender.jsx');
  assert.match(sender, /fullScreen=\{isMobile\}/);
  assert.match(sender, /display:\s*\{ xs: 'grid', sm: 'none' \}/);
  assert.match(sender, /display:\s*\{ xs: 'none', sm: 'block' \}/);
  assert.match(sender, /toggleRecipient/);
  assert.match(sender, /selectFilteredRecipients/);
  assert.match(sender, /Select all/);
  assert.match(sender, /selected`/);
  assert.match(sender, /position:\s*\{ xs: 'sticky', sm: 'static' \}/);
});

test('client comms dashboard, templates, logs and previews have dedicated mobile layouts', () => {
  const dashboard = source('EmailDashboard.js');
  const templates = source('EmailTemplatesTable.js');
  const logs = source('EmailLogsTable.js');
  const preview = source('EmailHtmlPreview.jsx');
  assert.match(dashboard, /width:\s*\{ xs: '100%', sm: 250 \}/);
  assert.match(templates, /isMobile \? <Stack/);
  assert.match(logs, /filtered\.length > 0 && isMobile/);
  assert.match(logs, /filtered\.length > 0 && !isMobile/);
  assert.match(preview, /height:\s*\{ xs: '52vh', sm: '60vh', lg: '65vh' \}/);
});
