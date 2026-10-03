import { resolveProjectCc, resolveProjectRecipients } from "./projectRecipients.js";
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

export function updaterDetailsHtml(data, verifiedEmail = "") {
  const email = clean(verifiedEmail || data?.updatedByEmail || data?.["Updated By Email"]);
  if (!email) return "";
  const name = clean(data?.updatedByName || data?.["Updated By"] || email);
  const role = clean(data?.updatedByRole || data?.["Updated By Role"]);
  const updatedAt = clean(data?.["Updated At"] || data?.updatedAt);
  const details = [
    `<strong>Updated by:</strong> ${escapeHtml(name)} (${escapeHtml(email)})`,
    role ? `<strong>CRM role:</strong> ${escapeHtml(role)}` : "",
    updatedAt ? `<strong>Updated at:</strong> ${escapeHtml(updatedAt)}` : "",
  ].filter(Boolean).join(" &nbsp;|&nbsp; ");
  return `<p style="margin:0 0 18px 0;font-size:13px;color:#4b5563;">${details}</p>`;
}

function brandedHtml({ greeting, intro, subject, headers, data, previousData = null, calendarLink = false, actionUrl = "", actionLabel = "" }) {
  const meetingUrl = clean(process.env.CRM_CALENDAR_URL) || `${getPublicBaseUrl()}/calendar`;

  const content = `
    <p style="margin:0 0 14px 0;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 18px 0;">${escapeHtml(intro)}</p>
    ${updaterDetailsHtml(data)}
    ${previousData ? `<div style="font-size:15px;font-weight:700;margin:20px 0 8px;">What changed</div>${changedFieldsCards(headers, previousData, data)}<div style="font-size:15px;font-weight:700;margin:20px 0 8px;">Current snapshot</div>${recordDetailsCards(priorityHeaders(headers, data), data, { limit: 8 })}` : recordDetailsCards(headers, data)}
    ${actionUrl ? `<p style="margin:20px 0 0 0;"><a href="${escapeHtml(actionUrl)}" target="_blank" style="display:inline-block;background:#12315c;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:4px;font-size:13px;font-weight:700;">${escapeHtml(actionLabel || "Open Link")}</a></p>` : ""}
    ${calendarLink ? `<p style="margin:20px 0 0 0;"><a href="${escapeHtml(meetingUrl)}" target="_blank" style="display:inline-block;background:#6495ED;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:4px;font-size:13px;font-weight:700;">Schedule a Meeting</a></p>` : ""}
    <p style="margin:22px 0 0 0;">Regards,<br>Rido CRM Team</p>
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
  const resolved = await loginEmail(submitted);
  return clean(resolved).toLowerCase() === submitted ? clean(resolved) : "";
}

async function projectCcEmails() {
  const sheetName = await resolveSheetTitle(SHEETS.validation.spreadsheetId, SHEETS.validation.leadSheetNames);
  const values = await getValues(SHEETS.validation.spreadsheetId, sheetName);
  const [headers = [], ...rows] = values;
  return resolveProjectCc(headers, rows);
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
  const { to, cc: projectCc, bcc } = resolveProjectRecipients(validationHeaders, validationRows, data);
  if (!to) return { sent: false, reason: "missing_recipient" };
  const updaterEmail = await validatedUpdaterEmail(data);
  const toKeys = new Set(splitEmails(to).map((email) => email.toLowerCase()));
  const cc = uniqueEmails([...splitEmails(projectCc), updaterEmail])
    .filter((email) => !toKeys.has(email.toLowerCase()))
    .join(",");

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
    ${updaterDetailsHtml(data, updaterEmail).replace("margin:0 0 18px 0", "margin:0 0 16px 0")}
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
    fromName: "Rido CRM",
  }));
  await gmailSendRawEmail(raw);
  return { sent: true, to, cc, bcc };
}

const PROJECT_TASK_IGNORED_FIELDS = new Set([
  "Updated At", "Updated By", "Updated By Email", "Updated By Role",
  "updatedByName", "updatedByEmail", "updatedByRole",
]);

export function projectTaskEvent(previous = {}, task = {}) {
  if (!clean(previous["Task ID"])) return "created";
  const previousStatus = clean(previous.Status);
  const status = clean(task.Status);
  if (status !== previousStatus) {
    if (status === "Completed") return "completed";
    if (status === "Blocked") return "blocked";
    if (previousStatus === "Completed") return "reopened";
    return "status_changed";
  }
  const assignmentChanged = ["Task Owner", "Assigned Team"].some((field) => clean(previous[field]) !== clean(task[field]));
  if (assignmentChanged) {
    return clean(previous["Task Owner"]) || clean(previous["Assigned Team"]) ? "reassigned" : "assigned";
  }
  const changed = Object.keys(task || {}).some((field) => (
    !PROJECT_TASK_IGNORED_FIELDS.has(field) && clean(previous[field]) !== clean(task[field])
  ));
  return changed ? "updated" : "unchanged";
}

function splitIdentities(value) {
  return clean(value).split(/[;,\n]/).map(clean).filter(Boolean);
}

export function resolveProjectTaskRecipients(headers, rows, task, project = {}, verifiedUpdater = "") {
  const ownerIndex = findHeader(headers, "Lead Owner");
  const emailIndex = findHeader(headers, "Email");
  const bccIndex = findHeader(headers, "Project BCC");
  const directory = new Map();
  (rows || []).forEach((row) => {
    const name = ownerIndex >= 0 ? clean(row[ownerIndex]).toLowerCase() : "";
    const email = emailIndex >= 0 ? clean(row[emailIndex]) : "";
    if (name && email) directory.set(name, email);
  });
  const emailsFor = (values) => uniqueEmails(values.flatMap((value) => splitIdentities(value).map((identity) => (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity) ? identity : directory.get(identity.toLowerCase()) || ""
  ))));
  const assignees = emailsFor([task["Task Owner"], task["Assigned Team"]]);
  const managers = emailsFor([project["Project Manager"], project["Account Owner"], project["Lead Owner"], project.Owner]);
  const toList = assignees.length ? assignees : managers;
  const toKeys = new Set(toList.map((email) => email.toLowerCase()));
  const ccList = uniqueEmails([...managers, ...resolveProjectCc(headers, rows), verifiedUpdater])
    .filter((email) => !toKeys.has(email.toLowerCase()));
  const visible = new Set([...toList, ...ccList].map((email) => email.toLowerCase()));
  const bccList = uniqueEmails((rows || []).flatMap((row) => bccIndex >= 0 ? splitEmails(row[bccIndex]) : []))
    .filter((email) => !visible.has(email.toLowerCase()));
  return { to: toList.join(","), cc: ccList.join(","), bcc: bccList.join(",") };
}

function projectTaskEventLabel(event) {
  return ({
    created: "Created", assigned: "Assigned", reassigned: "Reassigned", status_changed: "Status Changed",
    completed: "Completed", blocked: "Blocked", reopened: "Reopened", updated: "Updated",
  })[event] || "Updated";
}

async function projectTaskDirectory() {
  const sheetName = await resolveSheetTitle(SHEETS.validation.spreadsheetId, SHEETS.validation.leadSheetNames);
  const values = await getValues(SHEETS.validation.spreadsheetId, sheetName);
  return { headers: values[0] || [], rows: values.slice(1) };
}

async function sendProjectTaskEmail({ task, project, event, previous = null, importedTasks = [] }) {
  if (String(process.env.ENABLE_OPERATIONAL_EMAILS || "false").toLowerCase() !== "true") {
    return { sent: false, reason: "disabled" };
  }
  if (event === "unchanged") return { sent: false, reason: "no_material_changes" };
  const updaterEmail = await validatedUpdaterEmail(task);
  const directory = await projectTaskDirectory();
  const recipients = resolveProjectTaskRecipients(directory.headers, directory.rows, task, project, updaterEmail);
  if (!recipients.to) return { sent: false, reason: "missing_recipient" };

  const projectName = clean(task["Project Name"] || project["Project Name"]) || "Untitled Project";
  const projectId = clean(task["Project ID"] || project["Project ID (unique, auto-generated)"]);
  const isImport = importedTasks.length > 0;
  const subject = isImport
    ? `Project Tasks Imported: ${projectName} [${projectId}]`
    : `Project Task ${projectTaskEventLabel(event)}: ${clean(task["Task Name"])} | ${projectName}`;
  const importedHtml = importedTasks.map((item, index) => `
    <div style="padding:10px 12px;border-bottom:${index === importedTasks.length - 1 ? "0" : "1px solid #dbe4f0"};">
      <div style="font-weight:700;color:#111827;">${escapeHtml(item["Task Name"])}</div>
      <div style="font-size:12px;color:#4b5563;margin-top:3px;">${escapeHtml([item["Quotation Quantity"], item["Quotation Unit"], item["Task Owner"] || item["Assigned Team"]].filter(Boolean).join(" | "))}</div>
    </div>`).join("");
  const content = `
    <div style="margin:0 0 20px;background:#6495ED;border-radius:8px;padding:18px 20px;color:#ffffff;">
      <div style="font-size:20px;font-weight:700;line-height:1.3;">${isImport ? "Quotation Tasks Imported" : `Project Task ${escapeHtml(projectTaskEventLabel(event))}`}</div>
      <div style="font-size:13px;line-height:1.5;margin-top:4px;">${escapeHtml(projectName)}${projectId ? ` | ${escapeHtml(projectId)}` : ""}</div>
    </div>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${isImport ? `${importedTasks.length} quotation ${importedTasks.length === 1 ? "line has" : "lines have"} been added to the project task plan.` : `The task has been ${escapeHtml(projectTaskEventLabel(event).toLowerCase())}.`}</p>
    ${updaterDetailsHtml(task, updaterEmail).replace("margin:0 0 18px 0", "margin:0 0 16px 0")}
    ${isImport
      ? `<div style="border:1px solid #dbe4f0;border-radius:8px;overflow:hidden;margin-bottom:18px;">${importedHtml}</div>`
      : `${previous ? `<div style="font-size:15px;font-weight:700;margin:20px 0 8px;">What changed</div>${changedFieldsCards(Object.keys(task), previous, task)}` : ""}<div style="font-size:15px;font-weight:700;margin:20px 0 8px;">Task details</div>${recordDetailsCards(Object.keys(task).filter((field) => !PROJECT_TASK_IGNORED_FIELDS.has(field)), task)}`}
    <p style="margin:22px 0 0 0;">Regards,<br>Rido CRM Team</p>`;
  const html = brandedEmailHtml(content, { subject });
  const raw = base64Url(mimeMessage({
    ...recipients, subject, html, replyTo: process.env.OPERATIONAL_REPLY_TO || "", fromName: "Rido CRM",
  }));
  await gmailSendRawEmail(raw);
  return { sent: true, ...recipients, event };
}

export async function notifyProjectTaskChanged(task, previous = {}, project = {}) {
  const event = projectTaskEvent(previous, task);
  return sendProjectTaskEmail({ task, previous: clean(previous["Task ID"]) ? previous : null, project, event });
}

export async function notifyProjectTasksImported(tasks, project = {}) {
  if (!Array.isArray(tasks) || !tasks.length) return { sent: false, reason: "no_tasks" };
  return sendProjectTaskEmail({ task: tasks[0], project, event: "created", importedTasks: tasks });
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
  const projectCc = await projectCcEmails();
  const configuredCc = process.env.ORDER_OPERATIONAL_EMAIL_CC || process.env.OPERATIONAL_EMAIL_CC || DEFAULT_CC;
  return sendOperationalEmail({
    owner,
    subject,
    intro: previousData ? "An order record has been updated. The changes are shown below:" : "An order record has been submitted with the following details:",
    headers,
    data,
    previousData,
    cc: uniqueEmails([...splitEmails(configuredCc), ...projectCc]).join(","),
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

export async function notifyTenderSubmitted(headers, data) {
  const bidNumber = clean(data["Bid Number"]) || "Unnumbered Tender";
  return sendDirectOperationalEmail({
    to: process.env.TENDER_OPERATIONAL_EMAIL_TO || "info@ridosports.com,Sidhant@ridosports.com,Sandeep@ridosports.com",
    cc: process.env.TENDER_OPERATIONAL_EMAIL_CC || "info@klientkonnect.com",
    subject: `New/Update Tender Submission - ${bidNumber}`,
    intro: "A new or updated tender has been submitted with the following details:",
    headers,
    data,
  });
}

export async function notifyInventoryBookingCreated({ bookingId, requestedBy, category, variant, remarks, items }) {
  const requesterEmail = await loginEmail(requestedBy);
  const data = {
    "Booking ID": bookingId,
    "Requested By": requestedBy,
    Category: category,
    "Variant / Base Type": variant,
    Status: "Pending Review",
    Remarks: remarks,
    "Total Required Qty": inventoryTotal(items, "requiredQty"),
    "Total Shortage Qty": inventoryTotal(items, "shortageQty"),
    Items: inventoryItemSummary(items),
  };
  return sendDirectOperationalEmail({
    to: process.env.INVENTORY_BOOKING_REQUIREMENT_TO || "sarabjeet@ridosports.com,info@klientkonnect.com",
    cc: requesterEmail,
    subject: `New inventory booking requirement ${bookingId}`,
    intro: "A new inventory booking requirement has been submitted for admin review:",
    headers: Object.keys(data),
    data,
  });
}

export async function notifyInventoryBookingUpdated({ bookingId, requestedBy, category, variant, status, updatedBy, holdExpiresAt, remarks, items }) {
  const to = await loginEmail(requestedBy);
  if (!to) return { sent: false, reason: "missing_requester_email" };
  const data = {
    "Booking ID": bookingId,
    "Requested By": requestedBy,
    Category: category,
    "Variant / Base Type": variant,
    Status: status,
    "Updated By": updatedBy,
    "Hold Expires At": holdExpiresAt,
    Remarks: remarks,
    Items: inventoryItemSummary(items),
  };
  return sendDirectOperationalEmail({
    to,
    cc: process.env.INVENTORY_BOOKING_STATUS_CC || "sidhant@ridosports.com,sandeep@ridosports.com,sarabjeet@ridosports.com,info@klientkonnect.com",
    greeting: `Hello ${clean(requestedBy) || "there"},`,
    subject: `Inventory booking ${bookingId} updated to ${status}`,
    intro: "Your inventory booking has been updated:",
    headers: Object.keys(data),
    data,
  });
}

function inventoryTotal(items, field) {
  return (items || []).reduce((sum, item) => sum + (Number(item?.[field]) || 0), 0);
}

function inventoryItemSummary(items) {
  return (items || []).map((item) => {
    const material = clean(item.materialName) || clean(item["Material Name"]);
    const required = item.requiredQty ?? item["Required Qty"] ?? 0;
    const allocatedPackaged = item.allocatedPackagedQty ?? item["Allocation Package Qty"] ?? 0;
    const allocatedLoose = item.allocatedLooseQty ?? item["Allocation Loose Qty"] ?? 0;
    const shortage = item.shortageQty ?? item["Shortage Qty"] ?? 0;
    return `${material}: required ${required}, packaged ${allocatedPackaged}, loose ${allocatedLoose}, shortage ${shortage}`;
  }).join("\n");
}

async function loginEmail(identity) {
  const wanted = clean(identity).toLowerCase();
  if (!wanted) return "";
  const sheetName = await resolveSheetTitle(SHEETS.auth.spreadsheetId, SHEETS.auth.sheetNames);
  const values = await getValues(SHEETS.auth.spreadsheetId, sheetName);
  const [headers = [], ...rows] = values;
  const indexes = {
    identity: ["Username", "User Name", "Login Username", "loginUsername", "Name", "Full Name", "Employee Name", "Email", "Email ID", "Email Address", "Login Email"]
      .map((header) => findHeader(headers, header)).filter((index) => index >= 0),
    email: ["Email", "Email ID", "Email Address", "Login Email"]
      .map((header) => findHeader(headers, header)).find((index) => index >= 0),
  };
  if (indexes.email == null) return "";
  const match = rows.find((row) => indexes.identity.some((index) => clean(row[index]).toLowerCase() === wanted));
  return match ? clean(match[indexes.email]) : "";
}

function hasMaterialChanges(headers, previousData, data) {
  const ignored = new Set(["Timestamp", "Notification Status", "Prefilled Link", "mode", "originalSNo"]);
  return (headers || []).some((header) =>
    !ignored.has(header) && clean(previousData?.[header]) !== clean(data?.[header])
  );
}
