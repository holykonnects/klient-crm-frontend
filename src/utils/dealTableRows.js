const idFields = ["Deal ID", "Order Distribution ID", "Order ID"];
const clean = (value) => String(value ?? "").trim().toLowerCase();
const accountKey = (row) => clean(row["Account ID"]) || clean(row["Lead ID"]);

const sparseOrderSnapshot = (row) => clean(row["Order ID"]) && !clean(row["Deal Amount"]);

export function recoverDealSnapshot(latest, olderRows) {
  if (!sparseOrderSnapshot(latest) || !olderRows.length) return latest;
  const snapshot = { ...latest };
  for (const row of olderRows) {
    for (const [field, value] of Object.entries(row)) {
      if (clean(value) && !clean(snapshot[field])) snapshot[field] = value;
    }
  }
  return snapshot;
}

function contactKey(row) {
  const mobile = clean(row["Mobile Number"]).replace(/\D/g, "");
  const parts = [row["Deal Name"], row.Company, row["Account Owner"], mobile].map(clean);
  return mobile.length >= 7 && parts.every(Boolean) ? JSON.stringify(parts) : "";
}

export function dealRowGroups(rows) {
  const parents = rows.map((_, index) => index);
  const identifiers = rows.map((row) => idFields.map((field) => new Set([clean(row[field])].filter(Boolean))));

  function root(index) {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  }

  function connect(indices, authoritative = false) {
    const groups = [...new Set(indices.map(root))];
    if (groups.length < 2) return;
    const combined = idFields.map((_, field) =>
      new Set(groups.flatMap((group) => [...identifiers[group][field]]))
    );
    // Aliases can connect old snapshots, but a reused name cannot merge distinct IDs.
    if (!authoritative && combined.some((ids) => ids.size > 1)) return;
    const [first, ...others] = groups;
    identifiers[first] = combined;
    others.forEach((group) => { parents[group] = first; });
  }

  function connectBy(getAlias, authoritative = false) {
    const byAlias = new Map();
    rows.forEach((row, index) => {
      const alias = getAlias(row);
      if (!alias) return;
      if (!byAlias.has(alias)) byAlias.set(alias, []);
      byAlias.get(alias).push(index);
    });

    for (const indices of byAlias.values()) connect(indices, authoritative);
  }

  idFields.forEach((field, index) => connectBy((row) => clean(row[field]), index === 0));
  connectBy((row) => {
    const account = accountKey(row);
    const name = clean(row["Deal Name"]);
    return account && name ? JSON.stringify([account, name]) : "";
  });

  connectBy((row) => {
    const name = clean(row["Deal Name"]);
    const timestamp = clean(row.Timestamp);
    return !accountKey(row) && name && timestamp ? JSON.stringify([name, timestamp]) : "";
  });

  const linkedOrderGroups = new Set();
  const earlierDeals = new Map();
  const legacyOrders = new Map();
  rows.forEach((row, index) => {
    if (accountKey(row) || clean(row["Deal ID"]) || clean(row["Order Distribution ID"])) {
      linkedOrderGroups.add(root(index));
    }
    const contact = contactKey(row);
    if (!contact) return;
    const closedDeal = !clean(row["Order ID"]) && clean(row.Stage) === "closed won" && clean(row["Deal Amount"]);
    if (accountKey(row) || closedDeal) {
      if (!earlierDeals.has(contact)) earlierDeals.set(contact, []);
      earlierDeals.get(contact).push(index);
    } else if (sparseOrderSnapshot(row) && !clean(row["Deal ID"]) && !clean(row["Order Distribution ID"])) {
      if (!legacyOrders.has(contact)) legacyOrders.set(contact, []);
      legacyOrders.get(contact).push(index);
    }
  });

  // Legacy deals and their order snapshots can both lack an account ID.
  // A Closed Won row with a deal amount can supply the original deal when the contact match is unique.
  for (const [contact, orders] of legacyOrders) {
    const candidates = (earlierDeals.get(contact) || []).filter((index) => index < orders[0]);
    const orderGroup = root(orders[0]);
    if (!linkedOrderGroups.has(orderGroup) && new Set(orders.map(root)).size === 1 && new Set(candidates.map(root)).size === 1) {
      connect([candidates[0], orders[0]]);
    }
  }

  return new Map(rows.map((row, index) => [row, root(index)]));
}
