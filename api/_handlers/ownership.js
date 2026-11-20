import { SHEETS } from "../_lib/crmConfig.js";
import { getValues, resolveSheetTitle, rowsToObjects } from "../_lib/googleSheets.js";
import {
  loadOwnershipData, normalize, ownerPortfolio, ownershipChain, ownershipError, portfolioOwners, readOwnershipLedger, saveOwnershipTransfer, transferFingerprint,
} from "../_lib/ownership.js";
import { createSignedToken, requireSession, verifySignedToken } from "../_lib/sessionAuth.js";

const transferEmails = new Set(["holy@klientkonnect.com", "sidhant@ridosports.com", "sandeep@ridosports.com"]);
const tokenType = "crm-ownership-bulk-preview";

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
    if (!history && !["options", "preview", "confirm"].includes(body.action)) throw ownershipError("Unknown ownership action.", 400);
    const token = body.action === "confirm" ? previewToken(body.token) : null;
    if (token && token.actor !== normalize(session.email)) throw ownershipError("This preview belongs to another CRM user.", 403);
    const [data, ledger] = await Promise.all([loadOwnershipData(), readOwnershipLedger()]);

    if (history) {
      const { type, recordKey } = body;
      const chain = ownershipChain(data, ledger.events, type, recordKey);
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
    if (!actor) throw ownershipError("Your account is unavailable for this action.", 403);
    if (body.action === "options") {
      const sources = portfolioOwners(data, ledger.events).map((owner) => {
        const matched = users.find((user) => [user.email, normalize(user.username)].includes(normalize(owner)));
        return matched?.username || owner;
      });
      return res.status(200).json({ sources: [...new Set(sources)].sort((a, b) => a.localeCompare(b)), users });
    }

    const recipient = users.find((user) => user.email === normalize(token?.recipient || body.recipient));
    if (!recipient) throw ownershipError("Choose a uniquely identified active CRM user.", 400);
    const source = normalize(token?.source || body.source);
    const sourceUser = users.find((user) => [user.email, normalize(user.username)].includes(source));
    const sourceOwners = sourceUser ? [sourceUser.email, sourceUser.username] : [source];
    if (sourceOwners.some((owner) => [recipient.email, normalize(recipient.username)].includes(normalize(owner)))) {
      throw ownershipError("Choose a different new owner.", 400);
    }
    const { chains, blockers } = ownerPortfolio(data, ledger.events, sourceOwners);
    if (!chains.length && !blockers.length) throw ownershipError("This owner has no remaining linked records to transfer.");
    const fingerprint = transferFingerprint(chains);
    if (token) {
      if (blockers.length || fingerprint !== token.fingerprint) {
        throw ownershipError("The linked records or owners changed. Review a fresh preview.");
      }
      const events = await saveOwnershipTransfer(ledger, chains, recipient, actor);
      return res.status(200).json({ ok: true, customers: events.length, count: events.reduce((sum, event) => sum + event.records.length, 0) });
    }
    const confirmation = blockers.length ? null : createSignedToken({
      type: tokenType, actor: actor.email, recipient: recipient.email, source, fingerprint,
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    return res.status(200).json({
      token: confirmation, source: sourceUser?.username || body.source, recipient: recipient.username, blockers,
      customers: chains.map(({ customer, label, changes }) => ({
        customer, label,
        records: changes.map(({ type, label: name, reference, owner }) => ({ type, label: name, reference, owner })),
      })),
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.status ? error.message : "Ownership information is temporarily unavailable." });
  }
}
