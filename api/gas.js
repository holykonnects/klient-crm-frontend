// klient-crm-frontend/api/gas.js
export default async function handler(req, res) {
  // Same-origin; these CORS headers are optional
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const GAS_EXEC_URL =
    process.env.NEXT_PUBLIC_GAS_EXEC_URL ||
    'https://script.google.com/macros/s/AKfycbwcV0I1JGLqmDTT_vPgrVOdDbpy4XUbUEi7CD5cujdLydfS9uybkMJ_DCCJRMNDWKbo3g/exec';

  try {
    // Build target = GAS_EXEC_URL + (clean) query from incoming request
    const incoming = new URL(req.url, `http://${req.headers.host}`);
    const target = new URL(GAS_EXEC_URL);
    // copy search params across
    incoming.searchParams.forEach((v, k) => target.searchParams.set(k, v));

    const init = {
      method: req.method,
      headers: req.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: req.method === 'POST' ? JSON.stringify(req.body ?? {}) : undefined
    };

    const upstream = await fetch(target.toString(), init);
    const text = await upstream.text();
    const ct = upstream.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', ct);

    // Try JSON; fall back to text
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
