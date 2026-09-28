import test from "node:test";
import assert from "node:assert/strict";
import { DELIVERY_PIN_HEADER, requireDeliveryPin } from "../api/_handlers/projects.js";

test("project delivery PIN uses the expected sheet header", () => {
  assert.equal(DELIVERY_PIN_HEADER, "Delivery PIN Code");
});

test("project delivery PIN accepts exactly six digits", () => {
  assert.equal(requireDeliveryPin(" 110001 "), "110001");
  assert.equal(requireDeliveryPin("012345"), "012345");
});

test("project delivery PIN rejects missing or malformed values", () => {
  for (const value of ["", "12345", "1234567", "12A456", null]) {
    assert.throws(() => requireDeliveryPin(value), /exactly 6 digits/);
  }
});
