import accounts from "./_handlers/accounts.js";
import costing from "./_handlers/costing.js";
import deals from "./_handlers/deals.js";
import email from "./_handlers/email.js";
import gas from "./_handlers/gas.js";
import leads from "./_handlers/leads.js";
import login from "./_handlers/login.js";
import nomenclature from "./_handlers/nomenclature.js";
import orderInvoices from "./_handlers/order-invoices.js";
import orders from "./_handlers/orders.js";
import projects from "./_handlers/projects.js";
import quotations from "./_handlers/quotations.js";
import salesTracker from "./_handlers/sales-tracker.js";

export const config = {
  maxDuration: 60,
};

const handlers = {
  accounts,
  costing,
  deals,
  email,
  gas,
  leads,
  login,
  nomenclature,
  "order-invoices": orderInvoices,
  orders,
  projects,
  quotations,
  "sales-tracker": salesTracker,
};

export default async function handler(req, res) {
  const routeValue = Array.isArray(req.query.route) ? req.query.route[0] : req.query.route;
  const route = String(routeValue || "").replace(/^\/+|\/+$/g, "");
  const routeHandler = handlers[route];

  if (!routeHandler) {
    return res.status(404).json({ ok: false, error: `Unknown API route: ${route || "(empty)"}` });
  }

  return routeHandler(req, res);
}
