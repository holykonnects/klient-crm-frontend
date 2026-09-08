import { SHEETS } from "./_lib/crmConfig.js";
import { getTable, getValidationOptions, handleLeadPost } from "./_lib/crmHandlers.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (req.query.action === "validation") {
        return res.status(200).json(await getValidationOptions(SHEETS.validation, SHEETS.validation.leadSheetNames));
      }
      return res.status(200).json(await getTable(SHEETS.leads));
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const result = await handleLeadPost({
        leadsConfig: SHEETS.leads,
        accountsConfig: SHEETS.accounts,
        payload: body,
      });
      return res.status(200).json({ ...result, status: "added" });
    }

    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}
