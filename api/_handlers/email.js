import { DRIVE_FOLDERS, SHEETS } from "../_lib/crmConfig.js";
import {
  appendValues,
  buildRow,
  driveCopyFile,
  driveExportFile,
  driveDownloadFile,
  driveGetFile,
  driveListFiles,
  formatTimestamp,
  getValues,
  getSpreadsheet,
  googleFetch,
  updateCell,
  gmailSendRawEmail,
  resolveSheetTitle,
  rowsToObjects,
} from "../_lib/googleSheets.js";
import { handleLeadPost } from "../_lib/crmHandlers.js";
import { base64Url, mimeMessage } from "../_lib/emailRenderer.js";
import { prepareTemplateEmail, selectEmailTemplateFiles, templateEmailHtml } from "../_lib/emailTemplates.js";
import { createSignedToken, requireSession, verifySignedToken } from '../_lib/sessionAuth.js';
import { campaignRecipients, campaignDispatchKey, campaignPlaceholders, dispatchCampaign, validEmail } from '../_lib/emailCampaigns.js';
import { createHash } from 'node:crypto';
import { emailGoogleRead, emailLoginAccess } from '../_lib/emailAccess.js';

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const DISPATCH_SHEET = 'CRM_Email_Dispatches';
const campaignSpreadsheetId = () => process.env.EMAIL_CAMPAIGN_SHEET_ID || SHEETS.email.spreadsheetId;
let cachedTemplate;

const emailSheetsAuth = spreadsheetId => emailGoogleRead('Sheets', `workbook ${spreadsheetId}`, async auth => {
  await getSpreadsheet(spreadsheetId, auth);
  return auth;
});

async function appendDispatchRow(row) {
  const auth = await emailSheetsAuth(campaignSpreadsheetId());
  const range = encodeURIComponent(`'${DISPATCH_SHEET}'!A:F`);
  return googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${campaignSpreadsheetId()}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [row] }),
  }, auth);
}

function previewHtml(prepared, template) {
  if (prepared.htmlBytes > 3 * 1024 * 1024) throw Object.assign(new Error('The template HTML is too large to preview. Remove unused document content and try again.'), { status: 413 });
  let html = prepared.html;
  for (const attachment of prepared.inlineAttachments) {
    const token = createSignedToken({ type: 'email-template-image', templateId: template.id, version: template.version,
      cid: attachment.cid, exp: Math.floor(Date.now() / 1000) + 1800 });
    const params = new URLSearchParams({ action: 'emailTemplateImage', token });
    html = html.replaceAll(`cid:${attachment.cid}`, `/api/email?${params.toString().replace(/&/g, '&amp;')}`);
  }
  return html;
}

async function templateImage(req, res) {
  let receipt;
  try { receipt = verifySignedToken(clean(req.query.token)); }
  catch { throw Object.assign(new Error('Template preview image has expired. Preview the template again.'), { status: 403 }); }
  if (receipt.type !== 'email-template-image') throw Object.assign(new Error('Invalid image token.'), { status: 403 });
  const template = await loadTemplate(receipt.templateId);
  if (template.version !== receipt.version) throw new Error('The template changed. Preview it again.');
  const image = prepareTemplateEmail(template.html).inlineAttachments.find(attachment => attachment.cid === receipt.cid);
  if (!image) throw new Error('Template image not found.');
  res.setHeader('Content-Type', image.contentType);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(200).send(image.body);
}

async function loadTemplate(id) {
  if (!id) throw new Error('Select an email template.');
  return emailGoogleRead('Drive', `email template ${id}`, async auth => {
  const meta = await driveGetFile(id, 'id,name,mimeType,modifiedTime,webViewLink,parents', auth);
  if (!(meta.parents || []).includes(DRIVE_FOLDERS.emailTemplates)) throw Object.assign(new Error('Select a template from the CRM email template folder.'), { status: 403 });
  if (cachedTemplate?.id === id && cachedTemplate.modifiedTime === meta.modifiedTime && cachedTemplate.expires > Date.now()) return { ...cachedTemplate, meta };
  let exported;
  if (meta.mimeType === GOOGLE_DOC_MIME) exported = await driveExportFile(id, 'text/html', auth);
  else if (meta.mimeType === 'text/html') exported = await driveDownloadFile(id, auth);
  else throw new Error('Use a Google Docs or HTML email template.');
  const html = exported.body.toString('utf8');
  const version = createHash('sha256').update(html).digest('hex');
  cachedTemplate = { id, modifiedTime: meta.modifiedTime, expires: Date.now() + 60000, html, version };
  return { ...cachedTemplate, meta };
  });
}

