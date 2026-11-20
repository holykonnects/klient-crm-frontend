import React, { useEffect, useState } from "react";
import {
  Alert, Box, Button, List, ListItem, ListItemText, MenuItem, Paper, Stack, TextField, Typography,
} from "@mui/material";
import { ownershipRequest } from "./OwnershipActions";

const typeLabels = { leads: "Lead", accounts: "Account", deals: "Deal", orders: "Order" };

function TransferPreview({ preview }) {
  const counts = preview.customers.reduce((totals, customer) => {
    for (const { type } of customer.records) totals[type] = (totals[type] || 0) + 1;
    return totals;
  }, {});

  return (
    <Stack spacing={2}>
      <Typography component="h2" variant="h6">Review transfer</Typography>
      <Typography><strong>{preview.source}</strong> → <strong>{preview.recipient}</strong></Typography>
      <Typography color="text.secondary">
        {preview.customers.length} customer {preview.customers.length === 1 ? "chain" : "chains"} · {Object.entries(typeLabels).map(([type, label]) => {
          const count = counts[type] || 0;
          return `${count} ${label}${count === 1 ? "" : "s"}`;
        }).join(" · ")}
      </Typography>
      {preview.blockers.length > 0 && (
        <Alert severity="error">
          Resolve these customer links before confirming the transfer.
          <List dense>
            {preview.blockers.map((record, index) => (
              <ListItem key={index} disableGutters>
                <ListItemText primary={`${typeLabels[record.type]} · ${record.label || record.reference || "Unnamed record"}`} secondary={record.reason} />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}
      <List disablePadding>
        {preview.customers.map((customer) => (
          <ListItem key={customer.customer} disableGutters divider sx={{ display: "block" }}>
            <Box component="details">
              <Box component="summary" sx={{ cursor: "pointer", py: 1 }}>
                {customer.label} · {customer.records.length} records
              </Box>
              <List dense>
                {customer.records.map((record, index) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={`${typeLabels[record.type]} · ${record.label}`}
                      secondary={[
                        record.reference !== record.label && record.reference,
                        `Current owner: ${record.owner || "Unassigned"}`,
                      ].filter(Boolean).join(" · ")}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}

export default function OwnershipTransferPage() {
  const [options, setOptions] = useState(null);
  const [optionsVersion, refreshOptions] = useState(0);
  const [source, setSource] = useState("");
  const [recipient, setRecipient] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    ownershipRequest("", { action: "options" }, controller.signal)
      .then(setOptions)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, [optionsVersion]);

  function changeSource(event) {
    const next = event.target.value;
    setSource(next);
    if (options.users.some((user) => user.email === recipient && user.username.toLowerCase() === next.toLowerCase())) {
      setRecipient("");
    }
    setReceipt(null);
  }

  async function submit(event) {
    event.preventDefault();
    if (busy || !source || !recipient || (preview && !preview.token)) return;
    setBusy(true);
    setError("");
    setReceipt(null);
    try {
      if (!preview) {
        setPreview(await ownershipRequest("", { action: "preview", source, recipient }));
      } else {
        const result = await ownershipRequest("", { action: "confirm", token: preview.token });
        setReceipt({ ...result, owner: preview.recipient });
        setPreview(null);
        setSource("");
        setRecipient("");
        setOptions(null);
        refreshOptions((version) => version + 1);
      }
    } catch (err) {
      setError(err.message);
      if (preview) setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 1, sm: 2 }, py: { xs: 2, sm: 4 } }}>
      <Typography component="h1" variant="h4" fontWeight={700} sx={{ mb: 2 }}>Ownership Transfer</Typography>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack component="form" onSubmit={submit} spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {receipt && (
            <Alert severity="success">
              Transferred {receipt.count} linked {receipt.count === 1 ? "record" : "records"} across {receipt.customers} customer {receipt.customers === 1 ? "chain" : "chains"} to {receipt.owner}.
            </Alert>
          )}
          {!error && !options && <Typography role="status">Loading owners…</Typography>}
          {options && !preview && (
            <>
              <Typography>Move an owner’s linked Leads, Accounts, Deals, and Orders together.</Typography>
              {options.sources.length === 0 ? (
                <Alert severity="info">There are no assigned records to transfer.</Alert>
              ) : (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField fullWidth select disabled={busy} label="Current owner" value={source} onChange={changeSource}>
                    {options.sources.map((owner) => <MenuItem key={owner} value={owner}>{owner}</MenuItem>)}
                  </TextField>
                  <TextField fullWidth select disabled={busy} label="New owner" value={recipient} onChange={(event) => setRecipient(event.target.value)}>
                    {options.users.map((user) => (
                      <MenuItem key={user.email} value={user.email} disabled={user.username.toLowerCase() === source.toLowerCase()}>
                        {user.username} · {user.email}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              )}
            </>
          )}
          {preview && <TransferPreview preview={preview} />}
          {options && options.sources.length > 0 && (
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              {preview && <Button type="button" onClick={() => { setPreview(null); setError(""); }} disabled={busy}>Back</Button>}
              <Button type="submit" variant="contained" disabled={busy || !source || !recipient || Boolean(preview && !preview.token)}>
                {busy ? "Working…" : preview ? "Confirm transfer" : "Review transfer"}
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
