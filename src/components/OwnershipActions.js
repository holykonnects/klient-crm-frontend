import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  List, ListItem, ListItemText, Typography,
} from "@mui/material";
import ManageHistoryIcon from "@mui/icons-material/ManageHistory";

export const ownershipColumns = (row = {}) => Object.keys(row || {}).filter((field) => field !== "_ownershipRecord");

export async function ownershipRequest(path, body, signal) {
  const response = await fetch(`/api/ownership${path}`, body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal,
  } : { signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status === 401 ? "Sign in again to use ownership tools." : data.error || "Ownership information is unavailable.");
  return data;
}

function OwnershipHistoryDialog({ type, recordKey, onClose }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ action: "history", type, recordKey });
    ownershipRequest(`?${query}`, null, controller.signal)
      .then(setHistory)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, [type, recordKey]);

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Ownership history</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error">{error}</Alert>}
        {!error && !history && <Typography role="status">Loading…</Typography>}
        {history && (
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
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}

export function useOwnershipHistory(type) {
  const [recordKey, setRecordKey] = useState("");

  const actions = useCallback((row) => row._ownershipRecord && (
    <IconButton size="small" title="Ownership history" aria-label="Ownership history"
      onClick={() => setRecordKey(row._ownershipRecord)}>
      <ManageHistoryIcon fontSize="small" />
    </IconButton>
  ), []);

  const dialog = recordKey && (
    <OwnershipHistoryDialog type={type} recordKey={recordKey} onClose={() => setRecordKey("")} />
  );
  return { actions, dialog };
}
