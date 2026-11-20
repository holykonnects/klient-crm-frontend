import React, { Fragment, useEffect, useState } from "react";
import {
  Alert, Box, Button, List, ListItem, ListItemText, MenuItem, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography, createTheme, ThemeProvider,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { CRM_TABLE_SX } from "../utils/crmTableUtils";
import { ownershipRequest } from "./OwnershipActions";

const theme = createTheme({ typography: { fontFamily: "Montserrat, sans-serif", fontSize: 10.5 } });
const typeLabels = { leads: "Lead", accounts: "Account", deals: "Deal", orders: "Order" };

function TransferPreview({ preview }) {
  const [expanded, setExpanded] = useState(() => new Set());

  function toggle(customer) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(customer)) next.delete(customer);
      else next.add(customer);
      return next;
    });
  }

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
      {preview.customers.length > 0 && (
        <Box className="crm-table-shell">
          <Table size="small" aria-label="Records in this transfer" sx={CRM_TABLE_SX}>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Customer / record</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>Current owner</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {preview.customers.map((customer) => {
                const open = expanded.has(customer.customer);
                return (
                  <Fragment key={customer.customer}>
                    <TableRow hover>
                      <TableCell colSpan={4}>
                        <Button
                          type="button"
                          size="small"
                          color="inherit"
                          aria-expanded={open}
                          onClick={() => toggle(customer.customer)}
                          startIcon={open ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                          sx={{ textTransform: "none", fontSize: "inherit", px: 0.5 }}
                        >
                          {customer.label} · {customer.records.length} records
                        </Button>
                      </TableCell>
                    </TableRow>
                    {open && customer.records.map((record, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{typeLabels[record.type]}</TableCell>
                        <TableCell>{record.label}</TableCell>
                        <TableCell>{record.reference !== record.label ? record.reference : ""}</TableCell>
                        <TableCell>{record.owner || "Unassigned"}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
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
    <ThemeProvider theme={theme}>
      <Box padding={4}>
        <Box className="crm-page-header" display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <img className="crm-primary-logo" src="/assets/rido-sports-logo.png" alt="Rido Sports" />
          <Typography component="h1" variant="h5" fontWeight="bold">Ownership Transfer</Typography>
        </Box>
        <Stack component="form" onSubmit={submit} spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {receipt && (
            <Alert severity="success">
              Transferred {receipt.count} linked {receipt.count === 1 ? "record" : "records"} across {receipt.customers} customer {receipt.customers === 1 ? "chain" : "chains"} to {receipt.owner}.
            </Alert>
          )}
          {!error && !options && <Typography role="status">Loading owners…</Typography>}
          {options && !preview && (options.sources.length === 0 ? (
            <Alert severity="info">There are no assigned records to transfer.</Alert>
          ) : (
            <Box className="crm-filter-bar" display="flex" gap={2} flexWrap="wrap" alignItems="center">
              <TextField size="small" select disabled={busy} label="Current owner" value={source} onChange={changeSource} sx={{ minWidth: 200 }}>
                {options.sources.map((owner) => <MenuItem key={owner} value={owner}>{owner}</MenuItem>)}
              </TextField>
              <TextField size="small" select disabled={busy} label="New owner" value={recipient} onChange={(event) => setRecipient(event.target.value)} sx={{ minWidth: 200 }}>
                {options.users.map((user) => (
                  <MenuItem key={user.email} value={user.email} disabled={user.username.toLowerCase() === source.toLowerCase()}>
                    {user.username} · {user.email}
                  </MenuItem>
                ))}
              </TextField>
              <Button type="submit" size="small" variant="contained" disabled={busy || !source || !recipient}>
                {busy ? "Working…" : "Review transfer"}
              </Button>
            </Box>
          ))}
          {preview && (
            <>
              <TransferPreview preview={preview} />
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button type="button" size="small" onClick={() => { setPreview(null); setError(""); }} disabled={busy}>Back</Button>
                <Button type="submit" size="small" variant="contained" disabled={busy || !preview.token}>
                  {busy ? "Working…" : "Confirm transfer"}
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </Box>
    </ThemeProvider>
  );
}
