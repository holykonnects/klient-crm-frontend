export function moveQuotationRow(rows = [], index, direction) {
  const nextIndex = index + direction;
  if (index < 0 || index >= rows.length || nextIndex < 0 || nextIndex >= rows.length) return rows;
  const next = [...rows];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

export function moveQuotationRowTo(rows = [], fromIndex, toIndex) {
  if (fromIndex < 0 || fromIndex >= rows.length || toIndex < 0 || toIndex >= rows.length || fromIndex === toIndex) return rows;
  const next = [...rows];
  const [row] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, row);
  return next;
}
