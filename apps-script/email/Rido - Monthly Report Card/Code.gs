let cachedData = {};

const VALIDATION_SPREADSHEET_ID = '1YxYSLVuBrNOp8fYdA3s1dLzR3KFW0IaVMUvJ2AvY4aQ';
const SALES_TRACKER_SPREADSHEET_ID = '1XV4CJLt8nP512e39YK9RmYFO2llxyNCtmuphXgT8p2E';
const SALES_TRACKER_SHEET_NAME = 'Sheet1';
const ADMIN_PREVIEW_RECIPIENTS = 'holy@klientkonnect.com,Sandeep@ridosports.com,sidhant@ridosports.com';
const EMAIL_PUBLIC_APP_URL = 'https://crm.klientkonnect.com';
const EMAIL_FONT_STACK = 'Montserrat, Arial, sans-serif';

function doGet(e) {
  const query = e.parameter;
  if (query.action === 'previewQuarterlyBilling') {
    previewQuarterlyBillingEmails();
    return ContentService.createTextOutput("✅ Quarterly billing preview sent successfully.");
  } else if (query.action === 'sendQuarterlyBilling') {
    runAndSendQuarterlyBillingEmails();
    return ContentService.createTextOutput("✅ Quarterly billing emails sent successfully.");
  } else if (query.confirm === 'true' && query.month) {
    const [year, month] = query.month.split('-');
    const startDate = new Date(`${year}-${month}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);
    runAndSendMonthlyEmails();
    return ContentService.createTextOutput("✅ Emails sent successfully.");
  } else {
    return ContentService.createTextOutput("⚠️ Invalid or missing parameters.");
  }
}

function getHtmlTableFromRows(rows, headers) {
  if (!rows || rows.length === 0) return '<p>No records available.</p>';
  let html = `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-spacing:0;margin:18px 0;border:1px solid #d9e3f0;background:#ffffff;font-family:${EMAIL_FONT_STACK};font-size:12px;">`;
  html += `<tr>${headers.map(h => `<th style="background:#eef4ff;color:#172033;border:1px solid #d9e3f0;padding:10px 12px;text-align:left;font-size:12px;line-height:1.45;font-weight:700;vertical-align:top;">${escapeHtml_(h)}</th>`).join('')}</tr>`;
  rows.forEach(row => {
    html += '<tr>' + headers.map(h => `<td style="border:1px solid #d9e3f0;padding:9px 12px;color:#243447;font-size:12px;line-height:1.5;vertical-align:top;">${escapeHtml_(row[h] || '')}</td>`).join('') + '</tr>';
  });
  html += '</table>';
  return html;
}

function getEmailMap() {
  const sheet = SpreadsheetApp.openById(VALIDATION_SPREADSHEET_ID).getSheetByName('Validation Tables');
  const data = sheet.getDataRange().getValues();
  const map = {};
  Logger.log('📧 Email Mapping Log:');
  for (let i = 1; i < data.length; i++) {
    const name = data[i][0]; // Column A: Name
    const email = data[i][4]; // Column E: Email
    if (name && email) {
      map[name] = email;
      Logger.log(`${name} => ${email}`);
    }
  }
  cachedData['EmailMap'] = map;
  return map;
}

function safeText_(value) {
  return (value === null || value === undefined) ? '' : String(value).trim();
}

function normalizeName_(value) {
  return safeText_(value).replace(/\s+/g, ' ').toLowerCase();
}

function escapeHtml_(value) {
  return safeText_(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function brandedReportEmailHtml_(title, contentHtml) {
  return `
    <div style="margin:0;padding:0;background:#f3f6fb;font-family:${EMAIL_FONT_STACK};color:#172033;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;margin:0;padding:28px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:920px;background:#ffffff;border:1px solid #e4ebf5;border-radius:8px;overflow:hidden;">
              <tr>
                <td bgcolor="#ffffff" style="padding:18px 24px;background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);border-bottom:4px solid #6495ED;">
                  <table role="presentation" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);border:1px solid #e4ebf5;border-radius:8px;"><tr><td bgcolor="#ffffff" style="padding:10px 14px;background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);">
                    <img src="${EMAIL_PUBLIC_APP_URL}/assets/rido-sports-logo.png" alt="Rido Sports" style="display:block;max-width:170px;max-height:64px;width:auto;height:auto;" />
                  </td></tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:30px 28px 24px 28px;font-size:13px;line-height:1.6;color:#172033;">
                  <h2 style="margin:0 0 16px 0;color:#172033;font-size:20px;line-height:1.3;">${escapeHtml_(title)}</h2>
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

function parseAmount_(value) {
  const cleaned = safeText_(value).replace(/[₹,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency_(value) {
  return '₹' + (Number(value) || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });
}

function formatDate_(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

function parseSheetDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  const text = safeText_(value);
  if (!text) return null;
  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function getBillingAliasMap() {
  const sheet = SpreadsheetApp.openById(VALIDATION_SPREADSHEET_ID).getSheetByName('Validation Tables');
  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(1, 8, lastRow, 3).getValues(); // H:J Alias Name, Maps To, Email
  const aliases = {};
  const emailOverrides = {};

  for (let i = 1; i < data.length; i++) {
    const aliasName = safeText_(data[i][0]);
    const mapsTo = safeText_(data[i][1]);
    const email = safeText_(data[i][2]);

    if (aliasName && mapsTo) {
      aliases[normalizeName_(aliasName)] = { owner: mapsTo, email };
    }

    if (mapsTo && email) {
      emailOverrides[mapsTo] = email;
    }
  }

  cachedData['BillingAliases'] = { aliases, emailOverrides };
  return cachedData['BillingAliases'];
}

function getBillingRecipientMap() {
  const emailMap = cachedData['EmailMap'] || getEmailMap();
  const aliasData = cachedData['BillingAliases'] || getBillingAliasMap();
  return Object.assign({}, emailMap, aliasData.emailOverrides || {});
}

function resolveBillingOwner_(salesPersonName) {
  const raw = safeText_(salesPersonName);
  if (!raw) return 'Unassigned';

  const aliasData = cachedData['BillingAliases'] || getBillingAliasMap();
  const match = (aliasData.aliases || {})[normalizeName_(raw)];
  return match?.owner || raw;
}

function getLastCompletedQuarterRange() {
  const today = new Date();
  const currentQuarterIndex = Math.floor(today.getMonth() / 3);
  let year = today.getFullYear();
  let quarterIndex = currentQuarterIndex - 1;

  if (quarterIndex < 0) {
    quarterIndex = 3;
    year -= 1;
  }

  const startMonth = quarterIndex * 3;
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  const label = `Q${quarterIndex + 1} ${year}`;

  return { startDate, endDate, label };
}

function mapSalesTrackerBilling(startDate, endDate) {
  const sheet = SpreadsheetApp.openById(SALES_TRACKER_SPREADSHEET_ID).getSheetByName(SALES_TRACKER_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const dateIndex = headers.indexOf('Date');
  const amountIndex = headers.indexOf('Basic Value');
  const ownerIndex = headers.indexOf('Sales Person Name');

  if ([dateIndex, amountIndex, ownerIndex].includes(-1)) {
    Logger.log('❌ Header columns not found in Sales Tracker billing data.');
    cachedData['BillingManaged'] = { summary: {}, rows: {} };
    return cachedData['BillingManaged'];
  }

  getBillingAliasMap();

  const summary = {};
  const rows = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const billingDate = parseSheetDate_(row[dateIndex]);
    if (!billingDate || billingDate < startDate || billingDate > endDate) continue;

    const owner = resolveBillingOwner_(row[ownerIndex]);
    const amount = parseAmount_(row[amountIndex]);
    if (!summary[owner]) summary[owner] = { count: 0, total: 0 };
    if (!rows[owner]) rows[owner] = [];

    summary[owner].count += 1;
    summary[owner].total += amount;

    const mapped = asMap(headers, row);
    mapped['Billing Owner'] = owner;
    mapped['Billing Date'] = billingDate;
    rows[owner].push(mapped);
  }

  cachedData['BillingManaged'] = { summary, rows };
  return cachedData['BillingManaged'];
}

function getBillingManagedHtmlTable(rows) {
  if (!rows || rows.length === 0) return '<p>No billing records available.</p>';

  const headers = ['Date', 'Company', 'Invoice No.', 'Sale Type', 'Description', 'Basic Value', 'Sales Person Name'];
  let html = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; border: 1px solid #d1d5db; font-family: Montserrat, Arial, sans-serif; font-size: 12px; width: 100%;">`;
  html += `<tr style="background-color: #f3f7ff;">${headers.map(h => `<th align="left">${h}</th>`).join('')}</tr>`;

  rows.forEach(row => {
    html += '<tr>';
    headers.forEach(header => {
      let value = row[header] || '';
      if (header === 'Date') value = formatDate_(row['Billing Date']);
      if (header === 'Basic Value') value = formatCurrency_(parseAmount_(row[header]));
      const align = header === 'Basic Value' ? 'right' : 'left';
      html += `<td align="${align}">${escapeHtml_(value)}</td>`;
    });
    html += '</tr>';
  });

  html += '</table>';
  return html;
}

function buildQuarterlyBillingEmailHtml(owner, ownerSummary, ownerRows, quarterInfo) {
  return `
    <div style="font-family: Montserrat, Arial, sans-serif; color: #1f2937; max-width: 920px; margin: 0 auto;">
      <div style="border-bottom: 4px solid #6495ED; padding: 18px 0 14px;">
        <h2 style="margin: 0; color: #6495ED; font-size: 22px;">Quarterly Billing Managed Summary</h2>
        <p style="margin: 6px 0 0; font-size: 13px;">${escapeHtml_(quarterInfo.label)} | ${formatDate_(quarterInfo.startDate)} to ${formatDate_(quarterInfo.endDate)}</p>
      </div>

      <div style="padding: 18px 0;">
        <p style="margin: 0 0 6px; font-size: 14px;">Hi ${escapeHtml_(owner)},</p>
        <p style="margin: 0; font-size: 13px; line-height: 1.6;">
          Please find below your quarterly billing managed summary from the Sales Tracker.
        </p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 22px;">
        <tr>
          <td style="background: #eefaf3; border: 1px solid #cdebd8; padding: 14px;">
            <div style="font-size: 12px; color: #6b7280;">Billing Managed</div>
            <div style="font-size: 24px; font-weight: 700;">${formatCurrency_(ownerSummary.total)}</div>
          </td>
          <td style="background: #f3f7ff; border: 1px solid #d8e4ff; padding: 14px;">
            <div style="font-size: 12px; color: #6b7280;">Billing Records</div>
            <div style="font-size: 24px; font-weight: 700;">${ownerSummary.count || 0}</div>
          </td>
        </tr>
      </table>

      <h3 style="font-size: 15px; margin: 24px 0 8px;">Billing Managed Details</h3>
      ${getBillingManagedHtmlTable(ownerRows)}

      <div style="margin-top: 28px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280;">
        This is an automated quarterly billing summary from Klient Konnect.
      </div>
    </div>
  `;
}

function previewQuarterlyBillingEmails() {
  getEmailMap();
  getBillingAliasMap();
  const quarterInfo = getLastCompletedQuarterRange();
  const billing = mapSalesTrackerBilling(quarterInfo.startDate, quarterInfo.endDate);
  const recipientMap = getBillingRecipientMap();

  let html = `<h2 style="font-family: Montserrat;">Quarterly Billing Managed Preview - ${quarterInfo.label}</h2>`;
  html += `<p style="font-family: Montserrat;">${formatDate_(quarterInfo.startDate)} to ${formatDate_(quarterInfo.endDate)}</p>`;
  html += `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-family: Montserrat, Arial, sans-serif; font-size: 12px;">
    <tr style="background-color: #f3f7ff;"><th>Owner</th><th>Email</th><th>Records</th><th>Billing Managed</th></tr>`;

  Object.keys(billing.summary || {}).sort().forEach(owner => {
    const s = billing.summary[owner];
    html += `<tr><td>${escapeHtml_(owner)}</td><td>${escapeHtml_(recipientMap[owner] || 'Missing email')}</td><td>${s.count || 0}</td><td align="right">${formatCurrency_(s.total)}</td></tr>`;
  });

  html += '</table>';

  GmailApp.sendEmail(ADMIN_PREVIEW_RECIPIENTS, `Quarterly Billing Managed Preview - ${quarterInfo.label}`, '', {
    htmlBody: brandedReportEmailHtml_(`Quarterly Billing Managed Preview - ${quarterInfo.label}`, html),
  });
}

function sendQuarterlyBillingEmails(startDate, endDate, label) {
  getEmailMap();
  getBillingAliasMap();
  const quarterInfo = { startDate, endDate, label };
  const billing = mapSalesTrackerBilling(startDate, endDate);
  const recipientMap = getBillingRecipientMap();

  Object.keys(billing.summary || {}).forEach(owner => {
    const email = recipientMap[owner];
    if (!email) {
      Logger.log(`Quarterly billing email skipped: missing email for ${owner}`);
      return;
    }

    const html = buildQuarterlyBillingEmailHtml(
      owner,
      billing.summary[owner],
      billing.rows[owner] || [],
      quarterInfo
    );

    try {
      GmailApp.sendEmail(email, `Quarterly Billing Managed - ${label}`, '', {
        htmlBody: brandedReportEmailHtml_(`Quarterly Billing Managed - ${label}`, html),
      });
      Logger.log(`✅ Quarterly billing email sent to: ${owner} (${email})`);
    } catch (err) {
      Logger.log(`❌ Failed to send quarterly billing email to: ${owner} (${email}) — ${err.message}`);
    }
  });
}

function runAndSendQuarterlyBillingEmails() {
  const quarterInfo = getLastCompletedQuarterRange();
  sendQuarterlyBillingEmails(quarterInfo.startDate, quarterInfo.endDate, quarterInfo.label);
}

function testLeadsDataMapping() {
  const sheetId = '1vJbB0fmBQhd6XGTNbjUAi7Bt71lHNyau2TBMXTCdoM0';
  const sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Form Responses 1');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const ownerColName = 'Lead Owner';
  const dateColName = 'Timestamp';
  const idColName = 'Lead ID';
  const startDate = getLastMonthStart();
  const endDate = getLastMonthEnd();
  const ownerColIndex = headers.indexOf(ownerColName);
  const dateColIndex = headers.indexOf(dateColName);
  const idColIndex = headers.indexOf(idColName);

  if ([ownerColIndex, dateColIndex, idColIndex].includes(-1)) {
    Logger.log('❌ Header columns not found in leads.');
    return;
  }

  const summary = {};
  const raw = {};
  const seen = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const owner = row[ownerColIndex];
    const timestamp = row[dateColIndex];
    const id = row[idColIndex];
    const parsedDate = new Date(timestamp);

    if (owner && id && parsedDate && parsedDate >= startDate && parsedDate <= endDate) {
      if (!seen[owner]) seen[owner] = new Set();
      if (!seen[owner].has(id)) {
        seen[owner].add(id);
        summary[owner] = (summary[owner] || 0) + 1;
      }
      if (!raw[owner]) raw[owner] = [];
      raw[owner].push(asMap(headers, row));
    }
  }

  Logger.log('✅ Lead Mapping Summary:');
  Object.keys(summary).forEach(owner => {
    Logger.log(`${owner}: ${summary[owner]} leads`);
  });

  cachedData['Leads'] = { summary, rows: raw };
}

function testAccountsDataMapping() {
  const sheetId = '1K9JT7C88oOVdAvapDOieWaiYj6Wd_XRZ1CCNiYzUhG8';
  const sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Qualified Leads');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const ownerColName = 'Lead Owner';
  const dateColName = 'Qualification Code';
  const idColName = 'Lead ID';
  const startDate = getLastMonthStart();
  const endDate = getLastMonthEnd();
  const ownerColIndex = headers.indexOf(ownerColName);
  const dateColIndex = headers.indexOf(dateColName);
  const idColIndex = headers.indexOf(idColName);

  if ([ownerColIndex, dateColIndex, idColIndex].includes(-1)) {
    Logger.log('❌ Header columns not found in accounts.');
    return;
  }

  const summary = {};
  const raw = {};
  const seen = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const owner = row[ownerColIndex];
    const timestamp = row[dateColIndex];
    const id = row[idColIndex];
    const parsedDate = parseCustomTimestamp(timestamp);

    if (owner && id && parsedDate && parsedDate >= startDate && parsedDate <= endDate) {
      if (!seen[owner]) seen[owner] = new Set();
      if (!seen[owner].has(id)) {
        seen[owner].add(id);
        summary[owner] = (summary[owner] || 0) + 1;
      }
      if (!raw[owner]) raw[owner] = [];
      raw[owner].push(asMap(headers, row));
    }
  }

  Logger.log('✅ Account Mapping Summary:');
  Object.keys(summary).forEach(owner => {
    Logger.log(`${owner}: ${summary[owner]} accounts`);
  });

  cachedData['Accounts'] = { summary, rows: raw };
}

function testDealDataMapping() {
  const sheetId = '1GoZiI3HMDA_Ohkr50wwQlCiYWnT5EcNgDW3dWiZAJU4';
  const sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Form Responses 1');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const ownerColName = 'Account Owner';
  const dateColName = 'Timestamp';
  const amountColName = 'Deal Amount';
  const stageColName = 'Stage';
  const idColName = 'Distribution Timestamp';
  const startDate = getLastMonthStart();
  const endDate = getLastMonthEnd();
  const ownerColIndex = headers.indexOf(ownerColName);
  const dateColIndex = headers.indexOf(dateColName);
  const amountColIndex = headers.indexOf(amountColName);
  const stageColIndex = headers.indexOf(stageColName);
  const idColIndex = headers.indexOf(idColName);

  if ([ownerColIndex, dateColIndex, amountColIndex, stageColIndex, idColIndex].includes(-1)) {
    Logger.log('❌ Header columns not found in deals.');
    return;
  }

  const summary = {};
  const raw = {};
  const seen = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const owner = row[ownerColIndex];
    const timestamp = row[dateColIndex];
    const id = row[idColIndex];
    const parsedDate = new Date(timestamp);
    const stage = row[stageColIndex];
    const amount = parseFloat(row[amountColIndex]) || 0;

    if (owner && id && parsedDate && parsedDate >= startDate && parsedDate <= endDate) {
      if (!seen[owner]) seen[owner] = new Set();
      if (!seen[owner].has(id)) {
        seen[owner].add(id);
        if (!summary[owner]) summary[owner] = { total: 0, open: 0, won: 0, lost: 0, openValue: 0, wonValue: 0, lostValue: 0 };
        summary[owner].total++;
        if (stage === 'Closed Won') {
          summary[owner].won++;
          summary[owner].wonValue += amount;
        } else if (stage === 'Closed Lost') {
          summary[owner].lost++;
          summary[owner].lostValue += amount;
        } else {
          summary[owner].open++;
          summary[owner].openValue += amount;
        }
      }
      if (!raw[owner]) raw[owner] = [];
      raw[owner].push(asMap(headers, row));
    }
  }

  Logger.log('✅ Deal Mapping Summary:');
  Object.keys(summary).forEach(owner => {
    const s = summary[owner];
    Logger.log(`${owner}: Total=${s.total}, Open=${s.open}, Won=${s.won}, Lost=${s.lost}, ₹Open=${s.openValue}, ₹Won=${s.wonValue}, ₹Lost=${s.lostValue}`);
  });

  cachedData['Deals'] = { summary, rows: raw };
}

function asMap(headers, row) {
  const map = {};
  headers.forEach((h, i) => {
    map[h] = row[i];
  });
  return map;
}

function parseCustomTimestamp(str) {
  if (!str || typeof str !== 'string' || str.length < 14) return null;
  const y = str.substring(0, 4);
  const m = str.substring(4, 6);
  const d = str.substring(6, 8);
  const h = str.substring(8, 10);
  const min = str.substring(10, 12);
  const s = str.substring(12, 14);
  return new Date(`${y}-${m}-${d}T${h}:${min}:${s}`);
}

function getLastMonthStart() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() - 1, 1);
}

