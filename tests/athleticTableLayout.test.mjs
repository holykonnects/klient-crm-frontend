import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { athleticTableColumns } from '../src/utils/athleticTableLayout.js';

test('athletic columns prioritise item and description without repeating generic CRM widths', () => {
  const columns = athleticTableColumns();
  const widths = Object.fromEntries(columns.map(column => [column.key, column.width]));
  assert.equal(columns.length, 12);
  assert.equal(widths.serial, 64);
  assert.equal(widths.actions, 144);
  assert.ok(widths.description > widths.item && widths.item > widths.system && widths.system > widths.scope);
  assert.ok(athleticTableColumns({ freight: true, installation: true }).slice(-2).every(column => ['freight', 'installation'].includes(column.key)));
});

test('scoped overrides neutralise shared CRM width caps and mobile split-table layout', async () => {
  const css = await readFile(new URL('../src/components/quotation-builder.css', import.meta.url), 'utf8');
  assert.match(css, /table\.athletic-quotation-items \.MuiTableCell-root\s*\{[^}]*min-width: 0 !important;[^}]*max-width: none !important;/);
  assert.match(css, /table\.athletic-quotation-items \.MuiTableHead-root\s*\{[^}]*display: table-header-group;/);
  assert.match(css, /table\.athletic-quotation-items \.MuiTableBody-root\s*\{[^}]*display: table-row-group;/);
  const builder = await readFile(new URL('../src/components/QuotationBuilder.js', import.meta.url), 'utf8');
  assert.match(builder, /<colgroup>/);
  assert.match(builder, /column.key === 'description' \? undefined : column.width/);
});
