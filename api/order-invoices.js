import { SHEETS } from "./_lib/crmConfig.js";
import { getTable } from "./_lib/crmHandlers.js";

function toNum(value) {
  const n = Number(String(value ?? "").replace(/[₹,\s,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function rowTime(row) {
  const raw = row?.Timestamp || row?.["Invoice Date"] || row?.["Billing Date"] || "";
  const dmy = String(raw).trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmy) {
    const dt = new Date(
      Number(dmy[3]),
      Number(dmy[2]) - 1,
      Number(dmy[1]),
      Number(dmy[4] || 0),
      Number(dmy[5] || 0),
      Number(dmy[6] || 0)
    );
    const time = dt.getTime();
    if (Number.isFinite(time)) return time;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

    const orderId = String(req.query.orderId || "").trim();
    if (!orderId) return res.status(400).json({ ok: false, error: "Missing orderId" });

    const [orders, salesRows] = await Promise.all([getTable(SHEETS.orders), getTable(SHEETS.salesTracker)]);
    const orderRows = orders
      .filter((row) => String(row["Order ID"] || "").trim() === orderId)
      .sort((a, b) => rowTime(b) - rowTime(a));
    const invoices = salesRows
      .filter((row) => String(row["Order ID"] || "").trim() === orderId)
      .sort((a, b) => rowTime(b) - rowTime(a));

    const invoiceValue = invoices.reduce(
      (sum, row) => sum + toNum(row["Invoice Value"] || row["Basic Value"] || row["Total Amount"]),
      0
    );
    const orderAmount = toNum(orderRows[0]?.["Order Amount"]);

    return res.status(200).json({
      ok: true,
      orderId,
      order: orderRows[0] || null,
      orderLogs: orderRows,
      invoices,
      invoiceValue,
      orderAmount,
      pendingInvoiceValue: Math.max(orderAmount - invoiceValue, 0),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}
