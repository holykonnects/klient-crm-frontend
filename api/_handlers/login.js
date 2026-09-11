import crypto from "crypto";
import { SHEETS } from "../_lib/crmConfig.js";
import { getValues, resolveSheetTitle, rowsToObjects } from "../_lib/googleSheets.js";

const clean = (value) => String(value ?? "").trim();
const normalize = (value) => clean(value).toLowerCase();

function valueFrom(row, aliases) {
  const keys = Object.keys(row || {});
  for (const alias of aliases) {
    const key = keys.find((candidate) => normalize(candidate) === normalize(alias));
    if (key && clean(row[key])) return clean(row[key]);
  }
  return "";
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function loginHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method Not Allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const email = normalize(body.email);
    const password = String(body.password ?? "");
    if (!email || !password) return res.status(400).json({ success: false, error: "Email and password are required" });

    const sheetName = await resolveSheetTitle(SHEETS.auth.spreadsheetId, SHEETS.auth.sheetNames);
    const rows = rowsToObjects(await getValues(SHEETS.auth.spreadsheetId, sheetName));
    const user = rows.find((row) => normalize(valueFrom(row, ["Email", "Login Email", "Login Username", "Username"])) === email);
    const storedPassword = valueFrom(user, ["Password", "Login Password", "Passcode"]);

    if (!user || !storedPassword || !safeEqual(storedPassword, password)) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }

    const username = valueFrom(user, ["Login Username", "Username", "Name", "Email"]);
    const role = valueFrom(user, ["Role", "User Role"]);
    const pageAccess = valueFrom(user, ["Page Access", "Pages", "Access"])
      .split(",")
      .map(clean)
      .filter(Boolean);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ success: true, username, email, role, pageAccess });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || String(error) });
  }
}
