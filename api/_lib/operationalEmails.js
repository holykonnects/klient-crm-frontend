import { SHEETS } from "./crmConfig.js";
import { getValues, gmailSendRawEmail, resolveSheetTitle } from "./googleSheets.js";
import { base64Url, brandedEmailHtml, changedFieldsCards, escapeHtml, mimeMessage, recordDetailsCards, recordDetailsTable } from "./emailRenderer.js";

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

function brandedHtml({ greeting, intro, subject, headers, data, previousData = null, calendarLink = false, actionUrl = "", actionLabel = "" }) {
  const meetingUrl = clean(process.env.CRM_CALENDAR_URL) || `${getPublicBaseUrl()}/calendar`;

  const content = `
    <p style="margin:0 0 14px 0;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 18px 0;">${escapeHtml(intro)}</p>
    ${clean(data?.updatedByEmail) ? `<p style="margin:0 0 18px 0;font-size:13px;color:#4b5563;"><strong>Updated by:</strong> ${escapeHtml(data.updatedByName || data.updatedByEmail)} (${escapeHtml(data.updatedByEmail)})</p>` : ""}
    ${previousData ? `<div style="font-size:15px;font-weight:700;margin:20px 0 8px;">What changed</div>${changedFieldsCards(headers, previousData, data)}<div style="font-size:15px;font-weight:700;margin:20px 0 8px;">Current snapshot</div>${recordDetailsCards(priorityHeaders(headers, data), data, { limit: 8 })}` : recordDetailsCards(headers, data)}
    ${actionUrl ? `<p style="margin:20px 0 0 0;"><a href="${escapeHtml(actionUrl)}" target="_blank" style="display:inline-block;background:#12315c;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:4px;font-size:13px;font-weight:700;">${escapeHtml(actionLabel || "Open Link")}</a></p>` : ""}
    ${calendarLink ? `<p style="margin:20px 0 0 0;"><a href="${escapeHtml(meetingUrl)}" target="_blank" style="display:inline-block;background:#6495ED;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:4px;font-size:13px;font-weight:700;">Schedule a Meeting</a></p>` : ""}
    <p style="margin:22px 0 0 0;">Regards,<br>Klient Konnect Team</p>
  `;
  return brandedEmailHtml(content, { subject });
}

function priorityHeaders(headers, data) {
  const preferred = ["Lead ID", "Account ID", "Deal ID", "Order ID", "Company", "First Name", "Last Name", "Deal Name", "Lead Status", "Stage", "Deal Stage", "Order Status", "Lead Owner", "Account Owner"];
  const available = new Set(headers || []);
  return [...preferred.filter((header) => available.has(header) && clean(data?.[header])), ...(headers || []).filter((header) => !preferred.includes(header))];
}

export async function ownerEmail(ownerName) {
  const owner = clean(ownerName);
  if (!owner) return "";
  const sheetName = await resolveSheetTitle(SHEETS.validation.spreadsheetId, SHEETS.validation.leadSheetNames);
  const values = await getValues(SHEETS.validation.spreadsheetId, sheetName);
  const [, ...rows] = values;
  const match = rows.find((row) => clean(row[0]) === owner);
  return match ? clean(match[4]) : "";
}

async function validatedUpdaterEmail(data) {
  const submitted = clean(data?.updatedByEmail).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitted)) return "";
  const sheetName = await resolveSheetTitle(SHEETS.validation.spreadsheetId, SHEETS.validation.leadSheetNames);
  const values = await getValues(SHEETS.validation.spreadsheetId, sheetName);
  const [headers = [], ...rows] = values;
  const emailIndex = findHeader(headers, "Email");
  if (emailIndex < 0) return "";
  const match = rows.find((row) => clean(row[emailIndex]).toLowerCase() === submitted);
  return match ? clean(match[emailIndex]) : "";
}

