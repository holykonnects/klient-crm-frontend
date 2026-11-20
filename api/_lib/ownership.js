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
const ownerFields = {
  leads: ["Lead Owner", "Account Owner", "Owner"],
  accounts: ["Account Owner", "Lead Owner", "Owner"],
  deals: ["Deal Owner", "Account Owner", "Lead Owner", "Owner"],
  orders: ["Order Owner", "Account Owner", "Lead Owner", "Owner"],
};
const unique = (items) => [...new Set(items.filter(Boolean))];
const ledgerTitle = "CRM Ownership Transfers";
const ledgerId = () => SHEETS.accounts.spreadsheetId;

export function recordOwner(type, row) {
  const fields = ownerFields[type];
  return fields.map((field) => clean(row[field])).find(Boolean) || "";
}

export function setRecordOwner(type, row, owner) {
  const field = ["leads", "accounts"].includes(type) ? "Lead Owner" : "Account Owner";
  const otherFields = ownerFields[type].filter((name) => Object.hasOwn(row, name));
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

function ownershipGraph(data, events) {

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
    const snapshots = newestCrmRows(rows);
    const latest = snapshots[0];
    const old = snapshots.map((row) => currentTransfer(index, kind, row)).find(Boolean);
    const owner = snapshots.map((row) => recordOwner(kind, row)).find(Boolean) || "";
    const reference = clean(latest[kind === "deals" ? "Deal ID" : kind === "orders" ? "Order ID" : "Lead ID"]) ||
      clean(latest["Account ID"] || latest.Timestamp);
    records.push({ type: kind, ids, keys, label: label(kind, latest), reference,
      owner: old?.to.username || owner, contacts: rows.map(contactKey).filter(Boolean) });
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

  for (const type of ["leads", "accounts", "orders"]) {
    for (const row of data[type]) {
      if (!ownershipRecordKey(type, row) && recordOwner(type, row)) add(type, [row], resolveIds([row]));
    }
  }

  const roots = records.filter((record) => record.type === "leads" || record.type === "accounts");
  const knownIds = new Set(roots.flatMap((record) => record.ids));
  return { records, knownIds, contactOwners, accountsById, events };
}

function customerChain({ records, knownIds, contactOwners, accountsById, events }, customer) {
  const chain = records.filter((record) => record.ids.includes(customer));
  if (!knownIds.has(customer)) {
    throw ownershipError("The linked Lead or Account is missing.");
  }
  const ambiguous = records.filter((record) =>
    (!record.ids.length || record.ids.some((id) => !knownIds.has(id))) &&
    record.contacts.some((contact) => contactOwners.get(contact)?.has(customer)));
  const conflicts = unique([...ambiguous, ...chain.filter((record) =>
    record.ids.length !== 1 || !record.keys.length || record.conflictingAccountIds)]);
  if (conflicts.length) {
    throw Object.assign(ownershipError("Some records have conflicting or missing customer links."), { records: conflicts });
  }
  const customerAliases = unique([customer, ...[...accountsById].filter(([, targets]) => targets.size === 1 && targets.has(customer)).map(([id]) => id)]);
  const changes = chain.map(({ type, keys, label, reference, owner }) => ({ type, keys: [...keys].sort(), label, reference, owner }))
    .sort((a, b) => a.keys[0].localeCompare(b.keys[0]));
  const history = events.filter((event) => customerAliases.some((id) => event.customerIds.includes(id)));
  const revision = history.at(-1)?.id || "";
  const label = changes.find((record) => record.type === "accounts")?.label ||
    changes.find((record) => record.type === "leads")?.label || customer;
  return { customer, customerIds: customerAliases.sort(), changes, revision, history, label };
}

export function ownershipChain(data, events, type, recordKey) {
  if (!ownershipTypes.includes(type) || !recordKey) throw ownershipError("Select a saved CRM record.", 400);
  const graph = ownershipGraph(data, events);
  const selected = graph.records.filter((record) => record.type === type && record.keys.includes(recordKey));
  if (selected.length !== 1 || selected[0].ids.length !== 1) {
    throw ownershipError("This record cannot be linked to a unique Lead or Account. Reconcile its IDs before transferring.");
  }
  // History for a verified record remains readable even if a newer record has an unresolved customer link.
  const customer = selected[0].ids[0];
  const history = events.filter((event) => event.customer === customer || event.customerIds.includes(customer));
  try {
    return { ...customerChain(graph, customer), selected: selected[0] };
  } catch (error) {
    if (error.status !== 409) throw error;
    return { selected: selected[0], history, customer };
  }
}

export function portfolioOwners(data, events) {
  const graph = ownershipGraph(data, events);
  const byName = new Map();
  for (const { owner } of graph.records) if (owner) byName.set(normalize(owner), owner);
  return [...byName.values()].sort((a, b) => a.localeCompare(b));
}

export function ownerPortfolio(data, events, sourceOwners) {
  const owners = new Set(sourceOwners.map(normalize).filter(Boolean));
  if (!owners.size) throw ownershipError("Choose the current owner.", 400);
  const graph = ownershipGraph(data, events);
  const affected = graph.records.filter((record) => owners.has(normalize(record.owner)));
  const blockers = [];
  const customers = new Map();
  for (const record of affected) {
    if (record.ids.length !== 1 || !record.keys.length) {
      blockers.push({ type: record.type, label: record.label, reference: record.reference, reason: "Missing or ambiguous customer link." });
    } else if (!customers.has(record.ids[0])) {
      customers.set(record.ids[0], record);
    }
  }
  const chains = [];
  for (const [customer, record] of customers) {
    try {
      chains.push(customerChain(graph, customer));
    } catch (error) {
      if (error.status !== 409) throw error;
      for (const conflict of error.records || [record]) {
        if (!blockers.some((blocker) => blocker.type === conflict.type && blocker.reference === conflict.reference && blocker.label === conflict.label)) {
          blockers.push({ type: conflict.type, label: conflict.label, reference: conflict.reference, reason: error.message });
        }
      }
    }
  }
  chains.sort((a, b) => a.customer.localeCompare(b.customer));
  return { chains, blockers };
}

export function transferFingerprint(chains) {
  return hash(JSON.stringify(chains.map(({ customer, customerIds, revision, changes }) => [customer, customerIds, revision, changes])));
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

function transferCells(event) {
  const json = JSON.stringify(event);
  const values = [];
  for (let offset = 0; offset < json.length;) {
    let end = Math.min(json.length, offset + 40_000);
    if (end < json.length && /[\uD800-\uDBFF]/.test(json[end - 1])) end--;
    values.push({ userEnteredValue: { stringValue: json.slice(offset, end) } });
    offset = end;
  }
  if (values.length > 26) throw ownershipError("This customer has too many records for one transfer.");
  return { values };
}

export async function saveOwnershipTransfer(ledger, chains, to, actor) {
  const at = new Date().toISOString();
  const batchId = randomUUID();
  const events = chains.map((chain) => ({
    id: randomUUID(), batchId, customer: chain.customer, customerIds: chain.customerIds,
    to, actor, at, records: chain.changes,
  }));
  const sheetId = ledger.sheet?.sheetId ?? (Math.max(0, ...ledger.properties.map((prop) => prop.sheetId)) + 1);
  const requests = ledger.sheet ? [] : [
    { addSheet: { properties: { sheetId, title: ledgerTitle, hidden: true } } },
    { updateCells: {
      start: { sheetId, rowIndex: 0, columnIndex: 0 },
      rows: [{ values: [{ userEnteredValue: { stringValue: "Ownership Transfer" } }] }], fields: "userEnteredValue",
    } },
  ];
  // Reserve every chain revision and append every event in one atomic Sheets batch.
  for (const { customer, revision } of chains) {
    const reservation = "CrmOwnership_" + hash(JSON.stringify([customer, revision]));
    requests.push({ addNamedRange: { namedRange: {
      namedRangeId: reservation, name: reservation,
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
    } } });
  }
  requests.push({ appendCells: { sheetId, rows: events.map(transferCells), fields: "userEnteredValue" } });
  try {
    await googleFetch(`${ledger.base}:batchUpdate`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requests }),
    });
  } catch (error) {
    const refreshed = await readOwnershipLedger();
    if (events.every((event) => refreshed.events.some((entry) => entry.id === event.id))) return events;
    if (error.googleStatus === 400 || error.googleStatus === 409) {
      throw ownershipError("The transfer could not be confirmed. Review the current owners and create a new preview.");
    }
    throw error;
  }
  return events;
}
