//Leads -- https://docs.google.com/spreadsheets/d/1vJbB0fmBQhd6XGTNbjUAi7Bt71lHNyau2TBMXTCdoM0/edit?usp=drive_link
//Deals -- https://docs.google.com/spreadsheets/d/1GoZiI3HMDA_Ohkr50wwQlCiYWnT5EcNgDW3dWiZAJU4/edit?usp=sharing
//Orders -- https://docs.google.com/spreadsheets/d/11hW2rcd5x4gmXFn2AO03FgOQ0Ec8wd3Ot8yTbAh7P2k/edit?gid=1143614880#gid=1143614880
//Accounts -- https://docs.google.com/spreadsheets/d/1K9JT7C88oOVdAvapDOieWaiYj6Wd_XRZ1CCNiYzUhG8/edit?gid=1121509308#gid=1121509308

function notifyCRMEntry() {
  const sheetConfigs = [
    { sheetId: '1vJbB0fmBQhd6XGTNbjUAi7Bt71lHNyau2TBMXTCdoM0', sheetName: 'Form responses 1', type: 'Lead', ownerField: 'Lead Owner' },
    { sheetId: '1GoZiI3HMDA_Ohkr50wwQlCiYWnT5EcNgDW3dWiZAJU4', sheetName: 'Form responses 1', type: 'Deal', ownerField: 'Account Owner' },
    { sheetId: '1K9JT7C88oOVdAvapDOieWaiYj6Wd_XRZ1CCNiYzUhG8', sheetName: 'Qualified Leads', type: 'Account', ownerField: 'Lead Owner' },
    { sheetId: '11hW2rcd5x4gmXFn2AO03FgOQ0Ec8wd3Ot8yTbAh7P2k', sheetName: 'Form responses 1', type: 'Order', ownerField: 'Account Owner' }
  ];

  const adminEmail = 'sidhant@ridosports.com, sandeep@ridosports.com, info@klientkonnect.com';
  const schedulerLink = 'https://crm.klientkonnect.com/calendar';

  for (let config of sheetConfigs) {
    Logger.log(`Checking sheet: ${config.type} (${config.sheetName})`);
    const sheet = SpreadsheetApp.openById(config.sheetId).getSheetByName(config.sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const notificationIndex = headers.indexOf('Notification Status');

    if (notificationIndex < 0) {
      Logger.log(`❌ 'Notification Status' column not found in ${config.type}`);
      continue;
    }

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const processed = row[notificationIndex];
      
      if (processed && processed.toString().trim() !== '') {
        Logger.log(`⏭️ Skipping row ${i + 1} — already processed with status: ${processed}`);
        continue;
      }

      const ownerName = row[headers.indexOf(config.ownerField)];
      const ownerEmail = getEmailFromValidation(ownerName);
      if (!ownerEmail) {
        Logger.log(`⚠️ No email found for ${ownerName} in ${config.type} row ${i + 1}`);
        continue;
      }

      const htmlTable = buildHTMLTable(headers, row);
      const subject = `New/Updated ${config.type} Notification`;
      const body = `Hi ${ownerName},<br><br>A new or updated ${config.type} record is available:<br><br>${htmlTable}<br><br>Click on the link to set up a meeting: <a href="${schedulerLink}" target="_blank">Schedule a Meeting</a><br><br>Regards,<br>Your CRM Team`;

      const conditionalCc = config.type === 'Order' ? `${adminEmail}, sudeep@ridosports.com` : adminEmail;
      if(config.type === 'Order'){
        Logger.log('Order Notification includes sudeep@ridosports.com in cc');
      }
      GmailApp.sendEmail(ownerEmail, subject, '', {
        cc: conditionalCc,
        htmlBody: body
      });

      Logger.log(`✅ Email sent to ${ownerEmail} for ${config.type} row ${i + 1}`);
      sheet.getRange(i + 1, notificationIndex + 1).setValue('Sent');
      Logger.log(`📌 Row ${i + 1} in ${config.type} marked as 'Sent'`);
    }
  }
  notifyQuotation();
}

