import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import handler from "../api/_handlers/ownership.js";
import { SHEETS } from "../api/_lib/crmConfig.js";
import { createSessionToken } from "../api/_lib/sessionAuth.js";
import { ownerPortfolio, ownershipChain, ownershipRecordKey, projectOwnership, transferFingerprint } from "../api/_lib/ownership.js";

const oldOwner = "Existing Owner";
const newOwner = "New Owner";

function fixture() {
  return {
    leads: [
      { "Lead ID": "L-1", "Lead Owner": oldOwner, Company: "Same name", "Mobile Number": "9000000000" },
      { "Lead ID": "L-2", "Lead Owner": "Other", Company: "Same name", "Mobile Number": "9000000001" },
    ],
    accounts: [
      { "Lead ID": "L-1", "Account ID": "A-1", "Lead Owner": oldOwner, Company: "Same name", "Mobile Number": "+91 9000000000" },
      { "Lead ID": "L-2", "Account ID": "A-2", "Lead Owner": "Other", Company: "Same name", "Mobile Number": "9000000001" },
    ],
    deals: [
      { "Deal Name": "Older deal", Timestamp: "19/08/2026", "Order ID": "O-1", "Account Owner": oldOwner, Company: "Same name", "Mobile Number": "9000000000" },
      { "Deal Name": "New deal", "Deal ID": "D-2", "Account ID": "A-1", "Account Owner": oldOwner },
      { "Deal Name": "Different customer's deal", "Deal ID": "D-3", "Account ID": "A-2", "Account Owner": "Other" },
    ],
    orders: [
      { "Order ID": "O-1", "Account Owner": oldOwner, Company: "Same name", "Mobile Number": "9000000000" },
      { "Order ID": "O-2", "Deal ID": "D-2", "Account Owner": "Former order owner" },
      { "Order ID": "O-3", "Deal ID": "D-3", "Account Owner": "Other" },
    ],
  };
}
const reference = (data, type, index = 0) => ownershipRecordKey(type, data[type][index]);

test("all four entry points resolve the same customer chain, including legacy deals and orders", () => {
  const data = fixture();
  const chain = ownershipChain(data, [], "leads", reference(data, "leads"));
  assert.deepEqual(chain.changes.map(({ type }) => type), ["accounts", "deals", "deals", "leads", "orders", "orders"]);
  for (const type of ["accounts", "deals", "orders"]) {
    assert.equal(transferFingerprint([ownershipChain(data, [], type, reference(data, type))]), transferFingerprint([chain]));
  }
  assert.equal(chain.changes.find((row) => row.label === "O-2").owner, "Former order owner");
  const event = { id: "r1", customer: chain.customer, customerIds: chain.customerIds, to: { username: newOwner }, records: chain.changes };
  assert.equal(projectOwnership("orders", data.orders, [event])[0]["Account Owner"], newOwner);
  assert.equal(projectOwnership("orders", data.orders, [event])[2]["Account Owner"], "Other");

  const futureDeal = { "Deal ID": "D-4", "Account ID": "A-1", "Account Owner": oldOwner };
  assert.equal(projectOwnership("deals", [futureDeal], [event])[0]["Account Owner"], newOwner);
  const futureOrder = { "Order ID": "O-4", "Deal ID": "D-2", "Account Owner": oldOwner };
  assert.equal(projectOwnership("orders", [futureOrder], [event])[0]["Account Owner"], newOwner);
  assert.equal(data.orders[0]["Account Owner"], oldOwner);
});

test("ambiguous legacy records block a partial transfer, and stable IDs survive a legacy migration", () => {
  const data = fixture();
  const chain = ownershipChain(data, [], "leads", reference(data, "leads"));
  const event = { id: "r1", customer: chain.customer, customerIds: chain.customerIds, to: { username: newOwner }, records: chain.changes };
  data.deals[0]["Deal ID"] = "MIGRATED";
  assert.equal(projectOwnership("deals", data.deals, [event])[0]["Account Owner"], newOwner);

  const ambiguous = fixture();
  ambiguous.accounts[1]["Mobile Number"] = "9000000000";
  assert.ok(ownerPortfolio(ambiguous, [], [oldOwner]).blockers.length > 0);
});

