import test from "node:test";
import assert from "node:assert/strict";
import { resolveLoginAudit } from "../api/_lib/updateAudit.js";

const loginRows = [{
  "Login Username": "crm.user",
  "Login Email": "crm.user@example.test",
  Role: "Accounts",
}];

test("update audit resolves canonical CRM Login details from email", () => {
  const result = resolveLoginAudit(loginRows, {
    updatedByName: "Browser display name",
    updatedByEmail: "CRM.USER@example.test",
  }, "26/09/2026 12:00:00");
  assert.equal(result["Updated At"], "26/09/2026 12:00:00");
  assert.equal(result["Updated By"], "crm.user");
  assert.equal(result["Updated By Email"], "crm.user@example.test");
  assert.equal(result["Updated By Role"], "Accounts");
});

test("update audit can resolve a CRM Login username and rejects unknown identities", () => {
  assert.equal(resolveLoginAudit(loginRows, { updatedByName: "crm.user" })["Updated By Email"], "crm.user@example.test");
  assert.throws(() => resolveLoginAudit(loginRows, { updatedByEmail: "unknown@example.test" }), /not found/);
  assert.throws(() => resolveLoginAudit([{ Username: "legacy" }], { updatedByName: "legacy" }), /missing an email/);
});
