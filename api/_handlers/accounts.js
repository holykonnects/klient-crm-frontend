import { getOwnershipTable } from "../_lib/ownership.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") return res.status(200).json(await getOwnershipTable("accounts"));
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}
