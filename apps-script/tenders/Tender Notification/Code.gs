const EMAIL_PUBLIC_APP_URL = "https://crm.klientkonnect.com";
const EMAIL_FONT_STACK = "Montserrat, Arial, sans-serif";

function escapeHtml_(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function brandedTenderEmailHtml_(title, contentHtml) {
  return `
    <div style="margin:0;padding:0;background:#f3f6fb;font-family:${EMAIL_FONT_STACK};color:#172033;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;margin:0;padding:28px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border:1px solid #e4ebf5;border-radius:8px;overflow:hidden;">
              <tr>
                <td style="padding:22px 28px;background:#ffffff;border-bottom:4px solid #6495ED;">
                  <img src="${EMAIL_PUBLIC_APP_URL}/assets/rido-sports-logo.png" alt="Rido Sports" style="display:block;max-width:170px;max-height:64px;width:auto;height:auto;" />
                </td>
              </tr>
              <tr>
                <td style="padding:30px 28px 24px 28px;font-size:13px;line-height:1.6;color:#172033;">
                  <h2 style="margin:0 0 16px 0;color:#172033;font-size:18px;line-height:1.3;">${escapeHtml_(title)}</h2>
                  ${contentHtml || ""}
                </td>
              </tr>
              <tr>
                <td style="padding:18px 28px 22px 28px;background:#f8fbff;border-top:1px solid #e4ebf5;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="font-size:11px;line-height:1.5;color:#6b7280;">Sent via Klient Konnect CRM</td>
                      <td align="right"><img src="${EMAIL_PUBLIC_APP_URL}/assets/kk-logo.png" alt="Klient Konnect" style="display:inline-block;max-width:120px;max-height:44px;width:auto;height:auto;vertical-align:middle;" /></td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function processNewTenders() {
  const sheetId = '1XCO4ycfxAIhZdNr9qGZluAEH7BwPbF-rSfhQc1yvszI';
  const sheetName = 'Form responses 1';
  Logger.log("🔄 Starting processNewTenders...");

  const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const uidCol = headers.indexOf("Tender Unique ID");
  const notifCol = headers.indexOf("Notification Status");
  const updateCol = headers.indexOf("Update Tender");
  const bidNumCol = headers.indexOf("Bid Number");

  if (uidCol === -1 || notifCol === -1 || updateCol === -1 || bidNumCol === -1) {
    Logger.log("❌ Required columns not found. Exiting.");
    return;
  }

  Logger.log(`📌 Columns — UID: ${uidCol}, Notification: ${notifCol}, Update Tender: ${updateCol}, Bid Number: ${bidNumCol}`);

  const entryMapping = {
    "entry.1935485735": "Bid Number",
    "entry.1867562577": "Bid Start Date",
    "entry.1593496403": "Bid End Date",
    "entry.1534984940": "Ministry/State Name",
    "entry.1101390415": "Organisation Name",
    "entry.328591834": "Work Type",
    "entry.1808877600": "Bid Type",
    "entry.1012570309": "EMD Amount",
    "entry.1063977684": "EMD Exemption Available",
    "entry.537047039": "Tender Budget",
    "entry.1208217132": "Pre Bid Meeting Date",
    "entry.1802100799": "Pre Bid Meeting Venue",
    "entry.1721867859": "Tender Conditions",
    "entry.1483595671": "Tender Status",
    "entry.284842606": "Tender Remarks"
  };

  const baseURL = "https://docs.google.com/forms/d/e/1FAIpQLSdf2pFdSBeBb8C-__cY6Xlg7ErfWJoxHDi2uXue80aieVLwmg/viewform?usp=pp_url";
  const existingBidMap = new Map();

  for (let i = 1; i < data.length; i++) {
    const bid = data[i][bidNumCol];
    const uid = data[i][uidCol];
    if (bid && uid && !existingBidMap.has(bid)) {
      existingBidMap.set(bid, uid); // Store UID instead of row number
    }
  }

  let processedRows = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowIndex = i + 1;
    const bidNumber = row[bidNumCol];

    if (!row[notifCol]) {
      Logger.log(`📥 Processing Row ${rowIndex} (Bid: ${bidNumber})`);

      // UID Assignment or reuse
      if (!row[uidCol]) {
        if (existingBidMap.has(bidNumber)) {
          const existingUID = existingBidMap.get(bidNumber);
          sheet.getRange(rowIndex, uidCol + 1).setValue(existingUID);
          Logger.log(`🔁 Reused existing UID: ${existingUID}`);
        } else {
          const newUID = Utilities.formatDate(new Date(), "GMT+5:30", "ddMMyyyyHHmmssSSS");
          sheet.getRange(rowIndex, uidCol + 1).setValue(newUID);
          existingBidMap.set(bidNumber, newUID);
          Logger.log(`✅ New UID set: ${newUID}`);
        }
      } else {
        Logger.log(`ℹ️ UID already present in row ${rowIndex}`);
      }

      // Email Notification
      try {
        const htmlTable = buildHtmlTable(headers, row);
        const subject = `New/Update Tender Submission - ${bidNumber}`;
        GmailApp.sendEmail(
          "info@ridosports.com,Sidhant@ridosports.com,Sandeep@ridosports.com",
          subject,
          "",
          {
            htmlBody: brandedTenderEmailHtml_("Tender Submission Update", `
              <p>Hello Team,</p>
              <p>A new/update to a tender has been submitted or updated. Details are below:</p>
              ${htmlTable}
              <p>Regards,<br>Your CRM Team</p>
            `),
            cc: "info@klientkonnect.com"
          }
        );
        Logger.log("📧 Email sent successfully.");
        sheet.getRange(rowIndex, notifCol + 1).setValue("Sent");
      } catch (err) {
        Logger.log(`❌ Email send failed: ${err.message}`);
        continue;
      }

      // Prefilled Link
      try {
        const params = Object.entries(entryMapping).map(([entryId, header]) => {
          const val = encodeURIComponent(getValue(headers, row, header) || "");
          return `${entryId}=${val}`;
        });
        const prefilledURL = `${baseURL}&${params.join("&")}`;
        const formula = `=HYPERLINK(\"${prefilledURL}\", \"Update Tender\")`;
        sheet.getRange(rowIndex, updateCol + 1).setFormula(formula);
        Logger.log("🔗 Prefilled link added.");
      } catch (err) {
        Logger.log(`❌ Prefilled link generation failed: ${err.message}`);
      }

      processedRows++;
    }
  }

  Logger.log(`✅ Done. Total rows processed: ${processedRows}`);
}