async function sendOperationalEmail({ owner, subject, intro, headers, data, previousData = null, calendarLink = false, cc: ccOverride = "" }) {
  if (String(process.env.ENABLE_OPERATIONAL_EMAILS || "false").toLowerCase() !== "true") {
    return { sent: false, reason: "disabled" };
  }

  const to = await ownerEmail(owner);
  if (!to) return { sent: false, reason: "missing_owner_email" };

  const updaterEmail = await validatedUpdaterEmail(data);
  const cc = uniqueEmails([
    ...splitEmails(ccOverride || process.env.OPERATIONAL_EMAIL_CC || DEFAULT_CC),
    updaterEmail,
  ]).filter((email) => email.toLowerCase() !== to.toLowerCase()).join(",");
  const html = brandedHtml({
    greeting: `Hello ${owner},`,
    intro,
    subject,
    headers,
    data: {
      ...data,
      updatedByName: updaterEmail ? data.updatedByName : "",
      updatedByEmail: updaterEmail,
    },
    previousData,
    calendarLink,
  });
  const raw = base64Url(mimeMessage({ to, cc, subject, html, replyTo: process.env.OPERATIONAL_REPLY_TO || "" }));
  await gmailSendRawEmail(raw);
  return { sent: true, to, cc };
}

async function sendDirectOperationalEmail({ to, cc, subject, greeting = "Hello Team,", intro, headers, data, calendarLink = false, actionUrl = "", actionLabel = "" }) {
  if (String(process.env.ENABLE_OPERATIONAL_EMAILS || "false").toLowerCase() !== "true") {
    return { sent: false, reason: "disabled" };
  }
  if (!clean(to)) return { sent: false, reason: "missing_recipient" };

  const updaterEmail = await validatedUpdaterEmail(data);
  const toKeys = new Set(splitEmails(to).map((email) => email.toLowerCase()));
  const resolvedCc = uniqueEmails([...splitEmails(cc), updaterEmail])
    .filter((email) => !toKeys.has(email.toLowerCase()))
    .join(",");

  const html = brandedHtml({
    greeting,
    intro,
    subject,
    headers,
    data: {
      ...data,
      updatedByName: updaterEmail ? data.updatedByName : "",
      updatedByEmail: updaterEmail,
    },
    calendarLink,
    actionUrl,
    actionLabel,
  });
  const raw = base64Url(mimeMessage({ to, cc: resolvedCc, subject, html, replyTo: process.env.OPERATIONAL_REPLY_TO || "" }));
  await gmailSendRawEmail(raw);
  return { sent: true, to, cc: resolvedCc };
}

export async function notifyLeadSubmitted(headers, data, previousData = null) {
  const owner = data["Lead Owner"];
  const subject = `Lead Updated: ${clean(data["First Name"])} ${clean(data["Last Name"])} | ${clean(data["Mobile Number"])} | ${clean(data.Company)} | Source: ${clean(data["Lead Source"])}`;
  return sendOperationalEmail({
    owner,
    subject,
    intro: previousData ? "A lead record has been updated. The changes are shown below:" : "A new lead form has been submitted with the following details:",
    headers,
    data,
    previousData,
    calendarLink: true,
  });
}

export async function notifyAccountSubmitted(headers, data, previousData = null) {
  const owner = data["Account Owner"] || data["Lead Owner"];
  const subject = `New/Updated Account Notification: ${clean(data.Company)}`;
  return sendOperationalEmail({
    owner,
    subject,
    intro: "A new or updated account record is available:",
    headers,
    data,
    previousData,
    calendarLink: true,
  });
}

