function doGet() {
  const sheet = SpreadsheetApp.openById('1K9JT7C88oOVdAvapDOieWaiYj6Wd_XRZ1CCNiYzUhG8')
                .getSheetByName('Qualified Leads');
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
