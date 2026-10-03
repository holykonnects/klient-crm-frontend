import test from 'node:test';
import assert from 'node:assert/strict';
import { filterQuotationLeads, normalizeQuotationLead, quotationMetaForLead } from '../src/utils/quotationLeadOptions.js';

const leads = [
  { value: 'Celebration Sports | Asha Rao | 9999999999', display: 'Celebration Sports | Asha Rao | 9999999999', company: 'Celebration Sports', contactName: 'Asha Rao', mobile: '9999999999', email: 'asha@example.test', leadId: 'LEAD-24', billingAddress: 'Solapur, Maharashtra', gstNumber: '27AAAAA0000A1Z5' },
  { value: 'Metro School | Ravi Shah | 8888888888', display: 'Metro School | Ravi Shah | 8888888888', company: 'Metro School', contactName: 'Ravi Shah', mobile: '8888888888', leadId: 'LEAD-25' },
];

test('quotation lead search matches company, contact, phone, email and ID with multiple terms', () => {
  assert.deepEqual(filterQuotationLeads(leads, 'celebration asha').map(lead => lead.leadId), ['LEAD-24']);
  assert.deepEqual(filterQuotationLeads(leads, '999999').map(lead => lead.leadId), ['LEAD-24']);
  assert.deepEqual(filterQuotationLeads(leads, 'asha@example').map(lead => lead.leadId), ['LEAD-24']);
  assert.deepEqual(filterQuotationLeads(leads, 'lead-25').map(lead => lead.leadId), ['LEAD-25']);
});

test('legacy lead strings remain selectable', () => {
  assert.deepEqual(normalizeQuotationLead('Example Co | Mina Das | 7777777777'), {
    value: 'Example Co | Mina Das | 7777777777', display: 'Example Co | Mina Das | 7777777777',
    company: 'Example Co', contactName: 'Mina Das', mobile: '7777777777', email: '', billingAddress: '', gstNumber: '', leadId: '',
  });
});

test('lead selection populates client name and only fills blank supporting fields', () => {
  assert.deepEqual(quotationMetaForLead(leads[0], { clientName: '', clientBillingAddress: '', clientGstNumber: '', notes: 'Keep' }), {
    clientName: 'Celebration Sports', clientBillingAddress: 'Solapur, Maharashtra', clientGstNumber: '27AAAAA0000A1Z5', notes: 'Keep',
  });
  assert.deepEqual(quotationMetaForLead(leads[0], { clientName: 'Old', clientBillingAddress: 'Manual address', clientGstNumber: 'Manual GST' }), {
    clientName: 'Celebration Sports', clientBillingAddress: 'Manual address', clientGstNumber: 'Manual GST',
  });
});