function getLastMonthEnd() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
}

function previewMonthlyPerformanceEmails() {
  const today = new Date();
  const reportMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const year = reportMonth.getFullYear();
  const month = ('0' + (reportMonth.getMonth() + 1)).slice(-2);
  const startDate = new Date(`${year}-${month}-01T00:00:00`);
  const endDate = new Date(year, reportMonth.getMonth() + 1, 0);

  getEmailMap();
  testLeadsDataMapping();
  testAccountsDataMapping();
  testDealDataMapping();

  const emailMap = cachedData['EmailMap'] || {};
  const leads = cachedData['Leads'] || {};
  const accounts = cachedData['Accounts'] || {};
  const deals = cachedData['Deals'] || {};

  let html = `<h2 style="font-family: Montserrat;">CRM Summary Preview – ${reportMonth.toLocaleString('default', { month: 'long' })} ${year}</h2>`;
  html += `<table style="border-collapse: collapse; font-family: Montserrat;" border="1" cellpadding="5" cellspacing="0">
    <tr style="background-color: #f0f0f0;"><th>Owner</th><th>Leads</th><th>Accounts</th><th>Total Deals</th><th>Open Deals</th><th>Won Deals</th><th>Lost Deals</th><th>Open ₹</th><th>Won ₹</th><th>Lost ₹</th></tr>`;

  const owners = new Set([
    ...Object.keys(leads.summary || {}),
    ...Object.keys(accounts.summary || {}),
    ...Object.keys(deals.summary || {})
  ]);

  owners.forEach(owner => {
    const leadCount = leads.summary?.[owner] || 0;
    const accCount = accounts.summary?.[owner] || 0;
    const deal = deals.summary?.[owner] || {};

    html += `<tr><td>${owner}</td><td>${leadCount}</td><td>${accCount}</td><td>${deal.total || 0}</td>
      <td>${deal.open || 0}</td><td>${deal.won || 0}</td><td>${deal.lost || 0}</td>
      <td>₹${deal.openValue || 0}</td><td>₹${deal.wonValue || 0}</td><td>₹${deal.lostValue || 0}</td></tr>`;
  });

  html += `</table><br><br>`;

  owners.forEach(owner => {
    html += `<h3 style="font-family: Montserrat;">Details for ${owner}</h3>`;

    const leadRows = leads.rows?.[owner] || [];
    const accRows = accounts.rows?.[owner] || [];
    const dealRows = deals.rows?.[owner] || [];

    const leadTable = getHtmlTableFromRows(leadRows, ["First Name", "Last Name", "Company", "Mobile Number", "Email ID", "Lead Source", "Lead Status", "Description"]);
    const accTable = getHtmlTableFromRows(accRows, ["First Name", "Last Name", "Company", "Mobile Number", "Email ID", "Lead Source", "Lead Status", "Description"]);
    const dealTable = getHtmlTableFromRows(dealRows, ["First Name", "Last Name", "Company", "Mobile Number", "Email ID", "Lead Source", "Description", "Deal Name", "Type", "Deal Amount", "Next Step", "Product Required", "Stage"]);

    if (leadRows.length > 0) html += `<h4 style="font-family: Montserrat;">Leads</h4>${leadTable}`;
    if (accRows.length > 0) html += `<h4 style="font-family: Montserrat;">Accounts</h4>${accTable}`;
    if (dealRows.length > 0) html += `<h4 style="font-family: Montserrat;">Deals</h4>${dealTable}`;

    html += `<br>`;
  });

  //html += `<p>Click below to confirm and send the summary emails to all mapped owners:</p>`;
  //html += `<a href="https://script.google.com/macros/s/AKfycbyI_JPnn8YmIkcx0-uPuwLCi3Q5jwFOhk2N8RSgKC-68_b64bEgSvmsUdMplM5XIIsZ/exec?confirm=true&month=${year}-${month}" target="_blank">
    //✅ Confirm & Send Emails
  //</a>`;

  GmailApp.sendEmail('holy@klientkonnect.com,Sandeep@ridosports.com,sidhant@ridosports.com', `CRM Summary Preview – ${month}/${year}`, '', {
    htmlBody: brandedReportEmailHtml_(`CRM Summary Preview - ${month}/${year}`, html)
  });
}

