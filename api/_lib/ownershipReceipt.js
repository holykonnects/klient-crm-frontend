import { handoffFields } from "./ownershipHandoff.js";
import { gmailSendRawEmail } from "./googleSheets.js";
import { base64Url, brandedEmailHtml, escapeHtml, mimeMessage } from "./emailRenderer.js";

const labels = { leads: "Lead", accounts: "Account", deals: "Deal", orders: "Order" };
const time = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

function csvCell(value) {
  const text = String(value ?? "");
  const safe = /^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function ownershipReceipt(events) {
  const rows = [["Customer", "Type", "Record", "Reference", ...handoffFields.map(([, label]) => label),
    "Previous owner", "New owner", "Transferred by", "Transferred at (IST)"]];
  for (const event of events) {
    const customer = event.records.find((record) => record.type === "accounts")?.label ||
      event.records.find((record) => record.type === "leads")?.label || event.customer;
    for (const record of event.records) {
      rows.push([
        customer, labels[record.type], record.label, record.reference,
        ...handoffFields.map(([key]) => record.details?.[key] || ""), record.owner || "Unassigned",
        event.to.username, event.actor.username, time.format(new Date(event.at)),
      ]);
    }
  }
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(events[0].at));
  const filename = `Rido-ownership-transfer-${date}-${events[0].batchId.slice(0, 8)}.csv`;
  return { filename, csv: "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n" };
}

export async function sendOwnershipReceipt(events, attachment) {
  if (String(process.env.ENABLE_OPERATIONAL_EMAILS || "").toLowerCase() !== "true") return "disabled";

  const recipient = events[0].to;
  // The recipient comes from the CRM login directory. Require exactly one email address.
  if (!/^[^\s@,;<>"\\]+@[^\s@,;<>"\\]+\.[^\s@,;<>"\\]+$/.test(recipient.email)) return "failed";
  const count = events.reduce((total, event) => total + event.records.length, 0);
  const subject = "Rido CRM ownership transfer";
  const html = brandedEmailHtml(`
    <p>Hello ${escapeHtml(recipient.username)},</p>
    <p>${count} CRM ${count === 1 ? "record was" : "records were"} transferred to you. The attached list identifies the customers and records included in this transfer.</p>
    <p>Regards,<br>Rido CRM Team</p>
  `, { subject });
  try {
    await gmailSendRawEmail(base64Url(mimeMessage({
      to: recipient.email, subject, html,
      fileAttachments: [{ filename: attachment.filename, contentType: "text/csv; charset=UTF-8", body: attachment.csv }],
    })));
    return "sent";
  } catch {
    return "failed";
  }
}