function getValue(headers, row, header) {
  const index = headers.indexOf(header);
  return index !== -1 ? row[index] : "";
}

function buildHtmlTable(headers, row) {
  let html = `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-spacing:0;margin:18px 0;border:1px solid #d9e3f0;background:#ffffff;font-family:${EMAIL_FONT_STACK};font-size:12px;">`;
  headers.forEach((header, i) => {
    html += `<tr>
      <td style="background:#f8fbff;border:1px solid #d9e3f0;padding:9px 12px;color:#172033;font-weight:700;vertical-align:top;">${escapeHtml_(header)}</td>
      <td style="border:1px solid #d9e3f0;padding:9px 12px;color:#243447;vertical-align:top;">${escapeHtml_(row[i] || "")}</td>
    </tr>`;
  });
  html += '</table>';
  return html;
}

/*************** TENDER REMINDER SCHEDULER (D-7 & D-2) ***************/

function setupTenderReminderTrigger() {
  // Runs daily at ~9 AM IST (Apps Script chooses an approximate time)
  // Delete existing trigger(s) for this handler to avoid duplicates
  const handler = "runTenderReminders";
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction && t.getHandlerFunction() === handler) ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyDays(1)
    .atHour(9) // IST timezone is set in project settings; still works fine
    .create();

  Logger.log("✅ Daily trigger created for runTenderReminders()");
}