export async function notifyProjectSubmitted(headers, data, historyRows = []) {
  if (String(process.env.ENABLE_OPERATIONAL_EMAILS || "false").toLowerCase() !== "true") {
    return { sent: false, reason: "disabled" };
  }

  const projectId = clean(data["Project ID (unique, auto-generated)"]);
  const previousProject = historyRows
    .slice(0, -1)
    .reverse()
    .find((row) => clean(row["Project ID (unique, auto-generated)"]) === projectId);
  if (previousProject && !hasMaterialChanges(headers, previousProject, data)) {
    return { sent: false, reason: "no_material_changes" };
  }

  const validationSheet = await resolveSheetTitle(SHEETS.validation.spreadsheetId, SHEETS.validation.leadSheetNames);
  const validationValues = await getValues(SHEETS.validation.spreadsheetId, validationSheet);
  const [validationHeaders = [], ...validationRows] = validationValues;
  const ownerIndex = findHeader(validationHeaders, "Lead Owner");
  const emailIndex = findHeader(validationHeaders, "Email");
  const ccIndex = findHeader(validationHeaders, "CC");
  const bccIndex = findHeader(validationHeaders, "BCC");
  const wantedOwners = new Set(
    [data["Project Manager"], data["Account Owner"], data["Lead Owner"], data.Owner]
      .map((value) => clean(value).toLowerCase())
      .filter(Boolean)
  );
  const ownerRecipients = validationRows
    .filter((row) => wantedOwners.has(clean(row[ownerIndex]).toLowerCase()))
    .map((row) => clean(row[emailIndex]));
  const clientRecipients = splitEmails(data["Client Email ID"]);
  const submittedUpdater = clean(data.updatedByEmail).toLowerCase();
  const updaterEmail = validationRows
    .map((row) => clean(row[emailIndex]))
    .find((email) => email.toLowerCase() === submittedUpdater) || "";
  const ccRecipients = validationRows.map((row) => clean(row[ccIndex]));
  const bccRecipients = validationRows.map((row) => clean(row[bccIndex]));
  const toList = uniqueEmails(clientRecipients.length ? clientRecipients : ownerRecipients);
  const toKeys = new Set(toList.map((email) => email.toLowerCase()));
  const to = toList.join(",");
  const cc = uniqueEmails([...ownerRecipients, ...ccRecipients, updaterEmail])
    .filter((email) => !toKeys.has(email.toLowerCase()))
    .join(",");
  const bcc = uniqueEmails(bccRecipients).join(",");
  if (!to) return { sent: false, reason: "missing_recipient" };

  const projectName = clean(data["Project Name"]) || "Untitled Project";
  const excluded = new Set([
    "Vendors", "Timestamp", "Task Name", "Task Owner", "Start Date", "End Date", "Budget (₹)",
    "Actual Cost (₹)", "Variance (₹)", "PO Link", "Invoice Link", "Payment Receipt Link",
    "Other Documents", "Assigned Team", "Task Status", "Project Manager",
  ]);
  const historyHtml = historyRows
    .slice()
    .reverse()
    .map((row, index) => `<div style="margin:0 0 14px;border:1px solid #dbe4f0;border-radius:10px;overflow:hidden;">
      <div style="padding:10px 12px;background:${index === 0 ? "#eaf3ff" : "#f8fafc"};font-weight:700;">${index === 0 ? "Latest Update" : "Previous Update"} — ${escapeHtml(row.Timestamp)}</div>
      <div style="padding:2px 12px 10px;">${recordDetailsTable(headers.filter((header) => !excluded.has(header)), row)}</div>
    </div>`)
    .join("");
  const content = `
    <div style="margin:0 0 20px;background:#6495ED;border-radius:10px;padding:18px 20px;color:#ffffff;">
      <div style="font-size:20px;font-weight:700;line-height:1.3;">Rido Sport Project Update</div>
      <div style="font-size:13px;line-height:1.5;margin-top:4px;">${escapeHtml(projectName)}</div>
    </div>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">A project entry was <strong>added or updated</strong>.</p>
    ${updaterEmail ? `<p style="margin:0 0 16px;font-size:13px;color:#4b5563;"><strong>Updated by:</strong> ${escapeHtml(data.updatedByName || updaterEmail)} (${escapeHtml(updaterEmail)})</p>` : ""}
    <div style="border:1px solid #dbe4f0;border-radius:10px;padding:14px 16px;background:#f9fbff;margin-bottom:20px;">
      ${projectSummaryRow("Project Name", projectName)}
      ${projectSummaryRow("Project ID", projectId)}
      ${projectSummaryRow("Project Manager", data["Project Manager"] || data["Account Owner"])}
      ${projectSummaryRow("Project Status", data["Project Status"])}
      ${projectSummaryRow("Project Stage", data["Project Stage"] || data.Stage)}
      ${projectSummaryRow("Client Email ID", data["Client Email ID"])}
    </div>
    <div style="font-size:15px;font-weight:700;color:#111827;margin:0 0 6px;">Project History</div>
    <div style="font-size:12px;color:#4b5563;line-height:1.6;margin-bottom:14px;">Latest update appears first.</div>
    ${historyHtml}`;
  const subject = `Project Update: ${projectName} [${projectId}]`;
  const html = brandedEmailHtml(content, { subject });
  const raw = base64Url(mimeMessage({
    to,
    cc,
    bcc,
    subject,
    html,
    replyTo: process.env.OPERATIONAL_REPLY_TO || "",
    fromName: "Rido Sport Project Update",
  }));
  await gmailSendRawEmail(raw);
  return { sent: true, to, cc, bcc };
}

