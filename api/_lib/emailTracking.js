import { createSignedToken, verifySignedToken } from './sessionAuth.js';

const TRACKING_TTL_SECONDS = 180 * 24 * 60 * 60;

const clean = value => String(value ?? '').trim();
const htmlAttribute = value => clean(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export function emailTrackingOrigin(req, env = process.env) {
  const configured = clean(env.EMAIL_PUBLIC_BASE_URL);
  if (configured) {
    const candidate = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
    return new URL(candidate).origin;
  }
  const host = clean(req?.headers?.['x-forwarded-host'] || req?.headers?.host);
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) throw new Error('Email tracking URL is not configured.');
  const forwarded = clean(req?.headers?.['x-forwarded-proto']).toLowerCase();
  const protocol = forwarded === 'http' && /^(localhost|127\.0\.0\.1)(:|$)/i.test(host) ? 'http' : 'https';
  return `${protocol}://${host}`;
}

function trackingUrl(origin, payload, createToken) {
  const token = createToken({ type: 'email-campaign-track', ...payload,
    exp: Math.floor(Date.now() / 1000) + TRACKING_TTL_SECONDS });
  const params = new URLSearchParams({ action: 'emailTrack', token });
  return `${origin}/api/email?${params.toString()}`;
}

export function addEmailTracking(html, details, options = {}) {
  const createToken = options.createToken || createSignedToken;
  const origin = clean(details.origin).replace(/\/$/, '');
  const common = { campaign: clean(details.campaign), recipient: clean(details.recipient).toLowerCase(),
    subject: clean(details.subject), templateId: clean(details.templateId), template: clean(details.template), sentBy: clean(details.sentBy) };
  let tracked = String(html || '').replace(/(<a\b[^>]*?\shref=)(["'])(https?:\/\/[^"']+)\2/gi, (match, prefix, quote, encodedTarget) => {
    const target = encodedTarget.replace(/&amp;/gi, '&');
    const url = trackingUrl(origin, { ...common, event: 'click', url: target }, createToken);
    return `${prefix}${quote}${htmlAttribute(url)}${quote}`;
  });
  const pixel = `<img src="${htmlAttribute(trackingUrl(origin, { ...common, event: 'open' }, createToken))}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px;opacity:0" />`;
  tracked = /<\/body\s*>/i.test(tracked) ? tracked.replace(/<\/body\s*>/i, `${pixel}</body>`) : `${tracked}${pixel}`;
  return tracked;
}

export function readEmailTrackingToken(token, options = {}) {
  const receipt = verifySignedToken(token, options);
  if (receipt.type !== 'email-campaign-track' || !['open', 'click'].includes(receipt.event) || !receipt.recipient) {
    throw new Error('Invalid email tracking token');
  }
  if (receipt.event === 'click' && !/^https?:\/\//i.test(clean(receipt.url))) throw new Error('Invalid tracked link');
  return receipt;
}
