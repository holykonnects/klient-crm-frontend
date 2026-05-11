export const sanitizeMobileNumber = (value = '') =>
  String(value || '').replace(/\D/g, '');

export const formatIndiaWhatsAppNumber = (value = '') => {
  const clean = sanitizeMobileNumber(value);

  if (!clean) return '';

  if (clean.startsWith('91') && clean.length >= 12) return clean;

  if (clean.length === 10) return `91${clean}`;

  return clean;
};

export const getCallUrl = (value = '') => {
  const clean = sanitizeMobileNumber(value);
  return clean ? `tel:${clean}` : '';
};

export const getWhatsAppUrl = (value = '', message = '') => {
  const phone = formatIndiaWhatsAppNumber(value);
  if (!phone) return '';

  const text = String(message || '').trim();
  return text
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${phone}`;
};

export const copyMobileNumber = async (value = '') => {
  const text = String(value || '').trim();
  if (!text || typeof navigator === 'undefined' || !navigator.clipboard) return false;

  await navigator.clipboard.writeText(text);
  return true;
};
