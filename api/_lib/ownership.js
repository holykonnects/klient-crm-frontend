import { createHash, randomUUID } from "node:crypto";
import { SHEETS } from "./crmConfig.js";
import { getValues, googleFetch, resolveSheetTitle, rowsToObjects } from "./googleSheets.js";
import { dealRowGroups } from "../../src/utils/dealTableRows.js";
import { newestCrmRows } from "../../src/utils/crmTableUtils.js";

export const ownershipTypes = ["leads", "accounts", "deals", "orders"];
export const recordKeyField = "_ownershipRecord";
export const clean = (value) => String(value ?? "").trim();
export const normalize = (value) => clean(value).toLowerCase();
export const ownershipError = (message, status = 409) => Object.assign(new Error(message), { status });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const ownerFields = ["Account Owner", "Lead Owner", "Owner"];
const unique = (items) => [...new Set(items.filter(Boolean))];
const ledgerTitle = "CRM Ownership Transfers";
const ledgerId = () => SHEETS.accounts.spreadsheetId;

export function recordOwner(type, row) {
  const fields = ["leads", "accounts"].includes(type) ? ["Lead Owner", "Account Owner", "Owner"] : ownerFields;
  return fields.map((field) => clean(row[field])).find(Boolean) || "";
}

export function setRecordOwner(type, row, owner) {
  const field = ["leads", "accounts"].includes(type) ? "Lead Owner" : "Account Owner";
  const otherFields = ownerFields.filter((name) => Object.hasOwn(row, name));
  return { ...row, ...Object.fromEntries(otherFields.map((name) => [name, owner])), [field]: owner };
}

const customerIds = (row) => unique([normalize(row["Account ID"]), normalize(row["Lead ID"])]);
const orderId = (row) => normalize(row["Order ID"]);
const dealId = (row) => normalize(row["Deal ID"]);
const label = (type, row) => clean(type === "deals" ? row["Deal Name"] : type === "orders" ? row["Order ID"] : row.Company) ||
  [clean(row["First Name"]), clean(row["Last Name"])].filter(Boolean).join(" ") || customerIds(row)[0];

function contactKey(row) {
  const company = normalize(row.Company);
  const digits = clean(row["Mobile Number"]).replace(/\D/g, "");
  const mobile = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return company && mobile.length === 10 ? JSON.stringify([company, mobile]) : "";
}

function recordKeys(type, row) {
  const prefix = (value) => value ? `${type}:${value}` : "";
  if (type === "leads") return unique([prefix(normalize(row["Lead ID"]))]);
  if (type === "accounts") return unique([prefix(customerIds(row)[0])]);
  if (type === "orders") return unique([prefix(orderId(row))]);
  const name = normalize(row["Deal Name"]);
  const timestamp = normalize(row.Timestamp);
  const legacyKey = name && (timestamp || orderId(row) || row["Order Distribution ID"]) && prefix("legacy:" + hash(JSON.stringify([
    name, timestamp, customerIds(row), orderId(row), normalize(row["Order Distribution ID"]), contactKey(row),
  ])));
  return unique([prefix(dealId(row)), legacyKey]);
}

export function ownershipRecordKey(type, row) {
  return recordKeys(type, row)[0] || "";
}

export function ownershipIndex(events) {
  const byRecord = new Map();
  const byCustomerId = new Map();
  for (const event of events) {
    for (const record of event.records) for (const key of record.keys) byRecord.set(key, event);
    for (const id of event.customerIds) byCustomerId.set(id, event);
  }
  return { byRecord, byCustomerId };
}

export function currentTransfer(index, type, row) {
  const direct = recordKeys(type, row).map((key) => index.byRecord.get(key)).find(Boolean);
  const linkedDeal = type === "orders" && dealId(row) && index.byRecord.get(`deals:${dealId(row)}`);
  const matches = unique(customerIds(row).map((id) => index.byCustomerId.get(id)));
  if (matches.length > 1 && new Set(matches.map((event) => event.customer)).size > 1) return undefined;
  return matches[0] || direct || linkedDeal || undefined;
}

export function projectOwnership(type, rows, events) {
  const index = ownershipIndex(events);
  return rows.map((row) => {
    const transfer = currentTransfer(index, type, row);
    return { ...(transfer ? setRecordOwner(type, row, transfer.to.username) : row), [recordKeyField]: ownershipRecordKey(type, row) };
  });
}

function groupRows(rows, getKey) {
  const groups = new Map();
  for (const row of rows) {
    const key = getKey(row);
    if (key === "" || key == null) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()];
}

