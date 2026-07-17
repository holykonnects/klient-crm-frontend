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
const LEADS_SHEET_ID   = '1vJbB0fmBQhd6XGTNbjUAi7Bt71hNya u2TBMXTCdoM0'.replace(/\s/g, '');
const LEADS_SHEET_NAME = 'Form responses 1'; // must contain "Quotation Link" header

// Equipment BD expected headers (in reference spreadsheet)
const EQUIPMENT_SHEET_NAME = 'Equipment BD'; // A..H → Cat | Sub | Code | Name | Unit | Rate | Desc | ImageURL

// New Template rows used for items
const ITEMS_START_ROW = 18;
const ITEMS_END_ROW   = 70;

// Template meta cell mapping for the current "New Template" sheet.
const META_MAP = {
  clientName:  'E7',
  projectName: 'E8',
  quotationNo: 'E9',
  dateISO:     'E10',
  preparedBy:  'E12',
  notes:       'E15',
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
      const out = buildQuotationAndExport_(payload);

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

/** ====== Main builder (copy-on-export) ====== **/
function buildQuotationAndExport_(payload){
  const { meta = {}, pricing = {}, items = [] } = payload || {};
  const {
    clientName='', projectName='', quotationNo='',
    dateISO='', preparedBy='', notes='',
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
  const workingCopy = ref.copy(copyName);
  const workingFile = DriveApp.getFileById(workingCopy.getId());

  // Move to working copies folder (optional but tidy)
  try {
    const folder = DriveApp.getFolderById(WORKING_COPIES_FOLDER_ID);
    folder.addFile(workingFile);
    DriveApp.getRootFolder().removeFile(workingFile);
  } catch (_) {}

  // 2) Fill the copy’s template
  const template = workingCopy.getSheetByName(TEMPLATE_SHEET_NAME);
  if (!template) throw new Error(`${TEMPLATE_SHEET_NAME} not found in working copy`);

  // Clear line area while preserving the fixed summary/terms rows.
  template.showRows(ITEMS_START_ROW, ITEMS_END_ROW - ITEMS_START_ROW + 1);
  template.getRange(`B${ITEMS_START_ROW}:O${ITEMS_END_ROW}`).clearContent().clearDataValidations();
  for (let r = ITEMS_START_ROW; r <= ITEMS_END_ROW; r++) template.setRowHeight(r, 22);

  // Meta
  if (META_MAP.clientName)  template.getRange(META_MAP.clientName).setValue(clientName);
  if (META_MAP.projectName) template.getRange(META_MAP.projectName).setValue(projectName);
  if (META_MAP.quotationNo) template.getRange(META_MAP.quotationNo).setValue(quotationNo);
  if (META_MAP.dateISO)     template.getRange(META_MAP.dateISO).setValue(dateISO ? new Date(dateISO) : new Date());
  if (META_MAP.preparedBy)  template.getRange(META_MAP.preparedBy).setValue(preparedBy);
  if (META_MAP.notes)       template.getRange(META_MAP.notes).setValue(notes);
  if (META_MAP.termsType)   template.getRange(META_MAP.termsType).setValue(tcType || 'Equipment');
  if (META_MAP.billingAddress) template.getRange(META_MAP.billingAddress).setValue(clientBillingAddress);
  if (META_MAP.clientGst)   template.getRange(META_MAP.clientGst).setValue(clientGstNumber);
  if (META_MAP.displayName) template.getRange(META_MAP.displayName).setValue(copyName);

  // Lookup master (Equipment BD)
  const catalog = getCatalog_();

  let row = ITEMS_START_ROW;
  for (const it of items){
    if (row > ITEMS_END_ROW) break;

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
    const img = it.imageUrl ? toDirectLink_(it.imageUrl) : (found && found.imageUrl ? toDirectLink_(found.imageUrl) : '');
    const unit = it.unit || (found ? found.unit : '');
    const itemType = it.itemType || (found ? found.itemType : '') || 'Equipment';
    const displayItem = `${it.category || ''} : ${it.subCategory || ''} : ${it.itemCode || ''}`;

    // New Template columns B:O.
    template.getRange(row, 2, 1, 13).setValues([[
      it.category || '',
      it.subCategory || '',
      it.itemCode || '',
      row - ITEMS_START_ROW + 1,
      displayItem,
      '',
      desc,
      unit,
      qty,
      rate,
      '',
      itemType,
      baseRate
    ]]);
    template.getRange(row, 8).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    template.getRange(row, 12).setFormula(`=IF(OR(J${row}="",K${row}=""),"",J${row}*K${row})`);
    template.getRange(row, 15).setFormula(`=IF(OR(K${row}="",N${row}=""),"",K${row}-N${row})`);

    if (img) {
      template.getRange(row, 7).setFormula(`=IMAGE("${img}",3)`);
      template.setRowHeight(row, 220);
      template.setColumnWidth(7, 260);
    } else if (template.getRowHeight(row) < 60) {
      template.setRowHeight(row, 60);
    }

    row++;
  }

  applyTemplatePricing_(template, pricing);

  for (let rr = row; rr <= ITEMS_END_ROW; rr++) {
    template.hideRows(rr);
  }

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

/** ====== Update “Quotation Link” on Leads ====== **/
function updateLeadQuotationLink_(leadDisplay, pdfUrl, actingUser){
  // leadDisplay format: "Company | First Last | Mobile"
  const parts = String(leadDisplay||'').split('|').map(s=>s.trim());
  const company = parts[0] || '';
  const mobile  = parts[2] || '';

  if (!company || !mobile) throw new Error('Invalid leadDisplay format');

  const rec = getLoginRow_(actingUser);
  const isAdmin = rec && rec.role === 'Admin';

  const ss = SpreadsheetApp.openById(LEADS_SHEET_ID);
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
function exportTemplateRegion_(sheet, folderId, layout, rangeA1){
  const ss = sheet.getParent();
  const fileName = String(sheet.getRange(META_MAP.displayName).getValue() || 'ExportedQuotation').trim();

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