function runTenderReminders() {
  const sheetId = '1XCO4ycfxAIhZdNr9qGZluAEH7BwPbF-rSfhQc1yvszI';
  const sheetName = 'Form responses 1';
  const tz = "GMT+5:30";

  const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(sheetName);
  if (!sheet) {
    Logger.log("❌ Sheet not found.");
    return;
  }

  const dataRange = sheet.getDataRange();
  const data = dataRange.getValues();
  if (data.length < 2) {
    Logger.log("ℹ️ No rows to process.");
    return;
  }

  const headers = data[0];

  // Required
  const bidNumCol = headers.indexOf("Bid Number");
  const bidEndCol = headers.indexOf("Bid End Date");
  const uidCol = headers.indexOf("Tender Unique ID");

  if (bidNumCol === -1 || bidEndCol === -1) {
    Logger.log("❌ Missing required columns: Bid Number / Bid End Date");
    return;
  }

  // Ensure reminder columns exist
  const rem7Col = ensureColumn_(sheet, headers, "Reminder 7 Days Status");
  const rem2Col = ensureColumn_(sheet, headers, "Reminder 2 Days Status");
  const remLastCol = ensureColumn_(sheet, headers, "Reminder Last Sent At");

  // After ensureColumn_, headers may be outdated — re-read
  const fresh = sheet.getDataRange().getValues();
  const freshHeaders = fresh[0];

  const bidNumCol2 = freshHeaders.indexOf("Bid Number");
  const bidEndCol2 = freshHeaders.indexOf("Bid End Date");
  const uidCol2 = freshHeaders.indexOf("Tender Unique ID");
  const rem7Col2 = freshHeaders.indexOf("Reminder 7 Days Status");
  const rem2Col2 = freshHeaders.indexOf("Reminder 2 Days Status");
  const remLastCol2 = freshHeaders.indexOf("Reminder Last Sent At");

  const today = startOfDay_(new Date(), tz);

  let sentCount = 0;

  for (let i = 1; i < fresh.length; i++) {
    const row = fresh[i];
    const rowIndex = i + 1;

    const bidNumber = row[bidNumCol2];
    const bidEndRaw = row[bidEndCol2];

    if (!bidNumber || !bidEndRaw) continue;

    const bidEndDate = parseSheetDate_(bidEndRaw, tz);
    if (!bidEndDate) continue;

    const endDay = startOfDay_(bidEndDate, tz);
    const daysLeft = daysBetween_(today, endDay); // endDay - today

    const rem7Status = row[rem7Col2] || "";
    const rem2Status = row[rem2Col2] || "";

    // Only send if end date is in future or today (daysLeft >= 0)
    // You can allow negative if you want overdue reminders; currently skipping overdue
    if (daysLeft < 0) continue;

    // Build email content once
    const htmlTable = buildHtmlTable(freshHeaders, row);
    const endStr = Utilities.formatDate(endDay, tz, "dd MMM yyyy");

    // D-7 reminder
    if (daysLeft === 7 && rem7Status !== "Sent") {
      const subject = `Tender Reminder (D-7): Bid ${bidNumber} ends on ${endStr}`;
      const ok = sendTenderReminderEmail_(subject, htmlTable, endStr, 7);
      if (ok) {
        sheet.getRange(rowIndex, rem7Col2 + 1).setValue("Sent");
        sheet.getRange(rowIndex, remLastCol2 + 1).setValue(Utilities.formatDate(new Date(), tz, "dd MMM yyyy HH:mm:ss"));
        sentCount++;
      }
    }

    // D-2 reminder
    if (daysLeft === 2 && rem2Status !== "Sent") {
      const subject = `Tender Reminder (D-2): Bid ${bidNumber} ends on ${endStr}`;
      const ok = sendTenderReminderEmail_(subject, htmlTable, endStr, 2);
      if (ok) {
        sheet.getRange(rowIndex, rem2Col2 + 1).setValue("Sent");
        sheet.getRange(rowIndex, remLastCol2 + 1).setValue(Utilities.formatDate(new Date(), tz, "dd MMM yyyy HH:mm:ss"));
        sentCount++;
      }
    }
  }

  Logger.log(`✅ runTenderReminders done. Emails sent: ${sentCount}`);
}

/*********************** HELPERS ***********************/

function ensureColumn_(sheet, headers, colName) {
  let idx = headers.indexOf(colName);
  if (idx === -1) {
    sheet.getRange(1, headers.length + 1).setValue(colName);
    idx = headers.length;
    headers.push(colName);
    Logger.log(`➕ Added column: ${colName}`);
  }
  return idx;
}

// Robustly parse a Google Sheet date cell that may be Date object or string
function parseSheetDate_(value, tz) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Try Date constructor
    const d1 = new Date(trimmed);
    if (!isNaN(d1)) return d1;

    // Try common dd/MM/yyyy
    const m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const dd = Number(m[1]);
      const mm = Number(m[2]) - 1;
      let yyyy = Number(m[3]);
      if (yyyy < 100) yyyy += 2000;
      const d2 = new Date(yyyy, mm, dd);
      if (!isNaN(d2)) return d2;
    }
  }
  return null;
}

function startOfDay_(dateObj, tz) {
  const y = Number(Utilities.formatDate(dateObj, tz, "yyyy"));
  const m = Number(Utilities.formatDate(dateObj, tz, "MM")) - 1;
  const d = Number(Utilities.formatDate(dateObj, tz, "dd"));
  return new Date(y, m, d);
}

function daysBetween_(start, end) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = end.getTime() - start.getTime();
  return Math.round(diff / msPerDay);
}

function sendTenderReminderEmail_(subject, htmlTable, endDateStr, daysLeft) {
  try {
    GmailApp.sendEmail(
      "info@ridosports.com,Sidhant@ridosports.com,Sandeep@ridosports.com",
      subject,
      "",
      {
        htmlBody: brandedTenderEmailHtml_("Tender Reminder", `
          <p>Hello Team,</p>
          <p>This is a reminder that the tender bid end date is approaching.</p>
          <p><b>Bid ends on:</b> ${escapeHtml_(endDateStr)}<br/>
             <b>Reminder window:</b> D-${escapeHtml_(daysLeft)}</p>
          ${htmlTable}
          <p>Regards,<br/>Your CRM Team</p>
        `),
        cc: "info@klientkonnect.com"
      }
    );
    Logger.log("📧 Reminder email sent.");
    return true;
  } catch (err) {
    Logger.log(`❌ Reminder email failed: ${err.message}`);
    return false;
  }
}
