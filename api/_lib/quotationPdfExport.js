import fs from "fs";
import path from "path";
import { DRIVE_FOLDERS, SHEETS } from "./crmConfig.js";
import {
  driveCopyFile, driveDownloadFile, getAccessToken, getDriveAuthSubjects, googleFetch, uploadDriveFileDetails,
} from "./googleSheets.js";
import { createSignedToken } from "./sessionAuth.js";
import { QUOTATION_CURRENCY_FORMAT } from "./quotationCurrency.js";
import { quotationImageReference } from "./quotationImages.js";
import { quotationChargeAmount, quotationCommercialLabel, quotationCommercialSummary } from "../../src/utils/quotationCommercials.js";

const BLUE = "#163f76";
const LIGHT_BLUE = "#dce9f8";
const BORDER = "#b8c4d4";
const TEXT = "#172033";

function clean(value) { return String(value ?? "").trim(); }
function number(value) {
  const parsed = Number(clean(value).replace(/[,₹%\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function money(value) { return `Rs. ${number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`; }
function plainText(value) {
  return clean(value)
    .replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\s*li\b[^>]*>/gi, "- ")
    .replace(/<\/(?:p|div|li)>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/\n{3,}/g, "\n\n").trim();
}
function safeFileName(value) {
  return (clean(value) || "Quotation").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ");
}
function decodeHtml(value) {
  return String(value ?? "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'");
}
export function quotationLineDescription(item = {}) {
  return plainText(item.descHtml || item.descOverride || item.description || item.desc);
}
function driveId(value) {
  const match = clean(value).match(/[-\w]{25,}/);
  return match ? match[0] : "";
}
async function loadImage(value) {
  const url = clean(value);
  if (!url) return null;
  try {
    const id = driveId(url);
    if (id) {
      for (const subject of getDriveAuthSubjects()) {
        try { return (await driveDownloadFile(id, { scopes: ["https://www.googleapis.com/auth/drive"], subject })).body; } catch {}
      }
      return null;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
  } catch { return null; }
}
async function loadImages(items) {
  const urls = [...new Set(items.map((item) => clean(item.imageUrl)).filter(Boolean))];
  return new Map(await Promise.all(urls.map(async (url) => [url, await loadImage(url)])));
}
function collectItems(payload) {
  if (payload.quoteType === "project-set") {
    let serial = 0;
    return (payload.setQuotation?.sets || []).flatMap((set) => (set.items || []).map((item) => ({
      ...item, serial: ++serial, section: clean(set.title), displayItem: clean(item.item),
      descOverride: clean(item.description), qty: number(item.qty), rate: number(item.rate),
    })));
  }
  return (payload.items || []).map((item, index) => ({ ...item, serial: index + 1 }));
}

export async function buildQuotationPdf(payload = {}) {
  const { default: PDFDocument } = await import("pdfkit");
  const meta = payload.meta || {};
  const items = collectItems(payload);
  if (!items.length) throw new Error("Add at least one complete quotation item before exporting");
  const images = await loadImages(items);
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 24, autoFirstPage: false, bufferPages: true });
  const chunks = [];
  const completed = new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const left = 24;
  const columns = [
    ["S.No", 30], ["Item", 118], ["Image", 62], ["Description", 236], ["Freight", 62],
    ["Installation", 67], ["Unit", 42], ["Qty", 45], ["Unit Price", 64], ["Amount", 68],
  ];
  const tableWidth = columns.reduce((sum, column) => sum + column[1], 0);
  let y = 0;
  const cell = (text, x, top, width, height, options = {}) => {
    doc.save().rect(x, top, width, height).fillAndStroke(options.fill || "#ffffff", BORDER).restore();
    doc.fillColor(options.color || TEXT).font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(options.size || 7.2)
      .text(clean(text) || "-", x + 4, top + 5, { width: width - 8, height: height - 8, align: options.align || "left", ellipsis: true });
  };
  const pageHeader = (continued = false) => {
    doc.addPage();
    y = 22;
    const logo = path.join(process.cwd(), "public", "assets", "rido-sports-logo.png");
    doc.rect(left, y, tableWidth, 52).stroke(BORDER);
    if (fs.existsSync(logo)) doc.image(logo, left + 4, y + 5, { fit: [115, 42] });
    doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(15).text("QUOTATION", left + 145, y + 10, { width: 420, align: "center" });
    doc.font("Helvetica").fontSize(8).text(clean(meta.quotationTitle || meta.projectName || "Quotation"), left + 145, y + 31, { width: 420, align: "center" });
    doc.fontSize(7).text(`Quotation No.: ${clean(meta.quotationNo) || "-"}\nDate: ${clean(meta.dateISO) || "-"}\nPrepared By: ${clean(meta.preparedBy) || "-"}`, left + 590, y + 8, { width: 190, lineGap: 2 });
    y += 52;
    if (!continued) {
      [["Client", meta.clientName, "Project", meta.projectName], ["Client Email ID", meta.clientEmail, "GST Number", meta.clientGstNumber], ["Billing Address", meta.clientBillingAddress, "", ""]].forEach(([a, b, c, d]) => {
        cell(a, left, y, 90, 30, { fill: LIGHT_BLUE, bold: true }); cell(b, left + 90, y, 305, 30);
        cell(c, left + 395, y, 90, 30, { fill: LIGHT_BLUE, bold: true }); cell(d, left + 485, y, tableWidth - 485, 30); y += 30;
      });
    }
    let x = left;
    columns.forEach(([label, width]) => { cell(label, x, y, width, 26, { fill: BLUE, color: "#ffffff", bold: true, align: "center" }); x += width; });
    y += 26;
  };
  pageHeader();
  let subtotal = 0;
  let equipmentSubtotal = 0;
  let nonEquipmentSubtotal = 0;
  for (const item of items) {
    const rate = number(item.rateOverride !== undefined ? item.rateOverride : item.rate);
    const qty = number(item.qty);
    const amount = qty * rate;
    subtotal += amount;
    if (clean(item.itemType).toLowerCase() === "non equipment") nonEquipmentSubtotal += amount;
    else equipmentSubtotal += amount;
    const description = quotationLineDescription(item);
    doc.font("Helvetica").fontSize(7.2);
    const height = Math.max(58, Math.min(118, doc.heightOfString(description || "-", { width: 228 }) + 12));
    if (y + height > 545) pageHeader(true);
    const values = [item.serial, [item.section, item.displayItem || item.libraryItem || item.itemCode, item.category, item.subCategory].filter(Boolean).join("\n"), "", description, item.freight, item.installation, item.unit, qty, money(rate), money(amount)];
    let x = left;
    columns.forEach(([, width], index) => {
      cell(values[index], x, y, width, height, { align: index === 0 || index >= 6 ? "center" : "left", bold: index === 9 });
      if (index === 2 && images.get(clean(item.imageUrl))) {
        try { doc.image(images.get(clean(item.imageUrl)), x + 4, y + 4, { fit: [width - 8, height - 8], align: "center", valign: "center" }); } catch {}
      }
      x += width;
    });
    y += height;
  }
  const pricing = payload.pricing || {};
  const equipmentDiscount = equipmentSubtotal * (number(pricing.equipmentDiscountPct) / 100);
  const nonEquipmentDiscount = nonEquipmentSubtotal * (number(pricing.nonEquipmentDiscountPct) / 100);
  const discount = equipmentDiscount + nonEquipmentDiscount;
  const freight = number(pricing.freightAmount);
  const installation = number(pricing.installationAmount);
  const equipmentTaxable = Math.max(0, equipmentSubtotal - equipmentDiscount);
  const nonEquipmentTaxable = Math.max(0, nonEquipmentSubtotal - nonEquipmentDiscount);
  const taxable = equipmentTaxable + nonEquipmentTaxable;
  const gst = payload.quoteType === "project-set"
    ? subtotal * (number(payload.setQuotation?.gstPct) / 100)
    : equipmentTaxable * (number(pricing.equipmentGstPct) / 100)
    + nonEquipmentTaxable * (number(pricing.nonEquipmentGstPct) / 100)
    + (freight + installation) * (number(pricing.freightInstallGstPct) / 100);
  const totals = [["Subtotal", subtotal], ["Discount", -discount], ["Freight", freight], ["Installation", installation], ["GST", gst], ["Grand Total", Math.ceil(taxable + freight + installation + gst)]];
  if (y + totals.length * 22 + 55 > 570) pageHeader(true);
  const totalX = left + tableWidth - 220;
  totals.forEach(([label, value], index) => {
    const final = index === totals.length - 1;
    cell(label, totalX, y, 105, 22, { fill: final ? LIGHT_BLUE : "#ffffff", bold: final });
    cell(money(value), totalX + 105, y, 115, 22, { fill: final ? LIGHT_BLUE : "#ffffff", bold: final, align: "right" }); y += 22;
  });
  const terms = (meta.termsAndConditions || []).map(plainText).filter(Boolean);
  if (terms.length) {
    if (y + 50 > 570) pageHeader(true);
    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(9).text(`Terms & Conditions: ${clean(meta.tcType) || "Selected terms"}`, left, y + 10); y += 28;
    terms.forEach((term, index) => {
      const height = Math.max(18, doc.heightOfString(`${index + 1}. ${term}`, { width: tableWidth - 12 }) + 7);
      if (y + height > 570) pageHeader(true);
      doc.fillColor(TEXT).font("Helvetica").fontSize(7.5).text(`${index + 1}. ${term}`, left + 6, y + 3, { width: tableWidth - 12 }); y += height;
    });
  }
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.fillColor("#64748b").font("Helvetica").fontSize(7).text(`Rido CRM quotation | Page ${index + 1} of ${range.count}`, left, 572, { width: tableWidth, align: "center" });
  }
  doc.end();
  return completed;
}

export async function buildLegacyQuotationPdfToDrive(payload = {}) {
  const pdf = await buildQuotationPdf(payload);
  const meta = payload.meta || {};
  const fileName = `${safeFileName(meta.quotationTitle || meta.quotationNo || meta.clientName)}.pdf`;
  const uploaded = await uploadDriveFileDetails({ name: fileName, label: fileName, type: "application/pdf", base64: pdf.toString("base64") }, DRIVE_FOLDERS.quotationExports, "QUOTATION");
  return { ok: true, pdfFileId: uploaded.id, pdfFileName: fileName, pdfUrl: uploaded.webViewLink, workingCopyUrl: "" };
}

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TEMPLATE_SHEET = "New Template";
const ITEMS_START_ROW = 18;
const ITEMS_END_ROW = 70;

function templateRange(a1) { return `'${TEMPLATE_SHEET}'!${a1}`; }
function templatePercent(value) {
  const numeric = number(value);
  return numeric > 1 ? numeric / 100 : numeric;
}
function templateDate(value) {
  const [year, month, day] = clean(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : clean(value);
}
function publicAppUrl() {
  const configured = clean(
    process.env.PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "https://crm.klientkonnect.com",
  ).replace(/\/+$/g, "");
  return /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
}
function quotationImageProxyUrl(fileId) {
  if (!fileId) return "";
  const token = createSignedToken({ type: "quotation-image", fileId });
  return `${publicAppUrl()}/api/quotation-image?token=${encodeURIComponent(token)}`;
}
function templateImageFormula(value, options = {}) {
  const reference = quotationImageReference(value);
  if (!reference) return "";
  const source = reference.fileId ? (options.proxyUrl || quotationImageProxyUrl(reference.fileId)) : reference.url;
  if (!source || /(?:^|\/)drive\.google\.com(?:\/|$)/i.test(source)) return "";
  return `=IMAGE("${source.replace(/"/g, '""')}",1)`;
}
function templateItems(payload) {
  if (payload.quoteType !== "project-set") return payload.items || [];
  return (payload.setQuotation?.sets || []).flatMap((set) => (set.items || []).map((item) => ({
    category: clean(set.title), subCategory: "Project BOQ", itemCode: clean(item.item),
    displayItem: clean(item.item), descOverride: clean(item.description), descHtml: item.descHtml,
    freight: item.freight, installation: item.installation, unit: item.unit,
    qty: item.qty, rate: item.rate, itemType: "Equipment", imageUrl: item.imageUrl,
  })));
}
function templatePricing(payload) {
  if (payload.quoteType !== "project-set") return payload.pricing || {};
  const gst = payload.setQuotation?.gstPct || 0;
  return {
    freightAmount: "", installationAmount: "", equipmentDiscountPct: 0, nonEquipmentDiscountPct: 0,
    equipmentGstPct: gst, nonEquipmentGstPct: gst, freightInstallGstPct: gst,
  };
}

function templateCommercials(items, pricing, field) {
  const summary = quotationCommercialSummary(items, field);
  const globalValue = pricing[`${field}Amount`];
  const amount = quotationChargeAmount(globalValue) + summary.amount;
  const hasAmount = amount > 0 || /^\s*(?:₹\s*)?0(?:\.0+)?\s*$/.test(String(globalValue ?? ''));
  return {
    label: quotationCommercialLabel(field === 'freight' ? 'Freight' : 'Installation', summary),
    value: hasAmount ? amount : (String(globalValue ?? '').trim() || (summary.entries.length ? 'As specified' : 'Extra')),
  };
}
function templateRichCell(html, fallback) {
  const source = clean(html) || clean(fallback).replace(/\n/g, "<br>");
  const tokens = source.match(/<[^>]+>|[^<]+/g) || [];
  const active = { bold: false, italic: false, underline: false };
  const runs = [];
  let text = "";
  const append = (value, format = active) => {
    const decoded = decodeHtml(value);
    if (!decoded) return;
    const next = { bold: Boolean(format.bold), italic: Boolean(format.italic), underline: Boolean(format.underline) };
    const previous = runs.at(-1)?.format || {};
    if (!runs.length || previous.bold !== next.bold || previous.italic !== next.italic || previous.underline !== next.underline) {
      runs.push({ startIndex: text.length, format: next });
    }
    text += decoded;
  };
  const newline = () => { if (text && !text.endsWith("\n")) append("\n"); };
  tokens.forEach((token) => {
    if (!token.startsWith("<")) return append(token);
    const tag = token.toLowerCase().replace(/[<>]/g, "").trim().split(/\s+/)[0];
    if (["br", "br/", "/p", "/div", "/li"].includes(tag)) newline();
    else if (tag === "li") { newline(); append("- "); }
    else if (["strong", "b"].includes(tag)) active.bold = true;
    else if (["/strong", "/b"].includes(tag)) active.bold = false;
    else if (["em", "i"].includes(tag)) active.italic = true;
    else if (["/em", "/i"].includes(tag)) active.italic = false;
    else if (tag === "u") active.underline = true;
    else if (tag === "/u") active.underline = false;
  });
  text = text.trim();
  return { userEnteredValue: { stringValue: text }, textFormatRuns: runs.filter((run) => run.startIndex < text.length) };
}
function templateDescriptionLayout(item = {}) {
  const text = templateRichCell(
    item.descHtml,
    item.descOverride || item.description || item.desc,
  ).userEnteredValue.stringValue;
  const imageUrl = clean(item.imageUrl);
  const imageHeight = /^https?:\/\//i.test(imageUrl) && !/^#(?:REF|VALUE|N\/A|ERROR)!?$/i.test(imageUrl) ? 160 : 60;
  const maximumHeight = 380;
  let selected = { fontSize: 5, height: maximumHeight, wrappedLines: 1 };

  for (const fontSize of [9, 8, 7, 6, 5]) {
    const charactersPerLine = Math.max(34, Math.floor(34 * (9 / fontSize)));
    const wrappedLines = text.split("\n").reduce(
      (count, line) => count + Math.max(1, Math.ceil(line.length / charactersPerLine)),
      0,
    ) || 1;
    const height = Math.ceil(24 + (wrappedLines * fontSize * 1.7));
    selected = { fontSize, height: Math.min(maximumHeight, Math.max(60, imageHeight, height)), wrappedLines };
    if (height <= maximumHeight) break;
  }

  return selected;
}
function templateItemRowHeight(item = {}) {
  return templateDescriptionLayout(item).height;
}
async function copyNewTemplate(name) {
  const errors = [];
  for (const subject of getDriveAuthSubjects()) {
    const auth = { scopes: [DRIVE_SCOPE, SHEETS_SCOPE], subject };
    try {
      const copy = await driveCopyFile(SHEETS.quotations.referenceSpreadsheetId, {
        name,
        parents: [DRIVE_FOLDERS.quotationWorkingCopies],
      }, auth);
      return { copy, auth };
    } catch (error) { errors.push(error.message || String(error)); }
  }
  throw new Error(`Editable New Template copy could not be created: ${errors.at(-1) || "Google Drive access failed"}`);
}
async function populateNewTemplate(spreadsheetId, auth, payload) {
  const metadata = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`, {}, auth);
  const sheet = (metadata.sheets || []).map((entry) => entry.properties).find((entry) => entry?.title === TEMPLATE_SHEET);
  if (!sheet) throw new Error(`${TEMPLATE_SHEET} was not found in the editable quotation copy`);
  await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ updateSpreadsheetProperties: {
      properties: { importFunctionsExternalUrlAccessAllowed: true },
      fields: "importFunctionsExternalUrlAccessAllowed",
    } }] }),
  }, auth);
  const items = templateItems(payload).slice(0, ITEMS_END_ROW - ITEMS_START_ROW + 1);
  if (!items.length) throw new Error("Add at least one complete quotation item before exporting");
  const meta = payload.meta || {};
  const pricing = templatePricing(payload);
  const freight = templateCommercials(items, pricing, "freight");
  const installation = templateCommercials(items, pricing, "installation");
  const data = [
    ["G11", meta.clientName], ["G12", meta.projectName || meta.clientName],
    ["E10", meta.quotationNo ? `Refrence Number:${meta.quotationNo}` : "Refrence Number:"],
    ["E9", `Dated: ${templateDate(meta.dateISO)}`], ["C14", meta.tcType || "Equipment"],
    ["G13", meta.clientBillingAddress], ["G14", meta.clientGstNumber],
    ["E16", safeFileName(meta.quotationTitle || meta.quotationNo || meta.clientName)],
    ["L71", "=SUM(L18:L70)"],
    ["E72", freight.label], ["L72", freight.value],
    ["E73", installation.label], ["L73", installation.value],
    ["K74", templatePercent(pricing.nonEquipmentDiscountPct)], ["K75", templatePercent(pricing.equipmentDiscountPct)],
    ["K76", templatePercent(pricing.nonEquipmentGstPct)], ["K77", templatePercent(pricing.equipmentGstPct)],
    ["K78", templatePercent(pricing.freightInstallGstPct)],
    ["L74", '=SUMIF($M$18:$M$70,"Non Equipment",$L$18:$L$70)*$K$74'],
    ["L75", '=SUMIF($M$18:$M$70,"Equipment",$L$18:$L$70)*$K$75'],
    ["L76", '=(SUMIF($M$18:$M$70,"Non Equipment",$L$18:$L$70)-L74)*K76'],
    ["L77", '=(SUMIF($M$18:$M$70,"Equipment",$L$18:$L$70)-L75)*K77'],
    ["L78", '=SUM(IFERROR(L72,0),IFERROR(L73,0))*K78'],
    ["L79", '=ROUNDUP(SUM(L76,L77,L71,IFERROR(L72,0),IFERROR(L73,0),L78)-L74-L75)'],
  ].map(([a1, value]) => ({ range: templateRange(a1), values: [[value ?? ""]] }));
  if (clean(meta.clientEmail)) data.push({
    range: templateRange("E8"), values: [[`Email ID: ${clean(meta.clientEmail)}`]],
  });
  items.forEach((item, index) => {
    const row = ITEMS_START_ROW + index;
    const rate = item.rateOverride !== undefined && item.rateOverride !== "" ? number(item.rateOverride) : number(item.rate);
    data.push({ range: templateRange(`B${row}:N${row}`), values: [[
      item.category || "", item.subCategory || "", item.itemCode || "", index + 1,
      item.displayItem || item.libraryItem || item.itemCode || "", templateImageFormula(item.imageUrl), "",
      item.unit || "", number(item.qty), rate, `=IF(OR(J${row}="",K${row}=""),"",J${row}*K${row})`,
      item.itemType || "Equipment", number(item.rate),
    ]] });
  });
  await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ranges: [templateRange("B18:O70"), templateRange("E80:F99")] }),
  }, auth);
  await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
  }, auth);
  const requests = [{ updateDimensionProperties: {
    range: { sheetId: sheet.sheetId, dimension: "ROWS", startIndex: ITEMS_START_ROW - 1, endIndex: ITEMS_END_ROW },
    properties: { hiddenByUser: false }, fields: "hiddenByUser",
  } }];
  [freight, installation].forEach((commercial, index) => {
    const rowIndex = 71 + index;
    requests.push({ repeatCell: {
      range: { sheetId: sheet.sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 4, endColumnIndex: 12 },
      cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
      fields: "userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment",
    } });
    const lines = commercial.label.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 80)), 0);
    requests.push({ updateDimensionProperties: {
      range: { sheetId: sheet.sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 },
      properties: { pixelSize: Math.max(20, lines * 16 + 6) }, fields: "pixelSize",
    } });
  });
  [
    [10, 11, ITEMS_START_ROW - 1, ITEMS_END_ROW],
    [11, 12, ITEMS_START_ROW - 1, 79],
    [13, 14, ITEMS_START_ROW - 1, ITEMS_END_ROW],
  ].forEach(([startColumnIndex, endColumnIndex, startRowIndex, endRowIndex]) => {
    requests.push({ repeatCell: {
      range: { sheetId: sheet.sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex },
      cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: QUOTATION_CURRENCY_FORMAT } } },
      fields: "userEnteredFormat.numberFormat",
    } });
  });
  items.forEach((item, index) => {
    const rowIndex = ITEMS_START_ROW - 1 + index;
    const descriptionLayout = templateDescriptionLayout(item);
    const descriptionCell = templateRichCell(item.descHtml, item.descOverride || item.description || item.desc, item);
    requests.push({ updateCells: {
      range: { sheetId: sheet.sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 7, endColumnIndex: 8 },
      rows: [{ values: [{
        ...descriptionCell,
        userEnteredFormat: {
          wrapStrategy: "WRAP", verticalAlignment: "TOP",
          textFormat: { fontSize: descriptionLayout.fontSize },
        },
      }] }],
      fields: "userEnteredValue,textFormatRuns,userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment,userEnteredFormat.textFormat.fontSize",
    } });
    requests.push({ updateDimensionProperties: {
      range: { sheetId: sheet.sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 },
      properties: { pixelSize: descriptionLayout.height }, fields: "pixelSize",
    } });
  });
  if (ITEMS_START_ROW + items.length <= ITEMS_END_ROW) requests.push({ updateDimensionProperties: {
    range: { sheetId: sheet.sheetId, dimension: "ROWS", startIndex: ITEMS_START_ROW - 1 + items.length, endIndex: ITEMS_END_ROW },
    properties: { hiddenByUser: true }, fields: "hiddenByUser",
  } });
  const terms = (meta.termsAndConditions || []).map((term) => clean(plainText(term)) ? term : "").filter(Boolean).slice(0, 20);
  requests.push({ updateDimensionProperties: {
    range: { sheetId: sheet.sheetId, dimension: "ROWS", startIndex: 79, endIndex: 99 },
    properties: { hiddenByUser: false }, fields: "hiddenByUser",
  } });
  terms.forEach((term, index) => {
    const rowIndex = 79 + index;
    requests.push({ updateCells: {
      range: { sheetId: sheet.sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 4, endColumnIndex: 6 },
      rows: [{ values: [{ userEnteredValue: { numberValue: index + 1 } }, templateRichCell(term, plainText(term))] }],
      fields: "userEnteredValue,textFormatRuns",
    } });
  });
  if (terms.length < 20) requests.push({ updateDimensionProperties: {
    range: { sheetId: sheet.sheetId, dimension: "ROWS", startIndex: 79 + terms.length, endIndex: 99 },
    properties: { hiddenByUser: true }, fields: "hiddenByUser",
  } });
  await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requests }),
  }, auth);
  return sheet.sheetId;
}
async function exportNewTemplatePdf(spreadsheetId, sheetId, auth, layout) {
  const params = new URLSearchParams({
    format: "pdf", gid: String(sheetId), range: "E2:L110", size: "A4",
    portrait: layout === "landscape" ? "false" : "true", fitw: "true",
    sheetnames: "false", printtitle: "false", pagenumbers: "true", gridlines: "false", fzr: "false",
    top_margin: "0.2", bottom_margin: "0.2", left_margin: "0.2", right_margin: "0.2",
  });
  const token = await getAccessToken(auth);
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`New Template PDF export failed (${response.status}): ${await response.text()}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function exportQuotationToDrive(payload = {}) {
  const meta = payload.meta || {};
  const baseName = safeFileName(meta.quotationTitle || meta.quotationNo || meta.clientName);
  const { copy, auth } = await copyNewTemplate(baseName);
  const sheetId = await populateNewTemplate(copy.id, auth, payload);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const pdf = await exportNewTemplatePdf(copy.id, sheetId, auth, meta.layout || "portrait");
  const fileName = `${baseName}.pdf`;
  const uploaded = await uploadDriveFileDetails({ name: fileName, label: fileName, type: "application/pdf", base64: pdf.toString("base64") }, DRIVE_FOLDERS.quotationExports, "QUOTATION");
  return {
    ok: true, pdfFileId: uploaded.id, pdfFileName: fileName, pdfUrl: uploaded.webViewLink,
    workingCopyUrl: copy.webViewLink || `https://docs.google.com/spreadsheets/d/${copy.id}/edit`,
  };
}

export { populateNewTemplate, templateCommercials, templateDescriptionLayout, templateImageFormula, templateItemRowHeight, templateItems, templateRichCell };
