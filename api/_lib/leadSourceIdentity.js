const clean = (value) => String(value ?? "").trim();
const normalized = (value) => clean(value).toLowerCase();

const NAME_FIELDS = [
  "Name", "Full Name", "Employee Name", "Login Entity", "User Name",
  "Lead Owner", "Login Username",
];
const EMAIL_FIELDS = ["Email ID", "Email", "Email Address", "Official Email"];

function pick(row, fields) {
  for (const field of fields) {
    if (clean(row?.[field])) return clean(row[field]);
  }
  return "";
}

export function resolveLeadSourceIdentity(leadSource, loginRows = []) {
  const source = clean(leadSource);
  if (!source) return { name: "", email: "" };

  const key = normalized(source);
  const row = (loginRows || []).find((entry) => [...NAME_FIELDS, ...EMAIL_FIELDS].some(
    (field) => normalized(entry?.[field]) === key,
  ));
  const sourceIsEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(source);

  return {
    name: row ? pick(row, NAME_FIELDS.filter((field) => field !== "Login Username")) || source : source,
    email: row ? pick(row, EMAIL_FIELDS) || (sourceIsEmail ? source : "") : (sourceIsEmail ? source : ""),
  };
}

export function resolveLeadOwnerIdentity(owner, loginRows = []) {
  const key = normalized(owner);
  const fields = [...NAME_FIELDS, ...EMAIL_FIELDS, 'User ID', 'Employee ID', 'Login ID'];
  const matches = key ? loginRows.filter(row => fields.some(field => normalized(row[field]) === key)) : [];
  const emails = new Set(matches.map(row => normalized(pick(row, EMAIL_FIELDS))).filter(Boolean));
  if (!matches.length || emails.size > 1) return { name: 'Team Rido', email: '' };
  const row = matches[0];
  const name = pick(row, NAME_FIELDS.filter(field => field !== 'Login Username'));
  return { name: name && !/^[\d\s]+$/.test(name) && !name.includes('@') ? name : 'Team Rido', email: pick(row, EMAIL_FIELDS) };
}
