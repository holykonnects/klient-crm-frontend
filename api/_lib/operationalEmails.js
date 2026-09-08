import { SHEETS } from "./crmConfig.js";
import { getValues, gmailSendRawEmail, resolveSheetTitle } from "./googleSheets.js";
import { base64Url, brandedEmailHtml, escapeHtml, mimeMessage, recordDetailsTable } from "./emailRenderer.js";

const DEFAULT_CC = "Holy@klientkonnect.com,Sidhant@ridosports.com,Sandeep@ridosports.com";

function clean(value) {
  return String(value || "").trim();
}

function getPublicBaseUrl() {
  const explicit = clean(process.env.PUBLIC_APP_URL || process.env.EMAIL_ASSET_BASE_URL);
  if (explicit) return explicit.replace(/\/+$/g, "");
  const vercelUrl = clean(process.env.VERCEL_URL);
  return vercelUrl ? `https://${vercelUrl.replace(/\/+$/g, "")}` : "";
}

function brandedHtml({ greeting, intro, subject, headers, data, calendarLink = false }) {
  const meetingUrl = clean(process.env.CRM_CALENDAR_URL) || `${getPublicBaseUrl()}/calendar`;

  const content = `
    <p style="margin:0 0 14px 0;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 18px 0;">${escapeHtml(intro)}</p>
    ${recordDetailsTable(headers, data)}
    ${calendarLink ? `<p style="margin:20px 0 0 0;"><a href="${escapeHtml(meetingUrl)}" target="_blank" style="display:inline-block;background:#6495ED;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:4px;font-size:13px;font-weight:700;">Schedule a Meeting</a></p>` : ""}
    <p style="margin:22px 0 0 0;">Regards,<br>Klient Konnect Team</p>
  `;
  return brandedEmailHtml(content, { subject });
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
  if (String(process.env.ENABLE_OPERATIONAL_EMAILS || "false").toLowerCase() !== "true") {
    return { sent: false, reason: "disabled" };
  }

  const to = await ownerEmail(owner);
  if (!to) return { sent: false, reason: "missing_owner_email" };

  const cc = process.env.OPERATIONAL_EMAIL_CC || DEFAULT_CC;
  const html = brandedHtml({
    greeting: `Hello ${owner},`,
    intro,
    subject,
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
