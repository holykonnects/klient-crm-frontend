import { DRIVE_FOLDERS } from "../_lib/crmConfig.js";
import { MAX_ORDER_ATTACHMENT_BYTES } from "../_lib/crmHandlers.js";
import {
  getAccessToken,
  getDriveAuthSubjects,
  uploadDriveFileDetails,
} from "../_lib/googleSheets.js";
import { createSignedToken, requireSession, verifySignedToken } from "../_lib/sessionAuth.js";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const FILE_FIELDS = ["Attach Purchase Order", "Attach Drawing", "Attach BOQ", "Proforma Invoice"];
const ALLOWED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg"]);

const clean = (value) => String(value ?? "").trim();

function configuredFolder(field) {
  return DRIVE_FOLDERS.attachments[field] || DRIVE_FOLDERS.defaultUpload;
}

function validateUpload(field, file) {
  if (!FILE_FIELDS.includes(field)) throw new Error(`Unknown order attachment field: ${field || "(empty)"}`);
  if (!file || typeof file !== "object" || !file.base64) throw new Error(`${field} file content is required`);
  const extension = clean(file.name).split(".").pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error(`${field} must be a PDF, PNG, JPG, or JPEG file`);
  if (Buffer.byteLength(file.base64, "base64") > MAX_ORDER_ATTACHMENT_BYTES) {
    throw new Error(`${field} exceeds the 2 MB attachment limit`);
  }
}

async function deleteSignedDraft(receipt) {
  const expectedFolder = configuredFolder(receipt.field);
  if (!expectedFolder || receipt.folderId !== expectedFolder) throw new Error("Attachment receipt folder is invalid");

  const errors = [];
  let notFound = false;
  for (const subject of getDriveAuthSubjects()) {
    try {
      const token = await getAccessToken({ scopes: [DRIVE_SCOPE], subject });
      const metadataResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(receipt.fileId)}?supportsAllDrives=true&fields=id,name,parents`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (metadataResponse.status === 404) {
        notFound = true;
        continue;
      }
      const metadata = await metadataResponse.json().catch(() => ({}));
      if (!metadataResponse.ok) throw new Error(metadata.error?.message || "Unable to verify uploaded attachment");
      if (!(metadata.parents || []).includes(expectedFolder) || !clean(metadata.name).startsWith(receipt.namePrefix)) {
        throw new Error("Uploaded attachment no longer matches its signed draft receipt");
      }

      const deleteResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(receipt.fileId)}?supportsAllDrives=true`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      if (deleteResponse.ok || deleteResponse.status === 404) return;
      const json = await deleteResponse.json().catch(() => ({}));
      throw new Error(json.error?.message || "Drive draft deletion failed");
    } catch (error) {
      errors.push(error.message || String(error));
    }
  }
  if (notFound && !errors.length) return;
  throw new Error(errors[errors.length - 1] || "Unable to remove the uploaded draft attachment");
}

export default async function handler(req, res) {
  try {
    const session = requireSession(req);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    if (req.method === "POST") {
      const field = clean(body.field);
      const file = body.file;
      validateUpload(field, file);
      const folderId = configuredFolder(field);
      const orderId = clean(body.orderId) || `DRAFT-${Date.now()}`;
      const namePrefix = `ORD ${orderId} -`;
      const uploaded = await uploadDriveFileDetails({
        name: clean(file.name) || "attachment",
        label: field,
        type: clean(file.type) || "application/octet-stream",
        base64: file.base64,
      }, folderId, `ORD ${orderId}`);
      const receipt = createSignedToken({
        type: "order-draft-attachment",
        sub: session.sub,
        fileId: uploaded.id,
        field,
        folderId,
        namePrefix,
        exp: Math.floor(Date.now() / 1000) + (2 * 60 * 60),
      });
      return res.status(200).json({ ok: true, url: uploaded.webViewLink, receipt });
    }

    if (req.method === "DELETE") {
      const receipt = verifySignedToken(body.receipt);
      if (receipt.type !== "order-draft-attachment" || receipt.sub !== session.sub || !receipt.fileId) {
        return res.status(403).json({ ok: false, error: "This attachment cannot be removed by the current CRM user" });
      }
      await deleteSignedDraft(receipt);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message || String(error) });
  }
}
