const clean = value => String(value ?? '').trim();

export function hasQuotationAuthorOverride(meta = {}) {
  if (typeof meta.preparedByEdited === 'boolean') return meta.preparedByEdited;
  // Older drafts did not record whether this field was edited.
  return Boolean(clean(meta.preparedBy)) && clean(meta.preparedBy).toLowerCase() !== clean(meta.leadSourceEmail).toLowerCase();
}

export function quotationGeneratedByEmail(meta = {}) {
  return hasQuotationAuthorOverride(meta) ? clean(meta.preparedBy) : clean(meta.leadSourceEmail) || clean(meta.preparedBy);
}

export function refreshQuotationAuthor(meta = {}, identity = {}) {
  return {
    ...meta,
    preparedBy: hasQuotationAuthorOverride(meta) ? meta.preparedBy : clean(identity.email),
    leadSourceName: clean(identity.name),
    leadSourceEmail: clean(identity.email),
  };
}
