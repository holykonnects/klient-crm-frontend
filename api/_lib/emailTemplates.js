import { createHash } from 'node:crypto';
import { escapeHtml } from './emailRenderer.js';
import juice from 'juice';

const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';

export function selectEmailTemplateFiles(files = []) {
  return files
    .filter(file => [GOOGLE_DOC_MIME, 'text/html'].includes(file?.mimeType))
    .filter(file => !/\.([0-9]+)$/.test(String(file?.name || '')))
    .filter(file => !/^copy of\s+/i.test(String(file?.name || '')))
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' }));
}

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

function objectIds(value, target = { inline: [], positioned: [] }) {
  if (!value || typeof value !== 'object') return target;
  if (value.inlineObjectElement?.inlineObjectId) target.inline.push(value.inlineObjectElement.inlineObjectId);
  if (Array.isArray(value.positionedObjectIds)) target.positioned.push(...value.positionedObjectIds);
  for (const child of Object.values(value)) if (child && typeof child === 'object') objectIds(child, target);
  return target;
}

function embeddedObject(tab, id, kind) {
  return kind === 'inline'
    ? tab.inlineObjects?.[id]?.inlineObjectProperties?.embeddedObject
    : tab.positionedObjects?.[id]?.positionedObjectProperties?.embeddedObject;
}

export function googleDocFrameImages(document = {}) {
  const sourceTab = document.tabs?.[0]?.documentTab || document.tabs?.[0] || document;
  const style = sourceTab.documentStyle || document.documentStyle || {};
  const pick = (collection, preferred, fallback) => {
    const id = style.useFirstPageHeaderFooter ? (preferred || fallback) : fallback;
    const area = collection?.[id];
    const ids = objectIds(area?.content || area);
    return [...ids.positioned.map(objectId => [objectId, 'positioned']), ...ids.inline.map(objectId => [objectId, 'inline'])]
      .map(([objectId, kind]) => embeddedObject(sourceTab, objectId, kind))
      .filter(object => object?.imageProperties?.contentUri)
      .map(object => ({ uri: object.imageProperties.contentUri, title: object.title || object.description || '', size: object.size || {} }));
  };
  return {
    header: pick(sourceTab.headers, style.firstPageHeaderId, style.defaultHeaderId),
    footer: pick(sourceTab.footers, style.firstPageFooterId, style.defaultFooterId),
  };
}

function frameRow(images, type) {
  if (!images?.length) return '';
  const cells = images.map((image, index) => {
    const width = Math.max(1, Math.round(Number(image.size?.width?.magnitude || 144) * 4 / 3));
    const align = images.length === 1 ? (type === 'header' ? 'right' : 'center') : (index ? 'right' : 'left');
    return `<td align="${align}" valign="${type === 'header' ? 'top' : 'bottom'}" style="padding:0;line-height:0"><img src="${image.src}" alt="" width="${width}" style="display:block;width:${width}px;max-width:100%;height:auto;border:0"></td>`;
  }).join('');
  return `<table class="crm-doc-${type}" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse"><tr>${cells}</tr></table>`;
}

export function frameGoogleDocEmailHtml(html, frames = {}) {
  const header = frameRow(frames.header, 'header');
  const footer = frameRow(frames.footer, 'footer');
  if (!header && !footer) return String(html || '');
  return String(html || '').replace(/<body\b([^>]*)>([\s\S]*?)<\/body>/i,
    (_, attributes, body) => `<body${attributes}>${header}${body}${footer}</body>`);
}

function cssDeclarations(style = '') {
  return Object.fromEntries(String(style).split(';').map(part => part.split(':')).filter(parts => parts.length > 1)
    .map(([name, ...value]) => [name.trim().toLowerCase(), value.join(':').trim()]));
}

function cssPixels(value) {
  const match = String(value || '').trim().match(/^([\d.]+)(px|pt|in|cm|mm)?$/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  return amount * ({ pt: 4 / 3, in: 96, cm: 96 / 2.54, mm: 96 / 25.4 }[String(match[2] || 'px').toLowerCase()] || 1);
}

function paddingSides(value = '') {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { left: 0, right: 0 };
  if (parts.length === 1) return { left: cssPixels(parts[0]), right: cssPixels(parts[0]) };
  if (parts.length === 2 || parts.length === 3) return { left: cssPixels(parts[1]), right: cssPixels(parts[1]) };
  return { left: cssPixels(parts[3]), right: cssPixels(parts[1]) };
}

export function normalizeGoogleDocEmailHtml(html) {
  const source = String(html || '');
  const bodyMatch = source.match(/<body\b([^>]*)>([\s\S]*?)<\/body>/i);
  if (!bodyMatch || !/\bclass\s*=\s*(["'])[^"']*\bdoc-content\b[^"']*\1/i.test(bodyMatch[1])) return source;
  const styleMatch = bodyMatch[1].match(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i);
  const declarations = cssDeclarations(styleMatch?.[2]);
  const padding = declarations.padding || '0';
  const sides = paddingSides(padding);
  const contentWidth = cssPixels(declarations['max-width']) || 624;
  const documentWidth = Math.max(320, Math.round(contentWidth + sides.left + sides.right));
  const bodyAttributes = bodyMatch[1].replace(/\s*style\s*=\s*(["'])[\s\S]*?\1/i, '');
  const background = declarations['background-color'] || '#ffffff';
  const compatibility = `<style>
    .crm-google-doc-content img{max-width:100%!important;height:auto!important}
    .crm-google-doc-content table{width:100%!important;max-width:100%!important;table-layout:fixed!important}
    @media only screen and (max-width:600px){.crm-google-doc-padding{padding:24px 16px!important}}
  </style>`;
  const wrapped = `<body${bodyAttributes} style="margin:0;background-color:${background}">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background-color:${background}"><tr><td align="center">
      <table role="presentation" width="${documentWidth}" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:${documentWidth}px;border-collapse:collapse"><tr>
        <td class="crm-google-doc-padding" style="padding:${padding};background-color:${background}"><div class="crm-google-doc-content">${bodyMatch[2]}</div></td>
      </tr></table>
    </td></tr></table>
  </body>`;
  const withCss = /<\/head>/i.test(source) ? source.replace(/<\/head>/i, `${compatibility}</head>`) : `${compatibility}${source}`;
  return withCss.replace(bodyMatch[0], wrapped);
}

export function prepareTemplateEmail(html) {
  const attachments = new Map();
  const prepared = normalizeGoogleDocEmailHtml(html).replace(/(<img\b[^>]*?\bsrc\s*=\s*)(["'])(data:[\s\S]*?)\2/gi, (_, prefix, quote, src) => {
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
  const compatibleHtml = juice(prepared, { removeStyleTags: false, preserveMediaQueries: true,
    preserveFontFaces: true, preserveImportant: true, inlinePseudoElements: false })
    .replace(/\sheight=(["'])auto\1/gi, '');
  const compatibleBytes = Buffer.byteLength(compatibleHtml, 'utf8');
  if (compatibleBytes + imageBytes > 20 * 1024 * 1024) throw Object.assign(new Error('This template exceeds the 20 MB message budget after CSS preparation.'), { status: 413 });
  return { html: compatibleHtml, inlineAttachments, htmlBytes: compatibleBytes, imageBytes };
}
