import { quotationGeneratedByEmail } from '../../src/utils/quotationAuthor.js';

export function quotationSignoffText(value, meta = {}) {
  const text = String(value ?? '');
  const match = /(?:warm|best)\s+regards\s*[,,:]?/i.exec(text);
  if (!match) return text;
  const email = quotationGeneratedByEmail(meta);
  return `${text.slice(0, match.index)}Warm Regards,\n${meta.leadSourceName || 'Team Rido'}${email ? `\n${email}` : ''}`;
}
