import { DRIVE_FOLDERS, SHEETS } from "./_lib/crmConfig.js";
import {
  appendValues,
  buildRow,
  driveCopyFile,
  driveExportFile,
  driveGetFile,
  driveListFiles,
  formatTimestamp,
  getValues,
  gmailSendRawEmail,
  resolveSheetTitle,
  rowsToObjects,
} from "./_lib/googleSheets.js";
import { handleLeadPost } from "./_lib/crmHandlers.js";

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

function json(res, status, body) {
  return res.status(status).json(body);
}

function clean(value) {
  return String(value || "").trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyPlaceholders(html, placeholders = {}) {
  let next = String(html || "");
  Object.entries(placeholders || {}).forEach(([key, value]) => {
    next = next.replaceAll(`{{${key}}}`, value == null ? "" : String(value));
  });
  return next;
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

function enhanceEmailTables(html) {
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

function brandedEmailHtml(contentHtml, { subject = "" } = {}) {
  const ridoLogo = clean(process.env.RIDO_LOGO_URL) || assetUrl("/assets/rido-sports-logo.png");
  const kkLogo = clean(process.env.KLIENT_KONNECT_LOGO_URL) || assetUrl("/assets/kk-logo.png");
  const preheader = clean(subject) || "Rido Sports communication";
  const bodyHtml = enhanceEmailTables(contentHtml);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${preheader}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;margin:0;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #e4ebf5;border-radius:8px;overflow:hidden;">
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
                    <td style="font-size:11px;line-height:1.5;color:#6b7280;">
                      Sent via Klient Konnect CRM
                    </td>
                    <td align="right">
                      ${logoImg(kkLogo, "Klient Konnect", "display:inline-block;max-width:120px;max-height:44px;width:auto;height:auto;vertical-align:middle;")}
                    </td>
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

function base64Url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function mimeMessage({ to, subject, html, replyTo }) {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject || ""}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
  ];
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);
  return `${headers.join("\r\n")}\r\n\r\n${html || ""}`;
}

async function listTemplates() {
  const result = await driveListFiles({
    q: `'${DRIVE_FOLDERS.emailTemplates}' in parents and trashed=false`,
    pageSize: 200,
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
  });
  const templates = (result.files || [])
    .filter((file) => file.mimeType !== "application/vnd.google-apps.folder")
    .filter((file) => !/\.([0-9]+)$/.test(file.name || ""))
    .map((file) => ({
      id: file.id,
      name: file.name,
      url: file.webViewLink,
      modifiedTime: file.modifiedTime,
    }));
  return { ok: true, data: templates };
}

async function previewTemplate(id) {
  if (!id) throw new Error("Missing template id");
  const exported = await driveExportFile(id, "text/html");
  return { ok: true, html: brandedEmailHtml(exported.body.toString("utf8"), { subject: "Template Preview" }) };
}

async function openTemplate(id) {
  if (!id) throw new Error("Missing template id");
  const file = await driveGetFile(id);
  return { ok: true, url: file.webViewLink };
}

async function versionTemplate(templateId) {
  if (!templateId) throw new Error("Missing templateId");
  const original = await driveGetFile(templateId);
  const baseName = original.name || "Template";
  const versions = await driveListFiles({
    q: `'${DRIVE_FOLDERS.emailTemplates}' in parents and name contains '${baseName.replace(/'/g, "\\'")}' and trashed=false`,
    pageSize: 200,
    fields: "files(id,name)",
  });
  const re = new RegExp(`^${escapeRegExp(baseName)}\\.(\\d+)$`);
  const maxVersion = (versions.files || []).reduce((max, file) => {
    const match = String(file.name || "").match(re);
    return match ? Math.max(max, Number(match[1] || 0)) : max;
  }, 0);
  const version = maxVersion + 1;
  const copy = await driveCopyFile(templateId, {
    name: `${baseName}.${version}`,
    parents: [DRIVE_FOLDERS.emailTemplates],
  });
  return { ok: true, version, fileId: copy.id, url: copy.webViewLink };
}

async function getLeads() {
  const sheetName = await resolveSheetTitle(SHEETS.leads.spreadsheetId, SHEETS.leads.sheetNames);
  const values = await getValues(SHEETS.leads.spreadsheetId, sheetName);
  return rowsToObjects(values);
}

async function getEvents() {
  const sheetName = await resolveSheetTitle(SHEETS.email.spreadsheetId, SHEETS.email.eventSheetNames);
  const values = await getValues(SHEETS.email.spreadsheetId, sheetName);
  const rows = rowsToObjects(values);
  if (rows.length) return { ok: true, data: rows };

  const [, ...bodyRows] = values;
  return {
    ok: true,
    data: bodyRows.map((row) => ({
      timestamp: row[0] || "",
      to: row[1] || "",
      subject: row[2] || "",
      templateText: row[3] || "",
      status: "SENT",
    })),
  };
}

async function logEmailEvent(data) {
  const sheetName = await resolveSheetTitle(SHEETS.email.spreadsheetId, SHEETS.email.eventSheetNames);
  const values = await getValues(SHEETS.email.spreadsheetId, sheetName, "1:1");
  const headers = values[0] || [];
  if (!headers.length) return;
  await appendValues(SHEETS.email.spreadsheetId, sheetName, buildRow(headers, data, { timestampFields: ["Timestamp", "timestamp"] }));
}

async function createLead(data) {
  const result = await handleLeadPost({
    leadsConfig: SHEETS.leads,
    accountsConfig: SHEETS.accounts,
    payload: {
      "First Name": data.firstName || data["First Name"] || "",
      Company: data.company || data.Company || "",
      "Email ID": data.email || data["Email ID"] || "",
      "Lead Source": data.leadSource || data["Lead Source"] || "Communication",
      "Lead Status": data["Lead Status"] || "New",
      Timestamp: formatTimestamp(),
    },
  });
  return { ok: true, ...result };
}

async function sendEmail(body) {
  const templateId = clean(body.templateId);
  const to = clean(body.to);
  const subject = clean(body.subject);
  if (!to) throw new Error("Missing email recipient");
  if (!templateId) throw new Error("Missing templateId");

  const templateMeta = await driveGetFile(templateId);
  if (templateMeta.mimeType !== GOOGLE_DOC_MIME) {
    throw new Error("Only Google Docs email templates can be exported as HTML.");
  }

  const exported = await driveExportFile(templateId, "text/html");
  const html = brandedEmailHtml(applyPlaceholders(exported.body.toString("utf8"), body.placeholders || {}), { subject });
  const raw = base64Url(mimeMessage({ to, subject, html, replyTo: body.fromEmail }));
  await gmailSendRawEmail(raw);

  await logEmailEvent({
    Timestamp: formatTimestamp(),
    timestamp: formatTimestamp(),
    to,
    subject,
    templateId,
    templateText: templateMeta.name,
    templateUrl: templateMeta.webViewLink,
    companyName: body.placeholders?.COMPANY || "",
    firstName: body.placeholders?.FIRST_NAME || "",
    status: "SENT",
    error: "",
  });

  return { ok: true };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const action = clean(req.query.action);
      if (action === "getTemplates") return json(res, 200, await listTemplates());
      if (action === "previewTemplate") return json(res, 200, await previewTemplate(clean(req.query.id)));
      if (action === "openTemplate") return json(res, 200, await openTemplate(clean(req.query.id)));
      if (action === "getEvents" || action === "getEmailEvents") return json(res, 200, await getEvents());
      if (action === "getLeads") return json(res, 200, await getLeads());
      return json(res, 400, { ok: false, error: "Invalid action" });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const action = clean(body.action);
      if (action === "versionTemplate") return json(res, 200, await versionTemplate(clean(body.templateId)));
      if (action === "createLead") return json(res, 200, await createLead(body));
      if (action === "sendEmail") return json(res, 200, await sendEmail(body));
      return json(res, 400, { ok: false, error: "Invalid action" });
    }

    return json(res, 405, { ok: false, error: "Method Not Allowed" });
  } catch (err) {
    return json(res, 500, { ok: false, error: err.message || String(err) });
  }
}
