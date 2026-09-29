import test from "node:test";
import assert from "node:assert/strict";
import {
  createSessionToken,
  createSignedToken,
  requireSession,
  verifySignedToken,
} from "../api/_lib/sessionAuth.js";

const secret = "test-session-secret";
const now = Date.UTC(2026, 8, 29, 10, 0, 0);

test("CRM sessions are signed, cookie-bound, and expire", () => {
  const token = createSessionToken({ username: "crm.user", email: "crm@example.test", role: "Admin" }, { secret, now });
  const session = requireSession({ headers: { cookie: `kk_session=${encodeURIComponent(token)}` } }, { secret, now });
  assert.equal(session.sub, "crm.user");
  assert.equal(session.email, "crm@example.test");
  assert.throws(() => requireSession({ headers: { cookie: `kk_session=${token}x` } }, { secret, now }), /expired|sign in again/i);
  assert.throws(() => requireSession({ headers: { cookie: `kk_session=${token}` } }, { secret, now: now + (13 * 60 * 60 * 1000) }), /expired|sign in again/i);
});

test("draft upload receipts cannot be modified", () => {
  const token = createSignedToken({ type: "order-draft-attachment", fileId: "file-123", exp: Math.floor(now / 1000) + 60 }, { secret, now });
  assert.equal(verifySignedToken(token, { secret, now }).fileId, "file-123");
  assert.throws(() => verifySignedToken(`${token}x`, { secret, now }), /Invalid signed token/);
});
