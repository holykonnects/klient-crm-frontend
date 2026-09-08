import crypto from "crypto";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

let cachedToken = null;

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getPrivateKey() {
  const key = process.env.GOOGLE_PRIVATE_KEY || "";
  return key.replace(/\\n/g, "\n");
}

function getServiceAccountEmail() {
  return process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL || "";
}

function assertGoogleEnv() {
  if (!getServiceAccountEmail() || !getPrivateKey()) {
    throw new Error(
      "Missing Google service account env vars. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in Vercel."
    );
  }
}

async function getAccessToken() {
  assertGoogleEnv();

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.token;

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: getServiceAccountEmail(),
    scope: `${SHEETS_SCOPE} ${DRIVE_SCOPE}`,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer
    .sign(getPrivateKey(), "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error || "Google auth failed");

  cachedToken = { token: json.access_token, expiresAt: now + Number(json.expires_in || 3600) };
  return cachedToken.token;
}

function sheetRange(sheetName, a1 = "") {
  const escaped = String(sheetName).replace(/'/g, "''");
  return `'${escaped}'${a1 ? `!${a1}` : ""}`;
}

async function googleFetch(url, init = {}) {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(json.error?.message || text || `Google API failed: ${res.status}`);
  return json;
}

export async function getSpreadsheet(spreadsheetId) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
  return googleFetch(url);
}

export async function resolveSheetTitle(spreadsheetId, candidates) {
  const spreadsheet = await getSpreadsheet(spreadsheetId);
  const titles = (spreadsheet.sheets || []).map((s) => s.properties?.title).filter(Boolean);
  const wanted = candidates.map((x) => String(x || "").trim()).filter(Boolean);

  for (const candidate of wanted) {
    const exact = titles.find((title) => title === candidate);
    if (exact) return exact;
  }

  for (const candidate of wanted) {
    const normalized = candidate.toLowerCase();
    const loose = titles.find((title) => String(title).toLowerCase() === normalized);
    if (loose) return loose;
  }

  throw new Error(`Sheet not found. Tried: ${wanted.join(", ")}`);
}

export async function getValues(spreadsheetId, sheetName, a1 = "") {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    sheetRange(sheetName, a1)
  )}`;
  const json = await googleFetch(url);
  return json.values || [];
}

export async function appendValues(spreadsheetId, sheetName, row) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    sheetRange(sheetName)
  )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  return googleFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values: [row] }),
  });
}

export async function updateValues(spreadsheetId, sheetName, rowNumber, row) {
  const a1 = `A${rowNumber}:${columnName(row.length)}${rowNumber}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    sheetRange(sheetName, a1)
  )}?valueInputOption=USER_ENTERED`;
  return googleFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values: [row] }),
  });
}

export function rowsToObjects(values) {
  const [headers = [], ...rows] = values;
  return rows.map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? "";
    });
    return obj;
  });
}

export function optionsFromValues(values) {
  const [headers = [], ...rows] = values;
  const output = {};
  headers.forEach((header, colIndex) => {
    output[header] = [
      ...new Set(rows.map((row) => row[colIndex]).filter((value) => value !== "" && value != null)),
    ];
  });
  return output;
}

export function buildRow(headers, data, { timestampFields = ["Timestamp"] } = {}) {
  const stamp = formatTimestamp();
  return headers.map((header) => {
    if (timestampFields.includes(header)) return data[header] || stamp;
    return data[header] ?? "";
  });
}

export function formatTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.day}/${byType.month}/${byType.year} ${byType.hour}:${byType.minute}:${byType.second}`;
}

export async function uploadDriveFile(fileObj, folderId, prefix = "UPLOAD") {
  if (!fileObj || typeof fileObj !== "object" || !fileObj.base64) return "";

  const token = await getAccessToken();
  const boundary = `kk_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const metadata = {
    name: `${prefix} - ${fileObj.label || fileObj.name || "file"}`,
    parents: folderId ? [folderId] : undefined,
  };
  const contentType = fileObj.type || "application/octet-stream";
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
        metadata
      )}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`
    ),
    Buffer.from(fileObj.base64, "base64"),
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || "Drive upload failed");
  return json.webViewLink || `https://drive.google.com/file/d/${json.id}/view`;
}

function columnName(index) {
  let name = "";
  let n = index;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}
