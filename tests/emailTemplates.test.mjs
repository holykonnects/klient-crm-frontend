import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeGoogleDocEmailHtml, prepareTemplateEmail, selectEmailTemplateFiles, templateEmailHtml } from '../api/_lib/emailTemplates.js';
import { mimeMessage } from '../api/_lib/emailRenderer.js';

test('document HTML preserves stylesheet, dimensions and table styling', () => {
  const source = '<html><head><style>.c1{color:red;width:420px}</style></head><body style="background:#123456"><table class="c1" style="border:0"><tr><td>{{FIRST_NAME}}</td></tr></table></body></html>';
  const html = templateEmailHtml(source, { FIRST_NAME: '<A & B>' });
  assert.equal(html, source.replace('{{FIRST_NAME}}', '&lt;A &amp; B&gt;'));
  const prepared = prepareTemplateEmail(html).html;
  assert.match(prepared, /<style>\.c1\{color:red;width:420px\}<\/style>/);
  assert.match(prepared, /style="color: red; width: 420px; border: 0;"/);
  assert.match(prepared, /width="420"/);
  assert.ok(!prepared.includes('Rido Sports communication'));
});

test('CSS is inlined for mail clients while media queries, links and author overrides survive', () => {
  const source = '<html><head><style>.card{width:200px;color:red;padding:12px}@media(max-width:480px){.card{width:100%}}</style></head><body><table><tr><td class="card" style="color:blue"><a href="https://example.invalid/product">Product</a></td></tr></table></body></html>';
  const result = prepareTemplateEmail(source).html;
  assert.match(result, /width: 200px; padding: 12px; color: blue/);
  assert.match(result, /@media\(max-width:480px\)/);
  assert.match(result, /href="https:\/\/example.invalid\/product"/);
});

test('Google Docs page styles become an email-safe wrapper with responsive images and mobile padding', () => {
  const source = '<html><head><meta charset="utf-8"></head><body class="doc-content" style="background-color:#fafafa;max-width:468pt;padding:54pt 72pt 54pt 72pt"><img src="https://example.invalid/banner.png" style="width:856px;height:92px"><table><tr><td style="width:156pt">One</td><td style="width:156pt">Two</td><td style="width:156pt">Three</td></tr></table></body></html>';
  const normalized = normalizeGoogleDocEmailHtml(source);
  assert.match(normalized, /width="816"/);
  assert.match(normalized, /class="crm-google-doc-padding"/);
  assert.match(normalized, /padding:54pt 72pt 54pt 72pt/);
  const prepared = prepareTemplateEmail(source).html;
  assert.match(prepared, /max-width: 100%\s*!important; height: auto\s*!important/);
  assert.match(prepared, /@media only screen and \(max-width:600px\)/);
  assert.match(prepared, /max-width:\s*816px/);
  assert.match(prepared, /table-layout:\s*fixed\s*!important/);
  assert.match(prepared, /<table[^>]*style="[^"]*width:\s*100%\s*!important/);
  assert.ok(!prepared.includes('height="auto"'));
  assert.equal(normalizeGoogleDocEmailHtml('<html><body><p>Ordinary HTML</p></body></html>'), '<html><body><p>Ordinary HTML</p></body></html>');
});

test('template picker exposes canonical Docs and HTML in a stable order', () => {
  const files = [
    { id: 'copy', name: 'Copy of Diwali Template', mimeType: 'application/vnd.google-apps.document' },
    { id: 'docx', name: 'Diwali Template.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { id: 'version', name: 'Diwali Template.2', mimeType: 'application/vnd.google-apps.document' },
    { id: 'html', name: 'Athletic offer', mimeType: 'text/html' },
    { id: 'doc', name: 'Diwali Template', mimeType: 'application/vnd.google-apps.document' },
  ];
  assert.deepEqual(selectEmailTemplateFiles(files).map(file => file.id), ['html', 'doc']);
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

test('image-free HTML is base64 encoded and line-wrapped for Gmail MIME compatibility', () => {
  const html = '<html><body><p>Hello ₹ — '.repeat(100) + '</p></body></html>';
  const message = mimeMessage({ to: 'test@example.invalid', subject: 'Fixture', html });
  assert.match(message, /Content-Transfer-Encoding: base64/);
  const payload = message.split('\r\n\r\n')[1];
  assert.ok(payload.split('\r\n').every(line => line.length <= 76));
  assert.equal(Buffer.from(payload.replace(/\r\n/g, ''), 'base64').toString('utf8'), html);
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
