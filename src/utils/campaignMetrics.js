const statusKey = value => String(value || '').trim().toUpperCase();
const recipientKey = row => String(row.to || row.recipient || '').trim().toLowerCase();

export function campaignPerformance(events = []) {
  const campaigns = new Map();
  for (const event of events) {
    const campaign = String(event.campaign || event.subject || 'Uncategorised campaign').trim();
    const recipient = recipientKey(event);
    if (!recipient) continue;
    if (!campaigns.has(campaign)) campaigns.set(campaign, { campaign, accepted: new Set(), opened: new Set(), clicked: new Set(), latest: 0 });
    const item = campaigns.get(campaign);
    const status = statusKey(event.status);
    if (['ACCEPTED_BY_GMAIL', 'SENT'].includes(status)) item.accepted.add(recipient);
    if (['OPEN', 'OPENED'].includes(status)) item.opened.add(recipient);
    if (['CLICK', 'CLICKED'].includes(status)) item.clicked.add(recipient);
    item.latest = Math.max(item.latest, Date.parse(event.timestamp) || 0);
  }
  return [...campaigns.values()].map(item => {
    const engaged = new Set([...item.opened, ...item.clicked]);
    const denominator = item.accepted.size;
    const rate = count => denominator ? Math.round((count / denominator) * 1000) / 10 : 0;
    return { campaign: item.campaign, accepted: denominator, opened: item.opened.size, clicked: item.clicked.size,
      openRate: rate(item.opened.size), clickRate: rate(item.clicked.size), successRate: rate(engaged.size), latest: item.latest };
  }).filter(item => item.accepted || item.opened || item.clicked).sort((a, b) => b.latest - a.latest);
}
