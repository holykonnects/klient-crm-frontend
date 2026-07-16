// === Sheet Constants ===
const SALES_TRACKER_SHEET_ID = '1XV4CJLt8nP512e39YK9RmYFO2llxyNCtmuphXgT8p2E';
const SALES_TRACKER_SHEET_NAME = 'Sheet1';

const VALIDATION_SHEET_ID = '1YxYSLVuBrNOp8fYdA3s1dLzR3KFW0IaVMUvJ2AvY4aQ';
const VALIDATION_SHEET_NAME = 'Sales Tracker Validation Tables';

function doGet(e) {
  const action = e.parameter.action;
  const sheetName = e.parameter.sheetName || SALES_TRACKER_SHEET_NAME;

  if (!action) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Missing action parameter' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getData') {
    return getSalesData(sheetName);
  }

  if (action === 'getValidationOptions') {
    return getValidationOptions(VALIDATION_SHEET_NAME);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSalesData(sheetName) {
  const ss = SpreadsheetApp.openById(SALES_TRACKER_SHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  const [headers, ...rows] = sheet.getDataRange().getValues();

  const data = rows.map(row => {
    let obj = {};
    headers.forEach((key, i) => obj[key] = row[i]);
    return obj;
  });

  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getValidationOptions(sheetName) {
  const ss = SpreadsheetApp.openById(VALIDATION_SHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();

  const headers = data[0];
  const options = {};

  headers.forEach((header, colIndex) => {
    const colValues = data.slice(1).map(row => row[colIndex]).filter(val => val);
    options[header] = [...new Set(colValues)];
  });

  return ContentService.createTextOutput(JSON.stringify(options))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const sheet = SpreadsheetApp.openById('1XV4CJLt8nP512e39YK9RmYFO2llxyNCtmuphXgT8p2E').getSheetByName('Sheet1');
  const body = JSON.parse(e.postData.contents);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = headers.map(h => body[h] || '');

  // Edit in place by originalSNo if provided
  if (body.mode === 'edit' && body.originalSNo != null) {
    const data = sheet.getDataRange().getValues();
    const snoIdx = headers.indexOf('S.No');
    for (let i = 1; i < data.length; i++) {
      const currentSno = data[i][snoIdx];
      if (String(currentSno) === String(body.originalSNo)) {
        sheet.getRange(i + 1, 1, 1, headers.length).setValues([rowData]);
        return ContentService.createTextOutput(JSON.stringify({ status: 'updated' })).setMimeType(ContentService.MimeType.JSON);
      }
    }
  }

  // Fallback: add new
  sheet.appendRow(rowData);
  return ContentService.createTextOutput(JSON.stringify({ status: 'added' })).setMimeType(ContentService.MimeType.JSON);
}