async function campaignSheets(user) {
  await assertCanUseEmail(user);
  const spreadsheet = await emailGoogleRead('Sheets', `campaign workbook ${campaignSpreadsheetId()}`, auth => getSpreadsheet(campaignSpreadsheetId(), auth));
  const excluded = new Set([...SHEETS.email.eventSheetNames, ...SHEETS.email.settingsSheetNames, DISPATCH_SHEET]);
  return { ok: true, data: (spreadsheet.sheets || []).map(sheet => sheet.properties?.title).filter(title => title && !excluded.has(title)) };
}

async function readCampaign(sheet, user) {
  const { data } = await campaignSheets(user);
  if (!data.includes(sheet)) throw new Error('Select a campaign sheet from the available list.');
  return campaignRecipients(await emailGoogleRead('Sheets', `campaign tab ${sheet}`, auth => getValues(campaignSpreadsheetId(), sheet, '', auth)));
}

async function ledger(create = false) {
  const id = campaignSpreadsheetId();
  const auth = await emailSheetsAuth(id);
  try { return await getValues(id, DISPATCH_SHEET, '', auth); }
  catch (error) {
    const spreadsheet = await getSpreadsheet(id, auth);
    if ((spreadsheet.sheets || []).some(sheet => sheet.properties?.title === DISPATCH_SHEET)) throw error;
    if (!create) return [];
    try {
      await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: DISPATCH_SHEET, gridProperties: { frozenRowCount: 1 } } } }] }),
      }, auth);
    } catch (creationError) {
      const current = await getSpreadsheet(id, auth);
      if (!(current.sheets || []).some(sheet => sheet.properties?.title === DISPATCH_SHEET)) throw creationError;
    }
    return getValues(id, DISPATCH_SHEET, '', auth);
  }
}

async function previewCampaign(body, user) {
  await assertCanUseEmail(user);
  const template = await loadTemplate(clean(body.templateId));
  const recipient = body.recipient || {};
  const html = templateEmailHtml(template.html, campaignPlaceholders(recipient, body.quotationLink));
  const prepared = prepareTemplateEmail(html);
  return { ok: true, html: previewHtml(prepared, template), version: template.version, htmlBytes: prepared.htmlBytes, imageBytes: prepared.imageBytes,
    missing: [...new Set(html.match(/\{\{[A-Z_]+\}\}/g) || [])] };
}

