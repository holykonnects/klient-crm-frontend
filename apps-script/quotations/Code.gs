function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const fileName = SpreadsheetApp.getActive().getName();

  ui.createMenu('Klient Konnect')
    .addItem('Create Validation', 'setThreeTierValidation')
    .addItem('Get Images', 'insertImagesUsingFormula')
    .addItem('Hide Rows', 'hideEmptyRows')
    .addItem('Export PDF', 'exportRangeToPDFPortraitv1')
    
    .addSeparator()
    // NEW vertical template actions
    .addItem('Create Validation (Template Vertical)', 'setThreeTierValidationVertical')
    .addItem('Get Images + Description (Template Vertical)', 'insertImagesAndDescriptionsVertical')
    .addItem('Hide Rows (Template Vertical Portrait v2)', 'hideEmptyRowsVertical')
    .addItem('Export PDF (Template Vertical Portrait v2)', 'exportRangeToPDFPortraitv2')
    
    .addSeparator()
    //Hide Rows
    .addToUi();

  try {
    if (fileName !== 'Quotation Management (Responses)') {
      const response = ui.alert(
        'Setup Notice',
        'This is not the original Quotation Management file. Would you like to configure this sheet for automation?',
        ui.ButtonSet.YES_NO
      );

      if (response === ui.Button.YES) {
        const url = Browser.inputBox('Please paste the Google Sheet URL of your reference/template sheet:');
        const sheetId = extractSheetId(url);

        if (sheetId) {
          const docProps = PropertiesService.getDocumentProperties();
          docProps.setProperty('REFERENCE_SHEET_ID', sheetId);
          ui.alert('Reference sheet configured successfully!');
        } else {
          ui.alert('Invalid URL. Please try again.');
        }
      }
    }
  } catch (err) {
    Logger.log('Error during onOpen setup: ' + err.message);
    ui.alert('Failed to complete initial setup. Please try again from the menu.');
  }
}

function extractSheetId(url) {
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

function getReferenceSheet(sheetName) {
  const defaultId = '1t-8DRUh4NjRTQhpO6ZTpeYyZUjkwfU6DNoRaIGkdCkc';
  const docProps = PropertiesService.getDocumentProperties();
  const sheetId = docProps.getProperty('REFERENCE_SHEET_ID') || defaultId;
  return SpreadsheetApp.openById(sheetId).getSheetByName(sheetName);
}

function setThreeTierValidation() {
  const refSheet = getReferenceSheet('Equipment BD');
  const destSheet = getReferenceSheet('New Template');

  const destRange = destSheet.getRange('B18:D70');
  const refData = refSheet.getRange('A2:C' + refSheet.getLastRow()).getValues();

  for (var row = 18; row <= 70; row++) {
    const categories = [...new Set(refData.map(row => row[0]).filter(Boolean))];
    const categoryRule = SpreadsheetApp.newDataValidation().requireValueInList(categories, true).build();
    destSheet.getRange('B' + row).setDataValidation(categoryRule);
    destSheet.getRange('B' + row).setNote('Select a Category to see dependent dropdowns');
    destSheet.getRange('C' + row).setNote('Select a Sub-Category to see dependent Items');
  }

  addOnEditTrigger();
}

function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;
  const sheetName = sheet.getName();
  const row = range.getRow();
  const col = range.getColumn();

  const isNewTemplate      = (sheetName === 'New Template'      && row >= 18 && row <= 70);
  const isTemplateVertical = (sheetName === 'Template Vertical' && row >= 20 && row <= 137);

  if (!isNewTemplate && !isTemplateVertical) return;

  const refSheet = getReferenceSheet('Equipment BD');
  const refData = refSheet.getRange('A2:C' + refSheet.getLastRow()).getValues();

  // For Template Vertical we always use the TOP row of the 2-row block:
  // 20–21 → 20, 22–23 → 22, etc.
  const baseRow = isTemplateVertical
    ? (row % 2 === 0 ? row : row - 1) // ensure even/top row
    : row;                            // New Template uses the actual row

  const category    = sheet.getRange(baseRow, 2).getValue(); // Col B
  const subCategory = sheet.getRange(baseRow, 3).getValue(); // Col C

  // Tier 2: Sub-Category when Category changes
  if (col === 2) {
    const subCategories = [...new Set(
      refData
        .filter(r => r[0] === category)
        .map(r => r[1])
        .filter(Boolean)
    )];

    const subCategoryRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(subCategories, true)
      .build();

    const subCatCell = sheet.getRange(baseRow, 3); // C (merged in vertical view)
    const itemCell   = sheet.getRange(baseRow, 4); // D

    subCatCell.setDataValidation(subCategoryRule);
    subCatCell.clearContent();

    itemCell.clearContent();
    itemCell.setDataValidation(null);
  }

  // Tier 3: Item when Sub-Category changes
  if (col === 3) {
    const items = refData
      .filter(r => r[0] === category && r[1] === subCategory)
      .map(r => r[2])
      .filter(Boolean);

    const itemRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(items, true)
      .build();

    const itemCell = sheet.getRange(baseRow, 4); // D
    itemCell.setDataValidation(itemRule);
    itemCell.clearContent();
  }
}

function addOnEditTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onEdit') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('onEdit').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
}

function insertImagesUsingFormula() {
  const templateSheet = getReferenceSheet('New Template');
  const equipmentSheet = getReferenceSheet('Equipment BD');
  const equipmentData = equipmentSheet.getRange('A2:H').getValues();

  for (let row = 18; row <= 70; row++) {
    const selectionB = templateSheet.getRange(`B${row}`).getValue();
    const selectionC = templateSheet.getRange(`C${row}`).getValue();
    const selectionD = templateSheet.getRange(`D${row}`).getValue();

    if (selectionB && selectionC && selectionD) {
      const matchingRow = equipmentData.find(rowData => rowData[0] === selectionB && rowData[1] === selectionC && rowData[2] === selectionD);
      if (matchingRow) {
        const imageUrl = matchingRow[7];
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
          const formula = `=IMAGE("${convertToDirectLink(imageUrl)}", 3)`;
          templateSheet.getRange(`G${row}`).setFormula(formula);
          templateSheet.setRowHeight(row, 300);
          templateSheet.setColumnWidth(7, 300);
        } else {
          templateSheet.getRange(`G${row}`).clearContent();
        }
      } else {
        templateSheet.getRange(`G${row}`).clearContent();
      }
    } else {
      templateSheet.getRange(`G${row}`).clearContent();
    }
  }
}

function convertToDirectLink(url) {
  const fileId = url.match(/[-\w]{25,}/);
  return fileId ? `https://drive.google.com/uc?id=${fileId[0]}` : url;
}

function hideEmptyRows() {
  try {
    const sheet = getReferenceSheet('New Template');
    const range = sheet.getRange('F18:F70');
    const values = range.getValues();

    values.forEach((value, index) => {
      if (!value[0] || value[0].toString().trim() === '') {
        const row = index + 18;
        sheet.hideRows(row);
      }
    });
  } catch (error) {
    Logger.log(`Error: ${error.message}`);
  }
}

function hideEmptyRowsVertical() {
  try {
    const sheet    = getReferenceSheet('Template Vertical');
    const startRow = 20;      // first row to inspect
    const endRow   = 137;     // last row to inspect
    const startCol = 6;       // column F = 6
    const numCols  = 2;       // F and G

    const numRows = endRow - startRow + 1;
    const values  = sheet.getRange(startRow, startCol, numRows, numCols).getValues();

    // We treat rows in PAIRS: (18–19), (20–21), ..., (136–137)
    for (let r = 0; r < numRows; r += 2) {
      const topIndex    = r;           // index in values for top row of the block
      const bottomIndex = r + 1;       // index for second row
      const rowNumTop   = startRow + topIndex;   // actual sheet row number
      const rowNumBot   = rowNumTop + 1;         // actual sheet row number

      // Safety: if we somehow run past the last row, break
      if (bottomIndex >= numRows) break;

      const cellsToCheck = [];

      // Collect F & G for BOTH rows in the pair
      for (let c = 0; c < numCols; c++) {
        cellsToCheck.push(values[topIndex][c]);      // F/G of top row
        cellsToCheck.push(values[bottomIndex][c]);   // F/G of bottom row
      }

      const allBlank = cellsToCheck.every(v =>
        v === '' || v === null || String(v).trim() === ''
      );

      // Only hide if BOTH rows in this block are empty in F & G
      if (allBlank) {
        sheet.hideRows(rowNumTop, 2); // hide the pair together
      }
    }
  } catch (error) {
    Logger.log(`Error in hideEmptyRowsVertical: ${error.message}`);
  }
}



