/*******************************************************
 *              GLOBAL CONFIGURATION
 *******************************************************/
const EMAIL_SHEET_ID = '1Ys7WI5ar4N1C6Q3-LeAOOys9q8vd3Bx34bBetYEmxpM'; 
const TEMPLATE_FOLDER_ID = '1uKApnHOJVkOuXc7ayrxLyrkwgkjuUGt1';  // MAIN TEMPLATE FOLDER
const LEAD_SHEET_ID = '1vJbB0fmBQhd6XGTNbjUAi7Bt71lHNyau2TBMXTCdoM0';   
const LEAD_SHEET_NAME = 'Form responses 1';
const EVENTS_SHEET = 'Email_Events';
const SETTINGS_SHEET = 'Email_Settings';

/*******************************************************
 *                     doGet()
 *******************************************************/
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'getTemplates') return getTemplates();
    if (action === 'previewTemplate') return previewTemplate(e.parameter.id);
    if (action === 'openTemplate') return openTemplate(e.parameter.id);
    if (action === 'syncTemplates') return syncTemplates();
    if (action === 'getEvents') return getEvents();
    if (action === 'getLeads') return getLeads();

    return ContentService.createTextOutput("INVALID ACTION");
  } catch (err) {
    return ContentService.createTextOutput("ERROR: " + err);
  }
}

/*******************************************************
 *                     doPost()
 *******************************************************/
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'sendEmail') return sendEmail(body);
    if (action === 'createLead') return createLead(body);
    if (action === 'versionTemplate') return versionTemplate(body.templateId);

    return ContentService.createTextOutput("INVALID ACTION");
  } catch (err) {
    return ContentService.createTextOutput("ERROR: " + err);
  }
}

/*******************************************************
 *          1️⃣  TEMPLATE LISTING FROM DRIVE
 *******************************************************/
function getTemplates() {
  const folder = DriveApp.getFolderById(TEMPLATE_FOLDER_ID);
  const files = folder.getFiles();

  const templates = [];

  while (files.hasNext()) {
    const f = files.next();
    const name = f.getName();

    // skip version files like "Template.1", "Template.2"
    if (/\.([0-9]+)$/.test(name)) continue;

    templates.push({
      id: f.getId(),
      name: name,
      url: f.getUrl(),
      modifiedTime: f.getLastUpdated()
    });
  }

  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    data: templates
  }));
}

/*******************************************************
 *       2️⃣  PREVIEW TEMPLATE (HTML EXPORT)
 *******************************************************/
function previewTemplate(id) {
  try {
    const token = ScriptApp.getOAuthToken();

    const url =
      "https://www.googleapis.com/drive/v3/files/" +
      id +
      "/export?mimeType=text/html";

    const html = UrlFetchApp.fetch(url, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + token
      },
      muteHttpExceptions: true
    }).getContentText();

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, html }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


/*******************************************************
 *              3️⃣ OPEN TEMPLATE (URL)
 *******************************************************/
function openTemplate(id) {
  const f = DriveApp.getFileById(id);
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    url: f.getUrl()
  }));
}

/*******************************************************
 *         4️⃣  VERSIONING (CREATE ".1" FILES)
 *******************************************************/
function versionTemplate(templateId) {
  try {
    const original = DriveApp.getFileById(templateId);
    const folder = DriveApp.getFolderById(TEMPLATE_FOLDER_ID);
    const name = original.getName();

    // find latest version
    const files = folder.getFiles();
    let maxVersion = 0;

    while (files.hasNext()) {
      const f = files.next();
      const match = f.getName().match(new RegExp("^" + name + "\\.(\\d+)$"));
      if (match) {
        const v = parseInt(match[1]);
        if (v > maxVersion) maxVersion = v;
      }
    }

    // new version number
    const newVersion = maxVersion + 1;
    const newName = `${name}.${newVersion}`;

    const newFile = original.makeCopy(newName, folder);

    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      version: newVersion,
      fileId: newFile.getId()
    }));
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err }));
  }
}

/*******************************************************
 *           5️⃣  SEND EMAIL WITH PLACEHOLDERS
 *******************************************************/
function sendEmail(body) {
  const { to, subject, templateId, placeholders, fromEmail } = body;

  const html = exportHtml(templateId);
  const finalHtml = applyPlaceholders(html, placeholders);

  MailApp.sendEmail({
    to,
    subject,
    htmlBody: finalHtml,
    replyTo: fromEmail
  });

  logEmailEvent(to, subject, templateId, placeholders);

  return ContentService.createTextOutput("OK");
}

function exportHtml(id) {
  const url =
    "https://www.googleapis.com/drive/v3/files/" +
    id +
    "/export?mimeType=text/html";

  const token = ScriptApp.getOAuthToken();
  return UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + token }
  }).getContentText();
}

function applyPlaceholders(html, data) {
  Object.keys(data).forEach((k) => {
    html = html.replaceAll(`{{${k}}}`, data[k] || "");
  });
  return html;
}

/*******************************************************
 *                 6️⃣ LOG EMAIL EVENTS
 *******************************************************/
function logEmailEvent(to, subject, templateId, placeholders) {
  const ss = SpreadsheetApp.openById(EMAIL_SHEET_ID);
  const sh = ss.getSheetByName(EVENTS_SHEET);
  sh.appendRow([new Date(), to, subject, templateId, JSON.stringify(placeholders)]);
}

function getEvents() {
  const ss = SpreadsheetApp.openById(EMAIL_SHEET_ID);
  const sh = ss.getSheetByName(EVENTS_SHEET);
  const rows = sh.getDataRange().getValues();
  return ContentService.createTextOutput(JSON.stringify(rows));
}

/*******************************************************
 *                7️⃣ GET LEADS FOR UI
 *******************************************************/
function getLeads() {
  const ss = SpreadsheetApp.openById(LEAD_SHEET_ID);
  const sh = ss.getSheetByName(LEAD_SHEET_NAME);
  const rows = sh.getDataRange().getValues();

  const header = rows.shift();
  const leads = rows.map((r) => {
    let obj = {};
    header.forEach((h, i) => (obj[h] = r[i]));
    return obj;
  });

  return ContentService.createTextOutput(JSON.stringify(leads));
}

/*******************************************************
 *              8️⃣ CREATE NEW LEAD (Selected fields only)
 *******************************************************/
function createLead(data) {
  const ss = SpreadsheetApp.openById(LEAD_SHEET_ID);
  const sh = ss.getSheetByName(LEAD_SHEET_NAME);

  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];

  const row = header.map(h => data[h] || "");

  row[header.indexOf("Timestamp")] = new Date();

  sh.appendRow(row);

  return ContentService.createTextOutput("OK");
}
