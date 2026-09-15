import { openCostingStore, TABLE, active, clean, number } from "./costingStore.js";

export const EXTRA_GET_ACTIONS = new Set(["getAdvancesForCostSheet", "getExpenseRequests", "getExpenseApprovalQueue", "getExpenseAccountsQueue", "getCostSheetsForMapping", "getLinkedEntitiesForMapping"]);
export async function readCosting(action, query, getCostSheets, openStore = openCostingStore) {
  if (action === "getCostSheetsForMapping" || action === "getLinkedEntitiesForMapping") {
    const rows = await getCostSheets();
    if (action === "getCostSheetsForMapping") return rows.map((r) => ({
      costSheetId: clean(r["Cost Sheet ID"]), linkedEntityType: clean(r["Linked Entity Type"]), linkedEntityId: clean(r["Linked Entity ID"]), linkedEntityName: clean(r["Linked Entity Name"]),
      clientName: clean(r["Client Name"]), projectType: clean(r["Project Type"]), owner: clean(r.Owner), status: clean(r.Status),
      display: [r["Cost Sheet ID"], r["Linked Entity Name"], r["Client Name"], r["Project Type"]].map((v) => clean(v) || "-").join(" | "),
    }));
    const seen = new Set();
    return rows.flatMap((r) => {
      const parts = [r["Linked Entity Type"], r["Linked Entity ID"], r["Linked Entity Name"]].map(clean);
      const key = JSON.stringify(parts);
      if (!parts.some(Boolean) || seen.has(key)) return [];
      seen.add(key);
      return [{ linkedEntityType: parts[0], linkedEntityId: parts[1], linkedEntityName: parts[2], display: parts.map((v) => v || "-").join(" | ") }];
    });
  }
  if (action === "getAdvancesForCostSheet") {
    if (!clean(query.costSheetId)) return [];
    const store = await openStore([TABLE.advances, TABLE.lines]);
    // No advance sheet exists until the first advance is recorded.
    let advances;
    try { advances = store.table(TABLE.advances).rows; } catch (error) { if (error.message.startsWith("Sheet not found:")) return []; throw error; }
    const used = new Map();
    store.table(TABLE.lines).rows.filter(active).forEach((r) => {
      const id = clean(r["Advance ID"]);
      used.set(id, (used.get(id) || 0) + number(r["Advance Applied Amount"]));
    });
    return advances.filter((r) => active(r) && clean(r["Cost Sheet ID"]) === clean(query.costSheetId)).map((r) => ({
      ...r, "Advance Amount": number(r["Advance Amount"]), "Amount Used": used.get(clean(r["Advance ID"])) || 0,
      "Balance Available": Math.max(0, number(r["Advance Amount"]) - (used.get(clean(r["Advance ID"])) || 0)),
      label: [r["Advance ID"], r["Advance Paid To"], `₹ ${number(r["Advance Amount"]).toLocaleString("en-IN")}`, r["Reference No"]].filter(Boolean).join(" | "),
    }));
  }
  const store = await openStore([TABLE.requests]);
  let rows;
  try { rows = store.table(TABLE.requests).rows.filter(active); } catch (error) { if (error.message.startsWith("Sheet not found:")) return []; throw error; }
  if (action === "getExpenseApprovalQueue") return rows.filter((r) => ["Pending", "On Hold"].includes(r["Approval Status"]));
  if (action === "getExpenseAccountsQueue") return rows.filter((r) => r["Approval Status"] === "Approved");
  const role = clean(query.role).toLowerCase(), email = clean(query.raisedByEmail).toLowerCase(), name = clean(query.raisedBy).toLowerCase();
  return rows.filter((r) => ["admin", "operations manager", "accounts"].includes(role) || (email && clean(r["Raised By Email"]).toLowerCase() === email) || (name && clean(r["Raised By"]).toLowerCase() === name));
}
