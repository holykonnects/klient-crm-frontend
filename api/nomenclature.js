import { driveDownloadFile, driveExportFile, driveGetFile, driveListFiles } from "./_lib/googleSheets.js";

const EDITOR_USERS = new Set([
  "sandeep@ridosports.com",
  "sidhant@ridosports.com",
  "holy@klientkonnect.com",
]);

const FOLDER_MIME = "application/vnd.google-apps.folder";
const DEFAULT_FOLDER_NAME = "Nomenclature";

function cleanEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function assertSignedIn(req) {
  const user = cleanEmail(req.query.user || req.headers["x-kk-user"]);
  if (!user) {
    const err = new Error("Please sign in to access Nomenclature Manager.");
    err.status = 401;
    throw err;
  }
  return { user, canEdit: EDITOR_USERS.has(user) };
}

function quote(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function getRootFolderId() {
  if (process.env.NOMENCLATURE_FOLDER_ID) return process.env.NOMENCLATURE_FOLDER_ID;

  const result = await driveListFiles({
    q: `mimeType='${FOLDER_MIME}' and name='${DEFAULT_FOLDER_NAME}' and trashed=false`,
    pageSize: 10,
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
  });
  const folder = result.files?.[0];
  if (!folder) {
    throw new Error("NOMENCLATURE_FOLDER_ID is not set and no Drive folder named Nomenclature was found.");
  }
  return folder.id;
}

async function listNomenclature(req, res) {
  const access = assertSignedIn(req);

  const rootFolderId = await getRootFolderId();
  const parentId = String(req.query.folderId || rootFolderId).trim();
  const listed = await driveListFiles({
    q: `'${quote(parentId)}' in parents and trashed=false`,
    pageSize: 200,
    fields:
      "files(id,name,mimeType,modifiedTime,size,webViewLink,webContentLink,thumbnailLink,parents)",
  });

  const folders = [];
  const files = [];
  (listed.files || []).forEach((item) => {
    if (item.mimeType === FOLDER_MIME) folders.push(item);
    else files.push(item);
  });

  return res.status(200).json({
    ok: true,
    rootFolderId,
    folderId: parentId,
    canEdit: access.canEdit,
    folders,
    files,
  });
}

function getExportTarget(meta, { preview = false } = {}) {
  const mimeType = String(meta.mimeType || "");
  if (!mimeType.startsWith("application/vnd.google-apps.")) return null;
  if (preview) return { mimeType: "application/pdf", extension: "pdf" };
  const map = {
    "application/vnd.google-apps.document": {
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: "docx",
    },
    "application/vnd.google-apps.spreadsheet": {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
    },
    "application/vnd.google-apps.presentation": {
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      extension: "pptx",
    },
  };
  return map[mimeType] || { mimeType: "application/pdf", extension: "pdf" };
}

function safeFileName(name, extension = "") {
  const cleaned = String(name || "nomenclature-file").replace(/"/g, "").trim() || "nomenclature-file";
  if (!extension || cleaned.toLowerCase().endsWith(`.${extension}`)) return cleaned;
  return `${cleaned}.${extension}`;
}

async function sendNomenclatureFile(req, res, { inline = false } = {}) {
  assertSignedIn(req);
  const fileId = String(req.query.fileId || "").trim();
  if (!fileId) return res.status(400).json({ ok: false, error: "Missing fileId" });

  const meta = await driveGetFile(fileId);
  const exportTarget = getExportTarget(meta, { preview: inline });
  const file = exportTarget
    ? await driveExportFile(fileId, exportTarget.mimeType)
    : await driveDownloadFile(fileId);
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${safeFileName(meta.name, exportTarget?.extension)}"`);
  return res.status(200).send(file.body);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

    if (req.query.action === "download") return sendNomenclatureFile(req, res);
    if (req.query.action === "preview") return sendNomenclatureFile(req, res, { inline: true });
    return listNomenclature(req, res);
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, error: err.message || String(err) });
  }
}
