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
  const row = (loginRows || []).find((entry) => NAME_FIELDS.some(
    (field) => normalized(entry?.[field]) === key,
  ));
  const sourceIsEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(source);

  return {
    name: row ? pick(row, NAME_FIELDS.filter((field) => field !== "Login Username")) || source : source,
    email: row ? pick(row, EMAIL_FIELDS) || (sourceIsEmail ? source : "") : (sourceIsEmail ? source : ""),
  };
}
