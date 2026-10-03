const clean = value => String(value ?? '').trim();

const plainText = value => clean(value)
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

function itemName(item = {}) {
  return clean(item.displayItem || item.libraryItem || item.item || item.itemCode || item.name)
    || plainText(item.descOverride || item.desc || item.description).slice(0, 120)
    || 'Quotation item';
}

export function quotationTaskCandidates(quote = {}, payload = {}) {
  const quoteId = clean(quote.quoteId || payload.quoteId);
  const revision = Number(quote.revision || payload.revision) || 1;
  const direct = (payload.items || []).map((item, index) => ({
    quotationLineId: `${quoteId}:item:${index}`,
    taskName: itemName(item),
    item: itemName(item),
    description: plainText(item.descHtml || item.descOverride || item.desc || item.description),
    quantity: item.qty ?? '',
    unit: clean(item.unit),
    quoteId,
    quoteRevision: revision,
  }));
  const sets = (payload.setQuotation?.sets || []).flatMap((set, setIndex) => (set.items || []).map((item, itemIndex) => ({
    quotationLineId: `${quoteId}:set:${setIndex}:item:${itemIndex}`,
    taskName: `${clean(set.name || set.title || `Set ${setIndex + 1}`)} - ${itemName(item)}`,
    item: itemName(item),
    description: plainText(item.descHtml || item.description || item.desc),
    quantity: item.qty ?? '',
    unit: clean(item.unit),
    quoteId,
    quoteRevision: revision,
  })));
  return [...direct, ...sets];
}

export function projectTaskSummary(tasks = []) {
  const active = tasks.filter(task => !['Completed', 'Cancelled'].includes(clean(task.Status)));
  const completed = tasks.filter(task => clean(task.Status) === 'Completed');
  const overdue = active.filter(task => task['Due Date'] && new Date(`${task['Due Date']}T23:59:59`) < new Date());
  const progress = tasks.length
    ? Math.round(tasks.reduce((sum, task) => sum + Math.max(0, Math.min(100, Number(task['Progress %']) || 0)), 0) / tasks.length)
    : 0;
  return { total: tasks.length, active: active.length, completed: completed.length, overdue: overdue.length, progress };
}
