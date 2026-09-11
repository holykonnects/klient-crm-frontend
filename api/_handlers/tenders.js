import { DRIVE_FOLDERS, SHEETS } from "../_lib/crmConfig.js";
import { appendValues, buildRow, getValues, optionsFromValues, resolveSheetTitle, rowsToObjects, uploadDriveFile } from "../_lib/googleSheets.js";
import { notifyTenderSubmitted } from "../_lib/operationalEmails.js";

const UPDATE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdf2pFdSBeBb8C-__cY6Xlg7ErfWJoxHDi2uXue80aieVLwmg/viewform?usp=pp_url";
const UPDATE_FIELDS = {
  "entry.1935485735": "Bid Number", "entry.1867562577": "Bid Start Date",
  "entry.1593496403": "Bid End Date", "entry.1534984940": "Ministry/State Name",
  "entry.1101390415": "Organisation Name", "entry.328591834": "Work Type",
  "entry.1808877600": "Bid Type", "entry.1012570309": "EMD Amount",
  "entry.1063977684": "EMD Exemption Available", "entry.537047039": "Tender Budget",
  "entry.1208217132": "Pre Bid Meeting Date", "entry.1802100799": "Pre Bid Meeting Venue",
  "entry.1721867859": "Tender Conditions", "entry.1483595671": "Tender Status",
  "entry.284842606": "Tender Remarks",
};

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (req.query.action === "dropdowns") {
        const validationName = await resolveSheetTitle(SHEETS.tenders.validationSpreadsheetId, SHEETS.tenders.validationSheetNames);
        const values = await getValues(SHEETS.tenders.validationSpreadsheetId, validationName);
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json(optionsFromValues(values));
      }
      const sheetName = await resolveSheetTitle(SHEETS.tenders.spreadsheetId, SHEETS.tenders.sheetNames);
      const values = await getValues(SHEETS.tenders.spreadsheetId, sheetName);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(rowsToObjects(values));
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const sheetName = await resolveSheetTitle(SHEETS.tenders.spreadsheetId, SHEETS.tenders.sheetNames);
      const values = await getValues(SHEETS.tenders.spreadsheetId, sheetName);
      const headers = values[0] || [];
      if (!headers.length) throw new Error(`No headers found in ${sheetName}`);
      const data = { ...body };
      const existing = rowsToObjects(values).find((row) =>
        String(row["Bid Number"] || "").trim() === String(data["Bid Number"] || "").trim() &&
        String(row["Tender Unique ID"] || "").trim()
      );
      data["Tender Unique ID"] = data["Tender Unique ID"] || existing?.["Tender Unique ID"] || tenderId();
      const certificate = data["Authorization Certificate"];
      if (certificate && typeof certificate === "object") {
        data["Authorization Certificate"] = await uploadDriveFile(
          certificate,
          DRIVE_FOLDERS.tenderUploads,
          `Tender ${String(data["Bid Number"] || "").trim() || "NEW"}`
        );
      }
      if (headers.includes("Update Tender")) data["Update Tender"] = updateTenderFormula(data);
      const notification = await safely(() => notifyTenderSubmitted(headers, data));
      if (notification.sent && headers.includes("Notification Status")) data["Notification Status"] = "Sent";
      await appendValues(SHEETS.tenders.spreadsheetId, sheetName, buildRow(headers, data));
      return res.status(200).json({ ok: true, success: true, tenderId: data["Tender Unique ID"], notification });
    }

    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
}

function tenderId() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map((item) => [item.type, item.value]));
  return `${p.day}${p.month}${p.year}${p.hour}${p.minute}${p.second}${String(now.getMilliseconds()).padStart(3, "0")}`;
}

function updateTenderFormula(data) {
  const params = Object.entries(UPDATE_FIELDS)
    .map(([entry, field]) => `${entry}=${encodeURIComponent(String(data[field] ?? ""))}`)
    .join("&");
  const url = `${UPDATE_FORM_URL}&${params}`.replace(/"/g, '""');
  return `=HYPERLINK("${url}","Update Tender")`;
}

async function safely(fn) {
  try { return await fn(); }
  catch (error) { return { sent: false, reason: error.message || String(error) }; }
}
