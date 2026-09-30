import test from "node:test";
import assert from "node:assert/strict";
import { buildTermsCatalog } from "../api/_lib/quotationTerms.js";

test("terms catalogue reads the two column headings and their term lists", () => {
  const result = buildTermsCatalog([
    [],
    ["Equipment", "Flooring"],
    ["Equipment term one", "Flooring term one"],
    ["Equipment term two", "Flooring term two"],
    ["Equipment term one", ""],
  ]);
  assert.deepEqual(result.tcOptions, ["Equipment", "Flooring"]);
  assert.deepEqual(result.tcTerms.Equipment, ["Equipment term one", "Equipment term two"]);
  assert.deepEqual(result.tcTerms.Flooring, ["Flooring term one", "Flooring term two"]);
});
