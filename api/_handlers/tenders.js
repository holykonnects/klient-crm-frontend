const TENDER_GAS_URL = "https://script.google.com/macros/s/AKfycbyJqBc20hrZLKiPuKanwxDhqqbeqWW7-8x57Kvwjuep0bzRzRbDtD2wnuA1-VjaP1QfHQ/exec";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const upstreamUrl = new URL(TENDER_GAS_URL);
      if (req.query.action) upstreamUrl.searchParams.set("action", String(req.query.action));
      const upstream = await fetch(upstreamUrl, { redirect: "follow" });
      const text = await upstream.text();
      if (!upstream.ok) throw new Error(`Tender service returned ${upstream.status}`);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
      return res.status(200).send(text);
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      const upstream = await fetch(TENDER_GAS_URL, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body,
      });
      const text = await upstream.text();
      if (!upstream.ok || /^error$/i.test(text.trim())) {
        throw new Error(`Tender update failed${upstream.ok ? "" : ` (${upstream.status})`}`);
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error.message || String(error) });
  }
}
