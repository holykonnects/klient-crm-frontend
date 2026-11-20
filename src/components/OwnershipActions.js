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
  const [history, setHistory] = useState(null);
  const [selectedUser, setSelectedUser] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ action: "history", type, recordKey: selection.key });
    const request = isHistory ? ownershipRequest(`?${params}`, null, controller.signal) :
      ownershipRequest("", { action: "recipients" }, controller.signal);
    request.then((result) => {
      if (isHistory) setHistory(result);
      else setUsers(result.users);
    }).catch((err) => {
      if (err.name !== "AbortError") setError(err.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [isHistory, selection.key, type]);

  async function advance() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!preview) {
        const result = await ownershipRequest("", { action: "preview", type, recordKey: selection.key, recipient: selectedUser });
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
      <DialogTitle>{isHistory ? "Ownership history" : preview ? "Confirm ownership transfer" : "Transfer customer ownership"}</DialogTitle>
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
            <Typography sx={{ mb: 2 }}>This moves the customer’s linked Leads, Accounts, Deals, and Orders to the new owner.</Typography>
            <TextField fullWidth select label="New owner" value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>
              {users.map((user) => <MenuItem key={user.email} value={user.email}>{user.username} · {user.email}</MenuItem>)}
            </TextField>
          </>
        )}
        {preview && (
          <>
            <Typography><strong>{preview.recipient}</strong> will own these {preview.records.length} records.</Typography>
            <List>
              {preview.records.map((record, index) => (
                <ListItem key={index} disableGutters>
                  <ListItemText
                    primary={`${typeLabels[record.type]} · ${record.label}`}
                    secondary={[record.reference !== record.label && record.reference, `Current owner: ${record.owner || "Unassigned"}`].filter(Boolean).join(" · ")}
                  />
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
          <Button variant="contained" onClick={advance} disabled={busy || loading || !selectedUser}>
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
    <Box component="span">
      {canTransfer && (
        <IconButton size="small" title="Transfer ownership" aria-label="Transfer ownership"
          onClick={() => setSelection({ mode: "transfer", key: row._ownershipRecord })}>
          <SwapHorizIcon fontSize="small" />
        </IconButton>
      )}
      <IconButton size="small" title="Ownership history" aria-label="Ownership history"
        onClick={() => setSelection({ mode: "history", key: row._ownershipRecord })}>
        <ManageHistoryIcon fontSize="small" />
      </IconButton>
    </Box>
  ), [canTransfer]);

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
  return { actions, dialog };
}
