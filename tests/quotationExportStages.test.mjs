import test from 'node:test';
import assert from 'node:assert/strict';
import { startQuotationPdfExport, prepareQuotationPdfExport, finishQuotationPdfExport } from '../api/_lib/quotationPdfExport.js';
import { createQuotationExportReceipt, readQuotationExportReceipt } from '../api/_lib/quotationExportReceipt.js';
import { readQuotationResponse, runQuotationPdfExport } from '../src/utils/quotationRequest.js';

test('PDF stages reuse one working copy and preserve the New Template flow', async () => {
  const previous = process.env.CRM_SESSION_SECRET;
  process.env.CRM_SESSION_SECRET = 'stage-test-secret';
  try {
    const payload = { meta: { quotationTitle: 'Athletic review' }, items: [{ qty: 1, rate: 100 }] };
    const calls = [];
    const started = await startQuotationPdfExport(payload, 'review', {
      validate: async () => calls.push('images'),
      copy: async () => { calls.push('copy'); return { copy: { id: 'copy1', webViewLink: 'https://example.test/working' }, auth: { subject: 'editor@example.test' } }; },
    });
    assert.deepEqual(calls, ['images', 'copy']);
    const prepared = await prepareQuotationPdfExport(payload, started.exportToken, 'review', {
      populate: async (id, auth, value) => { assert.equal(id, 'copy1'); assert.equal(auth.subject, 'editor@example.test'); assert.deepEqual(value, payload); calls.push('populate'); return 123; },
    });
    const output = await finishQuotationPdfExport(payload, prepared.exportToken, 'review', {
      wait: async id => { assert.equal(id, 'copy1'); calls.push('wait'); },
      render: async (id, sheetId) => { assert.equal(id, 'copy1'); assert.equal(sheetId, 123); calls.push('render'); return Buffer.from('%PDF'); },
      upload: async file => { assert.equal(file.base64, Buffer.from('%PDF').toString('base64')); calls.push('upload'); return { id: 'pdf1', webViewLink: 'https://example.test/quote.pdf' }; },
    });
    assert.deepEqual(calls, ['images', 'copy', 'populate', 'wait', 'render', 'upload']);
    assert.equal(output.workingCopyUrl, started.workingCopyUrl);
    const completed = readQuotationExportReceipt(output.exportToken, payload, 'review', 'complete');
    assert.equal(completed.pdfUrl, output.pdfUrl);
    await assert.rejects(prepareQuotationPdfExport(payload, started.exportToken, 'different-user'), /invalid/);
    await assert.rejects(prepareQuotationPdfExport({ ...payload, items: [] }, started.exportToken, 'review'), /invalid/);
    await assert.rejects(finishQuotationPdfExport(payload, started.exportToken, 'review'), /invalid/);
  } finally {
    if (previous === undefined) delete process.env.CRM_SESSION_SECRET;
    else process.env.CRM_SESSION_SECRET = previous;
  }
});

test('stage receipts expire and cannot authorize a different working copy', () => {
  const payload = { items: [] };
  const options = { secret: 'receipt-secret', now: 1000 };
  const token = createQuotationExportReceipt({ phase: 'copied', fileId: 'copy1' }, payload, 'review', options);
  assert.equal(readQuotationExportReceipt(token, payload, 'review', 'copied', options).fileId, 'copy1');
  assert.throws(() => readQuotationExportReceipt(`${token}changed`, payload, 'review', 'copied', options), /Invalid signed token/);
  assert.throws(() => readQuotationExportReceipt(token, payload, 'review', 'copied', { ...options, now: 1802000 }), /expired/);
});

test('browser runs separate requests and does not retry an uncertain upload', async () => {
  const calls = [];
  const canonical = { items: [], meta: { leadSourceName: 'Resolved owner' } };
  await assert.rejects(runQuotationPdfExport({}, 'review', async body => {
    calls.push(body.action);
    if (body.action === 'startPdfExport') return { ok: true, payload: canonical, exportToken: 'start' };
    assert.deepEqual(body.payload, canonical);
    if (body.action === 'preparePdfExport') return { ok: true, exportToken: 'prepared' };
    throw new Error('Upload timed out');
  }), /Upload timed out/);
  assert.deepEqual(calls, ['startPdfExport', 'preparePdfExport', 'finishPdfExport']);
});

test('lead-link failure does not discard an already exported PDF', async () => {
  const canonical = { attach: { leadDisplay: 'Client' } };
  const result = await runQuotationPdfExport({}, 'review', async body => {
    if (body.action === 'startPdfExport') return { ok: true, payload: canonical, exportToken: 'start' };
    if (body.action === 'preparePdfExport') return { ok: true, exportToken: 'prepared' };
    if (body.action === 'finishPdfExport') return { ok: true, pdfUrl: 'https://example.test/quote.pdf', exportToken: 'done' };
    throw new Error('Lead link unavailable');
  });
  assert.equal(result.pdfUrl, 'https://example.test/quote.pdf');
  assert.match(result.linkWarning, /PDF was created/);
});

test('504 and non-JSON platform errors produce actionable messages', async () => {
  await assert.rejects(readQuotationResponse(new Response('FUNCTION_INVOCATION_TIMEOUT', { status: 504 })), /server time limit/);
  await assert.rejects(readQuotationResponse(new Response('<html>Bad gateway</html>', { status: 502 })), /unexpected response \(HTTP 502\)/);
  const response = await readQuotationResponse(new Response(JSON.stringify({ ok: false, error: 'Image access denied' }), { status: 500 }));
  assert.equal(response.error, 'Image access denied');
});
