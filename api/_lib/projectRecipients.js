const clean = (value) => String(value || "").trim();
const split = (value) => clean(value).split(/[;,\n]/).map(clean).filter(Boolean);
const indexOf = (headers, name) => headers.findIndex((header) => clean(header).toLowerCase() === name.toLowerCase());

function unique(values) {
  const seen = new Set();
  return values.filter((email) => {
    const key = email.toLowerCase();
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Project notification lists deliberately never fall back to shared CC/BCC.
export function resolveProjectRecipients(headers, rows, data) {
  const ownerIndex = indexOf(headers, "Lead Owner");
  const emailIndex = indexOf(headers, "Email");
  const ccIndex = indexOf(headers, "Project CC");
  const bccIndex = indexOf(headers, "Project BCC");
  const wantedOwners = new Set(
    [data["Project Manager"], data["Account Owner"], data["Lead Owner"], data.Owner]
      .map((value) => clean(value).toLowerCase()).filter(Boolean)
  );
  const owners = unique(rows
    .filter((row) => ownerIndex >= 0 && wantedOwners.has(clean(row[ownerIndex]).toLowerCase()))
    .flatMap((row) => emailIndex >= 0 ? split(row[emailIndex]) : []));
  const clients = unique(split(data["Client Email ID"]));
  const submitted = clean(data.updatedByEmail).toLowerCase();
  const updaterEmail = emailIndex >= 0
    ? rows.map((row) => clean(row[emailIndex])).find((email) => email && email.toLowerCase() === submitted) || ""
    : "";
  const toList = clients.length ? clients : owners;
  const toKeys = new Set(toList.map((email) => email.toLowerCase()));
  const ccList = unique([
    ...owners,
    ...rows.flatMap((row) => ccIndex >= 0 ? split(row[ccIndex]) : []),
    ...split(updaterEmail),
  ]).filter((email) => !toKeys.has(email.toLowerCase()));
  const visibleKeys = new Set([...toList, ...ccList].map((email) => email.toLowerCase()));
  const bccList = unique(rows.flatMap((row) => bccIndex >= 0 ? split(row[bccIndex]) : []))
    .filter((email) => !visibleKeys.has(email.toLowerCase()));
  return { to: toList.join(","), cc: ccList.join(","), bcc: bccList.join(","), updaterEmail };
}
