export function updateQuotationDescriptionDraft(current, value) {
  return current ? { ...current, value } : null;
}
