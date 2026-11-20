import { SHEETS } from "../_lib/crmConfig.js";
import { getValues, resolveSheetTitle, rowsToObjects } from "../_lib/googleSheets.js";
import {
  loadOwnershipData, normalize, ownershipChain, ownershipError, readOwnershipLedger, saveOwnershipTransfer, transferFingerprint,
} from "../_lib/ownership.js";
import { createSignedToken, requireSession, verifySignedToken } from "../_lib/sessionAuth.js";

const transferEmails = new Set(["holy@klientkonnect.com", "sidhant@ridosports.com", "sandeep@ridosports.com"]);
const tokenType = "crm-ownership-preview";

async function crmUsers() {
  const { spreadsheetId, sheetNames } = SHEETS.auth;
  const tab = await resolveSheetTitle(spreadsheetId, sheetNames);
  const rows = rowsToObjects(await getValues(spreadsheetId, tab));
  const users = rows.map((row) => ({
    email: normalize(row["Login Email"] || row.Email),
    username: String(row["Login Username"] || row.Username || row.Name || "").trim(),
    disabled: ["inactive", "disabled", "archived", "removed"].includes(normalize(row.Status || row["Account Status"])) ||
      ["no", "false", "0"].includes(normalize(row.Active)),
  }));
  return users.filter((user) => user.email && user.username && !user.disabled &&
    users.filter((entry) => entry.email === user.email || normalize(entry.username) === normalize(user.username)).length === 1
  ).map(({ email, username }) => ({ email, username }));
}

function previewToken(value) {
  try {
    const token = verifySignedToken(value);
    if (token.type !== tokenType) throw new Error("Wrong token type");
    return token;
  } catch {
    throw ownershipError("This preview has expired or is invalid. Review the transfer again.");
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const session = requireSession(req);
    const canTransfer = transferEmails.has(normalize(session.email));
    if (req.method === "GET" && req.query.action === "capabilities") return res.status(200).json({ canTransfer });

    const history = req.method === "GET" && req.query.action === "history";
    if (!history && req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
    if (!history && !canTransfer) throw ownershipError("You do not have permission to transfer ownership.", 403);

    const body = history ? req.query : (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {});
    if (!history && body.action === "recipients") return res.status(200).json({ users: await crmUsers() });
    if (!history && !["preview", "confirm"].includes(body.action)) throw ownershipError("Unknown ownership action.", 400);
    const token = body.action === "confirm" ? previewToken(body.token) : null;
    if (token && token.actor !== normalize(session.email)) throw ownershipError("This preview belongs to another CRM user.", 403);
    const type = token?.recordType || body.type;
    const recordKey = token?.recordKey || body.recordKey;
    const [data, ledger] = await Promise.all([loadOwnershipData(), readOwnershipLedger()]);
    const chain = ownershipChain(data, ledger.events, type, recordKey);

    if (history) {
      const identities = [session.sub, session.email].map(normalize).filter(Boolean);
      const canRead = ["admin", "administrator"].includes(normalize(session.role)) ||
        (normalize(chain.selected.owner) && identities.includes(normalize(chain.selected.owner)));
      if (!canRead) throw ownershipError("You do not have permission to view this ownership history.", 403);
      const entries = chain.history.flatMap((event) => event.records
        .filter((record) => record.type === type && record.keys.some((key) => chain.selected.keys.includes(key)))
        .map((record) => ({ id: event.id, from: record.owner, to: event.to.username, actor: event.actor.username, at: event.at })));
      return res.status(200).json({ owner: chain.selected.owner, entries: entries.reverse() });
    }

    const users = await crmUsers();
    const actor = users.find((user) => user.email === normalize(session.email));
    const recipient = users.find((user) => user.email === normalize(token?.recipient || body.recipient));
    if (!actor || !recipient) throw ownershipError("Choose a uniquely identified active CRM user.", 400);
    if (chain.changes.every((record) => normalize(record.owner) === normalize(recipient.username))) {
      throw ownershipError("All linked records already belong to this owner.");
    }
    const fingerprint = transferFingerprint(chain);
    if (token) {
      if (fingerprint !== token.fingerprint) throw ownershipError("The linked records or owners changed. Review a fresh preview.");
      const event = await saveOwnershipTransfer(ledger, chain, recipient, actor);
      return res.status(200).json({ ok: true, count: event.records.length });
    }
    const confirmation = createSignedToken({
      type: tokenType, actor: actor.email, recipient: recipient.email, recordType: type, recordKey, fingerprint,
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    return res.status(200).json({
      token: confirmation, recipient: recipient.username,
      records: chain.changes.map(({ type: kind, label, reference, owner }) => ({ type: kind, label, reference, owner })),
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.status ? error.message : "Ownership information is temporarily unavailable." });
  }
}
