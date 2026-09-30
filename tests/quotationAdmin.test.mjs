import assert from "node:assert/strict";
import test from "node:test";
import { parseQuotationAdminTable } from "../api/_lib/quotationAdmin.js";

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
