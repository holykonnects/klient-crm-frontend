/**
 * Klient Konnect — Quotation Management API (Apps Script Web App)
 * Builds quotations from CRM UI using the "New Template" layout in the reference workbook,
 * looks up items from 'Equipment BD', exports to PDF, and (optionally) updates Leads with the PDF link.
 *
 * Deploy settings:
 * - Execute as: Me
 * - Who has access: Anyone (or Anyone with the link)
 */

/** ====== CONFIG ====== **/

// Reference spreadsheet (template + Equipment BD)
const DEFAULT_REFERENCE_ID = '1t-8DRUh4NjRTQhpO6ZTpeYyZUjkwfU6DNoRaIGkdCkc'; // Quotation Management (Responses)
const ATHLETIC_REFERENCE_ID = '11rMTRdeLJNihYK3o2eHAVMpJ2bVvD9ZmhunE_Ygay3c';

// Template sheet name + export region
const TEMPLATE_SHEET_NAME = 'New Template';
const EXPORT_RANGE = 'E2:L105';

// Folders
const EXPORT_PDF_FOLDER_ID   = '1yDFrhOKCtTBv-iCwaFf8DZAMaa1ygYlP'; // PDFs
const WORKING_COPIES_FOLDER_ID = '1aIZw5K8DXCbkPJw7cpg8yUlbym2J_Dn4'; // Working copies

// Validation / Login sheet (role + page access)
const VALIDATION_SHEET_ID   = '1YxYSLVuBrNOp8fYdA3s1dLzR3KFW0IaVMUvJ2AvY4aQ';
const VALIDATION_LOGIN_SHEET = 'CRM Login'; // headers: Login Username | Role | Page Access

// Leads sheet (to write “Quotation Link”)
const LEADS_SHEET_ID   = '1vJbB0fmBQhd6XGTNbjUAi7Bt71lHNyau2TBMXTCdoM0';
const LEADS_SHEET_NAME = 'Form responses 1'; // must contain "Quotation Link" header

// Equipment BD expected headers (in reference spreadsheet)
const EQUIPMENT_SHEET_NAME = 'Equipment BD'; // A..H → Cat | Sub | Code | Name | Unit | Rate | Desc | ImageURL

// New Template rows used for items
const ITEMS_START_ROW = 18;
const ITEMS_END_ROW   = 70;

// Template meta cell mapping for the current "New Template" sheet.
const META_MAP = {
  clientName:  'G11',
  projectName: 'G12',
  quotationNo: 'E10',
  dateISO:     'E9',
  termsType:   'C14',
  billingAddress: 'G13',
  clientGst:   'G14',
  displayName: 'E16'
};

