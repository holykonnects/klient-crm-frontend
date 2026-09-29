import test from "node:test";
import assert from "node:assert/strict";
import { getDriveAuthSubjects, getDriveDelegatedUser } from "../api/_lib/googleSheets.js";

test("Drive upload prefers its dedicated delegated user", () => {
  assert.equal(getDriveDelegatedUser({
    GOOGLE_DRIVE_DELEGATED_USER_EMAIL: " drive@example.test ",
    GOOGLE_DELEGATED_USER_EMAIL: "general@example.test",
    GMAIL_SENDER_EMAIL: "mail@example.test",
  }), "drive@example.test");
});

test("Drive upload falls back to the existing delegated sender", () => {
  assert.equal(getDriveDelegatedUser({
    GOOGLE_DELEGATED_USER_EMAIL: "general@example.test",
    GMAIL_SENDER_EMAIL: "mail@example.test",
  }), "general@example.test");
  assert.equal(getDriveDelegatedUser({
    GMAIL_SENDER_EMAIL: "mail@example.test",
  }), "mail@example.test");
  assert.equal(getDriveDelegatedUser({}), "");
});

test("Drive upload can fall back to service-account Shared Drive access", () => {
  assert.deepEqual(getDriveAuthSubjects({
    GOOGLE_DRIVE_DELEGATED_USER_EMAIL: "drive@example.test",
  }), ["drive@example.test", ""]);
  assert.deepEqual(getDriveAuthSubjects({}), [""]);
});