function getReferenceSpreadsheet() {
  const defaultId = '1t-8DRUh4NjRTQhpO6ZTpeYyZUjkwfU6DNoRaIGkdCkc';
  const docProps = PropertiesService.getDocumentProperties();
  const sheetId = docProps.getProperty('REFERENCE_SHEET_ID') || defaultId;
  return SpreadsheetApp.openById(sheetId);
}

function copyTemplateSheet() {
  try {
    const sourceSpreadsheet = getReferenceSpreadsheet();
    const sourceSheet = sourceSpreadsheet.getSheetByName('New Template');
    const folderId = '1aIZw5K8DXCbkPJw7cpg8yUlbym2J_Dn4';

    if (!sourceSheet) {
      Logger.log(`Sheet "New Template" not found.`);
      return;
    }

    const fileName = sourceSheet.getRange('E16').getValue().toString().trim() || 'Copied_Template';
    const copiedSpreadsheet = sourceSpreadsheet.copy(fileName);
    const copiedSpreadsheetId = copiedSpreadsheet.getId();

    const targetFolder = DriveApp.getFolderById(folderId);
    const copiedFile = DriveApp.getFileById(copiedSpreadsheetId);
    DriveApp.getRootFolder().removeFile(copiedFile);
    targetFolder.addFile(copiedFile);

    Logger.log(`Copied spreadsheet "${fileName}" stored in folder ID: ${folderId}`);
  } catch (error) {
    Logger.log('Error copying the template sheet: ' + error.message);
  }
}

function exportRangeToPDFLandscape() {
  try {
    const sourceSpreadsheet = getReferenceSpreadsheet();
    const sourceSheet = sourceSpreadsheet.getSheetByName('New Template');
    const folderId = '1yDFrhOKCtTBv-iCwaFf8DZAMaa1ygYlP';

    if (!sourceSheet) {
      SpreadsheetApp.getUi().alert(`Sheet "New Template" not found in the spreadsheet.`);
      return;
    }

    const fileName = sourceSheet.getRange('E16').getValue().toString().trim() || 'ExportedRange';
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sourceSpreadsheet.getId()}/export?format=pdf` +
                      `&size=A4&portrait=false&scale=2&fitw=true` +
                      `&top_margin=0.06&bottom_margin=0.06&left_margin=0.06&right_margin=0.06` +
                      `&sheetnames=false&printtitle=false&gridlines=false` +
                      `&horizontal_alignment=CENTER&gid=${sourceSheet.getSheetId()}&range=E2:L105`;

    const response = UrlFetchApp.fetch(exportUrl, {
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
      }
    });

    const folder = DriveApp.getFolderById(folderId);
    const pdfBlob = response.getBlob().setName(`${fileName}.pdf`);
    folder.createFile(pdfBlob);

    Logger.log(`PDF saved as "${fileName}.pdf" in folder ID: ${folderId}`);
    SpreadsheetApp.getUi().alert(`✅ PDF exported successfully! Saved as "${fileName}.pdf"`);
  } catch (error) {
    Logger.log('❌ Error exporting range to PDF: ' + error.message);
    SpreadsheetApp.getUi().alert('❌ Error exporting range to PDF. Check the logs for more details.');
  }

  copyTemplateSheet();
}  

function exportRangeMergePDFLandscape() {
  try {
    const sourceSpreadsheet = getReferenceSpreadsheet();
    const sourceSheet = sourceSpreadsheet.getSheetByName('New Template');
    const folderId = '1yDFrhOKCtTBv-iCwaFf8DZAMaa1ygYlP';
    const standardFolderId = '1EDc_UtlsiWczWEgeQXMfsWcbbmkuUvEj'; // Replace with actual Standard folder ID
    const lomFolderId = '1a4SUebNBEg16VKaCYlFHxsMR0X90eJZD';     // Replace with actual LOM folder ID

    if (!sourceSheet) {
      SpreadsheetApp.getUi().alert(`Sheet "New Template" not found in the spreadsheet.`);
      return;
    }

    const fileName = sourceSheet.getRange('E16').getValue().toString().trim() || 'ExportedRange';
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sourceSpreadsheet.getId()}/export?format=pdf` +
                      `&size=A4&portrait=false&scale=2&fitw=true` +
                      `&top_margin=0.06&bottom_margin=0.06&left_margin=0.06&right_margin=0.06` +
                      `&sheetnames=false&printtitle=false&gridlines=false` +
                      `&horizontal_alignment=CENTER&gid=${sourceSheet.getSheetId()}&range=E2:L105`;

    const response = UrlFetchApp.fetch(exportUrl, {
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
      }
    });

    const folder = DriveApp.getFolderById(folderId);
    const pdfBlob = response.getBlob().setName(`${fileName}.pdf`);
    const mainFile = folder.createFile(pdfBlob);

    Logger.log(`PDF saved as "${fileName}.pdf" in folder ID: ${folderId}`);

    // ==== Begin Optional Merging ====

    const ui = SpreadsheetApp.getUi();

    // Prompt for Standard Document
    const standardPrompt = ui.prompt("Include Standard Document?", "Type YES or NO", ui.ButtonSet.OK);
    const includeStandard = standardPrompt.getResponseText().toUpperCase().trim() === 'YES';

    // Prompt for LOM Documents
    const lomFolder = DriveApp.getFolderById(lomFolderId);
    const lomFiles = lomFolder.getFilesByType(MimeType.GOOGLE_DOCS);
    const lomNames = [];
    while (lomFiles.hasNext()) lomNames.push(lomFiles.next().getName());

    const lomPrompt = ui.prompt(
      'Enter comma-separated document names to include from LOM:\n\n' + lomNames.join('\n'),
      ui.ButtonSet.OK
    );
    const selectedLomNames = lomPrompt.getResponseText().split(',').map(name => name.trim()).filter(name => name);

    const mergeBlobs = [pdfBlob];

    // Include Standard doc if selected
    if (includeStandard) {
      const standardFolder = DriveApp.getFolderById(standardFolderId);
      const stdFiles = standardFolder.getFilesByType(MimeType.GOOGLE_DOCS);
      if (stdFiles.hasNext()) {
        const stdBlob = stdFiles.next().getAs(MimeType.PDF);
        mergeBlobs.push(stdBlob);
      }
    }

    // Include selected LOM docs
    selectedLomNames.forEach(name => {
      const file = lomFolder.getFilesByName(name);
      if (file.hasNext()) {
        mergeBlobs.push(file.next().getAs(MimeType.PDF));
      }
    });

    // Merge and Save
    if (mergeBlobs.length > 1) {
      const merged = mergePDFBlobs(mergeBlobs);
      folder.createFile(merged.setName(`Merged_${fileName}.pdf`));
      ui.alert(`✅ Merged PDF saved as "Merged_${fileName}.pdf"`);
    } else {
      ui.alert(`✅ Exported only the main PDF without merging.`);
    }

  } catch (error) {
    Logger.log('❌ Error exporting or merging: ' + error.message);
    SpreadsheetApp.getUi().alert('❌ Error occurred. Check the logs for details.');
  }

  copyTemplateSheet();
}

