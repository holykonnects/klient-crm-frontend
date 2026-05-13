export const LINKED_CLIENT_FIELD = 'Client (Linked Deal/Account ID)';

export const getLinkedClientDisplay = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  return raw.includes('|') ? raw.split('|').slice(1).join('|').trim() : raw;
};

export const extractMobileFromLinkedClient = (value = '') => {
  const display = getLinkedClientDisplay(value);
  const match = display.match(/(?:\+?91[\s-]?)?([6-9]\d{9})\b/);
  return match ? match[1] : '';
};
