const MAX_BODY_BYTES = 4 * 1024 * 1024;

// CRA otherwise returns index.html for /api requests. Run the same native
// handlers used by Vercel; no legacy Apps Script proxy or production forwarding.
module.exports = function setupNativeApi(app) {
  let nativeApi;
  app.use('/api', async (req, res) => {
    try {
      const route = req.path.replace(/^\/+|\/+$/g, '');
      req.query = { ...req.query, route };
      if (req.body === undefined && !['GET', 'HEAD'].includes(req.method)) {
        const chunks = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > MAX_BODY_BYTES) throw Object.assign(new Error('API request exceeds 4 MB.'), { status: 413 });
          chunks.push(chunk);
        }
        const text = Buffer.concat(chunks).toString('utf8');
        try { req.body = text ? JSON.parse(text) : {}; }
        catch { throw Object.assign(new Error('Invalid JSON request.'), { status: 400 }); }
      }
      nativeApi ||= import('../api/index.js');
      const { default: handler } = await nativeApi;
      await handler(req, res);
    } catch (error) {
      if (!res.headersSent) res.status(error.status || 500).json({ ok: false, error: error.message || 'Local API failed.' });
    }
  });
};
