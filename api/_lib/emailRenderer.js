function clean(value) {
  return String(value || "").trim();
}

export function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function base64Url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function getPublicBaseUrl() {
  const explicit = clean(process.env.PUBLIC_APP_URL || process.env.EMAIL_ASSET_BASE_URL);
  if (explicit) return explicit.replace(/\/+$/g, "");
  const vercelUrl = clean(process.env.VERCEL_URL);
  return vercelUrl ? `https://${vercelUrl.replace(/\/+$/g, "")}` : "";
}

function assetUrl(path) {
  const base = getPublicBaseUrl();
  if (!base) return "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function logoImg(src, alt, style) {
  if (!src) return "";
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="${style}" />`;
}

function extractBodyHtml(html) {
  const text = String(html || "");
  const match = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : text;
}

function appendInlineStyle(tag, style) {
  if (/\sstyle=/i.test(tag)) {
    return tag.replace(/\sstyle=(["'])(.*?)\1/i, (match, quote, existing) => ` style=${quote}${existing};${style}${quote}`);
  }
  return tag.replace(/>$/, ` style="${style}">`);
}

export function enhanceEmailTables(html) {
  const body = extractBodyHtml(html);
  return body
    .replace(/<table\b(?![^>]*\brole=["']presentation["'])[^>]*>/gi, (tag) =>
      appendInlineStyle(
        tag,
        "width:100%;border-collapse:collapse;border-spacing:0;margin:18px 0;border:1px solid #d9e3f0;background:#ffffff;"
      )
    )
    .replace(/<th\b[^>]*>/gi, (tag) =>
      appendInlineStyle(
        tag,
        "background:#eef4ff;color:#172033;border:1px solid #d9e3f0;padding:10px 12px;text-align:left;font-size:12px;line-height:1.45;font-weight:700;vertical-align:top;"
      )
    )
    .replace(/<td\b[^>]*>/gi, (tag) =>
      appendInlineStyle(
        tag,
        "border:1px solid #d9e3f0;padding:9px 12px;color:#243447;font-size:12px;line-height:1.5;vertical-align:top;"
      )
    );
}

export function recordDetailsTable(headers, data) {
  return `<table cellspacing="0" cellpadding="0">
    ${(headers || [])
      .filter((header) => clean(header))
      .map((header) => {
        const value = data?.[header] ?? "";
        return `<tr>
          <td style="background:#f8fbff;font-weight:700;">${escapeHtml(header)}</td>
          <td>${escapeHtml(value)}</td>
        </tr>`;
      })
      .join("")}
  </table>`;
}

export function brandedEmailHtml(contentHtml, { subject = "" } = {}) {
  const ridoLogo = clean(process.env.RIDO_LOGO_URL) || assetUrl("/assets/rido-sports-logo.png");
  const kkLogo = clean(process.env.KLIENT_KONNECT_LOGO_URL) || assetUrl("/assets/kk-logo.png");
  const preheader = escapeHtml(clean(subject) || "Rido Sports communication");
  const bodyHtml = enhanceEmailTables(contentHtml);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${preheader}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:Montserrat,Arial,Helvetica,sans-serif;color:#172033;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;margin:0;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border:1px solid #e4ebf5;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:22px 28px;background:#ffffff;border-bottom:4px solid #6495ED;">
                ${ridoLogo
                  ? logoImg(ridoLogo, "Rido Sports", "display:block;max-width:170px;max-height:64px;width:auto;height:auto;")
                  : '<div style="font-size:20px;font-weight:700;color:#12315c;letter-spacing:0;">Rido Sports</div>'}
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 24px 28px;font-size:14px;line-height:1.6;color:#172033;">
                <div style="max-width:100%;overflow-wrap:break-word;word-break:normal;">
                  ${bodyHtml || ""}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 22px 28px;background:#f8fbff;border-top:1px solid #e4ebf5;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-size:11px;line-height:1.5;color:#6b7280;">Sent via Klient Konnect CRM</td>
                    <td align="right">${logoImg(kkLogo, "Klient Konnect", "display:inline-block;max-width:120px;max-height:44px;width:auto;height:auto;vertical-align:middle;")}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function mimeMessage({ to, cc = "", subject = "", html = "", replyTo = "" }) {
  const sender = clean(process.env.GMAIL_SENDER_EMAIL || process.env.GOOGLE_DELEGATED_USER_EMAIL || "");
  const headers = [
    sender ? `From: Klient Konnect CRM <${sender}>` : "",
    `To: ${to}`,
    cc ? `Cc: ${cc}` : "",
    `Subject: ${subject || ""}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
  ].filter(Boolean);
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);
  return `${headers.join("\r\n")}\r\n\r\n${html || ""}`;
}
