import { createHash, randomUUID } from "node:crypto";
import { rowsToObjects } from "./googleSheets.js";
import { dealRowGroups, recoverDealSnapshot } from "../../src/utils/dealTableRows.js";

const stableFields = ["Deal ID", "Order Distribution ID", "Order ID"];
const normalize = (value) => String(value ?? "").trim().toLowerCase();
const accountKey = (row) => normalize(row?.["Account ID"]) || normalize(row?.["Lead ID"]);

export function dealConflict(message) {
  return Object.assign(new Error(message), { status: 409 });
}

export function newDealId() {
  return `DEAL-${randomUUID()}`;
}

export function resolveDeal(values, original, spreadsheetId) {
  const records = rowsToObjects(values).map((row, index) => ({ row, rowNumber: index + 2 }));
  const originalId = normalize(original?.["Deal ID"]);
  let matches;

  if (originalId) {
    matches = records.filter(({ row }) => normalize(row["Deal ID"]) === originalId);
  } else {
    const account = accountKey(original);
    const name = normalize(original?.["Deal Name"]);
    const sameAccountAndName = (row) => account && name && account === accountKey(row) && name === normalize(row["Deal Name"]);
    const legacyFields = stableFields.slice(1);

    const directMatches = records.filter(({ row }) => legacyFields.some((field) =>
      normalize(original?.[field]) && normalize(original[field]) === normalize(row[field])
    ));
    const accountMatches = records.filter(({ row }) => sameAccountAndName(row));
    const directIds = new Set(directMatches.map(({ row }) => normalize(row["Deal ID"])).filter(Boolean));
    matches = [...new Set([...directMatches, ...accountMatches])];
    if (directIds.size === 1) {
      // A populated stable ID takes precedence over a name reused by another deal.
      matches = matches.filter(({ row }) => !normalize(row["Deal ID"]) || directIds.has(normalize(row["Deal ID"])));
    }

    for (const field of stableFields) {
      if (new Set(matches.map(({ row }) => normalize(row[field])).filter(Boolean)).size > 1) {
        throw dealConflict("More than one deal matches this record. The deal identifiers need to be reconciled before saving.");
      }
    }
    if (!matches.length && name && normalize(original?.Timestamp)) {
      matches = records.filter(({ row }) =>
        name === normalize(row["Deal Name"]) && normalize(original.Timestamp) === normalize(row.Timestamp) &&
        (!account || account === accountKey(row))
      );
      if (matches.length > 1) {
        throw dealConflict("More than one deal has this name and timestamp. The deal identifiers need to be reconciled before saving.");
      }
    }

    const resolvedId = matches.map(({ row }) => normalize(row["Deal ID"])).find(Boolean);
    if (resolvedId) {
      matches = [...new Set([...matches, ...records.filter(({ row }) => normalize(row["Deal ID"]) === resolvedId)])];
    }
  }

  if (!matches.length) {
    throw dealConflict("The original deal could not be found. Refresh the Deals table and reopen the deal.");
  }

  const groups = dealRowGroups(records.map(({ row }) => row));
  const matchedGroups = new Set(matches.map(({ row }) => groups.get(row)));
  if (matchedGroups.size === 1) {
    matches = records.filter(({ row }) => matchedGroups.has(groups.get(row)));
  }

  matches.sort((a, b) => b.rowNumber - a.rowNumber);
  const [latest, ...older] = matches;
  const previous = recoverDealSnapshot(latest.row, older.map(({ row }) => row));

  const assignedId = matches.find(({ row }) => normalize(row["Deal ID"]))?.row["Deal ID"];
  const rowsToBackfill = matches.filter(({ row }) => !normalize(row["Deal ID"])).map(({ rowNumber }) => rowNumber);
  // A retry before the first append must choose the same ID for this legacy history.
  const legacyId = () => {
    const first = matches.at(-1);
    const digest = createHash("sha256")
      .update(JSON.stringify([spreadsheetId, first.rowNumber, first.row.Timestamp, first.row["Deal Name"]]))
      .digest("hex")
      .slice(0, 24);
    return `DEAL-${digest}`;
  };
  return {
    previous,
    dealId: assignedId || legacyId(),
    rowsToBackfill,
  };
}
