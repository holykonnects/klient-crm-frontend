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
  return { ok: true, html: exported.body.toString("utf8") };
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

  const preview = await previewTemplate(templateId);
  const html = applyPlaceholders(preview.html, body.placeholders || {});
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
