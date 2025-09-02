// klient-crm-frontend/api/gas.js
export default async function handler(req, res) {
  // Optional: CORS headers (not required for same-origin, but harmless)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const GAS_EXEC_URL =
    process.env.NEXT_PUBLIC_GAS_EXEC_URL ||
    'https://script.google.com/macros/s/AKfycbwcV0I1JGLqmDTT_vPgrVOdDbpy4XUbUEi7CD5cujdLydfS9uybkMJ_DCCJRMNDWKbo3g/exec';

  // Preserve query string (?action=...&user=...)
  const qsIndex = req.url.indexOf('?');
  const qs = qsIndex >= 0 ? req.url.slice(qsIndex) : '';
  const target = `${GAS_EXEC_URL}${qs}`;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method === 'POST' ? JSON.stringify(req.body ?? {}) : undefined
    });

    const text = await upstream.text();
    // Try to pass through the content-type; default to JSON
    const ct = upstream.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', ct);

    // If it's JSON, return JSON; if not, return raw text
    if (ct.includes('application/json')) {
      try { return res.status(upstream.status).json(JSON.parse(text)); }
      catch { return res.status(upstream.status).send(text); }
    } else {
      return res.status(upstream.status).send(text);
    }
  } catch (err) {
    console.error('GAS proxy error:', err);
    return res.status(502).json({ ok: false, error: 'Proxy failed', detail: String(err) });
  }
}