export function ownershipChain(data, events, type, recordKey) {
  if (!ownershipTypes.includes(type) || !recordKey) throw ownershipError("Select a saved CRM record.", 400);

  const accountRows = groupRows(data.accounts, (row) => normalize(row["Lead ID"]) || normalize(row["Account ID"]));
  const accountsById = new Map();
  const addAlias = (id, key) => {
    if (!accountsById.has(id)) accountsById.set(id, new Set());
    accountsById.get(id).add(key);
  };
  for (const rows of accountRows) {
    const key = normalize(rows[0]["Lead ID"]) || normalize(rows[0]["Account ID"]);
    for (const row of rows) for (const id of customerIds(row)) addAlias(id, key);
  }
  const resolveId = (id) => [...(accountsById.get(id) || [id])];
  const resolveIds = (rows) => unique(rows.flatMap((row) => customerIds(row).flatMap(resolveId)));

  const contactOwners = new Map();
  for (const row of [...data.accounts, ...data.leads]) {
    const contact = contactKey(row);
    if (!contact) continue;
    if (!contactOwners.has(contact)) contactOwners.set(contact, new Set());
    for (const id of resolveIds([row])) contactOwners.get(contact).add(id);
  }
  const contactIds = (rows) => unique(rows.flatMap((row) => [...(contactOwners.get(contactKey(row)) || [])]));
  const index = ownershipIndex(events);
  const previouslyLinked = (recordType, rows) => rows.flatMap((row) => {
    const event = recordKeys(recordType, row).map((key) => index.byRecord.get(key)).find(Boolean);
    return event ? resolveId(event.customer) : [];
  });

  const dealGroups = dealRowGroups(data.deals);
  const deals = groupRows(data.deals, (row) => dealGroups.get(row));
  const records = [];
  const orderLinks = new Map();
  const dealLinks = new Map();
  const add = (kind, rows, ids) => {
    const keys = unique(rows.flatMap((row) => recordKeys(kind, row)));
    const latest = newestCrmRows(rows)[0];
    const old = currentTransfer(index, kind, latest);
    const reference = clean(latest[kind === "deals" ? "Deal ID" : kind === "orders" ? "Order ID" : "Lead ID"]) ||
      clean(latest["Account ID"] || latest.Timestamp);
    records.push({ type: kind, ids, keys, label: label(kind, latest), reference,
      owner: old?.to.username || recordOwner(kind, latest), contacts: rows.map(contactKey).filter(Boolean) });
  };

  for (const rows of groupRows(data.leads, (row) => ownershipRecordKey("leads", row))) add("leads", rows, resolveIds(rows));
  for (const rows of accountRows) {
    const ids = resolveIds(rows);
    const accountIds = unique(rows.map((row) => normalize(row["Account ID"])));
    add("accounts", rows, ids);
    records.at(-1).conflictingAccountIds = accountIds.length > 1;
  }
  for (const rows of deals) {
    const explicit = unique([...resolveIds(rows), ...previouslyLinked("deals", rows)]);
    const ids = explicit.length ? explicit : contactIds(rows);
    for (const row of rows) {
      if (orderId(row)) orderLinks.set(orderId(row), unique([...(orderLinks.get(orderId(row)) || []), ...ids]));
      if (dealId(row)) dealLinks.set(dealId(row), unique([...(dealLinks.get(dealId(row)) || []), ...ids]));
    }
    add("deals", rows, ids);
  }
  for (const rows of groupRows(data.orders, (row) => orderId(row))) {
    const explicit = unique([
      ...resolveIds(rows), ...previouslyLinked("orders", rows),
      ...rows.flatMap((row) => [...(orderLinks.get(orderId(row)) || []), ...(dealLinks.get(dealId(row)) || [])]),
    ]);
    const ids = explicit.length ? explicit : contactIds(rows);
    add("orders", rows, ids);
  }

  const selected = records.filter((record) => record.type === type && record.keys.includes(recordKey));
  if (selected.length !== 1 || selected[0].ids.length !== 1) {
    throw ownershipError("This record cannot be linked to a unique Lead or Account. Reconcile its IDs before transferring.");
  }

  const customer = selected[0].ids[0];
  const chain = records.filter((record) => record.ids.includes(customer));
  const roots = records.filter((record) => record.type === "leads" || record.type === "accounts");
  if (!roots.some((record) => record.ids.includes(customer))) {
    throw ownershipError("The linked Lead or Account is missing. Reconcile the customer link before transferring.");
  }
  const knownIds = new Set(roots.flatMap((record) => record.ids));
  const ambiguous = records.some((record) => record.ids.some((id) => !knownIds.has(id)) &&
    record.contacts.some((contact) => contactOwners.get(contact)?.has(customer)));
  if (ambiguous || chain.some((record) => record.ids.length !== 1 || !record.keys.length || record.conflictingAccountIds)) {
    throw ownershipError("Some records have conflicting or missing links. Reconcile those records before transferring.");
  }
  const customerAliases = unique([customer, ...[...accountsById].filter(([, targets]) => targets.size === 1 && targets.has(customer)).map(([id]) => id)]);
  const changes = chain.map(({ type: kind, keys, label: name, reference, owner }) => ({ type: kind, keys: [...keys].sort(), label: name, reference, owner }))
    .sort((a, b) => a.keys[0].localeCompare(b.keys[0]));
  const relevantEvents = events.filter((event) => customerAliases.some((id) => event.customerIds.includes(id)));
  const revision = relevantEvents.at(-1)?.id || "";
  return { customer, customerIds: customerAliases.sort(), changes, revision, selected: selected[0], history: relevantEvents };
}

