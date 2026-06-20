function doGet() {
  const sheet = SpreadsheetApp.openById('1vJbB0fmBQhd6XGTNbjUAi7Bt71lHNyau2TBMXTCdoM0').getSheetByName('Form responses 1');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const jsonData = data.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
  return ContentService.createTextOutput(JSON.stringify(jsonData)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    Logger.log('✅ doPost triggered');
    Logger.log('📦 Payload received: ' + e.postData.contents);

    const sheetId = '1vJbB0fmBQhd6XGTNbjUAi7Bt71lHNyau2TBMXTCdoM0';
    const sheetName = 'Form Responses 1';
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      Logger.log('❌ Sheet not found');
      return ContentService.createTextOutput('Sheet not found').setMimeType(ContentService.MimeType.TEXT);
    }

    const body = JSON.parse(e.postData.contents);
    const fields = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const newRow = [];

    const now = new Date();
    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss.SSS");

    fields.forEach(field => {
      if (field === 'Timestamp') {
        newRow.push(timestamp);
      } else {
        newRow.push(body[field] || '');
      }
    });

    Logger.log('✅ New row prepared: ' + JSON.stringify(newRow));
    sheet.appendRow(newRow);
    Logger.log('✅ Row appended successfully');

    return ContentService.createTextOutput('Success').setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    Logger.log('❌ Error in doPost: ' + error);
    return ContentService.createTextOutput('Error').setMimeType(ContentService.MimeType.TEXT);
  }
}