function findHeader(headers, name) {
  return headers.findIndex((header) => clean(header).toLowerCase() === name.toLowerCase());
}

function uniqueEmails(values) {
  return [...new Set(values.map(clean).filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.toLowerCase())))];
}

function splitEmails(value) {
  return clean(value).split(/[;,]/).map(clean).filter(Boolean);
}

function projectSummaryRow(label, value) {
  if (!clean(value)) return "";
  return `<div style="margin-bottom:8px;font-size:13px;line-height:1.5;"><span style="font-weight:700;color:#374151;">${escapeHtml(label)}:</span> <span style="color:#111827;">${escapeHtml(value)}</span></div>`;
}

export async function notifyLeadWorkflow(headers, data, previousData = null) {
  const current = clean(data["Notification Status"]);
  let nextStatus = current;
  const results = {};

  if ((!current || previousData) && (!previousData || hasMaterialChanges(headers, previousData, data))) {
    results.lead = await notifyLeadSubmitted(headers, data, previousData);
    if (results.lead.sent && !current) nextStatus = "Sent";
  }

  const leadStatus = clean(data["Lead Status"]);
  const owner = data["Lead Owner"];
  const salesTeam = clean(process.env.QUOTATION_SALES_EMAIL) || "sales2@ridosports.com";
  const infoEmail = clean(process.env.QUOTATION_INFO_EMAIL) || "info@klientkonnect.com";

  if (leadStatus === "Pre-Qualified - Prepare Quote" && notificationRank(nextStatus) < 1) {
    const ownerAddress = await ownerEmail(owner);
    results.quotation = await sendDirectOperationalEmail({
      to: salesTeam,
      cc: [ownerAddress, infoEmail].filter(Boolean).join(","),
      subject: `Prepare Quote for Lead: ${clean(data.Company)}`,
      intro: "Please prepare a quotation for the following lead:",
      headers,
      data: maskLeadMobile(data),
      calendarLink: true,
    });
    if (results.quotation.sent) nextStatus = "Quotation Update Sent";
  }

  if (leadStatus === "Pre-Qualified - Quote Ready" && notificationRank(nextStatus) < 2) {
    const ownerAddress = await ownerEmail(owner);
    const quotationLink = clean(data["Quotation Link"]);
    const quotationData = {
      ...maskLeadMobile(data),
      ...(quotationLink ? { "Quotation Link": quotationLink } : {}),
    };
    results.quotation = await sendDirectOperationalEmail({
      to: ownerAddress,
      cc: [salesTeam, infoEmail].filter(Boolean).join(","),
      greeting: `Hello ${clean(owner)},`,
      subject: `Quote Ready — ${clean(data.Company)}`,
      intro: "The quotation is ready. The record details and quotation link are below:",
      headers,
      data: quotationData,
      calendarLink: true,
      actionUrl: isHttpUrl(quotationLink) ? quotationLink : "",
      actionLabel: "Open Quotation",
    });
    if (results.quotation.sent) nextStatus = "Quotation Prepared & Update sent";
  }

  return { ...results, notificationStatus: nextStatus };
}

