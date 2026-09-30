const clean = (value) => String(value ?? "").trim();

export function parseQuotationAdminTable(values = []) {
  const rows = Array.isArray(values) ? values : [];
  const headerIndex = rows.findIndex((row) => (row || []).some((value) => clean(value)));
  if (headerIndex < 0) return { headerRow: 0, headers: [], rows: [] };

  const headers = (rows[headerIndex] || []).map(clean);
  const dataRows = rows.slice(headerIndex + 1).map((row, index) => {
    const record = { __rowNumber: headerIndex + index + 2 };
    headers.forEach((header, columnIndex) => {
      if (header) record[header] = (row || [])[columnIndex] ?? "";
    });
    return record;
  });

  return { headerRow: headerIndex + 1, headers, rows: dataRows };
}
