const clean = (value) => String(value ?? "").trim();
const normalized = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");

export function buildTermsCatalog(values = []) {
  const rows = Array.isArray(values) ? values : [];
  let headerIndex = rows.findIndex((row) => {
    const keys = (row || []).map(normalized);
    return keys.includes("equipment") && keys.includes("flooring");
  });
  if (headerIndex < 0) headerIndex = rows.findIndex((row) => (row || []).some((value) => clean(value)));
  const headers = headerIndex >= 0 ? (rows[headerIndex] || []).map(clean) : [];
  const tcOptions = headers.filter(Boolean);
  const tcTerms = {};
  headers.forEach((header, columnIndex) => {
    if (!header) return;
    const seen = new Set();
    tcTerms[header] = rows.slice(headerIndex + 1).map((row) => clean((row || [])[columnIndex])).filter((term) => {
      const key = normalized(term);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
  return { tcOptions, tcTerms };
}
