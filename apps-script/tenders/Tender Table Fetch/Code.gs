var TENDER_UPLOAD_FOLDER_ID = '1NxWIZserHmgDu3HpWS1tTy050qh9XW1bgOPrccHMVQ9Vve74t4NWuoUf-DQOT93IU5MyxZ1N';
var TENDER_FILE_FIELDS = {
  'Authorization Certificate': true
};

function safeString_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function uploadTenderFile_(fileObj, label, context) {
  if (!fileObj || typeof fileObj !== 'object') return '';

  var base64 = fileObj.base64 || '';
  if (!base64) return '';

  var bytes = Utilities.base64Decode(base64);
  var contentType = fileObj.type || 'application/octet-stream';
  var originalName = safeString_(fileObj.name) || 'file';
  var bidNumber = safeString_(context && context.bidNumber);
  var prefix = bidNumber ? ('Tender ' + bidNumber) : 'Tender';
  var stampedName = prefix + ' - ' + label + ' - ' + originalName;
  var blob = Utilities.newBlob(bytes, contentType, stampedName);
  var folder = DriveApp.getFolderById(TENDER_UPLOAD_FOLDER_ID);
  var file = folder.createFile(blob);

  return file.getUrl();
}

function doGet(e) {
  const action = e.parameter.action;

  if (action === 'dropdowns') {
    const sheet = SpreadsheetApp.openById('1YxYSLVuBrNOp8fYdA3s1dLzR3KFW0IaVMUvJ2AvY4aQ')
                   .getSheetByName('Tender Validation Tables');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const dropdowns = {};

    headers.forEach((header, col) => {
      dropdowns[header] = [];
      for (let row = 1; row < data.length; row++) {
        const val = data[row][col];
        if (val) dropdowns[header].push(val);
      }
    });

    return ContentService.createTextOutput(JSON.stringify(dropdowns)).setMimeType(ContentService.MimeType.JSON);
  }

  // Default: Fetch Tender Fields (from Form responses 1)
  const sheet = SpreadsheetApp.openById('1XCO4ycfxAIhZdNr9qGZluAEH7BwPbF-rSfhQc1yvszI')
                 .getSheetByName('Form responses 1');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const jsonData = data.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });

  return ContentService.createTextOutput(JSON.stringify(jsonData)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const sheetId = '1XCO4ycfxAIhZdNr9qGZluAEH7BwPbF-rSfhQc1yvszI';
    const sheetName = 'Form responses 1';
    const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(sheetName);

    const body = JSON.parse(e.postData.contents);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const now = new Date();
    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");

    const newRow = headers.map(header => {
      if (header === 'Timestamp') return timestamp;

      const value = body[header];
      if (TENDER_FILE_FIELDS[header] && value && typeof value === 'object') {
        return uploadTenderFile_(value, header, {
          bidNumber: body['Bid Number'] || ''
        });
      }

      return value || '';
    });

    sheet.appendRow(newRow);

    return ContentService.createTextOutput('Success').setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    Logger.log('Error: ' + error);
    return ContentService.createTextOutput('Error').setMimeType(ContentService.MimeType.TEXT);
  }
}