function getEmailFromValidation(ownerName) {
  const sheet = SpreadsheetApp.openById('1YxYSLVuBrNOp8fYdA3s1dLzR3KFW0IaVMUvJ2AvY4aQ').getSheetByName('Validation Tables');
  const data = sheet.getDataRange().getValues();
  const nameIndex = data[0].indexOf('Lead Owner');
  const emailIndex = data[0].indexOf('Email');

  for (let i = 1; i < data.length; i++) {
    if (data[i][nameIndex] === ownerName) {
      return data[i][emailIndex];
    }
  }
  return null;
}

function buildHTMLTable(headers, row) {
  let html = '<table border="1" style="border-collapse: collapse;">';
  for (let i = 0; i < headers.length; i++) {
    html += `<tr><th style="padding:4px">${headers[i]}</th><td style="padding:4px">${row[i]}</td></tr>`;
  }
  html += '</table>';
  return html;
}

function notifyQuotation() {
  const config = {
    sheetId: '1vJbB0fmBQhd6XGTNbjUAi7Bt71lHNyau2TBMXTCdoM0', // Leads
    sheetName: 'Form responses 1',
    ownerField: 'Lead Owner',
    schedulerLink: 'https://crm.klientkonnect.com/calendar',
    salesTeam: 'sales2@ridosports.com',
    infoEmail: 'info@klientkonnect.com'
  };

  const STATUS_PREPARE = 'Pre-Qualified - Prepare Quote';
  const STATUS_READY   = 'Pre-Qualified - Quote Ready';

  // Notification state machine (forward-only)
  const NOTIF_SENT                = 'Sent';
  const NOTIF_QUOTE_UPDATE_SENT   = 'Quotation Update Sent';
  const NOTIF_QUOTE_PREPARED_SENT = 'Quotation Prepared & Update sent';

  Logger.log('▶️ notifyQuotation() start');

  const ss = SpreadsheetApp.openById(config.sheetId);
  const sheet = ss.getSheetByName(config.sheetName);
  if (!sheet) { Logger.log(`❌ Sheet not found: ${config.sheetName}`); return; }

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) { Logger.log('ℹ️ No data rows. Exiting.'); return; }

  const headers = data[0];
  const col = (h) => headers.indexOf(h);

  const idx = {
    ts:            bestHeaderIndex_(headers, ['Timestamp','Submission Timestamp','Created At']),
    leadId:        bestHeaderIndex_(headers, ['Lead ID','LeadId','ID']),
    company:       col('Company'),
    mobile:        bestHeaderIndex_(headers, ['Mobile Number','Phone','Contact Number']),
    status:        col('Lead Status'),
    notif:         col('Notification Status'),
    owner:         col(config.ownerField),
    quotationURL:  col('Quotation Link')
  };

  // Required columns
  if (idx.status < 0) { Logger.log(`❌ 'Lead Status' not found`); return; }
  if (idx.notif  < 0) { Logger.log(`❌ 'Notification Status' not found`); return; }
  if (idx.owner  < 0) { Logger.log(`❌ '${config.ownerField}' not found`); return; }

  Logger.log(`🧭 Columns -> ts:${idx.ts}, leadId:${idx.leadId}, company:${idx.company}, mobile:${idx.mobile}, status:${idx.status}, notif:${idx.notif}, owner:${idx.owner}, quotationURL:${idx.quotationURL}`);

  // 1) Group by LeadKey and pick latest row
  const latestForKey = {};
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const key = buildLeadKey_(row, idx);
    if (!key) {
      Logger.log(`⚠️ Row ${r+1}: could not build LeadKey (missing Lead ID and Company/Mobile). Skipping.`);
      continue;
    }
    if (latestForKey[key] == null) {
      latestForKey[key] = r;
    } else {
      const newer = isRowNewer_(row, data[latestForKey[key]], idx.ts);
      latestForKey[key] = newer ? r : latestForKey[key];
    }
  }
  Logger.log(`📦 Grouping complete. Unique lead keys: ${Object.keys(latestForKey).length}`);

  // 2) Process only latest rows per key
  Object.entries(latestForKey).forEach(([key, r]) => {
    const row = data[r];
    const tsRaw   = idx.ts >= 0 ? row[idx.ts] : '';
    const leadId  = idx.leadId >= 0 ? row[idx.leadId] : '';
    const company = idx.company >= 0 ? (row[idx.company] || '') : '';
    const mobile  = idx.mobile  >= 0 ? (row[idx.mobile]  || '') : '';
    const leadStatus = str_(row[idx.status]);
    const curNotif   = str_(row[idx.notif]);
    const ownerName  = row[idx.owner] || '';
    const ownerEmail = getEmailFromValidation(ownerName);
    const qLink      = idx.quotationURL >= 0 ? (row[idx.quotationURL] || '') : '';

    Logger.log(`\n🔎 Processing latest row for key "${key}" -> Row ${r+1}`);
    Logger.log(`   • Timestamp: ${tsRaw} | LeadID: ${leadId} | Company: ${company} | Mobile: ${mobile}`);
    Logger.log(`   • Lead Status: "${leadStatus}" | Current Notif: "${curNotif}" | Owner: "${ownerName}" => ${ownerEmail || 'no-email'}`);
    Logger.log(`   • Quotation Link present: ${qLink ? 'YES' : 'NO'}`);

    if (!ownerEmail) {
      Logger.log(`   ⚠️ No owner email for "${ownerName}". Skipping row ${r+1}.`);
      return;
    }

    // Stage: PREPARE → move to Quotation Update Sent (once)
    if (leadStatus === STATUS_PREPARE) {
      Logger.log(`   🟨 Stage = PREPARE. Target Notif: "${NOTIF_QUOTE_UPDATE_SENT}"`);
      if (!isAtLeast_(curNotif, NOTIF_QUOTE_UPDATE_SENT)) {
        const to = config.salesTeam;
        const cc = `${ownerEmail}, ${config.infoEmail}`;
        const subject = `Prepare Quote for Lead: ${company}`;
        const htmlTable = buildHTMLTable2(headers, row);
        const body = `
          Hi Team,<br><br>
          Please prepare a quotation for the following lead. Details below:<br><br>
          ${htmlTable}<br><br>
          Schedule (optional): <a href="${config.schedulerLink}" target="_blank">Open Scheduler</a><br><br>
          Regards,<br>Your CRM Team
        `;

        Logger.log(`   ✉️ Sending PREPARE email -> To: ${to} | CC: ${cc} | Subject: "${subject}"`);
        try {
          GmailApp.sendEmail(to, subject, '', { cc, htmlBody: body });
          Logger.log(`   ✅ Email sent. Updating Notification Status -> "${NOTIF_QUOTE_UPDATE_SENT}"`);
          sheet.getRange(r+1, idx.notif+1).setValue(NOTIF_QUOTE_UPDATE_SENT);
        } catch (e) {
          Logger.log(`   ❗ FAILED to send PREPARE email: ${e.message}`);
        }
      } else {
        Logger.log(`   ⏭️ Already at/above "${NOTIF_QUOTE_UPDATE_SENT}". No action.`);
      }
      return; // done for PREPARE
    }

    // Stage: READY → move to Quotation Prepared & Update sent (once)
    if (leadStatus === STATUS_READY) {
      Logger.log(`   🟩 Stage = READY. Target Notif: "${NOTIF_QUOTE_PREPARED_SENT}"`);
      if (!isAtLeast_(curNotif, NOTIF_QUOTE_PREPARED_SENT)) {
        const to = ownerEmail; // END USER = Lead Owner
        const cc = `${config.salesTeam}, ${config.infoEmail}`;
        const subject = `Quote Ready — ${company}`;
        const htmlTable = buildHTMLTable2(headers, row);
        const quoteCta = qLink && looksLikeUrl_(qLink)
          ? `<p>Quotation link: <a href="${qLink}" target="_blank">${qLink}</a></p>`
          : '';
        if (!quoteCta) {
          Logger.log(`   ℹ️ No valid Quotation Link. Proceeding without CTA.`);
        }

        const body = `
          Hi ${sanitize_(ownerName)},<br><br>
          Your quotation for <b>${sanitize_(company)}</b> is ready.${quoteCta}
          <p>Book follow-up: <a href="${config.schedulerLink}" target="_blank">Open Scheduler</a></p>
          <p>Summary:</p>
          ${htmlTable}
          <br>
          Regards,<br>Your CRM Team
        `;

        Logger.log(`   ✉️ Sending READY email -> To: ${to} | CC: ${cc} | Subject: "${subject}"`);
        try {
          GmailApp.sendEmail(to, subject, '', { cc, htmlBody: body });
          Logger.log(`   ✅ Email sent. Updating Notification Status -> "${NOTIF_QUOTE_PREPARED_SENT}"`);
          sheet.getRange(r+1, idx.notif+1).setValue(NOTIF_QUOTE_PREPARED_SENT);
        } catch (e) {
          Logger.log(`   ❗ FAILED to send READY email: ${e.message}`);
        }
      } else {
        Logger.log(`   ⏭️ Already at/above "${NOTIF_QUOTE_PREPARED_SENT}". No action.`);
      }
      return; // done for READY
    }

    Logger.log(`   🔹 Status "${leadStatus}" not targeted. Skipping.`);
  });

  Logger.log('✅ notifyQuotation() complete');
}

