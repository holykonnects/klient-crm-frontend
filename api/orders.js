import { SHEETS } from "./_lib/crmConfig.js";
import { getTable, getValidationOptions, handleOrderPost } from "./_lib/crmHandlers.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (req.query.action === "validation") {
        return res.status(200).json(await getValidationOptions(SHEETS.validation, SHEETS.validation.dealSheetNames));
      }
      return res.status(200).json(await getTable(SHEETS.orders));
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const result = await handleOrderPost({ ordersConfig: SHEETS.orders, payload: body });
      return res.status(200).json(result);
    }

    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}
