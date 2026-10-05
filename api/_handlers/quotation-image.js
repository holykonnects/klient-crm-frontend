import { downloadQuotationImage } from "../_lib/quotationImages.js";
import { verifySignedToken } from "../_lib/sessionAuth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  try {
    const token = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;
    const payload = verifySignedToken(token);
    if (payload.type !== "quotation-image" || !/^[-\w]{25,}$/.test(String(payload.fileId || ""))) {
      return res.status(403).json({ ok: false, error: "Invalid quotation image link" });
    }
    const image = await downloadQuotationImage(payload.fileId);
    if (!String(image.contentType || "").toLowerCase().startsWith("image/")) {
      return res.status(415).json({ ok: false, error: "Quotation image link does not reference an image" });
    }
    res.setHeader("Content-Type", image.contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    return res.status(200).end(image.body);
  } catch (error) {
    return res.status(403).json({ ok: false, error: error.message || "Quotation image access failed" });
  }
}