async function sendCampaign(body, session) {
  const access = await assertCanUseEmail(session.sub);
  let recipient;
  let columns;
  if (body.sheet) {
    const campaign = await readCampaign(clean(body.sheet), session.sub);
    columns = campaign.columns;
    recipient = campaign.recipients.find(row => row.rowNumber === Number(body.rowNumber));
    if (!recipient || recipient.email !== clean(body.expectedEmail).toLowerCase()) throw new Error('The campaign row changed. Refresh the recipient list before sending.');
  } else recipient = { email: clean(body.recipient?.email).toLowerCase(), firstName: clean(body.recipient?.firstName), company: clean(body.recipient?.company) };
  if (!validEmail(recipient.email)) throw new Error('Enter a valid recipient email address.');
  const subject = clean(body.subject);
  const replyTo = clean(body.replyTo || session.email || session.sub);
  if (!subject || /[\r\n]/.test(subject) || !validEmail(replyTo)) throw new Error('Enter a subject without line breaks and a valid reply-to email address.');
  const template = await loadTemplate(clean(body.templateId));
  if (!body.version || body.version !== template.version) throw new Error('The template has changed. Preview it again before sending.');
  const placeholders = campaignPlaceholders(recipient, body.quotationLink);
  const prepared = prepareTemplateEmail(templateEmailHtml(template.html, placeholders));
  const missing = prepared.html.match(/\{\{[A-Z_]+\}\}/g);
  if (missing) throw new Error(`Complete the template placeholders before sending: ${[...new Set(missing)].join(', ')}`);
  const message = mimeMessage({ to: recipient.email, subject, replyTo, ...prepared });
  if (Buffer.byteLength(message) > 28 * 1024 * 1024) throw Object.assign(new Error('The encoded email is too large. Reduce image sizes.'), { status: 413 });
  const key = campaignDispatchKey({ campaign: body.campaign, sheet: body.sheet || 'single', email: recipient.email, templateId: body.templateId });
  const initial = await ledger(true);
  if (!initial.length) await appendDispatchRow(['Dispatch Key', 'Attempt', 'Status', 'Created At', 'Gmail Message ID', 'Detail']);
  const result = await dispatchCampaign({ key,
    readClaims: () => ledger(),
    claim: row => appendDispatchRow(row),
    updateClaim: async (token, status, messageId, detail) => {
      const rows = await ledger();
      const index = rows.findIndex(row => row[1] === token);
      if (index < 0) throw new Error('Dispatch record not found.');
      const auth = await emailSheetsAuth(campaignSpreadsheetId());
      await updateCell(campaignSpreadsheetId(), DISPATCH_SHEET, index + 1, 3, status, auth);
      await updateCell(campaignSpreadsheetId(), DISPATCH_SHEET, index + 1, 5, messageId, auth);
      await updateCell(campaignSpreadsheetId(), DISPATCH_SHEET, index + 1, 6, detail, auth);
    },
    send: () => gmailSendRawEmail(base64Url(message)),
  });
  if (!result.skipped) {
    try {
      if (body.sheet) {
        const latest = await readCampaign(clean(body.sheet), session.sub);
        if (!latest.recipients.some(row => row.rowNumber === recipient.rowNumber && row.email === recipient.email)) throw new Error('Recipient moved after sending.');
        columns = latest.columns;
        const auth = await emailSheetsAuth(campaignSpreadsheetId());
        for (const [field, value] of [['status', 'Sent'], ['sentAt', formatTimestamp()], ['template', template.meta.name]]) {
          if (columns[field] >= 0) await updateCell(campaignSpreadsheetId(), body.sheet, recipient.rowNumber, columns[field] + 1, value, auth);
        }
      }
      await logEmailEvent({ Timestamp: formatTimestamp(), to: recipient.email, subject, templateId: body.templateId,
        templateText: template.meta.name, sentBy: access.user, firstName: recipient.firstName, companyName: recipient.company, status: 'SENT' });
    } catch { result.warning = [result.warning, 'Email sent, but campaign status or event logging needs review. Do not resend.'].filter(Boolean).join(' '); }
  }
  return result;
}

function json(res, status, body) {
  return res.status(status).json(body);
}

function clean(value) {
  return String(value || "").trim();
}

function requestUser(req, body = {}) {
  return clean(body.user || req.query.user || req.headers["x-kk-user"]).toLowerCase();
}

async function getLoginRows() {
  return emailGoogleRead('Sheets', 'CRM Login', async auth => {
    const sheetName = await resolveSheetTitle(SHEETS.auth.spreadsheetId, SHEETS.auth.sheetNames, auth);
    return rowsToObjects(await getValues(SHEETS.auth.spreadsheetId, sheetName, '', auth));
  });
}

