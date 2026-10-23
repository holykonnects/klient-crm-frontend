export function athleticTableColumns({ freight = false, installation = false } = {}) {
  return [
    ['serial', 40], ['scope', 88], ['system', 108], ['item', 220], ['image', 72],
    ['description', 360], ['unit', 86], ['quantity', 120], ['rate', 110],
    ['amount', 126], ['type', 120], ['actions', 104],
    ...(freight ? [['freight', 130]] : []), ...(installation ? [['installation', 130]] : []),
  ].map(([key, width]) => ({ key, width }));
}
