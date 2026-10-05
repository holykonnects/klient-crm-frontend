import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { parseQuotationAdminTable } from "../api/_lib/quotationAdmin.js";
import quotationHandler from "../api/_handlers/quotations.js";
import { SHEETS } from "../api/_lib/crmConfig.js";

test("quotation administration detects headers below blank leading rows", () => {
  const parsed = parseQuotationAdminTable([
    [],
    ["Equipment", "Flooring"],
    ["Equipment term one", "Flooring term one"],
    ["Equipment term two", "Flooring term two"],
  ]);

  assert.equal(parsed.headerRow, 2);
  assert.deepEqual(parsed.headers, ["Equipment", "Flooring"]);
  assert.deepEqual(parsed.rows, [
    { __rowNumber: 3, Equipment: "Equipment term one", Flooring: "Flooring term one" },
    { __rowNumber: 4, Equipment: "Equipment term two", Flooring: "Flooring term two" },
  ]);
});

test("quotation administration preserves row one headers for existing tables", () => {
  const parsed = parseQuotationAdminTable([
    ["Item", "Rate"],
    ["Track", 250],
  ]);

  assert.equal(parsed.headerRow, 1);
  assert.deepEqual(parsed.rows, [{ __rowNumber: 2, Item: "Track", Rate: 250 }]);
});

test("admin retries another configured editor, reports denied identities, and never retries a lost append response", async () => {
  const originalFetch = globalThis.fetch;
  const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const originalKey = process.env.GOOGLE_PRIVATE_KEY;
  const originalSubject = process.env.GOOGLE_SHEETS_DELEGATED_USER_EMAIL;
  const originalDriveSubject = process.env.GOOGLE_DRIVE_DELEGATED_USER_EMAIL;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const delegatedUser = "quotation-editor@example.com";
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "service@example.com";
  process.env.GOOGLE_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" });
  process.env.GOOGLE_SHEETS_DELEGATED_USER_EMAIL = "blocked-editor@example.com";
  process.env.GOOGLE_DRIVE_DELEGATED_USER_EMAIL = delegatedUser;

  const writes = [];
  let denyEquipment = false;
  let loseAppendResponse = false;
  const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    if (url.hostname === "oauth2.googleapis.com") {
      const assertion = new URLSearchParams(init.body).get("assertion");
      const claim = JSON.parse(Buffer.from(assertion.split(".")[1], "base64url").toString());
      return jsonResponse({ access_token: claim.sub || "service", expires_in: 3600 });
    }
    const spreadsheetId = url.pathname.match(/\/spreadsheets\/([^/]+)/)?.[1];
    const sheetName = spreadsheetId === SHEETS.validation.spreadsheetId ? "CRM Login" : "Equipment BD";
    if (sheetName === "Equipment BD" && (denyEquipment || init.headers.Authorization !== `Bearer ${delegatedUser}`)) {
      return jsonResponse({ error: { message: "The caller does not have permission" } }, 403);
    }
    if (url.pathname.endsWith(`/spreadsheets/${spreadsheetId}`)) {
      return jsonResponse({ sheets: [{ properties: { title: sheetName } }] });
    }
    if (init.method === "PUT" || init.method === "POST") {
      writes.push({ method: init.method, auth: init.headers.Authorization, body: JSON.parse(init.body) });
      if (init.method === "POST" && loseAppendResponse) throw new TypeError("Network connection was lost");
      if (init.headers.Authorization !== `Bearer ${delegatedUser}`) {
        return jsonResponse({ error: { message: "The caller does not have permission" } }, 403);
      }
      return jsonResponse(init.method === "POST" ? { updates: { updatedRange: "'Equipment BD'!A3:D3" } } : {});
    }
    return jsonResponse({ values: sheetName === "CRM Login"
      ? [["Login Username", "Role"], ["admin", "Admin"]]
      : [["Court", "SubCategory", "Item", "concat"], ["Basketball", "Equipment", "Ball", "Basketball : Equipment : Ball"]] });
  };

  const request = async (row) => {
    let status = 200;
    let response;
    await quotationHandler({ method: "POST", body: { action: "saveAdminRow", table: "equipment", user: "admin", row } }, {
      status(code) { status = code; return this; },
      json(body) { response = body; return this; },
    });
    assert.equal(status, 200, response?.error);
    return response;
  };

  try {
    assert.equal((await request({ __rowNumber: 2, Court: "Football", Item: "Goal" })).created, false);
    assert.equal((await request({ Court: "Tennis", Item: "Net" })).created, true);
    assert.equal(writes.length, 5);
    assert.ok(writes.every((write) => write.auth === `Bearer ${delegatedUser}`));
    assert.match(writes.at(-1).body.values[0][0], /^=A3&/);

    denyEquipment = true;
    let deniedResponse;
    await quotationHandler({ method: "GET", query: { action: "getAdminTable", table: "equipment", user: "admin" } }, {
      status() { return this; }, json(body) { deniedResponse = body; },
    });
    assert.match(deniedResponse.error, /blocked-editor@example.com: The caller does not have permission/);
    assert.match(deniedResponse.error, /quotation-editor@example.com: The caller does not have permission/);
    assert.match(deniedResponse.error, /service account service@example.com: The caller does not have permission/);

    denyEquipment = false;
    loseAppendResponse = true;
    await assert.rejects(request({ Court: "Football", Item: "Goal" }), /Network connection was lost/);
    assert.equal(writes.filter((write) => write.method === "POST").length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEmail === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    else process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalEmail;
    if (originalKey === undefined) delete process.env.GOOGLE_PRIVATE_KEY;
    else process.env.GOOGLE_PRIVATE_KEY = originalKey;
    if (originalSubject === undefined) delete process.env.GOOGLE_SHEETS_DELEGATED_USER_EMAIL;
    else process.env.GOOGLE_SHEETS_DELEGATED_USER_EMAIL = originalSubject;
    if (originalDriveSubject === undefined) delete process.env.GOOGLE_DRIVE_DELEGATED_USER_EMAIL;
    else process.env.GOOGLE_DRIVE_DELEGATED_USER_EMAIL = originalDriveSubject;
  }
});