test("the API requires a signed preview, refuses stale previews and records one transfer with history", async (t) => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const env = {
    CRM_SESSION_SECRET: "test-ownership-session",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "test@example.com",
    GOOGLE_PRIVATE_KEY: privateKey.export({ format: "pem", type: "pkcs8" }),
  };
  const old = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => Object.entries(old).forEach(([key, value]) => {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }));

  const data = fixture();
  // The source owns only the Lead on the second chain, so the remaining rungs must move with it.
  data.leads[1]["Lead Owner"] = oldOwner;
  const types = ["leads", "accounts", "deals", "orders"];
  const byId = new Map(types.map((type) => [SHEETS[type].spreadsheetId, type]));
  const login = [
    ["Login Email", "Login Username", "Page Access"],
    ["manager@example.com", "Manager", "Lead, Ownership Transfer , Deal"],
    ["new@example.com", newOwner, ""],
    ["old@example.com", oldOwner, ""],
    ["holy@klientkonnect.com", "Holy", "Lead"],
  ];
  let events = [];
  let commits = 0;
  const reservations = new Set();
  const asValues = (rows) => {
    const headers = [...new Set(rows.flatMap(Object.keys))];
    return [headers, ...rows.map((row) => headers.map((key) => row[key] ?? ""))];
  };
  t.mock.method(globalThis, "fetch", async (input, options = {}) => {
    const url = new URL(input);
    if (url.hostname === "oauth2.googleapis.com") return Response.json({ access_token: "test" });
    const id = url.pathname.split("/")[3];
    if (id.endsWith(":batchUpdate")) {
      const batch = JSON.parse(options.body).requests;
      const pending = batch.filter((entry) => entry.addNamedRange).map((entry) => entry.addNamedRange.namedRange.namedRangeId);
      assert.equal(pending.length, 2);
      if (pending.some((reservation) => reservations.has(reservation))) {
        return Response.json({ error: { message: "Duplicate reservation" } }, { status: 400 });
      }
      pending.forEach((reservation) => reservations.add(reservation));
      const rows = batch.find((entry) => entry.appendCells).appendCells.rows;
      events.push(...rows.map(({ values }) => values.map((value) => value.userEnteredValue.stringValue)));
      commits++;
      return Response.json({});
    }
    if (url.pathname.includes("/values/")) {
      if (decodeURIComponent(url.pathname).includes("CRM Ownership Transfers")) return Response.json({ values: [["Ownership Transfer"], ...events] });
      return Response.json({ values: id === SHEETS.auth.spreadsheetId ? login : asValues(data[byId.get(id)]) });
    }
    const type = byId.get(id) || "auth";
    const sheets = [{ properties: { title: SHEETS[type].sheetNames[0], sheetId: 1 } }];
    if (type === "accounts" && events.length) sheets.push({ properties: { title: "CRM Ownership Transfers", sheetId: 2 } });
    return Response.json({ sheets });
  });

  function user(email, username, role = "End User") { return { email, username, role }; }
  const admin = user("manager@example.com", "Manager", "Admin");
  const previousAllowlistUser = user("holy@klientkonnect.com", "Holy", "Admin");
  const recipient = user("new@example.com", newOwner);
  const former = user("old@example.com", oldOwner);
  async function call(actor, { method = "POST", body, query = {} } = {}) {
    let result;
    const response = {
      setHeader() {},
      status(status) { return { json(data) { result = { status, data }; } }; },
    };
    const headers = actor ? { cookie: `kk_session=${createSessionToken(actor)}` } : {};
    await handler({ method, body, query, headers }, response);
    return result;
  }
  const selection = { type: "leads", recordKey: reference(data, "leads") };
  const preview = { action: "preview", source: oldOwner, recipient: recipient.email };
  assert.equal((await call(null, { body: preview })).status, 401);
  assert.equal((await call(former, { body: preview })).status, 403);
  const capability = { method: "GET", query: { action: "capabilities" } };
  assert.equal((await call(admin, capability)).data.canTransfer, true);
  assert.equal((await call(previousAllowlistUser, capability)).data.canTransfer, false);
  assert.equal((await call(previousAllowlistUser, { body: { action: "options" } })).status, 403);
  login[3][2] = "  OWNERSHIP TRANSFER  ";
  assert.equal((await call(former, capability)).data.canTransfer, true);
  login[3][2] = "";
  assert.equal((await call(former, capability)).data.canTransfer, false);
  assert.equal((await call(admin, { body: { action: "confirm", ...selection } })).status, 409);

  const options = await call(admin, { body: { action: "options" } });
  assert.ok(options.data.sources.includes(oldOwner));
  data.orders.push({ "Order ID": "UNLINKED", "Account Owner": oldOwner });
  const blocked = await call(admin, { body: preview });
  assert.equal(blocked.data.token, null);
  assert.equal(blocked.data.blockers.length, 1);
  data.orders.pop();
  const first = await call(admin, { body: preview });
  assert.equal(first.status, 200);
  assert.deepEqual(first.data.customers.map(({ records }) => records.length), [6, 4]);
  assert.equal(commits, 0);
  data.orders.push({ "Order ID": "O-new", "Deal ID": "D-2", "Account Owner": oldOwner });
  assert.equal((await call(admin, { body: { action: "confirm", token: first.data.token } })).status, 409);
  assert.equal(commits, 0);

  const fresh = await call(admin, { body: preview });
  const confirm = { action: "confirm", token: fresh.data.token };
  login[1][2] = "Lead, Deal";
  assert.equal((await call(admin, { body: confirm })).status, 403);
  assert.equal(commits, 0);
  login[1][2] = "Lead, Ownership Transfer, Deal";
  const confirmations = await Promise.all([call(admin, { body: confirm }), call(admin, { body: confirm })]);
  assert.deepEqual(confirmations.map((result) => result.status).sort(), [200, 409]);
  assert.deepEqual(confirmations.find((result) => result.status === 200).data, { ok: true, customers: 2, count: 11 });
  assert.equal((await call(admin, { body: confirm })).status, 409);
  assert.equal(commits, 1);
  assert.equal(events.length, 2);
  assert.equal(JSON.parse(events[0].join("")).batchId, JSON.parse(events[1].join("")).batchId);
  const query = { action: "history", ...selection };
  const trail = await call(recipient, { method: "GET", query });
  assert.equal(trail.data.owner, newOwner);
  assert.equal(trail.data.entries[0].from, oldOwner);
  assert.equal(trail.data.entries[0].actor, "Manager");
  assert.equal((await call(former, { method: "GET", query })).status, 403);
});
