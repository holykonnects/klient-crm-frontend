import { SHEETS } from "./_lib/crmConfig.js";
import { getTable } from "./_lib/crmHandlers.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") return res.status(200).json(await getTable(SHEETS.accounts));
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}