// ---------- helpers with extra logging ----------

function bestHeaderIndex_(headers, candidates) {
  for (const name of candidates) {
    const i = headers.indexOf(name);
    if (i >= 0) return i;
  }
  return -1;
}

function str_(v) { return (v == null) ? '' : String(v).trim(); }

function parseTimestamp_(v) {
  if (!v) return null;
  if (v instanceof Date) return v.getTime();
  const s = String(v).trim();
  const d1 = new Date(s);
  if (!isNaN(d1.getTime())) return d1.getTime();
  const m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [ , dd, mm, yyyy, HH='00', MM='00', SS='00'] = m;
    const d = new Date(Number(yyyy), Number(mm)-1, Number(dd), Number(HH), Number(MM), Number(SS));
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return null;
}

function isRowNewer_(rowA, rowB, tsIndex) {
  if (tsIndex >= 0) {
    const ta = parseTimestamp_(rowA[tsIndex]);
    const tb = parseTimestamp_(rowB[tsIndex]);
    if (ta != null && tb != null) {
      const newer = ta > tb;
      Logger.log(`      • Compare TS -> A:${ta} vs B:${tb} :: A newer? ${newer}`);
      return newer;
    }
  }
  // fallback: later row number considered newer
  Logger.log(`      • No valid TS compare. Using row order (A newer).`);
  return true;
}