export function transferFingerprint(chain) {
  return hash(JSON.stringify([chain.customer, chain.customerIds, chain.revision, chain.changes]));
}

export async function loadOwnershipData() {
  const entries = await Promise.all(ownershipTypes.map(async (type) => {
    const { spreadsheetId, sheetNames } = SHEETS[type];
    const sheet = await resolveSheetTitle(spreadsheetId, sheetNames);
    return [type, rowsToObjects(await getValues(spreadsheetId, sheet))];
  }));
  return Object.fromEntries(entries);
}

export async function readOwnershipLedger() {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${ledgerId()}`;
  const metadata = await googleFetch(`${base}?fields=sheets.properties(sheetId,title)`);
  const properties = metadata.sheets?.map((entry) => entry.properties) || [];
  const sheet = properties.find((entry) => entry.title === ledgerTitle);
  const rows = sheet ? await getValues(ledgerId(), ledgerTitle) : [];
  const events = rows.slice(1).filter((row) => row[0]).map((row) => JSON.parse(row.join("")));
  return { base, sheet, properties, events };
}

export async function getOwnershipTable(type) {
  const { spreadsheetId, sheetNames } = SHEETS[type];
  const [sheet, ledger] = await Promise.all([resolveSheetTitle(spreadsheetId, sheetNames), readOwnershipLedger()]);
  return projectOwnership(type, rowsToObjects(await getValues(spreadsheetId, sheet)), ledger.events);
}

export async function inheritOwnership(type, row, source = row) {
  const { events } = await readOwnershipLedger();
  const transfer = currentTransfer(ownershipIndex(events), type, source);
  return transfer ? setRecordOwner(type, row, transfer.to.username) : row;
}

export async function saveOwnershipTransfer(ledger, chain, to, actor) {
  const event = {
    id: randomUUID(), customer: chain.customer, customerIds: chain.customerIds,
    to, actor, at: new Date().toISOString(), records: chain.changes,
  };
  const sheetId = ledger.sheet?.sheetId ?? (Math.max(0, ...ledger.properties.map((prop) => prop.sheetId)) + 1);
  // An identical revision cannot be committed twice, even by different server instances.
  const reservation = "CrmOwnership_" + hash(JSON.stringify([chain.customer, chain.revision]));
  const requests = ledger.sheet ? [] : [
    { addSheet: { properties: { sheetId, title: ledgerTitle, hidden: true } } },
    { updateCells: {
      start: { sheetId, rowIndex: 0, columnIndex: 0 },
      rows: [{ values: [{ userEnteredValue: { stringValue: "Ownership Transfer" } }] }], fields: "userEnteredValue",
    } },
  ];
  const json = JSON.stringify(event);
  const values = [];
  for (let offset = 0; offset < json.length;) {
    let end = Math.min(json.length, offset + 40_000);
    if (end < json.length && /[\uD800-\uDBFF]/.test(json[end - 1])) end--;
    values.push({ userEnteredValue: { stringValue: json.slice(offset, end) } });
    offset = end;
  }
  if (values.length > 26) throw ownershipError("This customer has too many records for one transfer.");
  requests.push(
    { addNamedRange: { namedRange: {
      namedRangeId: reservation, name: reservation,
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
    } } },
    { appendCells: { sheetId, rows: [{ values }], fields: "userEnteredValue" } },
  );
  try {
    await googleFetch(`${ledger.base}:batchUpdate`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requests }),
    });
  } catch (error) {
    const refreshed = await readOwnershipLedger();
    if (refreshed.events.some((entry) => entry.id === event.id)) return event;
    if (error.googleStatus === 400 || error.googleStatus === 409) {
      throw ownershipError("The transfer could not be confirmed. Review the current owner and create a new preview.");
    }
    throw error;
  }
  return event;
}