/** ====== HTTP helpers ====== **/
function respond_(obj) {
  return ContentService
    .createTextOutput(typeof obj === 'string' ? obj : JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService.createTextOutput('OK');
}

/** ====== Reference workbook helpers (ScriptProperties first, then fallback) ====== **/
function getReferenceSpreadsheet_() {
  var sheetId = null;
  try {
    var sp = PropertiesService.getScriptProperties();
    sheetId = sp ? sp.getProperty('REFERENCE_SHEET_ID') : null;
  } catch (_) {}

  if (!sheetId) {
    try {
      var dp = PropertiesService.getDocumentProperties();
      sheetId = dp ? dp.getProperty('REFERENCE_SHEET_ID') : null;
    } catch (_) {}
  }

  sheetId = sanitizeId_(sheetId || DEFAULT_REFERENCE_ID);
  return SpreadsheetApp.openById(sheetId);
}

function sanitizeId_(maybeId) {
  var s = String(maybeId || '').trim();
  var m = s.match(/[-\w]{25,}/);
  return m ? m[0] : s;
}

function setReferenceSheetId(sheetId){
  var sp = PropertiesService.getScriptProperties();
  sp.setProperty('REFERENCE_SHEET_ID', sanitizeId_(sheetId));
}

function getRefSheet_(name){
  return getReferenceSpreadsheet_().getSheetByName(name);
}

/** ====== Access Control ====== **/
function getLoginRow_(username) {
  if (!username) return null;
  const sh = SpreadsheetApp.openById(VALIDATION_SHEET_ID).getSheetByName(VALIDATION_LOGIN_SHEET);
  if (!sh) return null;

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return null;

  const headers = sh.getRange(1,1,1,lastCol).getValues()[0];
  const vals = sh.getRange(2,1,lastRow-1,lastCol).getValues();

  const idxUser  = headers.indexOf('Login Username');
  const idxRole  = headers.indexOf('Role');
  const idxPages = headers.indexOf('Page Access');

  const uname = String(username).trim().toLowerCase();
  for (const row of vals) {
    const lu = String(row[idxUser]||'').trim().toLowerCase();
    if (lu === uname) {
      return {
        role: String(row[idxRole]||'').trim(),
        pageAccess: String(row[idxPages]||'').split(',').map(s=>s.trim()).filter(Boolean)
      };
    }
  }
  return null;
}

function assertCanUseQuotation_(username){
  const rec = getLoginRow_(username);
  if (!rec) throw new Error('Unauthorized: user not found');
  if (rec.role === 'Admin') return rec;
  if (rec.pageAccess && rec.pageAccess.includes('Quotation')) return rec;
  throw new Error('Unauthorized: no access to Quotation');
}

/** ====== Catalog (Equipment BD) — header-driven & auto-detect header row ====== **/
function getCatalog_(){
  var sh = getRefSheet_(EQUIPMENT_SHEET_NAME);
  if (!sh) throw new Error('Equipment BD not found');

  var lr = sh.getLastRow();
  if (lr < 2) return { categories:[], subcategories:{}, items:{}, tcOptions:getTcOptions_() };

  var required = ['category', 'subcategory', 'itemcode'];
  var H = getHeaderMapSmart_(sh, required);

  var missing = required.filter(function(k){ return !H[k]; });
  if (missing.length) {
    throw new Error('Equipment BD missing required headers: ' + missing.join(', '));
  }

  var hasName  = !!H['itemname'];
  var hasUnit  = !!H['unit'];
  var hasRate  = !!H['rate'];
  var hasDesc  = !!H['description'];
  var hasDefinition = !!H['itemdefinition'];
  var hasImage = !!H['imageurl'];

  var categories = new Set();
  var subMap = {};   // { cat: Set(sub) }
  var itemsMap = {}; // { "cat|||sub": [ {code,name,unit,rate,desc,imageUrl} ] }

  var vals = sh.getRange(2, 1, lr-1, sh.getLastColumn()).getValues();
  for (var i = 0; i < vals.length; i++) {
    var row = vals[i];

    var cat  = String(row[(H['category']||1)-1] || '').trim();
    var sub  = String(row[(H['subcategory']||1)-1] || '').trim();
    var code = String(row[(H['itemcode']||1)-1] || '').trim();
    if (!cat || !sub || !code) continue;

    var name  = hasName  ? String(row[H['itemname']-1] || '').trim() : '';
    var unit  = hasUnit  ? String(row[H['unit']-1] || '').trim()     : '';
    var rate  = hasRate  ? num_(row[H['rate']-1])                    : 0;
    var desc  = hasDesc  ? String(row[H['description']-1] || '').trim() : '';
    var definition = hasDefinition ? String(row[H['itemdefinition']-1] || '').trim() : '';
    var image = hasImage ? String(row[H['imageurl']-1] || '').trim() : '';

    categories.add(cat);
    if (!subMap[cat]) subMap[cat] = new Set();
    subMap[cat].add(sub);

    var key = cat + '|||' + sub;
    if (!itemsMap[key]) itemsMap[key] = [];

    itemsMap[key].push({
      code: code,
      name: name || code,
      unit: unit,
      rate: rate,
      desc: desc || definition,
      imageUrl: image,
      itemType: cat === 'Flooring' ? 'Non Equipment' : 'Equipment'
    });
  }

  return {
    categories: Array.from(categories),
    subcategories: Object.fromEntries(Object.keys(subMap).map(function(k){ return [k, Array.from(subMap[k])]; })),
    items: itemsMap,
    tcOptions: getTcOptions_()
  };
}

function getTcOptions_() {
  var sh = getRefSheet_('tc');
  if (!sh) return ['Equipment', 'Flooring'];
  return sh.getRange(2, 1, 1, sh.getLastColumn())
    .getValues()[0]
    .map(function(v){ return String(v || '').trim(); })
    .filter(Boolean);
}


/** ====== Public GET ====== **/
function doGet(e){
  try{
    const action = String(e.parameter.action||'').trim();

    if (action === 'getCatalog'){
      const data = getCatalog_();
      return respond_({ ok:true, data });
    }

    if (action === 'getLeadsForUser'){
      var username = String(e.parameter.user||'').trim();
      var rec = assertCanUseQuotation_(username);

      var ss, sh;
      try {
        ss = SpreadsheetApp.openById(sanitizeId_(LEADS_SHEET_ID));
      } catch (err) {
        return respond_({ ok:false, error:'Leads spreadsheet not accessible: ' + err });
      }

      sh = ss.getSheetByName(LEADS_SHEET_NAME);
      if (!sh) return respond_({ ok:false, error:'Leads sheet "' + LEADS_SHEET_NAME + '" not found' });

      var data = sh.getDataRange().getValues();
      if (data.length < 2) return respond_({ ok:true, entries: [] });

      var head = data.shift();
      var idxOwner = head.indexOf('Lead Owner');
      var idxFirst = head.indexOf('First Name');
      var idxLast  = head.indexOf('Last Name');
      var idxComp  = head.indexOf('Company');
      var idxMob   = head.indexOf('Mobile Number');

      var isAdmin = rec.role === 'Admin';

      var entries = data
        .filter(function(r){ return isAdmin || String(r[idxOwner]||'').trim().toLowerCase() === username.toLowerCase(); })
        .map(function(r){ return (r[idxComp]||'') + ' | ' + (r[idxFirst]||'') + ' ' + (r[idxLast]||'') + ' | ' + (r[idxMob]||''); })
        .filter(function(s){ return String(s).trim().length > 0; });

      return respond_({ ok:true, entries: Array.from(new Set(entries)) });
    }


    return respond_({ ok:false, error:'Invalid action' });
  }catch(err){
    Logger.log(err.stack||err);
    return respond_({ ok:false, error:String(err) });
  }
}

/** ====== Public POST ====== **/
function doPost(e){
  try{
    const action = String(e.parameter.action||'').trim();

    if (action === 'buildQuotationAndExport'){
      const username = String(e.parameter.user||'').trim();
      assertCanUseQuotation_(username);

      const payload = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
      if (payload.quoteType === 'athletic' && !(payload.items || []).length) {
        throw new Error('Athletic quotation has no exportable items. Add or restore quotation items before exporting.');
      }
      const out = payload.quoteType === 'project-set'
        ? buildSetQuotationAndExport_(payload)
        : buildQuotationAndExport_(payload);

      if (payload.attach && payload.attach.leadDisplay && out.pdfUrl){
        try { updateLeadQuotationLink_(payload.attach.leadDisplay, out.pdfUrl, username); }
        catch (err){ Logger.log('Lead link update warning: '+err); }
      }

      return respond_({ ok:true, ...out });
    }

    return respond_({ ok:false, error:'Invalid action' });
  }catch(err){
    Logger.log(err.stack||err);
    return respond_({ ok:false, error:String(err) });
  }
}

/** ====== Multi-set project BOQ builder ====== **/
function buildSetQuotationAndExport_(payload) {
  const meta = payload.meta || {};
  const setQuotation = payload.setQuotation || {};
  const sets = (setQuotation.sets || []).filter(function(set) { return (set.items || []).length; });
  if (!sets.length) throw new Error('Add at least one project set before exporting');
  if (!payload.quoteId) throw new Error('Save the quotation before exporting the project BOQ');

  const copyName = buildQuoteFileName_({
    quotationTitle: meta.quotationTitle || 'Project BOQ Quotation',
    quotationNo: meta.quotationNo,
    clientName: meta.clientName,
    projectName: meta.projectName
  });
  const workingCopy = managedWorkingCopy_(`project-set:${payload.quoteId}`, function() {
    const spreadsheet = SpreadsheetApp.create(copyName);
    moveFileToFolder_(spreadsheet.getId(), WORKING_COPIES_FOLDER_ID);
    return spreadsheet;
  });
  DriveApp.getFileById(workingCopy.getId()).setName(copyName);
  const sheets = workingCopy.getSheets();
  const sheet = workingCopy.getSheetByName('Quotation') || sheets[0];
  if (sheet.getName() !== 'Quotation') sheet.setName('Quotation');
  sheet.clear();
  while (workingCopy.getSheets().length > 1) workingCopy.deleteSheet(workingCopy.getSheets().pop());

  const headingRows = [
    ['RIDO SPORTS', '', '', '', '', '', ''],
    [meta.quotationTitle || 'Project BOQ Quotation', '', '', '', '', '', ''],
    ['Client', meta.clientName || '', 'Project', meta.projectName || '', 'Quotation No.', meta.quotationNo || '', ''],
    ['Date', meta.dateISO ? new Date(meta.dateISO) : new Date(), 'Prepared By', meta.preparedBy || '', 'Client GST', meta.clientGstNumber || '', ''],
    ['Billing Address', meta.clientBillingAddress || '', '', '', 'Notes', meta.notes || '', '']
  ];
  sheet.getRange(1, 1, headingRows.length, 7).setValues(headingRows);
  sheet.getRange('A1:G1').merge().setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#163f76').setFontColor('#ffffff');
  sheet.getRange('A2:G2').merge().setFontSize(13).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#dce9f8');
  sheet.getRange('B5:D5').merge();
  sheet.getRange('F5:G5').merge();

  let row = 7;
  let itemNumber = 1;
  const amountCells = [];
  sets.forEach(function(set, setIndex) {
    sheet.getRange(row, 1, 1, 7).merge().setValue(`${setIndex + 1}. ${set.title || 'Untitled set'}`)
      .setFontWeight('bold').setBackground('#dce9f8').setFontColor('#163f76');
    row += 1;
    sheet.getRange(row, 1, 1, 7).setValues([['S.No.', 'Item', 'Description', 'Unit', 'Quantity', 'Unit Price', 'Amount']])
      .setFontWeight('bold').setBackground('#6395df').setFontColor('#ffffff').setHorizontalAlignment('center');
    row += 1;
    const firstItemRow = row;
    const itemRows = (set.items || []).map(function(item) {
      const qty = num_(item.qty);
      const rate = num_(item.rate);
      return [itemNumber++, item.item || '', item.description || '', item.unit || '', qty, rate, qty * rate];
    });
    sheet.getRange(row, 1, itemRows.length, 7).setValues(itemRows);
    (set.items || []).forEach(function(item, index) {
      if (item.descHtml) sheet.getRange(row + index, 3).setRichTextValue(richTextFromHtml_(item.descHtml, item.description || ''));
      amountCells.push(`G${row + index}`);
    });
    sheet.setRowHeights(row, itemRows.length, 54);
    row += itemRows.length;
    sheet.getRange(row, 1, 1, 6).merge().setValue('Set Subtotal').setFontWeight('bold').setHorizontalAlignment('right');
    sheet.getRange(row, 7).setFormula(`=SUM(G${firstItemRow}:G${row - 1})`).setFontWeight('bold');
    row += 2;
  });

  const subtotalRow = row;
  sheet.getRange(row, 1, 1, 6).merge().setValue('Subtotal').setHorizontalAlignment('right').setFontWeight('bold');
  sheet.getRange(row, 7).setFormula(amountCells.length ? `=SUM(${amountCells.join(',')})` : '=0').setFontWeight('bold');
  row += 1;
  sheet.getRange(row, 1, 1, 6).merge().setValue(`GST @ ${num_(setQuotation.gstPct)}%`).setHorizontalAlignment('right');
  sheet.getRange(row, 7).setFormula(`=G${subtotalRow}*${num_(setQuotation.gstPct) / 100}`);
  row += 1;
  sheet.getRange(row, 1, 1, 6).merge().setValue('Grand Total').setHorizontalAlignment('right').setFontWeight('bold').setBackground('#dce9f8');
  sheet.getRange(row, 7).setFormula(`=ROUND(G${subtotalRow}+G${row - 1},0)`).setFontWeight('bold').setBackground('#dce9f8');

  const terms = richTermsFromMeta_(meta);
  if (terms.length) {
    row += 2;
    sheet.getRange(row, 1, 1, 7).merge().setValue(`Terms & Conditions: ${meta.tcType || 'Selected terms'}`)
      .setFontWeight('bold').setBackground('#dce9f8').setFontColor('#163f76');
    row += 1;
    terms.forEach(function(term, index) {
      sheet.getRange(row, 1).setValue(index + 1).setHorizontalAlignment('center');
      sheet.getRange(row, 2, 1, 6).merge().setRichTextValue(term.richText).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
      sheet.setRowHeight(row, Math.max(32, Math.min(90, 22 + Math.ceil(term.text.length / 110) * 16)));
      row += 1;
    });
    row -= 1;
  }

  sheet.getRange(1, 1, row, 7).setFontFamily('Montserrat').setVerticalAlignment('top');
  sheet.getRange(7, 1, row - 6, 7).setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(1, 2, row, 2).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  sheet.getRange(1, 5, row, 3).setNumberFormat('#,##0.00');
  [55, 210, 420, 75, 95, 105, 125].forEach(function(width, index) { sheet.setColumnWidth(index + 1, width); });
  sheet.setFrozenRows(5);
  SpreadsheetApp.flush();

  const pdfFile = exportTemplateRegion_(sheet, EXPORT_PDF_FOLDER_ID, meta.layout || 'landscape', `A1:G${row}`, copyName);
  return {
    pdfFileId: pdfFile.getId(),
    pdfFileName: pdfFile.getName(),
    pdfUrl: `https://drive.google.com/file/d/${pdfFile.getId()}/view`,
    workingCopyUrl: `https://docs.google.com/spreadsheets/d/${workingCopy.getId()}/edit`,
    displayName: copyName
  };
}

/** ====== Athletic quotation builder ====== **/
function buildAthleticQuotationAndExport_(payload) {
  const meta = payload.meta || {};
  const athletic = payload.athletic || {};
  const copyName = buildQuoteFileName_({
    quotationTitle: meta.quotationTitle || 'Athletic Track Quotation',
    quotationNo: meta.quotationNo,
    clientName: meta.clientName,
    projectName: meta.projectName
  });
  const source = SpreadsheetApp.openById(ATHLETIC_REFERENCE_ID);
  const workingCopy = payload.quoteId
    ? managedWorkingCopy_(`athletic:${payload.quoteId}`, function() {
        return copySpreadsheetWithoutBoundScript_(source, copyName, WORKING_COPIES_FOLDER_ID);
      })
    : copySpreadsheetWithoutBoundScript_(source, copyName, WORKING_COPIES_FOLDER_ID);
  DriveApp.getFileById(workingCopy.getId()).setName(copyName);

  const estimator = workingCopy.getSheetByName('Estimator');
  const printable = workingCopy.getSheetByName('Printable Quote');
  if (!estimator || !printable) throw new Error('Athletic Estimator or Printable Quote sheet not found');

  const cells = {
    D5: meta.clientName || '', D6: meta.projectName || '', D7: meta.quotationNo || '',
    D8: meta.dateISO ? new Date(meta.dateISO) : new Date(), D9: meta.preparedBy || '',
    G5: athletic.preset || '400m - 8 lane benchmark',
    G6: athletic.surfaceSystem || 'Sandwich System',
    G7: athletic.areaMethod || 'Preset benchmark area',
    G8: athletic.civilWorks || 'Yes', G9: athletic.drainageWorks || 'Yes',
    G10: athletic.trackEquipment || 'No', G11: athletic.installation || 'Inclusive',
    D13: num_(athletic.lengthPerimeter), D14: num_(athletic.breadth),
    D15: num_(athletic.laneWidth) || 1.22, D16: num_(athletic.laneQuantity),
    D17: num_(athletic.manualArea), D18: num_(athletic.drainPerimeter),
    D22: percent_(athletic.gstPct === undefined ? 18 : athletic.gstPct),
    D23: percent_(athletic.discountPct || 0), D24: num_(athletic.freightAmount),
    D25: num_(athletic.certificationAmount), D26: num_(athletic.validityDays) || 30,
    D27: athletic.paymentTerms || '50% advance; balance as agreed'
  };
  Object.keys(cells).forEach(function(a1) { estimator.getRange(a1).setValue(cells[a1]); });
  const athleticTerms = richTermsFromMeta_(meta);
  let printableLastRow = 49;
  if (athleticTerms.length) {
    const headingRow = 51;
    printable.getRange(headingRow, 2, 1, 7).merge().setValue(`Terms & Conditions: ${meta.tcType || 'Selected terms'}`)
      .setFontWeight('bold').setBackground('#dce9f8').setFontColor('#163f76');
    athleticTerms.forEach(function(term, index) {
      const termRow = headingRow + index + 1;
      printable.getRange(termRow, 2).setValue(index + 1).setHorizontalAlignment('center');
      printable.getRange(termRow, 3, 1, 6).merge().setRichTextValue(term.richText).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
      printable.setRowHeight(termRow, Math.max(32, Math.min(90, 22 + Math.ceil(term.text.length / 110) * 16)));
      printableLastRow = termRow;
    });
    printable.getRange(headingRow, 2, printableLastRow - headingRow + 1, 7)
      .setFontFamily('Montserrat').setVerticalAlignment('top')
      .setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);
  }
  SpreadsheetApp.flush();

  const pdfFile = exportTemplateRegion_(printable, EXPORT_PDF_FOLDER_ID, meta.layout || 'portrait', `B4:H${printableLastRow}`, copyName);
  try { pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
  return {
    pdfFileId: pdfFile.getId(),
    pdfFileName: pdfFile.getName(),
    pdfUrl: `https://drive.google.com/file/d/${pdfFile.getId()}/view`,
    workingCopyUrl: `https://docs.google.com/spreadsheets/d/${workingCopy.getId()}/edit`,
    displayName: copyName
  };
}

/** ====== Main builder (copy-on-export) ====== **/
function buildQuotationAndExport_(payload){
  const { meta = {}, pricing = {}, items = [] } = payload || {};
  const {
    clientName='', projectName='', quotationNo='',
    dateISO='',
    quotationTitle='', clientBillingAddress='', clientGstNumber='', tcType='Equipment',
    layout='portrait'
  } = meta;

  // 1) Copy reference for a clean working file
  const ref = getReferenceSpreadsheet_();
  const copyName = buildQuoteFileName_({
    quotationTitle,
    quotationNo,
    clientName,
    projectName
  });
  const createWorkingCopy = function() {
    return copySpreadsheetWithoutBoundScript_(
      ref,
      copyName,
      WORKING_COPIES_FOLDER_ID,
      [TEMPLATE_SHEET_NAME, 'tc']
    );
  };
  const workingCopy = payload.quoteId
    ? managedWorkingCopy_(`new-template-v2:${payload.quoteType || 'standard'}:${payload.quoteId}`, createWorkingCopy)
    : createWorkingCopy();
  DriveApp.getFileById(workingCopy.getId()).setName(copyName);

  // 2) Fill the copy’s template
  const template = workingCopy.getSheetByName(TEMPLATE_SHEET_NAME);
  if (!template) throw new Error(`${TEMPLATE_SHEET_NAME} not found in working copy`);
  const sourceTemplate = ref.getSheetByName(TEMPLATE_SHEET_NAME);
  if (!sourceTemplate) throw new Error(`${TEMPLATE_SHEET_NAME} not found in reference workbook`);

  restoreProtectedTemplateContent_(sourceTemplate, template);
  removeQuotationItemImages_(template);

  // Clear line area while preserving the fixed summary/terms rows.
  template.showRows(ITEMS_START_ROW, ITEMS_END_ROW - ITEMS_START_ROW + 1);
  template.getRange(`B${ITEMS_START_ROW}:O${ITEMS_END_ROW}`).clearContent().clearDataValidations();
  template.setRowHeights(ITEMS_START_ROW, ITEMS_END_ROW - ITEMS_START_ROW + 1, 22);

  // Meta
  if (META_MAP.clientName)  template.getRange(META_MAP.clientName).setValue(clientName);
  if (META_MAP.projectName) template.getRange(META_MAP.projectName).setValue(projectName || clientName);
  if (META_MAP.quotationNo) template.getRange(META_MAP.quotationNo).setValue(labelledTemplateValue_('Refrence Number:', quotationNo));
  if (META_MAP.dateISO)     template.getRange(META_MAP.dateISO).setValue(`Dated: ${quotationDate_(dateISO)}`);
  if (META_MAP.termsType)   template.getRange(META_MAP.termsType).setValue(tcType || 'Equipment');
  if (META_MAP.billingAddress) template.getRange(META_MAP.billingAddress).setValue(clientBillingAddress);
  if (META_MAP.clientGst)   template.getRange(META_MAP.clientGst).setValue(clientGstNumber);
  if (META_MAP.displayName) template.getRange(META_MAP.displayName).setValue(copyName);

  // Lookup master (Equipment BD)
  const catalog = getCatalog_();

  const preparedItems = items.slice(0, ITEMS_END_ROW - ITEMS_START_ROW + 1).map(function(it, index) {
    const key   = `${it.category}|||${it.subCategory}`;
    const pool  = catalog.items[key] || [];
    const found = pool.find(p => p.code === it.itemCode);
    const qty = num_(it.qty);
    const baseRate = num_(it.rate || (found ? found.rate : 0));
    const rate = it.rateOverride !== undefined && it.rateOverride !== null && it.rateOverride !== ''
      ? num_(it.rateOverride)
      : baseRate;
    const desc = (it.descOverride && String(it.descOverride).trim() !== '')
      ? it.descOverride
      : (found ? (found.desc || found.name || `${it.category} : ${it.subCategory} : ${it.itemCode}`)
               : `${it.category} : ${it.subCategory} : ${it.itemCode}`);
    const img = it.imageUrl || (found && found.imageUrl ? found.imageUrl : '');
    const unit = it.unit || (found ? found.unit : '');
    const itemType = it.itemType || (found ? found.itemType : '') || 'Equipment';
    const displayItem = it.displayItem || `${it.category || ''} : ${it.subCategory || ''} : ${it.itemCode || ''}`;

    return {
      row: ITEMS_START_ROW + index,
      values: [it.category || '', it.subCategory || '', it.itemCode || '', index + 1,
        displayItem, '', desc, unit, qty, rate, '', itemType, baseRate],
      descHtml: it.descHtml || '',
      desc: desc,
      imageUrl: img
    };
  });

  if (preparedItems.length) {
    const firstRow = ITEMS_START_ROW;
    const count = preparedItems.length;
    template.getRange(firstRow, 2, count, 13).setValues(preparedItems.map(function(item) { return item.values; }));
    template.getRange(firstRow, 8, count, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    template.getRange(firstRow, 12, count, 1).setFormulas(preparedItems.map(function(item) {
      return [`=IF(OR(J${item.row}="",K${item.row}=""),"",J${item.row}*K${item.row})`];
    }));
    template.getRange(firstRow, 15, count, 1).setFormulas(preparedItems.map(function(item) {
      return [`=IF(OR(K${item.row}="",N${item.row}=""),"",K${item.row}-N${item.row})`];
    }));

    preparedItems.forEach(function(item) {
      if (item.descHtml) template.getRange(item.row, 8).setRichTextValue(richTextFromHtml_(item.descHtml, item.desc));
      if (item.imageUrl && insertQuotationImage_(template, item.imageUrl, item.row, 7)) {
        template.setRowHeight(item.row, 160);
        template.setColumnWidth(7, 190);
      } else {
        template.setRowHeight(item.row, 60);
      }
    });
  }

  const row = ITEMS_START_ROW + preparedItems.length;

  applyTemplatePricing_(template, pricing);
  applyTemplateTerms_(template, meta);

  if (row <= ITEMS_END_ROW) template.hideRows(row, ITEMS_END_ROW - row + 1);

  SpreadsheetApp.flush();

  // 3) Export PDF from the working copy
  const pdfFile = exportTemplateRegion_(template, EXPORT_PDF_FOLDER_ID, layout, EXPORT_RANGE);

  // 4) Share link (optional)
  try { pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}

  const displayNameCell = META_MAP.displayName ? template.getRange(META_MAP.displayName).getValue() : '';
  const pdfUrl = `https://drive.google.com/file/d/${pdfFile.getId()}/view`;

  Logger.log(JSON.stringify({ pdfUrl, fileId: pdfFile.getId(), quotationNo, clientName }));

  return {
    pdfFileId: pdfFile.getId(),
    pdfFileName: pdfFile.getName(),
    pdfUrl,
    workingCopyUrl: `https://docs.google.com/spreadsheets/d/${workingCopy.getId()}/edit`,
    displayName: displayNameCell || quotationNo || 'Quotation'
  };
}

function buildQuoteFileName_(meta) {
  const parts = [
    meta.quotationTitle,
    meta.quotationNo,
    meta.clientName,
    meta.projectName
  ].map(function(v){ return String(v || '').trim(); }).filter(Boolean);
  return (parts.join(' - ') || 'Quotation_Working_Copy').replace(/[\\/:*?"<>|]/g, '-');
}

function applyTemplatePricing_(template, pricing) {
  template.getRange('L71').setFormula('=SUM(L18:L70)');
  template.getRange('L72').setValue(pricing.freightAmount === '' || pricing.freightAmount === undefined ? 'Extra' : num_(pricing.freightAmount));
  template.getRange('L73').setValue(pricing.installationAmount === '' || pricing.installationAmount === undefined ? 'Extra' : num_(pricing.installationAmount));
  template.getRange('K74').setValue(percent_(pricing.nonEquipmentDiscountPct));
  template.getRange('K75').setValue(percent_(pricing.equipmentDiscountPct));
  template.getRange('K76').setValue(percent_(pricing.nonEquipmentGstPct));
  template.getRange('K77').setValue(percent_(pricing.equipmentGstPct));
  template.getRange('K78').setValue(percent_(pricing.freightInstallGstPct));
  template.getRange('L74').setFormula('=SUMIF($M$18:$M$70,"Non Equipment",$L$18:$L$70)*$K$74');
  template.getRange('L75').setFormula('=SUMIF($M$18:$M$70,"Equipment",$L$18:$L$70)*$K$75');
  template.getRange('L76').setFormula('=(SUMIF($M$18:$M$70,"Non Equipment",$L$18:$L$70)-L74)*K76');
  template.getRange('L77').setFormula('=(SUMIF($M$18:$M$70,"Equipment",$L$18:$L$70)-L75)*K77');
  template.getRange('L78').setFormula('=SUM(IFERROR(L72,0),IFERROR(L73,0))*K78');
  template.getRange('L79').setFormula('=ROUNDUP(SUM(L76,L77,L71,IFERROR(L72,0),IFERROR(L73,0),L78)-L74-L75)');
}

function applyTemplateTerms_(template, meta) {
  const startRow = 80;
  const maxTerms = 20;
  const terms = richTermsFromMeta_(meta, maxTerms);
  if (!terms.length) return;
  template.getRange(startRow, 5, maxTerms, 2).clearContent();
  template.getRange(startRow, 6, maxTerms, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP).setVerticalAlignment('top');
  terms.forEach(function(term, index) {
    template.getRange(startRow + index, 5).setValue(index + 1);
    template.getRange(startRow + index, 6).setRichTextValue(term.richText);
    template.setRowHeight(startRow + index, Math.max(28, Math.min(76, 20 + Math.ceil(term.text.length / 120) * 14)));
  });
}

function restoreProtectedTemplateContent_(source, destination) {
  ['E3:L8', 'E100:L105'].forEach(function(a1) {
    source.getRange(a1).copyTo(destination.getRange(a1), SpreadsheetApp.CopyPasteType.PASTE_NORMAL, false);
  });
}

function removeQuotationItemImages_(sheet) {
  sheet.getImages().forEach(function(image) {
    const anchor = image.getAnchorCell();
    if (anchor.getColumn() === 7 && anchor.getRow() >= ITEMS_START_ROW && anchor.getRow() <= ITEMS_END_ROW) {
      image.remove();
    }
  });
}

function labelledTemplateValue_(label, value) {
  const text = String(value || '').trim();
  if (!text) return label;
  return text.toLowerCase().indexOf(String(label || '').toLowerCase()) === 0 ? text : `${label}${text}`;
}

function quotationDate_(value) {
  const date = value ? new Date(value) : new Date();
  const safeDate = isNaN(date.getTime()) ? new Date() : date;
  return Utilities.formatDate(safeDate, Session.getScriptTimeZone() || 'Asia/Kolkata', 'dd.MM.yyyy');
}

/** ====== Update “Quotation Link” on Leads ====== **/
function updateLeadQuotationLink_(leadDisplay, pdfUrl, actingUser){
  // leadDisplay format: "Company | First Last | Mobile"
  const parts = String(leadDisplay||'').split('|').map(s=>s.trim());
  const company = parts[0] || '';
  const mobile  = parts[2] || '';

  if (!company || !mobile) throw new Error('Invalid leadDisplay format');

  const rec = getLoginRow_(actingUser);
  const isAdmin = rec && rec.role === 'Admin';

  const ss = SpreadsheetApp.openById(sanitizeId_(LEADS_SHEET_ID));
  const sh = ss.getSheetByName(LEADS_SHEET_NAME);
  if (!sh) throw new Error(`Leads sheet "${LEADS_SHEET_NAME}" not found`);

  const data = sh.getDataRange().getValues();
  const head = data.shift();

  const idxOwner = head.indexOf('Lead Owner');
  const idxComp  = head.indexOf('Company');
  const idxMob   = head.indexOf('Mobile Number');
  const idxLink  = head.indexOf('Quotation Link');
  if (idxLink === -1) throw new Error('"Quotation Link" column not found');

  let targetDataIdx = -1;
  for (let i = data.length-1; i>=0; i--){
    const r = data[i];
    const owns = String(r[idxOwner]||'').trim().toLowerCase() === String(actingUser).trim().toLowerCase();
    const match = String(r[idxComp]||'').trim() === company && String(r[idxMob]||'').trim() === mobile;
    if (match && (isAdmin || owns)){
      targetDataIdx = i; break;
    }
  }
  if (targetDataIdx === -1) throw new Error('Lead not found or not permitted');

  const sheetRow = targetDataIdx + 2;
  sh.getRange(sheetRow, idxLink+1).setValue(pdfUrl);
}

/** ====== Export helpers ====== **/
function exportTemplateRegion_(sheet, folderId, layout, rangeA1, fileNameOverride){
  const ss = sheet.getParent();
  const fileName = String(fileNameOverride || sheet.getRange(META_MAP.displayName).getValue() || 'ExportedQuotation').trim();

  const url =
    `https://docs.google.com/spreadsheets/d/${ss.getId()}/export?format=pdf` +
    `&size=A4&portrait=${layout==='portrait'?'true':'false'}&scale=2&fitw=true` +
    `&top_margin=0.06&bottom_margin=0.06&left_margin=0.06&right_margin=0.06` +
    `&sheetnames=false&printtitle=false&gridlines=false` +
    `&horizontal_alignment=CENTER&gid=${sheet.getSheetId()}&range=${encodeURIComponent(rangeA1)}`;

  const res = UrlFetchApp.fetch(url, { headers:{ Authorization:`Bearer ${ScriptApp.getOAuthToken()}` }});
  const blob = res.getBlob().setName(`${fileName}.pdf`);
  const folder = DriveApp.getFolderById(folderId);
  return folder.createFile(blob);
}

/**
 * Build a spreadsheet-only working copy. Spreadsheet.copy()/Drive makeCopy()
 * can duplicate a container-bound Apps Script project; copying tabs into a
 * newly created spreadsheet preserves sheet content without creating another
 * quotation script deployment for every client.
 */
function copySpreadsheetWithoutBoundScript_(source, copyName, folderId, sheetNames) {
  const destination = SpreadsheetApp.create(copyName);
  const placeholder = destination.getSheets()[0];

  const wanted = sheetNames && sheetNames.length ? new Set(sheetNames) : null;
  source.getSheets().filter(function(sourceSheet) {
    return !wanted || wanted.has(sourceSheet.getName());
  }).forEach(function(sourceSheet) {
    const copied = sourceSheet.copyTo(destination);
    copied.setName(sourceSheet.getName());
    if (sourceSheet.isSheetHidden()) copied.hideSheet();
  });

  destination.deleteSheet(placeholder);
  try {
    const file = DriveApp.getFileById(destination.getId());
    const folder = DriveApp.getFolderById(folderId);
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
  } catch (_) {}
  SpreadsheetApp.flush();
  return destination;
}

function moveFileToFolder_(fileId, folderId) {
  const file = DriveApp.getFileById(fileId);
  const folder = DriveApp.getFolderById(folderId);
  folder.addFile(file);
  try { DriveApp.getRootFolder().removeFile(file); } catch (_) {}
}

function managedWorkingCopy_(quoteKey, createSpreadsheet) {
  const propertyKey = `quotation-working-copy:${String(quoteKey || '').trim()}`;
  const properties = PropertiesService.getScriptProperties();
  const existingId = properties.getProperty(propertyKey);
  if (existingId) {
    try {
      const file = DriveApp.getFileById(existingId);
      const parents = file.getParents();
      let insideEditableFolder = false;
      while (parents.hasNext()) {
        if (parents.next().getId() === WORKING_COPIES_FOLDER_ID) insideEditableFolder = true;
      }
      if (insideEditableFolder && file.getMimeType() === MimeType.GOOGLE_SHEETS) {
        return SpreadsheetApp.openById(existingId);
      }
    } catch (_) {}
    properties.deleteProperty(propertyKey);
  }
  const created = createSpreadsheet();
  properties.setProperty(propertyKey, created.getId());
  return created;
}

function insertQuotationImage_(sheet, url, row, column) {
  try {
    const sourceUrl = String(url || '');
    const fileId = /(?:drive|docs)\.google\.com/i.test(sourceUrl) ? sourceUrl.match(/[-\w]{25,}/) : null;
    const blob = fileId
      ? DriveApp.getFileById(fileId[0]).getBlob()
      : UrlFetchApp.fetch(sourceUrl, { muteHttpExceptions: true, followRedirects: true }).getBlob();
    if (!String(blob.getContentType() || '').startsWith('image/')) return false;
    const image = sheet.insertImage(blob, column, row);
    const maxWidth = 170;
    const maxHeight = 140;
    const sourceWidth = Math.max(1, image.getWidth());
    const sourceHeight = Math.max(1, image.getHeight());
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    image.setWidth(width).setHeight(height);
    image.setAnchorCellXOffset(Math.max(0, Math.round((maxWidth - width) / 2)));
    image.setAnchorCellYOffset(Math.max(0, Math.round((maxHeight - height) / 2)));
    return true;
  } catch (error) {
    Logger.log(`Quotation image warning for row ${row}: ${error}`);
    return false;
  }
}

function richTextFromHtml_(html, fallback) {
  const tokens = String(html || '').match(/<[^>]+>|[^<]+/g) || [];
  const state = { bold: 0, italic: 0, underline: 0 };
  const spans = [];
  let text = '';

  function append(value) {
    const decoded = decodeHtmlText_(value);
    if (!decoded) return;
    const start = text.length;
    text += decoded;
    spans.push({ start: start, end: text.length, bold: state.bold > 0, italic: state.italic > 0, underline: state.underline > 0 });
  }

  tokens.forEach(function(token) {
    if (token[0] !== '<') return append(token);
    const closing = /^<\//.test(token);
    const tagMatch = token.toLowerCase().match(/^<\/?\s*([a-z0-9]+)/);
    const tag = tagMatch ? tagMatch[1] : '';
    if (tag === 'strong' || tag === 'b') state.bold += closing ? -1 : 1;
    if (tag === 'em' || tag === 'i') state.italic += closing ? -1 : 1;
    if (tag === 'u') state.underline += closing ? -1 : 1;
    if (!closing && tag === 'li') append('• ');
    if (tag === 'br' || (closing && ['p', 'div', 'li'].includes(tag))) {
      if (text && !text.endsWith('\n')) append('\n');
    }
    state.bold = Math.max(0, state.bold);
    state.italic = Math.max(0, state.italic);
    state.underline = Math.max(0, state.underline);
  });

  text = text.replace(/\n+$/g, '') || String(fallback || '');
  const builder = SpreadsheetApp.newRichTextValue().setText(text);
  spans.forEach(function(span) {
    const end = Math.min(span.end, text.length);
    if (span.start >= end || (!span.bold && !span.italic && !span.underline)) return;
    const style = SpreadsheetApp.newTextStyle()
      .setBold(span.bold)
      .setItalic(span.italic)
      .setUnderline(span.underline)
      .build();
    builder.setTextStyle(span.start, end, style);
  });
  return builder.build();
}

function richTermsFromMeta_(meta, limit) {
  const values = Array.isArray(meta && meta.termsAndConditions) ? meta.termsAndConditions : [];
  const maximum = Number(limit) > 0 ? Number(limit) : values.length;
  return values.slice(0, maximum).map(function(value) {
    const richText = richTextFromHtml_(value, String(value || ''));
    return { richText: richText, text: richText.getText().trim() };
  }).filter(function(term) { return term.text; });
}

function decodeHtmlText_(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function toDirectLink_(url){
  const m = String(url).match(/[-\w]{25,}/);
  return m ? `https://drive.google.com/uc?id=${m[0]}` : url;
}

function col(letter){ return letter; }

/** ====== Header utilities (robust & header-row auto-detect) ====== **/
function normalizeHeader_(h) {
  // lower, trim, remove ALL non a-z0-9
  var s = String(h || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

  // explicit map first
  var map = {
    category: 'category', cat: 'category', court: 'category',

    subcategory: 'subcategory', subcat: 'subcategory',
    subcategoryname: 'subcategory',

    itemcode: 'itemcode', code: 'itemcode', sku: 'itemcode',

    itemname: 'itemname', name: 'itemname',
    item: 'itemcode',
    itemdefinition: 'itemdefinition',

    unit: 'unit', uom: 'unit',

    rate: 'rate', price: 'rate', unitprice: 'rate', listprice: 'rate',

    description: 'description', desc: 'description',

    imageurl: 'imageurl', image: 'imageurl', images: 'imageurl', photo: 'imageurl', picture: 'imageurl'
  };
  if (map[s]) return map[s];

  // heuristics (fallbacks)
  if (s.indexOf('subcategory') >= 0) return 'subcategory';
  if (s.indexOf('category')    >= 0) return 'category';
  if (s === 'court') return 'category';
  if (s.indexOf('itemcode')    >= 0 || s.indexOf('sku') >= 0 || s === 'code' || s === 'item') return 'itemcode';
  if (s.indexOf('itemname')    >= 0 || s === 'name') return 'itemname';
  if (s.indexOf('itemdefinition') >= 0) return 'itemdefinition';
  if (s.indexOf('description') >= 0 || s === 'desc') return 'description';
  if (s.indexOf('image')       >= 0 || s.indexOf('photo') >= 0 || s.indexOf('picture') >= 0) return 'imageurl';
  if (s.indexOf('unitprice')   >= 0 || s.indexOf('listprice') >= 0 || s === 'price' || s === 'rate') return 'rate';
  if (s === 'unit' || s === 'uom') return 'unit';

  return s;
}

// Try header rows 1..5, pick the first that has all required fields
function getHeaderMapSmart_(sheet, requiredKeys) {
  var lastCol = sheet.getLastColumn();
  for (var r = 1; r <= Math.min(5, sheet.getLastRow()); r++) {
    var headers = sheet.getRange(r, 1, 1, lastCol).getValues()[0];
    var map = {}; // canonical -> 1-based col
    headers.forEach(function(h, i) {
      var key = normalizeHeader_(h);
      if (key) map[key] = i + 1;
    });
    var hasAll = requiredKeys.every(function(k){ return !!map[k]; });
    if (hasAll) return map;
  }
  // fallback to row 1 map (even if incomplete)
  var headers1 = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map1 = {};
  headers1.forEach(function(h, i) {
    var key = normalizeHeader_(h);
    if (key) map1[key] = i + 1;
  });
  return map1;
}

function num_(v) {
  var n = Number(String(v === null || v === undefined ? '' : v).replace(/[₹,%\s,]/g, ''));
  return isNaN(n) ? 0 : n;
}

function percent_(v) {
  var n = num_(v);
  return n > 1 ? n / 100 : n;
}
