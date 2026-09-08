import { SHEETS } from "./crmConfig.js";
import { getValues, gmailSendRawEmail, resolveSheetTitle } from "./googleSheets.js";

const DEFAULT_CC = "Holy@klientkonnect.com,Sidhant@ridosports.com,Sandeep@ridosports.com";

function clean(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function base64Url(input) {
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
  return `<img src="${src}" alt="${alt}" style="${style}" />`;
}

function tableRows(headers, data) {
  return headers
    .filter((header) => clean(header))
    .map((header) => {
      const value = data?.[header] ?? "";
      return `<tr>
        <td style="background:#f8fbff;border:1px solid #d9e3f0;padding:9px 12px;color:#172033;font-size:12px;line-height:1.45;font-weight:700;vertical-align:top;">${escapeHtml(header)}</td>
        <td style="border:1px solid #d9e3f0;padding:9px 12px;color:#243447;font-size:12px;line-height:1.5;vertical-align:top;">${escapeHtml(value)}</td>
      </tr>`;
    })
    .join("");
}

function brandedHtml({ greeting, intro, headers, data, calendarLink = false }) {
  const ridoLogo = clean(process.env.RIDO_LOGO_URL) || assetUrl("/assets/rido-sports-logo.png");
  const kkLogo = clean(process.env.KLIENT_KONNECT_LOGO_URL) || assetUrl("/assets/kk-logo.png");
  const meetingUrl = clean(process.env.CRM_CALENDAR_URL) || `${getPublicBaseUrl()}/calendar`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:Montserrat,Arial,Helvetica,sans-serif;color:#172033;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;margin:0;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border:1px solid #e4ebf5;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:22px 28px;background:#ffffff;border-bottom:4px solid #6495ED;">
                ${ridoLogo ? logoImg(ridoLogo, "Rido Sports", "display:block;max-width:170px;max-height:64px;width:auto;height:auto;") : '<div style="font-size:20px;font-weight:700;color:#12315c;">Rido Sports</div>'}
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 24px 28px;font-size:14px;line-height:1.6;color:#172033;">
                <p style="margin:0 0 14px 0;">${escapeHtml(greeting)}</p>
                <p style="margin:0 0 18px 0;">${escapeHtml(intro)}</p>
                <table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border-spacing:0;margin:18px 0;border:1px solid #d9e3f0;background:#ffffff;">
                  ${tableRows(headers, data)}
                </table>
                ${calendarLink ? `<p style="margin:20px 0 0 0;"><a href="${escapeHtml(meetingUrl)}" target="_blank" style="display:inline-block;background:#6495ED;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:4px;font-size:13px;font-weight:700;">Schedule a Meeting</a></p>` : ""}
                <p style="margin:22px 0 0 0;">Regards,<br>Klient Konnect Team</p>
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

function mimeMessage({ to, cc, subject, html, replyTo }) {
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

async function ownerEmail(ownerName) {
  const owner = clean(ownerName);
  if (!owner) return "";
  const sheetName = await resolveSheetTitle(SHEETS.validation.spreadsheetId, SHEETS.validation.leadSheetNames);
  const values = await getValues(SHEETS.validation.spreadsheetId, sheetName);
  const [, ...rows] = values;
  const match = rows.find((row) => clean(row[0]) === owner);
  return match ? clean(match[4]) : "";
}

async function sendOperationalEmail({ owner, subject, intro, headers, data, calendarLink = false }) {
  if (String(process.env.ENABLE_OPERATIONAL_EMAILS || "true").toLowerCase() === "false") {
    return { sent: false, reason: "disabled" };
  }

  const to = await ownerEmail(owner);
  if (!to) return { sent: false, reason: "missing_owner_email" };

  const cc = process.env.OPERATIONAL_EMAIL_CC || DEFAULT_CC;
  const html = brandedHtml({
    greeting: `Hello ${owner},`,
    intro,
    headers,
    data,
    calendarLink,
  });
  const raw = base64Url(mimeMessage({ to, cc, subject, html, replyTo: process.env.OPERATIONAL_REPLY_TO || "" }));
  await gmailSendRawEmail(raw);
  return { sent: true, to, cc };
}

export async function notifyLeadSubmitted(headers, data) {
  const owner = data["Lead Owner"];
  const subject = `Lead Updated: ${clean(data["First Name"])} ${clean(data["Last Name"])} | ${clean(data["Mobile Number"])} | ${clean(data.Company)} | Source: ${clean(data["Lead Source"])}`;
  return sendOperationalEmail({
    owner,
    subject,
    intro: "A new lead form has been submitted with the following details:",
    headers,
    data,
    calendarLink: true,
  });
}

export async function notifyDealSubmitted(headers, data) {
  const owner = data["Account Owner"] || data["Lead Owner"];
  const amount = data["Deal Value"] || data["Deal Amount"] || "";
  const stage = data["Deal Stage"] || data.Stage || "";
  const subject = `New Deal Submitted: ${clean(data["Deal Name"])} | ${clean(data.Company)} | ${amount ? `₹${clean(amount)}` : ""} | Stage: ${clean(stage)}`;
  return sendOperationalEmail({
    owner,
    subject,
    intro: "A new deal form has been submitted with the following details:",
    headers,
    data,
  });
}

export async function notifyOrderSubmitted(headers, data) {
  const owner = data["Account Owner"] || data["Lead Owner"] || data.Owner;
  const subject = `Order Updated: ${clean(data["Order ID"])} | ${clean(data["Deal Name"] || data.Company)} | ${clean(data["Order Status"] || data.Status)}`;
  return sendOperationalEmail({
    owner,
    subject,
    intro: "An order record has been submitted with the following details:",
    headers,
    data,
  });
}
