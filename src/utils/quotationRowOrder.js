export function moveQuotationRow(rows = [], index, direction) {
  const nextIndex = index + direction;
  if (index < 0 || index >= rows.length || nextIndex < 0 || nextIndex >= rows.length) return rows;
  const next = [...rows];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}
