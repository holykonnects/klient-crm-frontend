import test from "node:test";
import assert from "node:assert/strict";
import { updaterDetailsHtml } from "../api/_lib/operationalEmails.js";

test("updater email block keeps the current format and includes CRM audit details", () => {
  const html = updaterDetailsHtml({
    updatedByName: "crm.user",
    updatedByEmail: "crm.user@example.test",
    updatedByRole: "Accounts",
    "Updated At": "26/09/2026 12:00:00",
  });
  assert.match(html, /<strong>Updated by:<\/strong> crm\.user \(crm\.user@example\.test\)/);
  assert.match(html, /<strong>CRM role:<\/strong> Accounts/);
  assert.match(html, /<strong>Updated at:<\/strong> 26\/09\/2026 12:00:00/);
});

test("updater email block escapes CRM Login values and hides when email is unavailable", () => {
  assert.equal(updaterDetailsHtml({ updatedByName: "Nobody" }), "");
  assert.match(updaterDetailsHtml({
    updatedByName: "<Admin>",
    updatedByEmail: "admin@example.test",
  }), /&lt;Admin&gt;/);
});
