import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../apps-script/quotations/Quotation API/Code.gs', import.meta.url), 'utf8');

test('New Template metadata writes only to the intended dynamic fields', () => {
  assert.match(source, /clientName:\s*'G11'/);
  assert.match(source, /projectName:\s*'G12'/);
  assert.match(source, /quotationNo:\s*'E10'/);
  assert.match(source, /dateISO:\s*'E9'/);
  assert.doesNotMatch(source, /clientName:\s*'E7'/);
  assert.doesNotMatch(source, /projectName:\s*'E8'/);
  assert.match(source, /restoreProtectedTemplateContent_\(sourceTemplate, template\)/);
  assert.match(source, /\['E3:L8', 'E100:L105'\]/);
});

test('athletic export uses the New Template item contract and cannot silently fall back', () => {
  assert.match(source, /Athletic quotation has no exportable items/);
  assert.doesNotMatch(source, /\(payload\.items \|\| \[\]\)\.length \? buildQuotationAndExport_\(payload\) : buildAthleticQuotationAndExport_\(payload\)/);
  assert.match(source, /new-template-v2:/);
});

test('quotation item images are refreshed and preserve their aspect ratio', () => {
  assert.match(source, /removeQuotationItemImages_\(template\)/);
  assert.match(source, /Math\.min\(maxWidth \/ sourceWidth, maxHeight \/ sourceHeight\)/);
  assert.match(source, /setAnchorCellXOffset/);
  assert.match(source, /setAnchorCellYOffset/);
});