async function assertCanUseEmail(userEmail) {
  const user = clean(userEmail).toLowerCase();
  if (!user) {
    const err = new Error("Please sign in to use the communication engine.");
    err.status = 401;
    throw err;
  }

  const rows = await getLoginRows();
  return emailLoginAccess(rows, user);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function listTemplates(userEmail) {
  await assertCanUseEmail(userEmail);
  const result = await emailGoogleRead('Drive', `email template folder ${DRIVE_FOLDERS.emailTemplates}`, async auth => {
    await driveGetFile(DRIVE_FOLDERS.emailTemplates, 'id,name', auth);
    return driveListFiles({
    q: `'${DRIVE_FOLDERS.emailTemplates}' in parents and trashed=false`,
    pageSize: 200,
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    }, auth);
  });
  const templates = selectEmailTemplateFiles(result.files || [])
    .map((file) => ({
      id: file.id,
      name: file.name,
      url: file.webViewLink,
      modifiedTime: file.modifiedTime,
    }));
  return { ok: true, data: templates };
}

async function previewTemplate(id, userEmail) {
  await assertCanUseEmail(userEmail);
  if (!id) throw new Error("Missing template id");
  const template = await loadTemplate(id);
  const html = templateEmailHtml(template.html);
  const prepared = prepareTemplateEmail(html);
  return { ok: true, html: previewHtml(prepared, template), htmlBytes: prepared.htmlBytes, imageBytes: prepared.imageBytes };
}

async function openTemplate(id, userEmail) {
  await assertCanUseEmail(userEmail);
  if (!id) throw new Error("Missing template id");
  const file = await driveGetFile(id);
  return { ok: true, url: file.webViewLink };
}

async function versionTemplate(templateId, userEmail) {
  await assertCanUseEmail(userEmail);
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

async function getLeads(userEmail) {
  const access = await assertCanUseEmail(userEmail);
  const sheetName = await resolveSheetTitle(SHEETS.leads.spreadsheetId, SHEETS.leads.sheetNames);
  const values = await getValues(SHEETS.leads.spreadsheetId, sheetName);
  const leads = rowsToObjects(values);
  if (clean(access.role).toLowerCase() === "admin") return leads;
  return leads.filter((lead) => clean(lead["Lead Owner"]).toLowerCase() === access.user);
}

async function getEvents(userEmail) {
  await assertCanUseEmail(userEmail);
  const values = await emailGoogleRead('Sheets', `email log workbook ${SHEETS.email.spreadsheetId}`, async auth => {
    const sheetName = await resolveSheetTitle(SHEETS.email.spreadsheetId, SHEETS.email.eventSheetNames, auth);
    return getValues(SHEETS.email.spreadsheetId, sheetName, '', auth);
  });
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
  const { auth, sheetName, values } = await emailGoogleRead('Sheets', 'email event log', async auth => {
    const sheetName = await resolveSheetTitle(SHEETS.email.spreadsheetId, SHEETS.email.eventSheetNames, auth);
    return { auth, sheetName, values: await getValues(SHEETS.email.spreadsheetId, sheetName, '1:1', auth) };
  });
  const headers = values[0] || [];
  if (!headers.length) return;
  await appendValues(SHEETS.email.spreadsheetId, sheetName, buildRow(headers, data, { timestampFields: ["Timestamp", "timestamp"] }), auth);
}

async function createLead(data, userEmail) {
  await assertCanUseEmail(userEmail);
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
      updatedByEmail: userEmail,
    },
  });
  return { ok: true, ...result };
}

async function sendEmail(body) {
  const access = await assertCanUseEmail(body.user);
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
  const { html, inlineAttachments } = prepareTemplateEmail(templateEmailHtml(exported.body.toString("utf8"), body.placeholders || {}));
  const replyTo = clean(body.fromEmail) || access.user;
  const message = mimeMessage({ to, subject, html, replyTo, inlineAttachments });
  if (Buffer.byteLength(message, 'utf8') > 28 * 1024 * 1024) {
    throw Object.assign(new Error('The email is too large after encoding. Reduce template image sizes before sending.'), { status: 413 });
  }
  const raw = base64Url(message);
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
    sentBy: access.user,
    fromEmail: replyTo,
    status: "SENT",
    error: "",
  });

  return { ok: true };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const action = clean(req.query.action);
      if (action === 'emailTemplateImage') return await templateImage(req, res);
      const userEmail = requestUser(req);
      if (action === 'getCampaignSheets' || action === 'getCampaignRecipients') {
        const session = requireSession(req);
        if (action === 'getCampaignSheets') return json(res, 200, await campaignSheets(session.sub));
        const campaign = await readCampaign(clean(req.query.sheet), session.sub);
        return json(res, 200, { ok: true, data: campaign.recipients });
      }
      if (action === "getTemplates") return json(res, 200, await listTemplates(userEmail));
      if (action === "previewTemplate") return json(res, 200, await previewTemplate(clean(req.query.id), userEmail));
      if (action === "openTemplate") return json(res, 200, await openTemplate(clean(req.query.id), userEmail));
      if (action === "getEvents" || action === "getEmailEvents") return json(res, 200, await getEvents(userEmail));
      if (action === "getLeads") return json(res, 200, await getLeads(userEmail));
      return json(res, 400, { ok: false, error: "Invalid action" });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const action = clean(body.action);
      const userEmail = requestUser(req, body);
      if (action === 'previewCampaignEmail' || action === 'sendCampaignEmail') {
        const session = requireSession(req);
        return json(res, 200, action === 'previewCampaignEmail' ? await previewCampaign(body, session.sub) : await sendCampaign(body, session));
      }
      if (action === "versionTemplate") return json(res, 200, await versionTemplate(clean(body.templateId), userEmail));
      if (action === "createLead") return json(res, 200, await createLead(body, userEmail));
      if (action === "sendEmail") return json(res, 200, await sendEmail(body));
      return json(res, 400, { ok: false, error: "Invalid action" });
    }

    return json(res, 405, { ok: false, error: "Method Not Allowed" });
  } catch (err) {
    return json(res, err.status || 500, { ok: false, error: err.message || String(err) });
  }
}
