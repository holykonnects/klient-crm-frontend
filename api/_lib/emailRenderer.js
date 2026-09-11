import fs from "fs";
import path from "path";

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

function localAssetPath(assetName) {
  return path.join(process.cwd(), "public", "assets", assetName);
}

function localAssetExists(assetName) {
  try {
    return fs.existsSync(localAssetPath(assetName));
  } catch {
    return false;
  }
}

function logoSrc(envName, assetName, cid) {
  const explicit = clean(process.env[envName]);
  if (explicit) return explicit;
  if (localAssetExists(assetName)) return `cid:${cid}`;
  return assetUrl(`/assets/${assetName}`);
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

export function recordDetailsCards(headers, data, { limit = 0 } = {}) {
  const populated = (headers || []).filter((header) => clean(header) && clean(data?.[header]));
  const selected = limit > 0 ? populated.slice(0, limit) : populated;
  return `<div style="width:100%;margin:16px 0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    ${selected.map((header) => detailCardRow(header, data?.[header])).join("")}
  </div>`;
}

export function changedFieldsCards(headers, previousData, data) {
  const ignored = new Set(["Timestamp", "Notification Status", "Prefilled Link"]);
  const changed = (headers || []).filter((header) =>
    clean(header) && !ignored.has(header) && clean(previousData?.[header]) !== clean(data?.[header])
  );
  if (!changed.length) {
    return '<div style="padding:14px 16px;border:1px solid #dbe4f0;border-radius:10px;background:#f9fbff;color:#4b5563;">No field-level changes were detected.</div>';
  }
  return `<div style="width:100%;margin:14px 0;">
    ${changed.map((header) => `<div style="margin:0 0 10px;border:1px solid #dbe4f0;border-radius:10px;overflow:hidden;">
      <div style="padding:9px 12px;background:#eaf3ff;color:#172033;font-size:12px;font-weight:700;">${escapeHtml(header)}</div>
      <div style="padding:10px 12px;font-size:12px;line-height:1.5;"><span style="display:block;color:#6b7280;font-size:10px;text-transform:uppercase;">Previous</span>${emailValue(previousData?.[header])}</div>
      <div style="padding:10px 12px;border-top:1px solid #eef2f7;font-size:12px;line-height:1.5;"><span style="display:block;color:#6b7280;font-size:10px;text-transform:uppercase;">Updated</span>${emailValue(data?.[header])}</div>
    </div>`).join("")}
  </div>`;
}

function detailCardRow(label, value) {
  return `<div style="padding:10px 12px;border-bottom:1px solid #e2e8f0;background:#ffffff;overflow-wrap:anywhere;">
    <div style="margin-bottom:3px;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">${escapeHtml(label)}</div>
    <div style="color:#172033;font-size:12px;line-height:1.5;">${emailValue(value)}</div>
  </div>`;
}

function emailValue(value) {
  const text = clean(value);
  if (/^https?:\/\//i.test(text)) {
    return `<a href="${escapeHtml(text)}" target="_blank" style="color:#2563eb;text-decoration:none;word-break:break-all;">Open link</a>`;
  }
  return escapeHtml(text) || '<span style="color:#9ca3af;">—</span>';
}

export function brandedEmailHtml(contentHtml, { subject = "" } = {}) {
  const ridoLogo = logoSrc("RIDO_LOGO_URL", "rido-sports-logo.png", "rido-logo");
  const kkLogo = logoSrc("KLIENT_KONNECT_LOGO_URL", "kk-logo.png", "kk-logo");
  const preheader = escapeHtml(clean(subject) || "Rido Sports communication");
  const bodyHtml = enhanceEmailTables(contentHtml);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${preheader}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:Montserrat,Arial,Helvetica,sans-serif;color:#172033;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;margin:0;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border:1px solid #e4ebf5;border-radius:8px;overflow:hidden;">
            <tr>
              <td bgcolor="#ffffff" style="padding:18px 24px;background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);border-bottom:4px solid #6495ED;">
                <table role="presentation" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);border:1px solid #e4ebf5;border-radius:8px;">
                  <tr><td bgcolor="#ffffff" style="padding:10px 14px;background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);">
                    ${ridoLogo
                      ? logoImg(ridoLogo, "Rido Sports", "display:block;max-width:170px;max-height:64px;width:auto;height:auto;color:#12315c;")
                      : '<div style="font-size:20px;font-weight:700;color:#12315c;letter-spacing:0;">Rido Sports</div>'}
                  </td></tr>
                </table>
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

export function mimeMessage({ to, cc = "", bcc = "", subject = "", html = "", replyTo = "", fromName = "Klient Konnect CRM" }) {
  const sender = clean(process.env.GMAIL_SENDER_EMAIL || process.env.GOOGLE_DELEGATED_USER_EMAIL || "");
  const attachments = inlineLogoAttachments(html);
  const headers = [
    sender ? `From: ${clean(fromName) || "Klient Konnect CRM"} <${sender}>` : "",
    `To: ${to}`,
    cc ? `Cc: ${cc}` : "",
    bcc ? `Bcc: ${bcc}` : "",
    `Subject: ${subject || ""}`,
    "MIME-Version: 1.0",
  ].filter(Boolean);
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);

  if (!attachments.length) {
    headers.push("Content-Type: text/html; charset=UTF-8");
    return `${headers.join("\r\n")}\r\n\r\n${html || ""}`;
  }

  const boundary = `kk_related_${Date.now().toString(36)}`;
  headers.push(`Content-Type: multipart/related; boundary="${boundary}"`);

  const parts = [
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Mime(html || ""),
    ...attachments.flatMap((attachment) => [
      `--${boundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-ID: <${attachment.cid}>`,
      `Content-Location: ${attachment.filename}`,
      `X-Attachment-Id: ${attachment.cid}`,
      `Content-Disposition: inline; filename="${attachment.filename}"`,
      "",
      attachment.content,
    ]),
    `--${boundary}--`,
  ];

  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`;
}

function inlineLogoAttachments(html) {
  const specs = [
    { cid: "rido-logo", filename: "rido-sports-logo.png", contentType: "image/png" },
    { cid: "kk-logo", filename: "kk-logo.png", contentType: "image/png" },
  ];

  return specs
    .filter((spec) => String(html || "").includes(`cid:${spec.cid}`))
    .map((spec) => {
      try {
        const body = fs.readFileSync(localAssetPath(spec.filename));
        return {
          ...spec,
          content: base64Mime(body),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function base64Mime(input) {
  return Buffer.from(input).toString("base64").replace(/(.{76})/g, "$1\r\n");
}