function notificationRank(value) {
  return ["Sent", "Quotation Update Sent", "Quotation Prepared & Update sent"].indexOf(clean(value));
}

function maskLeadMobile(data) {
  const next = { ...(data || {}) };
  const mobile = clean(next["Mobile Number"]);
  if (mobile) next["Mobile Number"] = `${"*".repeat(Math.max(0, mobile.length - 4))}${mobile.slice(-4)}`;
  return next;
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(clean(value));
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export async function notifyDealSubmitted(headers, data, previousData = null) {
  if (previousData && !hasMaterialChanges(headers, previousData, data)) return { sent: false, reason: "no_material_changes" };
  if (clean(data["Notification Status"]) && !previousData) return { sent: false, reason: "already_processed" };
  const owner = data["Account Owner"] || data["Lead Owner"];
  const amount = data["Deal Value"] || data["Deal Amount"] || "";
  const stage = data["Deal Stage"] || data.Stage || "";
  const subject = `New Deal Submitted: ${clean(data["Deal Name"])} | ${clean(data.Company)} | ${amount ? `₹${clean(amount)}` : ""} | Stage: ${clean(stage)}`;
  return sendOperationalEmail({
    owner,
    subject,
    intro: previousData ? "A deal record has been updated. The changes are shown below:" : "A new deal form has been submitted with the following details:",
    headers,
    data,
    previousData,
  });
}

export async function notifyOrderSubmitted(headers, data, previousData = null) {
  if (previousData && !hasMaterialChanges(headers, previousData, data)) return { sent: false, reason: "no_material_changes" };
  if (clean(data["Notification Status"]) && !previousData) return { sent: false, reason: "already_processed" };
  const owner = data["Account Owner"] || data["Lead Owner"] || data.Owner;
  const subject = `Order Updated: ${clean(data["Order ID"])} | ${clean(data["Deal Name"] || data.Company)} | ${clean(data["Order Status"] || data.Status)}`;
  return sendOperationalEmail({
    owner,
    subject,
    intro: previousData ? "An order record has been updated. The changes are shown below:" : "An order record has been submitted with the following details:",
    headers,
    data,
    previousData,
    cc: process.env.ORDER_OPERATIONAL_EMAIL_CC || `${DEFAULT_CC},sudeep@ridosports.com`,
  });
}

export async function notifySalesTrackerSubmitted(headers, data, previousData = null) {
  if (previousData && !hasMaterialChanges(headers, previousData, data)) {
    return { sent: false, reason: "no_material_changes" };
  }
  if (clean(data["Notification Status"]) && !previousData) {
    return { sent: false, reason: "already_processed" };
  }

  const owner = data["Sales Person Name"] || data["Account Owner"] || data.Owner;
  const subject = `Sales Tracker Updated: ${clean(data.Company)} | ${clean(data["Invoice No."])} | ${clean(data["Sale Type"])}`;
  return sendOperationalEmail({
    owner,
    subject,
    intro: previousData ? "A sales tracker record has been updated. The changes are shown below:" : "A sales tracker record has been added with the following details:",
    headers,
    data,
    previousData,
  });
}

function hasMaterialChanges(headers, previousData, data) {
  const ignored = new Set(["Timestamp", "Notification Status", "Prefilled Link", "mode", "originalSNo"]);
  return (headers || []).some((header) =>
    !ignored.has(header) && clean(previousData?.[header]) !== clean(data?.[header])
  );
}
