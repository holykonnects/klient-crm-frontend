import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  List, ListItem, ListItemText, MenuItem, Snackbar, TextField, Typography,
} from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ManageHistoryIcon from "@mui/icons-material/ManageHistory";

const typeLabels = { leads: "Lead", accounts: "Account", deals: "Deal", orders: "Order" };
export const ownershipColumns = (row = {}) => Object.keys(row || {}).filter((field) => field !== "_ownershipRecord");

async function ownershipRequest(path, body, signal) {
  const response = await fetch(`/api/ownership${path}`, body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal,
  } : { signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status === 401 ? "Sign in again to use ownership tools." : data.error || "Ownership information is unavailable.");
  return data;
}

function OwnershipDialog({ type, selection, onClose, onTransferred }) {
  const isHistory = selection.mode === "history";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [sources, setSources] = useState([]);
  const [source, setSource] = useState("");
  const [history, setHistory] = useState(null);
  const [selectedUser, setSelectedUser] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const request = isHistory
      ? ownershipRequest(`?${new URLSearchParams({ action: "history", type, recordKey: selection.key })}`, null, controller.signal)
      : ownershipRequest("", { action: "options" }, controller.signal);
    request.then((result) => {
      if (isHistory) setHistory(result);
      else {
        setUsers(result.users);
        setSources(result.sources);
      }
    }).catch((err) => {
      if (err.name !== "AbortError") setError(err.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [isHistory, selection.key, type]);

  const recordCounts = preview?.customers.reduce((counts, customer) => {
    for (const { type } of customer.records) counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {});

  async function advance() {
    if (busy || (preview && !preview.token)) return;
    setBusy(true);
    setError("");
    try {
      if (!preview) {
        const result = await ownershipRequest("", { action: "preview", source, recipient: selectedUser });
        setPreview(result);
      } else {
        const result = await ownershipRequest("", { action: "confirm", token: preview.token });
        onClose();
        onTransferred(result.count, preview.recipient);
      }
    } catch (err) {
      setError(err.message);
      if (preview) setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isHistory ? "Ownership history" : preview ? "Review bulk transfer" : "Transfer all records by owner"}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading && <Typography>Loading…</Typography>}
        {isHistory && history && (
          <>
            <Typography><strong>Current owner</strong> {history.owner || "Unassigned"}</Typography>
            {history.entries.length ? (
              <List>
                {history.entries.map((entry) => (
                  <ListItem key={entry.id} disableGutters>
                    <ListItemText
                      primary={`${entry.from || "Unassigned"} → ${entry.to}`}
                      secondary={`${entry.actor} · ${new Date(entry.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : <Typography sx={{ mt: 2 }}>No ownership transfers have been recorded for this record.</Typography>}
          </>
        )}
        {!isHistory && !loading && !preview && (
          <>
            <Typography sx={{ mb: 2 }}>Every customer chain assigned to the current owner will move, including all linked Leads, Accounts, Deals, and Orders.</Typography>
            <TextField fullWidth select label="Current owner" value={source} onChange={(event) => setSource(event.target.value)} sx={{ mb: 2 }}>
              {sources.map((owner) => <MenuItem key={owner} value={owner}>{owner}</MenuItem>)}
            </TextField>
            <TextField fullWidth select label="New owner" value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>
              {users.map((user) => <MenuItem key={user.email} value={user.email} disabled={user.username.toLowerCase() === source.toLowerCase()}>{user.username} · {user.email}</MenuItem>)}
            </TextField>
          </>
        )}
        {preview && (
          <>
            <Typography><strong>{preview.source}</strong> → <strong>{preview.recipient}</strong></Typography>
            <Typography sx={{ mt: 1 }}>
              {preview.customers.length} customer chains · {Object.entries(typeLabels).map(([type, label]) => {
                const count = recordCounts[type] || 0;
                return `${count} ${label}${count === 1 ? "" : "s"}`;
              }).join(" · ")}
            </Typography>
            {preview.blockers.length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                Resolve these customer links before transferring. No records will move until the entire transfer can be confirmed.
                <List dense>
                  {preview.blockers.map((record, index) => (
                    <ListItem key={index} disableGutters>
                      <ListItemText primary={`${typeLabels[record.type]} · ${record.label || record.reference || "Unnamed record"}`} secondary={record.reason} />
                    </ListItem>
                  ))}
                </List>
              </Alert>
            )}
            <List>
              {preview.customers.map((customer) => (
                <ListItem key={customer.customer} disableGutters sx={{ display: "block" }}>
                  <Box component="details">
                    <Box component="summary" sx={{ cursor: "pointer" }}>
                      {customer.label} · {customer.records.length} records
                    </Box>
                    <List dense>
                      {customer.records.map((record, index) => (
                        <ListItem key={index}>
                          <ListItemText
                            primary={`${typeLabels[record.type]} · ${record.label}`}
                            secondary={[record.reference !== record.label && record.reference, `Current owner: ${record.owner || "Unassigned"}`].filter(Boolean).join(" · ")}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>{isHistory ? "Close" : "Cancel"}</Button>
        {preview && <Button onClick={() => setPreview(null)} disabled={busy}>Back</Button>}
        {!isHistory && (
          <Button variant="contained" onClick={advance} disabled={busy || loading || !source || !selectedUser || Boolean(preview && !preview.token)}>
            {busy ? "Working…" : preview ? "Confirm transfer" : "Review transfer"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export function useOwnershipActions(type, user, onTransferred) {
  const [canTransfer, setCanTransfer] = useState(false);
  const [selection, setSelection] = useState(null);
  const [notice, setNotice] = useState("");
  const userEmail = user?.email;
  useEffect(() => {
    setCanTransfer(false);
    if (!userEmail) return undefined;
    const controller = new AbortController();
    ownershipRequest("?action=capabilities", null, controller.signal)
      .then((data) => setCanTransfer(data.canTransfer === true))
      .catch(() => {});
    return () => controller.abort();
  }, [userEmail]);

  const actions = useCallback((row) => row._ownershipRecord && (
    <IconButton size="small" title="Ownership history" aria-label="Ownership history"
      onClick={() => setSelection({ mode: "history", key: row._ownershipRecord })}>
      <ManageHistoryIcon fontSize="small" />
    </IconButton>
  ), []);

  const transferButton = canTransfer && (
    <Button variant="outlined" size="small" startIcon={<SwapHorizIcon />} onClick={() => setSelection({ mode: "transfer" })}>
      Transfer by owner
    </Button>
  );

  const dialog = (
    <>
      {selection && <OwnershipDialog type={type} selection={selection} onClose={() => setSelection(null)}
        onTransferred={(count, recipient) => {
          setNotice(`Transferred ${count} ${count === 1 ? "record" : "records"} to ${recipient}.`);
          onTransferred?.();
        }} />}
      <Snackbar open={Boolean(notice)} message={notice} autoHideDuration={4500} onClose={() => setNotice("")} />
    </>
  );
  return { actions, dialog, transferButton };
}
