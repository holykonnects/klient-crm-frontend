import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { docxFrameImages, frameGoogleDocEmailHtml, normalizeGoogleDocEmailHtml, prepareTemplateEmail, selectEmailTemplateFiles, templateEmailHtml } from '../api/_lib/emailTemplates.js';
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

test('Google Docs first-page header and footer images frame the exported email body', () => {
  const zip = entries => {
    const locals = [], centrals = [];
    let offset = 0;
    for (const [name, content] of Object.entries(entries)) {
      const filename = Buffer.from(name); const body = Buffer.from(content);
      const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(body.length, 18);
      local.writeUInt32LE(body.length, 22); local.writeUInt16LE(filename.length, 26);
      locals.push(local, filename, body);
      const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
      central.writeUInt32LE(body.length, 20); central.writeUInt32LE(body.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
      centrals.push(central, filename); offset += local.length + filename.length + body.length;
    }
    const directory = Buffer.concat(centrals); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(Object.keys(entries).length, 8); end.writeUInt16LE(Object.keys(entries).length, 10);
    end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, directory, end]);
  };
  const frames = docxFrameImages(zip({
    'word/document.xml': '<w:document><w:body><w:sectPr><w:headerReference w:type="first" r:id="rFirst"/><w:headerReference w:type="default" r:id="rDefault"/><w:footerReference w:type="default" r:id="rFooter"/><w:titlePg/></w:sectPr></w:body></w:document>',
    'word/_rels/document.xml.rels': '<Relationships><Relationship Id="rFirst" Target="header1.xml"/><Relationship Id="rDefault" Target="header2.xml"/><Relationship Id="rFooter" Target="footer1.xml"/></Relationships>',
    'word/header1.xml': '<w:hdr><wp:extent cx="914400" cy="457200"/><a:blip r:embed="rId1"/></w:hdr>',
    'word/_rels/header1.xml.rels': '<Relationships><Relationship Id="rId1" Target="media/logo.png"/></Relationships>',
    'word/header2.xml': '<w:hdr><a:blip r:embed="rId3"/></w:hdr>',
    'word/_rels/header2.xml.rels': '<Relationships><Relationship Id="rId3" Target="media/repeated.png"/></Relationships>',
    'word/footer1.xml': '<w:ftr><a:blip r:embed="rId2"/></w:ftr>',
    'word/_rels/footer1.xml.rels': '<Relationships><Relationship Id="rId2" Target="media/end.png"/></Relationships>',
    'word/media/logo.png': 'a', 'word/media/end.png': 'b', 'word/media/repeated.png': 'c',
  }));
  assert.equal(frames.header.length, 1);
  assert.match(frames.header[0].src, /base64,YQ==$/);
  assert.match(frames.footer[0].src, /base64,Yg==$/);
  const framed = frameGoogleDocEmailHtml('<html><body class="doc-content"><p>Body</p></body></html>', frames);
  assert.ok(framed.indexOf('crm-doc-header') < framed.indexOf('<p>Body</p>'));
  assert.ok(framed.indexOf('crm-doc-footer') > framed.indexOf('<p>Body</p>'));
  const alreadyExported = frameGoogleDocEmailHtml('<html><body class="doc-content"><img src="data:image/png;base64,Yw==" style="width:96px;height:48px"><p>Body</p></body></html>', frames);
  assert.doesNotMatch(alreadyExported, /crm-doc-header/);
  assert.equal((alreadyExported.match(/<img\b/gi) || []).length, 2); // exported header plus the separately injected footer
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
