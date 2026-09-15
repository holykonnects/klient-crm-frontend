import { SHEETS } from "../_lib/crmConfig.js";
import { getValues, resolveSheetTitle, rowsToObjects } from "../_lib/googleSheets.js";
import { authenticateLogin } from "../_lib/loginCredentials.js";

export default async function loginHandler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method Not Allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const identifier = String(body.email ?? "").trim();
    const password = body.password;
    if (!identifier || typeof password !== "string" || !password) return res.status(400).json({ success: false, error: "Email or username and password are required" });

    const sheetName = await resolveSheetTitle(SHEETS.auth.spreadsheetId, SHEETS.auth.sheetNames);
    const rows = rowsToObjects(await getValues(SHEETS.auth.spreadsheetId, sheetName));
    const user = authenticateLogin(rows, identifier, password);
    if (!user) return res.status(401).json({ success: false, error: "Invalid email, username or password" });

    return res.status(200).json({ success: true, ...user });
  } catch (error) {
    console.error("LOGIN_SERVICE_ERROR", error.message);
    return res.status(500).json({ success: false, error: "Sign-in is temporarily unavailable. Please try again later." });
  }
}
