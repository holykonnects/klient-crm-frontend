import { createHash } from 'node:crypto';
import { escapeHtml } from './emailRenderer.js';

// Template documents own their styles and layout; do not run them through the
// operational-email wrapper, which deliberately restyles tables.
export function templateEmailHtml(html, placeholders = {}) {
  return String(html || '').replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => {
    if (key === 'QUOTATION_BUTTON' && Object.prototype.hasOwnProperty.call(placeholders, 'QUOTATION_LINK')) {
      const link = String(placeholders.QUOTATION_LINK || '');
      return /^https?:\/\//i.test(link) ? `<a href="${escapeHtml(link)}">View quotation</a>` : '';
    }
    return Object.prototype.hasOwnProperty.call(placeholders, key) ? escapeHtml(String(placeholders[key] ?? '')) : match;
  });
}

export function prepareTemplateEmail(html) {
  const attachments = new Map();
  const prepared = String(html || '').replace(/(<img\b[^>]*?\bsrc\s*=\s*)(["'])(data:[\s\S]*?)\2/gi, (_, prefix, quote, src) => {
    const match = src.match(/^data:image\/(png|jpe?g|gif|webp);base64,([a-z0-9+/=\s]+)$/i);
    if (!match) throw new Error('An embedded template image is not a supported PNG, JPEG, GIF or WebP image. Replace it before sending.');
    const encoded = match[2].replace(/\s/g, '');
    const body = Buffer.from(encoded, 'base64');
    if (body.length > 3 * 1024 * 1024) throw Object.assign(new Error('An embedded image exceeds 3 MB. Resize that image before previewing or sending.'), { status: 413 });
    if (!body.length || body.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) throw new Error('An embedded template image is damaged. Replace it before sending.');
    const extension = /^jpe?g$/i.test(match[1]) ? 'jpeg' : match[1].toLowerCase();
    const cid = `template-${createHash('sha256').update(extension).update(body).digest('hex').slice(0, 24)}`;
    attachments.set(cid, { cid, filename: `${cid}.${extension}`, contentType: `image/${extension}`, body });
    return `${prefix}${quote}cid:${cid}${quote}`;
  });
  if (/data:image\//i.test(prepared)) throw new Error('The template contains an embedded background image. Use a regular image or a hosted image URL before sending.');
  const inlineAttachments = [...attachments.values()];
  const htmlBytes = Buffer.byteLength(prepared, 'utf8');
  const imageBytes = inlineAttachments.reduce((total, attachment) => total + attachment.body.length, 0);
  if (htmlBytes + imageBytes > 20 * 1024 * 1024) {
    const error = new Error('This template exceeds the CRM 20 MB message budget. Reduce the image sizes before sending.');
    error.status = 413;
    throw error;
  }
  return { html: prepared, inlineAttachments, htmlBytes, imageBytes };
}
