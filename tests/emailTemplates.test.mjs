import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareTemplateEmail, templateEmailHtml } from '../api/_lib/emailTemplates.js';
import { mimeMessage } from '../api/_lib/emailRenderer.js';

test('document HTML preserves stylesheet, dimensions and table styling', () => {
  const source = '<html><head><style>.c1{color:red;width:420px}</style></head><body style="background:#123456"><table class="c1" style="border:0"><tr><td>{{FIRST_NAME}}</td></tr></table></body></html>';
  const html = templateEmailHtml(source, { FIRST_NAME: '<A & B>' });
  assert.equal(html, source.replace('{{FIRST_NAME}}', '&lt;A &amp; B&gt;'));
  assert.equal(prepareTemplateEmail(html).html, html);
});

test('large embedded images become deduplicated inline MIME parts, not HTML body data', () => {
  const body = Buffer.alloc(450 * 1024, 42);
  const src = `data:image/png;base64,${body.toString('base64')}`;
  const input = `<style>.photo{width:400px}</style><img class="photo" src="${src}"><img src='${src}'>`;
  const prepared = prepareTemplateEmail(input);
  assert.equal(prepared.inlineAttachments.length, 1);
  assert.equal(prepared.imageBytes, body.length);
  assert.ok(prepared.htmlBytes < 300);
  assert.ok(!prepared.html.includes('data:image'));
  assert.match(prepared.html, /class="photo"/);
  assert.equal(prepared.inlineAttachments[0].body.equals(body), true);
  const message = mimeMessage({ to: 'test@example.invalid', subject: 'Fixture', ...prepared });
  assert.match(message, /Content-Type: multipart\/related/);
  assert.ok(message.includes(`Content-ID: <${prepared.inlineAttachments[0].cid}>`));
  assert.ok(message.includes(Buffer.from(prepared.html).toString('base64').slice(0, 60)));
});

test('remote images remain unchanged and damaged or unsupported embedded images fail before sending', () => {
  assert.equal(prepareTemplateEmail('<img src="https://example.invalid/photo.png">').inlineAttachments.length, 0);
  assert.throws(() => prepareTemplateEmail('<img src="data:image/png;base64,a">'), /damaged/);
  assert.throws(() => prepareTemplateEmail('<img src="data:image/svg+xml;base64,PHN2Zz4=">'), /not a supported/);
  assert.throws(() => prepareTemplateEmail('<p style="background:url(data:image/png;base64,YQ==)">Text</p>'), /background image/);
  assert.throws(() => prepareTemplateEmail('a'.repeat(20 * 1024 * 1024 + 1)), /20 MB/);
});

test('both CRM previews isolate HTML and the server send path uses the same template renderer', () => {
  const preview = readFileSync(new URL('../src/components/email/EmailHtmlPreview.jsx', import.meta.url), 'utf8');
  assert.match(preview, /sandbox=""/);
  assert.match(preview, /srcDoc=/);
  assert.match(preview, /Content-Security-Policy/);
  for (const file of ['EmailTemplatesTable.js', 'TemplatePreviewModal.jsx']) {
    const source = readFileSync(new URL(`../src/components/email/${file}`, import.meta.url), 'utf8');
    assert.match(source, /<EmailHtmlPreview/);
    assert.ok(!source.includes('dangerouslySetInnerHTML'));
  }
  const handler = readFileSync(new URL('../api/_handlers/email.js', import.meta.url), 'utf8');
  assert.ok(!handler.includes('brandedEmailHtml'));
  assert.match(handler, /prepareTemplateEmail\(templateEmailHtml/);
  assert.match(handler, /mimeMessage\(\{ to, subject, html, replyTo, inlineAttachments \}\)/);
});
