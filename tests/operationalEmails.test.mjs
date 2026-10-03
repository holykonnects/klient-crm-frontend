import test from "node:test";
import assert from "node:assert/strict";
import { projectTaskEvent, resolveProjectTaskRecipients, updaterDetailsHtml } from "../api/_lib/operationalEmails.js";

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

test("project task events distinguish assignment, status and completion changes", () => {
  const base = { "Task ID": "TSK-1", "Task Owner": "Asha", Status: "Not Started", "Task Name": "Survey" };
  assert.equal(projectTaskEvent({}, base), "created");
  assert.equal(projectTaskEvent(base, { ...base, "Task Owner": "Ravi" }), "reassigned");
  assert.equal(projectTaskEvent({ ...base, "Task Owner": "" }, base), "assigned");
  assert.equal(projectTaskEvent(base, { ...base, Status: "In Progress" }), "status_changed");
  assert.equal(projectTaskEvent(base, { ...base, Status: "Blocked" }), "blocked");
  assert.equal(projectTaskEvent(base, { ...base, Status: "Completed" }), "completed");
  assert.equal(projectTaskEvent({ ...base, Status: "Completed" }, { ...base, Status: "In Progress" }), "reopened");
  assert.equal(projectTaskEvent(base, { ...base, "Updated At": "later" }), "unchanged");
});

test("project task recipients come from assignments, project management and validation lists", () => {
  const headers = ["Lead Owner", "Email", "Project CC", "Project BCC"];
  const rows = [
    ["Asha", "asha@example.test", "projects@example.test", "audit@example.test"],
    ["Ravi", "ravi@example.test", "projects@example.test", "audit@example.test"],
    ["Mina", "mina@example.test", "", ""],
  ];
  assert.deepEqual(resolveProjectTaskRecipients(headers, rows, {
    "Task Owner": "Asha", "Assigned Team": "Ravi",
  }, { "Project Manager": "Mina" }, "updater@example.test"), {
    to: "asha@example.test,ravi@example.test",
    cc: "mina@example.test,projects@example.test,updater@example.test",
    bcc: "audit@example.test",
  });
});

test("project task recipient resolution falls back to the project manager", () => {
  const headers = ["Lead Owner", "Email", "Project CC"];
  const rows = [["Mina", "mina@example.test", "projects@example.test"]];
  assert.deepEqual(resolveProjectTaskRecipients(headers, rows, {}, { "Project Manager": "Mina" }), {
    to: "mina@example.test", cc: "projects@example.test", bcc: "",
  });
});
