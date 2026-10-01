import test from "node:test";
import assert from "node:assert/strict";
import { buildTermsCatalog } from "../api/_lib/quotationTerms.js";

test("terms catalogue reads all quotation clause headings and their term lists", () => {
  const result = buildTermsCatalog([
    [],
    ["Equipment", "Flooring", "Athletic"],
    ["Equipment term one", "Flooring term one", "Athletic term one"],
    ["Equipment term two", "Flooring term two", "Athletic term two"],
    ["Equipment term one", ""],
  ]);
  assert.deepEqual(result.tcOptions, ["Equipment", "Flooring", "Athletic"]);
  assert.deepEqual(result.tcTerms.Equipment, ["Equipment term one", "Equipment term two"]);
  assert.deepEqual(result.tcTerms.Flooring, ["Flooring term one", "Flooring term two"]);
  assert.deepEqual(result.tcTerms.Athletic, ["Athletic term one", "Athletic term two"]);
});
