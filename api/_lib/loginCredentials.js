import crypto from "crypto";

const clean = (value) => String(value ?? "").trim();
const normalize = (value) => clean(value).toLowerCase();
const identityHeaders = ["Email", "Login Email", "Login Username", "Username"];

function valuesFrom(row, aliases) {
  return aliases.flatMap((alias) => Object.entries(row || {})
    .filter(([key, value]) => normalize(key) === normalize(alias) && clean(value))
    .map(([, value]) => String(value)));
}
function valueFrom(row, aliases) {
  return clean(valuesFrom(row, aliases)[0]);
}
function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function readCrmLoginProfile(row) {
  return {
    username: valueFrom(row, ["Login Username", "Username", "Name", "Email"]),
    email: valueFrom(row, ["Login Email", "Email"]),
    role: valueFrom(row, ["Role", "User Role"]),
    pageAccess: valueFrom(row, ["Page Access", "Pages", "Access"]).split(",").map(clean).filter(Boolean),
  };
}

export function authenticateLogin(rows, identifier, password) {
  const identity = normalize(identifier);
  if (!identity || typeof password !== "string" || !password) return null;
  const matches = rows.filter((row) => valuesFrom(row, identityHeaders).some((value) => normalize(value) === identity));
  // Do not choose an arbitrary account when identifiers collide.
  if (matches.length !== 1) return null;
  const user = matches[0];
  const storedPassword = valuesFrom(user, ["Password", "Login Password", "Passcode"])[0];
  if (!storedPassword || !safeEqual(storedPassword, password)) return null;
  const profile = readCrmLoginProfile(user);
  return { ...profile, email: profile.email || identity };
}
