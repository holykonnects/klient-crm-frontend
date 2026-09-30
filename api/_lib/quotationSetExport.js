function number(value) {
  const parsed = Number(String(value ?? "").replace(/[,₹%\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
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
    { key: "serial", width: 8 }, { key: "item", width: 30 }, { key: "description", width: 68 },
    { key: "unit", width: 12 }, { key: "qty", width: 15 }, { key: "rate", width: 16 }, { key: "amount", width: 18 },
  ];

  const meta = payload.meta || {};
  const setQuotation = payload.setQuotation || {};
  const sets = (setQuotation.sets || []).filter((set) => (set.items || []).length);
  const title = meta.quotationTitle || "Project BOQ Quotation";
  const blue = "163F76";
  const lightBlue = "DCE9F8";
  const border = { style: "thin", color: { argb: "CBD5E1" } };

  sheet.mergeCells("A1:G1");
  sheet.getCell("A1").value = "RIDO SPORTS";
  sheet.getCell("A1").font = { name: "Montserrat", size: 16, bold: true, color: { argb: "FFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: blue } };
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.mergeCells("A2:G2");
  sheet.getCell("A2").value = title;
  sheet.getCell("A2").font = { name: "Montserrat", size: 13, bold: true, color: { argb: "0F172A" } };
  sheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightBlue } };
  sheet.getCell("A2").alignment = { horizontal: "center" };
  sheet.addRow([]);
  sheet.addRow(["Client", meta.clientName || "", "Project", meta.projectName || "", "Quotation No.", meta.quotationNo || ""]);
  sheet.addRow(["Date", meta.dateISO || "", "Prepared By", meta.preparedBy || "", "Client GST", meta.clientGstNumber || ""]);
  sheet.addRow(["Billing Address", meta.clientBillingAddress || "", "", "", "Notes", meta.notes || ""]);

  let serial = 1;
  let subtotal = 0;
  sets.forEach((set, setIndex) => {
    const heading = sheet.addRow([`${setIndex + 1}. ${set.title || "Untitled set"}`]);
    sheet.mergeCells(heading.number, 1, heading.number, 7);
    heading.font = { name: "Montserrat", bold: true, color: { argb: blue } };
    heading.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightBlue } };

    const header = sheet.addRow(["S.No.", "Item", "Description", "Unit", "Quantity", "Unit Price", "Amount"]);
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
      const row = sheet.addRow([serial++, item.item || "", item.description || "", item.unit || "", qty, rate, amount]);
      row.height = 44;
      row.eachCell((cell, column) => {
        cell.font = { name: "Montserrat", size: 9 };
        cell.alignment = { vertical: "top", wrapText: column === 2 || column === 3, horizontal: column >= 5 ? "right" : "left" };
        cell.border = { top: border, left: border, bottom: border, right: border };
      });
      row.getCell(5).numFmt = "#,##0.00";
      row.getCell(6).numFmt = "₹#,##0.00";
      row.getCell(7).numFmt = "₹#,##0.00";
    });
    const setTotalRow = sheet.addRow(["Set Subtotal", "", "", "", "", "", setSubtotal]);
    sheet.mergeCells(setTotalRow.number, 1, setTotalRow.number, 6);
    setTotalRow.font = { name: "Montserrat", bold: true };
    setTotalRow.alignment = { horizontal: "right" };
    setTotalRow.getCell(7).numFmt = "₹#,##0.00";
    sheet.addRow([]);
  });

  const gstPct = number(setQuotation.gstPct);
  const gst = subtotal * gstPct / 100;
  [["Subtotal", subtotal], [`GST @ ${gstPct}%`, gst], ["Grand Total", Math.round(subtotal + gst)]].forEach(([label, amount], index) => {
    const row = sheet.addRow([label, "", "", "", "", "", amount]);
    sheet.mergeCells(row.number, 1, row.number, 6);
    row.font = { name: "Montserrat", bold: index === 2 };
    row.alignment = { horizontal: "right" };
    row.getCell(7).numFmt = "₹#,##0.00";
    if (index === 2) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightBlue } };
  });

  const terms = Array.isArray(meta.termsAndConditions) ? meta.termsAndConditions.map(plainText).filter(Boolean) : [];
  if (terms.length) {
    sheet.addRow([]);
    const heading = sheet.addRow([`Terms & Conditions: ${meta.tcType || "Selected terms"}`]);
    sheet.mergeCells(heading.number, 1, heading.number, 7);
    heading.font = { name: "Montserrat", bold: true, color: { argb: blue } };
    heading.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightBlue } };
    terms.forEach((term, index) => {
      const row = sheet.addRow([index + 1, term]);
      sheet.mergeCells(row.number, 2, row.number, 7);
      row.getCell(1).alignment = { horizontal: "center", vertical: "top" };
      row.getCell(2).alignment = { wrapText: true, vertical: "top" };
      row.height = Math.max(28, Math.min(75, 18 + Math.ceil(String(term).length / 105) * 14));
      row.eachCell((cell) => { cell.border = { top: border, left: border, bottom: border, right: border }; });
    });
  }

  sheet.eachRow((row) => row.eachCell((cell) => { cell.font = { name: "Montserrat", ...(cell.font || {}) }; }));
  sheet.pageSetup.printArea = `A1:G${sheet.rowCount}`;
  sheet.headerFooter.oddFooter = "Rido CRM quotation";
  return {
    fileName: `${fileName(title || meta.quotationNo)}.xlsx`,
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  };
}