function mergePDFBlobs(blobs) {
  const tempFolder = DriveApp.createFolder('TempMerge_' + new Date().getTime());
  const files = blobs.map((blob, i) => tempFolder.createFile(blob.setName(`file${i}.pdf`)));
  const mergedBlob = files.reduce((acc, file) => acc ? acc.concat(file.getBlob()) : file.getBlob(), null);
  tempFolder.setTrashed(true);
  return mergedBlob.setName('MergedQuotation.pdf');
}

function exportRangeToPDFLandscapev2() {
  try {
    const sourceSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = sourceSpreadsheet.getSheetByName('New Template');
    const folderId = '1yDFrhOKCtTBv-iCwaFf8DZAMaa1ygYlP';

    if (!sourceSheet) {
      SpreadsheetApp.getUi().alert(`Sheet "New Template" not found in the spreadsheet.`);
      return;
    }

    const fileName = sourceSheet.getRange('E16').getValue().toString().trim() || 'ExportedRange';
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sourceSpreadsheet.getId()}/export?format=pdf` +
                      `&size=A4&portrait=false&scale=2&fitw=true` +
                      `&top_margin=0.06&bottom_margin=0.06&left_margin=0.06&right_margin=0.06` +
                      `&sheetnames=false&printtitle=false&gridlines=false` +
                      `&horizontal_alignment=CENTER&gid=${sourceSheet.getSheetId()}&range=E2:L105`;

    const response = UrlFetchApp.fetch(exportUrl, {
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
      }
    });

    const folder = DriveApp.getFolderById(folderId);
    const pdfBlob = response.getBlob().setName(`${fileName}.pdf`);
    folder.createFile(pdfBlob);

    Logger.log(`PDF saved as "${fileName}.pdf" in folder ID: ${folderId}`);
    SpreadsheetApp.getUi().alert(`✅ PDF exported successfully! Saved as "${fileName}.pdf"`);
  } catch (error) {
    Logger.log('❌ Error exporting range to PDF: ' + error.message);
    SpreadsheetApp.getUi().alert('❌ Error exporting range to PDF. Check the logs for more details.');
  }

  copyTemplateSheet();
} 

function exportRangeToPDFPortraitv1() {
  try {
    const sourceSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = sourceSpreadsheet.getSheetByName('New Template');
    const folderId = '1yDFrhOKCtTBv-iCwaFf8DZAMaa1ygYlP';

    if (!sourceSheet) {
      SpreadsheetApp.getUi().alert(`Sheet "New Template" not found in the spreadsheet.`);
      return;
    }

    const fileName = sourceSheet.getRange('E16').getValue().toString().trim() || 'ExportedRange';
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sourceSpreadsheet.getId()}/export?format=pdf` +
                      `&size=A4&portrait=true&scale=2&fitw=true` +
                      `&top_margin=0.08&bottom_margin=0.08&left_margin=0.08&right_margin=0.08` +
                      `&sheetnames=false&printtitle=false&gridlines=false` +
                      `&horizontal_alignment=CENTER&gid=${sourceSheet.getSheetId()}&range=E2:L105`;

    const response = UrlFetchApp.fetch(exportUrl, {
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
      }
    });

    const folder = DriveApp.getFolderById(folderId);
    const pdfBlob = response.getBlob().setName(`${fileName}.pdf`);
    folder.createFile(pdfBlob);

    Logger.log(`PDF saved as "${fileName}.pdf" in folder ID: ${folderId}`);
    SpreadsheetApp.getUi().alert(`✅ PDF exported successfully! Saved as "${fileName}.pdf"`);
  } catch (error) {
    Logger.log('❌ Error exporting range to PDF: ' + error.message);
    SpreadsheetApp.getUi().alert('❌ Error exporting range to PDF. Check the logs for more details.');
  }

 copyTemplateSheet();
} 

