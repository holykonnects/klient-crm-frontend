const clean = value => String(value ?? '').trim();

export function normalizeQuotationLead(option) {
  if (option && typeof option === 'object') {
    const contactName = clean(option.contactName || [option.firstName, option.lastName].filter(Boolean).join(' '));
    const company = clean(option.company);
    const mobile = clean(option.mobile);
    const display = clean(option.display || option.value)
      || [company, contactName, mobile].filter(Boolean).join(' | ');
    return {
      ...option,
      value: clean(option.value) || display,
      display,
      company,
      contactName,
      mobile,
      email: clean(option.email),
      billingAddress: clean(option.billingAddress),
      gstNumber: clean(option.gstNumber),
      leadId: clean(option.leadId),
      leadSourceName: clean(option.leadSourceName),
      leadSourceEmail: clean(option.leadSourceEmail),
    };
  }

  const display = clean(option);
  const [company = '', contactName = '', mobile = ''] = display.split('|').map(clean);
  return { value: display, display, company, contactName, mobile, email: '', billingAddress: '', gstNumber: '', leadId: '', leadSourceName: '', leadSourceEmail: '' };
}

export function filterQuotationLeads(options = [], inputValue = '', limit = 100) {
  const terms = clean(inputValue).toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return options.slice(0, limit);
  return options.filter(option => {
    const lead = normalizeQuotationLead(option);
    const searchable = [lead.company, lead.contactName, lead.mobile, lead.email, lead.leadId, lead.billingAddress, lead.leadSourceName, lead.leadSourceEmail]
      .join(' ')
      .toLowerCase();
    return terms.every(term => searchable.includes(term));
  }).slice(0, limit);
}

export function quotationMetaForLead(option, currentMeta = {}) {
  const lead = normalizeQuotationLead(option);
  if (!lead.value) return currentMeta;
  return {
    ...currentMeta,
    clientName: lead.company || lead.contactName || currentMeta.clientName,
    clientEmail: lead.email,
    clientBillingAddress: currentMeta.clientBillingAddress || lead.billingAddress,
    clientGstNumber: currentMeta.clientGstNumber || lead.gstNumber,
    leadSourceName: lead.leadSourceName,
    leadSourceEmail: lead.leadSourceEmail,
    preparedBy: lead.leadSourceEmail,
  };
}
