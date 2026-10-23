import test from 'node:test';
import assert from 'node:assert/strict';
import { updateQuotationDescriptionDraft } from '../src/utils/quotationDescriptionDraft.js';
import { athleticItemReferences } from '../src/components/athleticSpecificationReference.js';

test('delayed rich text callbacks cannot reopen a closed description editor', () => {
  assert.equal(updateQuotationDescriptionDraft(null, ''), null);
  assert.equal(updateQuotationDescriptionDraft(null, '<p>late update</p>'), null);
  const draft = { rowIndex: 3, value: '<p>Original</p>' };
  assert.deepEqual(updateQuotationDescriptionDraft(draft, '<p>Edit</p>'), { rowIndex: 3, value: '<p>Edit</p>' });
  assert.equal(draft.value, '<p>Original</p>');
});

test('row references are limited to the relevant element and do not assume unrelated defaults', () => {
  assert.equal(athleticItemReferences({ libraryItem: 'GSB compacted thickness' })[0][1], 'GSB - granular sub-base');
  assert.equal(athleticItemReferences({ libraryItem: 'WMM' })[0][1], 'WMM - wet mix macadam');
  assert.equal(athleticItemReferences({ libraryItem: 'Sandwich System' }).length, 1);
  assert.deepEqual(athleticItemReferences({ libraryItem: 'Manual equipment item' }), []);
});