function exportRangeToPDFPortraitv2() {
  try {
    const sourceSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = sourceSpreadsheet.getSheetByName('Template Vertical');
    const folderId = '1yDFrhOKCtTBv-iCwaFf8DZAMaa1ygYlP';

    if (!sourceSheet) {
      SpreadsheetApp.getUi().alert(`Sheet "Template Vertical" not found in the spreadsheet.`);
      return;
    }

    const fileName = sourceSheet.getRange('E16').getValue().toString().trim() || 'ExportedRange';
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sourceSpreadsheet.getId()}/export?format=pdf` +
                      `&size=A4&portrait=true&scale=2&fitw=true` +
                      `&top_margin=0.08&bottom_margin=0.08&left_margin=0.08&right_margin=0.08` +
                      `&sheetnames=false&printtitle=false&gridlines=false` +
                      `&horizontal_alignment=CENTER&gid=${sourceSheet.getSheetId()}&range=E2:K173`;

    const response = UrlFetchApp.fetch(exportUrl, {
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
      }
    });

    const folder = DriveApp.getFolderById(folderId);
    const pdfBlob = response.getBlob().setName(`${fileName}.pdf`);
    folder.createFile(pdfBlob);

    Logger.log(`PDF saved as "${fileName}.pdf" in folder ID: ${folderId}`);
    SpreadsheetApp.getUi().alert(`✅ PDF exported successfully! Saved as "${fileName}.pdf"`);
  } catch (error) {
    Logger.log('❌ Error exporting range to PDF: ' + error.message);
    SpreadsheetApp.getUi().alert('❌ Error exporting range to PDF. Check the logs for more details.');
  }

 copyTemplateSheetV2();
} 

function setThreeTierValidationVertical() {
  const refSheet  = getReferenceSheet('Equipment BD');
  const destSheet = getReferenceSheet('Template Vertical');

  const refData = refSheet.getRange('A2:C' + refSheet.getLastRow()).getValues();
  const categories = [...new Set(refData.map(r => r[0]).filter(Boolean))];

  // Each logical block is 2 rows: (20–21), (22–23), ..., up to 136–137
  for (let row = 20; row <= 137; row += 2) {
    const categoryCell    = destSheet.getRange('B' + row); // B20, B22, ...
    const subCategoryCell = destSheet.getRange('C' + row); // C20, C22, ...
    const itemCell        = destSheet.getRange('D' + row); // D20, D22, ...

    // Category (tier 1)
    const categoryRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(categories, true)
      .build();

    categoryCell.setDataValidation(categoryRule);
    categoryCell.setNote('Select a Category to see dependent dropdowns');

    // Notes for lower tiers (rules will be set on edit)
    subCategoryCell.setNote('Select a Sub-Category to see dependent Items');

    // Optional cleanup for this block
    subCategoryCell.clearContent().setDataValidation(null);
    itemCell.clearContent().setDataValidation(null);
  }

  // Ensure onEdit trigger is wired
  addOnEditTrigger();
}

function insertImagesAndDescriptionsVertical() {
  const templateSheet  = getReferenceSheet('Template Vertical');
  const equipmentSheet = getReferenceSheet('Equipment BD');

  // A: Category, B: Sub, C: Item, E: Description, H: Image URL (as in your current layout)
  const equipmentData = equipmentSheet.getRange('A2:H' + equipmentSheet.getLastRow()).getValues();

  // Each logical product block = 2 rows: (20–21), (22–23), ..., up to 136–137
  for (let row = 20; row <= 137; row += 2) {
    const categoryCell    = templateSheet.getRange('B' + row);
    const subCategoryCell = templateSheet.getRange('C' + row);
    const itemCell        = templateSheet.getRange('D' + row);

    const category    = categoryCell.getValue();
    const subCategory = subCategoryCell.getValue();
    const item        = itemCell.getValue();

    const imageCell = templateSheet.getRange('G' + row);       // top row → image
    const descCell  = templateSheet.getRange('G' + (row + 1)); // next row → text

    // Clear prior content for this block
    imageCell.clearContent();
    descCell.clearContent();

    // Optionally reset heights first (so empty blocks don't stay tall)
    templateSheet.setRowHeight(row, 21);
    templateSheet.setRowHeight(row + 1, 21);

    if (!category || !subCategory || !item) {
      continue; // skip this block if not fully selected
    }

    // Find matching row in Equipment BD
    const match = equipmentData.find(r =>
      r[0] === category && // Col A: Category
      r[1] === subCategory && // Col B: Sub-Category
      r[2] === item          // Col C: Item
    );

    if (!match) continue;

    const description = match[4]; // Col E: Description
    const imageUrl    = match[7]; // Col H: Image URL

    // --- IMAGE ---
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
      const formula = `=IMAGE("${convertToDirectLink(imageUrl)}", 3)`; // mode = 3 (custom)
      imageCell.setFormula(formula);

      // Tune these as you like for vertical layout
      templateSheet.setRowHeight(row, 260);   // height for image
      templateSheet.setColumnWidth(7, 260);   // width for column G
    }

    // --- DESCRIPTION (below image) ---
    if (description) {
      descCell.setValue(description);
      descCell.setWrap(true);
      templateSheet.setRowHeight(row + 1, 80); // more space for wrapped text
    }
  }
}

function copyTemplateSheetV2() {
  try {
    // v2 is based on the active spreadsheet and "Template Vertical" sheet
    const sourceSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = sourceSpreadsheet.getSheetByName('Template Vertical');
    const folderId = '1aIZw5K8DXCbkPJw7cpg8yUlbym2J_Dn4'; // same folder as v1 (tweak if needed)

    if (!sourceSheet) {
      Logger.log('Sheet "Template Vertical" not found.');
      return;
    }

    // File name driven by Template Vertical!E16 (like your exportRangeToPDFPortraitv2)
    const fileName =
      sourceSheet.getRange('E16').getValue().toString().trim() ||
      'Copied_Template_Vertical';

    // Copy the whole spreadsheet with that name
    const copiedSpreadsheet = sourceSpreadsheet.copy(fileName);
    const copiedSpreadsheetId = copiedSpreadsheet.getId();

    // Move the copy into the target folder
    const targetFolder = DriveApp.getFolderById(folderId);
    const copiedFile = DriveApp.getFileById(copiedSpreadsheetId);

    // Remove from My Drive root and add to target folder
    DriveApp.getRootFolder().removeFile(copiedFile);
    targetFolder.addFile(copiedFile);

    Logger.log(`Copied vertical spreadsheet "${fileName}" stored in folder ID: ${folderId}`);
  } catch (error) {
    Logger.log('Error copying the vertical template sheet: ' + error.message);
  }
}

