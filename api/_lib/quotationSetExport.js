import { driveDownloadFile, getDriveAuthSubjects } from "./googleSheets.js";

function number(value) {
  const parsed = Number(String(value ?? "").replace(/[,₹%\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function driveId(value) {
  const match = String(value || "").match(/[-\w]{25,}/);
  return match ? match[0] : "";
}

async function loadImage(value) {
  const url = String(value || "").trim();
  if (!url) return null;
  try {
    const id = driveId(url);
    if (id) {
      for (const subject of getDriveAuthSubjects()) {
        try { return await driveDownloadFile(id, { scopes: ["https://www.googleapis.com/auth/drive"], subject }); } catch {}
      }
      return null;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    return { contentType: response.headers.get("content-type") || "image/png", body: Buffer.from(await response.arrayBuffer()) };
  } catch { return null; }
}

function imageDimensions(buffer = Buffer.alloc(0)) {
  if (buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      if (startOfFrame.has(marker)) return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      offset += length + 2;
    }
  }
  return { width: 4, height: 3 };
}

function fittedImageSize(buffer, maxWidth = 112, maxHeight = 78) {
  const dimensions = imageDimensions(buffer);
  const scale = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height);
  return { width: Math.max(1, dimensions.width * scale), height: Math.max(1, dimensions.height * scale) };
}

function fileName(value) {
  return String(value || "Project BOQ Quotation")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function plainText(value) {
  return String(value ?? "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "• ")
    .replace(/<\/(?:p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function buildQuotationSetWorkbook(payload = {}) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rido CRM";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Quotation", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    views: [{ state: "frozen", ySplit: 5 }],
  });
  sheet.columns = [
    { key: "serial", width: 8 }, { key: "item", width: 28 }, { key: "image", width: 18 }, { key: "description", width: 62 },
    { key: "unit", width: 12 }, { key: "qty", width: 15 }, { key: "rate", width: 16 }, { key: "amount", width: 18 },
  ];

  const meta = payload.meta || {};
  const setQuotation = payload.setQuotation || {};
  const sets = (setQuotation.sets || []).filter((set) => (set.items || []).length);
  const imageUrls = [...new Set(sets.flatMap((set) => (set.items || []).map((item) => String(item.imageUrl || "").trim())).filter(Boolean))];
  const images = new Map(await Promise.all(imageUrls.map(async (url) => [url, await loadImage(url)])));
  const title = meta.quotationTitle || "Project BOQ Quotation";
  const blue = "163F76";
  const lightBlue = "DCE9F8";
  const border = { style: "thin", color: { argb: "CBD5E1" } };

  sheet.mergeCells("A1:H1");
  sheet.getCell("A1").value = "RIDO SPORTS";
  sheet.getCell("A1").font = { name: "Montserrat", size: 16, bold: true, color: { argb: "FFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: blue } };
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.mergeCells("A2:H2");
  sheet.getCell("A2").value = title;
  sheet.getCell("A2").font = { name: "Montserrat", size: 13, bold: true, color: { argb: "0F172A" } };
  sheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightBlue } };
  sheet.getCell("A2").alignment = { horizontal: "center" };
  sheet.addRow([]);
  sheet.addRow(["Client", meta.clientName || "", "Project", meta.projectName || "", "Quotation No.", meta.quotationNo || ""]);
  sheet.addRow(["Date", meta.dateISO || "", "Quotation Generated By", meta.leadSourceEmail || meta.preparedBy || "", "Client GST", meta.clientGstNumber || ""]);
  sheet.addRow(["Billing Address", meta.clientBillingAddress || "", "", "", "Notes", meta.notes || ""]);

  let serial = 1;
  let subtotal = 0;
  sets.forEach((set, setIndex) => {
    const heading = sheet.addRow([`${setIndex + 1}. ${set.title || "Untitled set"}`]);
    sheet.mergeCells(heading.number, 1, heading.number, 8);
    heading.font = { name: "Montserrat", bold: true, color: { argb: blue } };
    heading.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightBlue } };

    const header = sheet.addRow(["S.No.", "Item", "Image", "Description", "Unit", "Quantity", "Unit Price", "Amount"]);
    header.eachCell((cell) => {
      cell.font = { name: "Montserrat", bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "6395DF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    let setSubtotal = 0;
    (set.items || []).forEach((item) => {
      const qty = number(item.qty);
      const rate = number(item.rate);
      const amount = qty * rate;
      setSubtotal += amount;
      subtotal += amount;
      const commercial = [item.freight ? `Freight: ${item.freight}` : "", item.installation ? `Installation: ${item.installation}` : ""].filter(Boolean).join("\n");
      const description = [item.description || "", commercial].filter(Boolean).join("\n");
      const row = sheet.addRow([serial++, item.item || "", "", description, item.unit || "", qty, rate, amount]);
      const image = images.get(String(item.imageUrl || "").trim());
      const estimatedDescriptionLines = description.split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 62)), 0);
      row.height = Math.max(image ? 64 : 44, 18 + (estimatedDescriptionLines * 14));
      row.eachCell((cell, column) => {
        cell.font = { name: "Montserrat", size: 9 };
        cell.alignment = { vertical: "top", wrapText: column === 2 || column === 4, horizontal: column >= 6 ? "right" : "left" };
        cell.border = { top: border, left: border, bottom: border, right: border };
      });
      row.getCell(6).numFmt = "#,##0.00";
      row.getCell(7).numFmt = "₹#,##0.00";
      row.getCell(8).numFmt = "₹#,##0.00";
      if (image?.body?.length) {
        const extension = /jpe?g/i.test(image.contentType) ? "jpeg" : /gif/i.test(image.contentType) ? "gif" : "png";
        const imageId = workbook.addImage({ buffer: image.body, extension });
        const size = fittedImageSize(image.body);
        sheet.addImage(imageId, {
          tl: { col: 2 + ((112 - size.width) / 28), row: row.number - 1 + 0.08 },
          ext: size,
          editAs: "oneCell",
        });
      }
    });
    const setTotalRow = sheet.addRow(["Set Subtotal", "", "", "", "", "", "", setSubtotal]);
    sheet.mergeCells(setTotalRow.number, 1, setTotalRow.number, 7);
    setTotalRow.font = { name: "Montserrat", bold: true };
    setTotalRow.alignment = { horizontal: "right" };
    setTotalRow.getCell(8).numFmt = "₹#,##0.00";
    sheet.addRow([]);
  });

  const gstPct = number(setQuotation.gstPct);
  const gst = subtotal * gstPct / 100;
  [["Subtotal", subtotal], [`GST @ ${gstPct}%`, gst], ["Grand Total", Math.round(subtotal + gst)]].forEach(([label, amount], index) => {
    const row = sheet.addRow([label, "", "", "", "", "", "", amount]);
    sheet.mergeCells(row.number, 1, row.number, 7);
    row.font = { name: "Montserrat", bold: index === 2 };
    row.alignment = { horizontal: "right" };
    row.getCell(8).numFmt = "₹#,##0.00";
    if (index === 2) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightBlue } };
  });

  const terms = Array.isArray(meta.termsAndConditions) ? meta.termsAndConditions.map(plainText).filter(Boolean) : [];
  if (terms.length) {
    sheet.addRow([]);
    const heading = sheet.addRow([`Terms & Conditions: ${meta.tcType || "Selected terms"}`]);
    sheet.mergeCells(heading.number, 1, heading.number, 8);
    heading.font = { name: "Montserrat", bold: true, color: { argb: blue } };
    heading.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightBlue } };
    terms.forEach((term, index) => {
      const row = sheet.addRow([index + 1, term]);
      sheet.mergeCells(row.number, 2, row.number, 8);
      row.getCell(1).alignment = { horizontal: "center", vertical: "top" };
      row.getCell(2).alignment = { wrapText: true, vertical: "top" };
      row.height = Math.max(28, Math.min(75, 18 + Math.ceil(String(term).length / 105) * 14));
      row.eachCell((cell) => { cell.border = { top: border, left: border, bottom: border, right: border }; });
    });
  }

  sheet.addRow([]);
  const regards = sheet.addRow(["Warm Regards,", meta.leadSourceName || "Team Rido"]);
  sheet.mergeCells(regards.number, 2, regards.number, 8);
  const generatedBy = sheet.addRow(["Quotation Generated By", meta.leadSourceEmail || meta.preparedBy || ""]);
  sheet.mergeCells(generatedBy.number, 2, generatedBy.number, 8);
  [regards, generatedBy].forEach((row) => {
    row.getCell(1).font = { name: "Montserrat", bold: true };
    row.eachCell((cell) => { cell.alignment = { wrapText: true, vertical: "top" }; });
  });

  sheet.eachRow((row) => row.eachCell((cell) => { cell.font = { name: "Montserrat", ...(cell.font || {}) }; }));
  sheet.pageSetup.printArea = `A1:H${sheet.rowCount}`;
  sheet.headerFooter.oddFooter = "Rido CRM quotation";
  return {
    fileName: `${fileName(title || meta.quotationNo)}.xlsx`,
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  };
}