function sendMonthlyPerformanceEmails(startDate, endDate) {
  const emailMap = cachedData['EmailMap'];
  const leads = cachedData['Leads'] || {};
  const accounts = cachedData['Accounts'] || {};
  const deals = cachedData['Deals'] || {};

  for (const owner in emailMap) {
    const email = emailMap[owner];
    const leadRows = (leads.rows && leads.rows[owner]) || [];
    const accountRows = (accounts.rows && accounts.rows[owner]) || [];
    const dealRows = (deals.rows && deals.rows[owner]) || [];

    const leadHeaders = ["First Name", "Last Name", "Company", "Mobile Number", "Email ID", "Lead Source", "Lead Status", "Description"];
    const accountHeaders = ["First Name", "Last Name", "Company", "Mobile Number", "Email ID", "Lead Source", "Lead Status", "Description"];
    const dealHeaders = ["First Name", "Last Name", "Company", "Mobile Number", "Email ID", "Lead Source", "Description", "Deal Name", "Type", "Deal Amount", "Next Step", "Product Required", "Stage"];

    let html = `<h2 style="font-family: Montserrat;">CRM Summary – ${startDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>`;
    html += `<h3 style="font-family: Montserrat;">${owner}</h3>`;

    html += `<h4 style="font-family: Montserrat;">Leads</h4>`;
    html += getHtmlTableFromRows(leadRows, leadHeaders);

    html += `<h4 style="font-family: Montserrat;">Accounts</h4>`;
    html += getHtmlTableFromRows(accountRows, accountHeaders);

    html += `<h4 style="font-family: Montserrat;">Deals</h4>`;
    html += getHtmlTableFromRows(dealRows, dealHeaders);

    try {
      GmailApp.sendEmail(email, `CRM Summary – ${startDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`, '', {
        htmlBody: brandedReportEmailHtml_(`CRM Summary - ${startDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`, html)
      });
      Logger.log(`✅ Email sent to: ${owner} (${email})`);
    } catch (err) {
      Logger.log(`❌ Failed to send email to: ${owner} (${email}) — ${err.message}`);
    }
  }
}

function runAndSendMonthlyEmails() {
  getEmailMap();
  testLeadsDataMapping();
  testAccountsDataMapping();
  testDealDataMapping();
  const startDate = getLastMonthStart();
  const endDate = getLastMonthEnd();
  sendMonthlyPerformanceEmails(startDate, endDate);
}
