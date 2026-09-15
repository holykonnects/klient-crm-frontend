import { openCostingStore, TABLE, active, clean, number, dateMs } from "./costingStore.js";

const numericFields = new Set(["QTY", "Amount", "GST Amount", "Total Amount", "Advance Applied Amount"]);
function dateText(field, value) {
  if (!/(date|timestamp|\bat$|\bon$)/i.test(field) || !dateMs(value)) return value ?? "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata" }).format(new Date(dateMs(value)));
}
export function prepareExport(headers, source, query) {
  let selected = headers;
  if (query.fields) {
    let fields;
    try { fields = JSON.parse(query.fields); } catch { fields = String(query.fields).split(","); }
    if (!Array.isArray(fields)) throw new Error("Export fields must be an array");
    selected = fields.filter((f) => headers.includes(f));
    if (!selected.length) throw new Error("Select at least one valid export column");
  }
  const from = query.from ? dateMs(`${query.from}T00:00:00+05:30`) : 0;
  const to = query.to ? dateMs(`${query.to}T23:59:59.999+05:30`) : 0;
  if ((query.from && !from) || (query.to && !to) || (from && to && from > to)) throw new Error("Invalid export date range");
  let rows = source.filter((r) => {
    if (!active(r)) return false;
    for (const [param, key] of [["costSheetId", "Cost Sheet ID"], ["entityType", "Linked Entity Type"], ["linkedEntityId", "Linked Entity ID"]]) if (query[param] && clean(r[key]) !== clean(query[param])) return false;
    if (query.paymentStatus && clean(r["Payment Status"]).toLowerCase() !== clean(query.paymentStatus).toLowerCase()) return false;
    if (query.particular && !clean(r.Particular).toLowerCase().includes(clean(query.particular).toLowerCase())) return false;
    const time = dateMs(r["Expense Date"]) || dateMs(r["Entry Timestamp"]);
    return (!from || time >= from) && (!to || (time && time <= to));
  }).map((r) => Object.fromEntries(headers.map((h) => [h, numericFields.has(h) ? number(r[h]) : dateText(h, r[h])])));
  const subtotal = query.action === "exportFinance" && query.subtotalBy && query.subtotalBy !== "none" ? query.subtotalBy : "";
  if (subtotal && !selected.includes(subtotal)) throw new Error("Subtotal column must be included in the export");
  const merge = query.format !== "csv" && selected.includes(query.mergeBy) ? query.mergeBy : "";
  const groupBy = subtotal || merge;
  if (groupBy) rows.sort((a, b) => clean(a[groupBy]).localeCompare(clean(b[groupBy])));
  const output = [];
  const pushTotal = (items, label, field) => {
    const total = Object.fromEntries(selected.map((h) => [h, numericFields.has(h) ? items.reduce((sum, row) => sum + number(row[h]), 0) : ""]));
    // A numeric-only selection must not overwrite a monetary total with a label.
    const labelField = !numericFields.has(field) ? field : selected.find((h) => !numericFields.has(h));
    if (labelField) total[labelField] = label;
    output.push({ values: selected.map((h) => total[h]), total: true });
  };
  if (subtotal) {
    let group = [];
    for (const row of rows) {
      if (group.length && clean(group[0][subtotal]) !== clean(row[subtotal])) {
        pushTotal(group, `${group[0][subtotal] || "(Blank)"} subtotal`, subtotal);
        group = [];
      }
      output.push({ values: selected.map((h) => row[h]) });
      group.push(row);
    }
    if (group.length) pushTotal(group, `${group[0][subtotal] || "(Blank)"} subtotal`, subtotal);
  } else rows.forEach((row) => output.push({ values: selected.map((h) => row[h]) }));
  if (query.action === "exportFinance") pushTotal(rows, "Grand total", selected[0]);
  return { headers: selected, rows: output, merge };
}
const csvCell = (value) => {
  let text = String(value ?? "");
  if (typeof value === "string" && /^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
};
export async function renderExport(table, format) {
  if (format === "csv") return Buffer.from("\uFEFF" + [table.headers, ...table.rows.map((r) => r.values)].map((r) => r.map(csvCell).join(",")).join("\r\n"));
  if (format === "xlsx") {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Costing", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.addRow(table.headers);
    table.rows.forEach((r) => { const row = sheet.addRow(r.values); if (r.total) row.font = { bold: true }; });
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2A44" } };
    sheet.columns.forEach((col, index) => {
      col.width = Math.min(45, Math.max(16, table.headers[index].length + 3));
      col.alignment = { vertical: "top", wrapText: true };
      if (numericFields.has(table.headers[index])) col.numFmt = '#,##0.00';
    });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: table.rows.length + 1, column: table.headers.length } };
    const col = table.headers.indexOf(table.merge);
    if (col >= 0) {
      let start = 0;
      while (start < table.rows.length) {
        let end = start;
        while (!table.rows[start].total && end + 1 < table.rows.length && !table.rows[end + 1].total && table.rows[end + 1].values[col] === table.rows[start].values[col]) end++;
        if (end > start) sheet.mergeCells(start + 2, col + 1, end + 2, col + 1);
        start = end + 1;
      }
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
  if (format === "pdf") {
    const { default: PDFDocument } = await import("pdfkit");
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28, autoFirstPage: false });
    const chunks = [];
    const completed = new Promise((resolve, reject) => { doc.on("data", (chunk) => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
    // Wide selections are split into labelled column panels rather than shrunk
    // until unreadable. Row numbers allow matching rows between panels.
    const panelSize = 6;
    for (let offset = 0; offset < table.headers.length; offset += panelSize) {
      const headers = table.headers.slice(offset, offset + panelSize);
      const width = 745 / headers.length;
      let y;
      let pageFirstRow = true;
      const mergeIndex = headers.indexOf(table.merge);
      const page = () => {
        doc.addPage();
        doc.font("Helvetica-Bold").fontSize(12).text(`Costing export — columns ${offset + 1}–${offset + headers.length}`, 28, 24);
        doc.fontSize(8).text("Row", 28, 55, { width: 30 });
        headers.forEach((h, i) => doc.text(h, 65 + i * width, 55, { width: width - 8 }));
        y = 92;
        pageFirstRow = true;
      };
      page();
      table.rows.forEach((row, rowIndex) => {
        const values = row.values.slice(offset, offset + panelSize).map((v) => String(v ?? "").replace(/₹/g, "INR "));
        doc.font(row.total ? "Helvetica-Bold" : "Helvetica").fontSize(8);
        const height = Math.max(22, ...values.map((v) => doc.heightOfString(v, { width: width - 8 }) + 10));
        // Split very long cells across continuation rows, keeping all text.
        const lines = values.map((v) => {
          const words = v.split(/\s+/), parts = []; let current = "";
          for (const word of words) {
            if (current && doc.widthOfString(current + " " + word) > width - 8) { parts.push(current); current = ""; }
            for (const char of (current ? " " : "") + word) {
              if (current && doc.widthOfString(current + char) > width - 8) { parts.push(current); current = ""; }
              current += char;
            }
          }
          if (current) parts.push(current);
          return parts;
        });
        const maxLines = Math.max(1, ...lines.map((v) => v.length));
        for (let part = 0; part < maxLines; part += 25) {
          const rowHeight = Math.min(height, Math.min(25, maxLines - part) * 11 + 10);
          if (y + rowHeight > 560) page();
          doc.font(row.total ? "Helvetica-Bold" : "Helvetica").fontSize(8);
          doc.text(String(rowIndex + 1), 28, y, { width: 30 });
          const previous = table.rows[rowIndex - 1];
          const next = table.rows[rowIndex + 1];
          const globalMergeIndex = table.headers.indexOf(table.merge);
          const continuesGroup = !row.total && previous && !previous.total && previous.values[globalMergeIndex] === row.values[globalMergeIndex];
          lines.forEach((v, i) => {
            if (i === mergeIndex && continuesGroup && !pageFirstRow && part === 0) return;
            doc.text(v.slice(part, part + 25).join("\n"), 65 + i * width, y, { width: width - 8, lineGap: 1 });
          });
          pageFirstRow = false;
          y += rowHeight;
          const mergesNext = mergeIndex >= 0 && !row.total && next && !next.total && next.values[globalMergeIndex] === row.values[globalMergeIndex];
          doc.strokeColor("#dddddd");
          if (mergesNext) {
            doc.moveTo(28, y - 5).lineTo(65 + mergeIndex * width - 4, y - 5).stroke();
            doc.moveTo(65 + (mergeIndex + 1) * width - 4, y - 5).lineTo(810, y - 5).stroke();
          } else doc.moveTo(28, y - 5).lineTo(810, y - 5).stroke();
        }
      });
    }
    doc.end();
    return completed;
  }
  throw new Error("Unsupported export format");
}
export async function exportCosting(query, res) {
  const format = clean(query.format || "csv").toLowerCase();
  if (!["csv", "xlsx", "pdf"].includes(format)) return res.status(400).json({ success: false, error: "Unsupported export format" });
  const store = await openCostingStore([TABLE.lines]);
  const table = store.table(TABLE.lines);
  const prepared = prepareExport(table.headers, table.rows, query);
  const body = await renderExport(prepared, format);
  res.setHeader("Content-Type", { csv: "text/csv; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pdf: "application/pdf" }[format]);
  res.setHeader("Content-Disposition", `attachment; filename="${query.action === "exportFinance" ? "Finance" : "Costing"}_${new Date().toISOString().slice(0, 10)}.${format}"`);
  return res.status(200).send(body);
}