function buildLeadKey_(row, idx) {
  if (idx.leadId >= 0) {
    const v = str_(row[idx.leadId]);
    if (v) return `ID::${v}`;
  }
  const company = (idx.company >= 0) ? str_(row[idx.company]) : '';
  const mobile  = (idx.mobile  >= 0) ? str_(row[idx.mobile])  : '';
  if (!company && !mobile) return null;
  return `CMP+MOB::${company}::${mobile}`;
}

function looksLikeUrl_(v) {
  if (!v) return false;
  try { const u = new URL(v); return !!u.protocol && !!u.host; }
  catch (e) { return false; }
}

function sanitize_(val) {
  const s = (val === null || val === undefined) ? '' : String(val);
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildHTMLTable2(headers, row) {
  let html = '<table border="1" style="border-collapse: collapse;">';
  for (let i = 0; i < headers.length; i++) {
    let displayValue = row[i];
    if (headers[i] === 'Mobile Number' && typeof displayValue === 'string') {
      const len = displayValue.length;
      const last4 = displayValue.slice(-4);
      displayValue = '*'.repeat(Math.max(0, len - 4)) + last4;
    }
    html += `<tr><th style="padding:4px;text-align:left">${sanitize_(headers[i])}</th><td style="padding:4px">${sanitize_(displayValue)}</td></tr>`;
  }
  html += '</table>';
  return html;
}

/**
 * Stage ordering:
 *   Sent < Quotation Update Sent < Quotation Prepared & Update sent
 */
function isAtLeast_(current, target) {
  const order = [ 'Sent', 'Quotation Update Sent', 'Quotation Prepared & Update sent' ];
  const pos = (v) => Math.max(0, order.indexOf(v));
  const res = pos(current) >= pos(target);
  Logger.log(`      • isAtLeast? current="${current}" (${pos(current)}) vs target="${target}" (${pos(target)}) => ${res}`);
  return res;
}


