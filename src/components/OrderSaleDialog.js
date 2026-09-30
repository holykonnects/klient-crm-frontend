import React, { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, Grid, InputLabel, MenuItem, Select, TextField,
} from "@mui/material";
import { buildOrderSalePrefill, salesTrackerOrderLabel } from "../utils/salesTrackerPrefill";

const SALES_API = "/api/sales-tracker";
const ENTITY_TYPES = ["Account", "Deal", "Order"];
const ENTITY_FIELD_ALIASES = ["Field", "Linked Entity Type", "Entity Type", "Source Type"];
const ENTITY_SELECTION_ALIASES = ["Field Selection", "Linked Entity", "Linked Entity Name", "Entity Selection"];
const inputSx = { fontFamily: "Montserrat, sans-serif", fontSize: 12 };
const clean = (value) => String(value ?? "").trim();
const normalize = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
const numberValue = (value) => Number(String(value ?? "").replace(/[₹,\s]/g, "")) || 0;
const unique = (values) => [...new Set(values.map(clean).filter(Boolean))];
const joinLabel = (parts) => parts.map(clean).filter(Boolean).join(" - ");

function findColumn(columns, aliases, fallback) {
  const normalizedAliases = new Set(aliases.map(normalize));
  return columns.find((column) => normalizedAliases.has(normalize(column))) || fallback;
}

function ensureEntityColumns(columns) {
  const next = [...columns];
  if (!next.some((column) => ENTITY_FIELD_ALIASES.map(normalize).includes(normalize(column)))) next.push("Field");
  if (!next.some((column) => ENTITY_SELECTION_ALIASES.map(normalize).includes(normalize(column)))) next.push("Field Selection");
  return next;
}

function accountLabel(row = {}) {
  return joinLabel([row["Account ID"] || row["Lead ID"], row.Company, [row["First Name"], row["Last Name"]].map(clean).filter(Boolean).join(" ")]);
}

function dealLabel(row = {}) {
  return joinLabel([row["Deal ID"], row["Deal Name"], row.Company]);
}

function fieldType(field = "") {
  if (/date/i.test(field)) return "date";
  if (/amount|value|quantity/i.test(field)) return "number";
  return "text";
}

export default function OrderSaleDialog({ open, order, user, onClose }) {
  const [columns, setColumns] = useState([]);
  const [validationOptions, setValidationOptions] = useState({});
  const [entityRecords, setEntityRecords] = useState({ Account: [], Deal: [], Order: [] });
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !order) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      fetch(`${SALES_API}?action=getData&sheetName=Sheet1`).then((response) => response.ok ? response.json() : Promise.reject(new Error("Sales Tracker could not be loaded"))),
      fetch(`${SALES_API}?action=getValidationOptions&sheetName=Sales%20Tracker%20Validation%20Tables`).then((response) => response.ok ? response.json() : {}),
      fetch("/api/accounts").then((response) => response.ok ? response.json() : []),
      fetch("/api/deals").then((response) => response.ok ? response.json() : []),
      fetch("/api/orders").then((response) => response.ok ? response.json() : []),
    ]).then(([sales, validations, accounts, deals, orders]) => {
      if (cancelled) return;
      const rows = Array.isArray(sales) ? sales : [];
      const nextColumns = ensureEntityColumns(Object.keys(rows[0] || {}));
      if (!nextColumns.length) throw new Error("Sales Tracker has no available fields");
      const entityFieldColumn = findColumn(nextColumns, ENTITY_FIELD_ALIASES, "Field");
      const entitySelectionColumn = findColumn(nextColumns, ENTITY_SELECTION_ALIASES, "Field Selection");
      const nextSNo = rows.reduce((max, row) => Math.max(max, numberValue(row["S.No"] || row["S No"])), 0) + 1;
      const initial = Object.fromEntries(nextColumns.map((column) => [column, ""]));
      const serialColumn = nextColumns.includes("S.No") ? "S.No" : nextColumns.includes("S No") ? "S No" : "S.No";
      initial[serialColumn] = String(nextSNo);
      Object.assign(initial, buildOrderSalePrefill({
        order,
        user,
        columns: nextColumns,
        entityFieldColumn,
        entitySelectionColumn,
      }));
      setColumns(nextColumns);
      setValidationOptions(validations || {});
      setEntityRecords({
        Account: Array.isArray(accounts) ? accounts : [],
        Deal: Array.isArray(deals) ? deals : [],
        Order: Array.isArray(orders) ? orders : [],
      });
      setFormData(initial);
    }).catch((loadError) => {
      if (!cancelled) setError(loadError.message || "Sales Tracker could not be loaded");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, order, user]);

  const entityFieldColumn = useMemo(() => findColumn(columns, ENTITY_FIELD_ALIASES, "Field"), [columns]);
  const entitySelectionColumn = useMemo(() => findColumn(columns, ENTITY_SELECTION_ALIASES, "Field Selection"), [columns]);
  const entityOptions = useMemo(() => ({
    Account: unique(entityRecords.Account.map(accountLabel)),
    Deal: unique(entityRecords.Deal.map(dealLabel)),
    Order: unique(entityRecords.Order.map(salesTrackerOrderLabel)),
  }), [entityRecords]);
  const selectedType = clean(formData[entityFieldColumn]);
  const selectionOptions = entityOptions[selectedType] || [];
  const selectedEntity = formData[entitySelectionColumn] || "";
  const modalColumns = columns.filter((field) => field !== entityFieldColumn && field !== entitySelectionColumn);

  const changeField = (field, value) => setFormData((current) => ({
    ...current,
    [field]: value,
    ...(field === entityFieldColumn ? { [entitySelectionColumn]: "" } : {}),
    ...(field === entityFieldColumn && columns.includes("Account / Deal / Order") ? { "Account / Deal / Order": "" } : {}),
    ...(field === entitySelectionColumn && columns.includes("Account / Deal / Order") ? { "Account / Deal / Order": value } : {}),
  }));

  const submit = async () => {
    setSubmitting(true);
    setError("");
    const timestamp = new Date().toLocaleString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
    const payload = {
      ...formData,
      mode: "add",
      Timestamp: formData.Timestamp || timestamp,
      updatedByName: user?.username || user?.email || "",
      updatedByEmail: user?.email || user?.username || "",
    };
    try {
      const response = await fetch(SALES_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await response.text() || "Sale could not be added");
      alert("✅ Sale added successfully");
      onClose();
    } catch (submitError) {
      setError(submitError.message || "Sale could not be added");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => { if (reason !== "backdropClick" && !submitting) onClose(); }}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown
    >
      <DialogTitle sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>Add Sale from Order</DialogTitle>
      <DialogContent dividers sx={{ p: 2 }}>
        {loading ? <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}><CircularProgress size={28} /></Box> : null}
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {!loading && columns.length ? <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel sx={inputSx}>Link Sale To</InputLabel>
              <Select value={selectedType} label="Link Sale To" onChange={(event) => changeField(entityFieldColumn, event.target.value)} sx={inputSx}>
                {ENTITY_TYPES.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small" disabled={!selectedType}>
              <InputLabel sx={inputSx}>{selectedType ? `Select ${selectedType}` : "Select Account / Deal / Order"}</InputLabel>
              <Select value={selectedEntity} label={selectedType ? `Select ${selectedType}` : "Select Account / Deal / Order"} onChange={(event) => changeField(entitySelectionColumn, event.target.value)} sx={inputSx}>
                {selectedEntity && !selectionOptions.includes(selectedEntity) ? <MenuItem value={selectedEntity}>{selectedEntity}</MenuItem> : null}
                {selectionOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          {modalColumns.map((field) => {
            const isSerial = field === "S.No" || field === "S No";
            const options = validationOptions[field] || [];
            return <Grid item xs={12} sm={6} key={field}>
              {options.length ? <FormControl fullWidth size="small">
                <InputLabel sx={inputSx}>{field}</InputLabel>
                <Select value={formData[field] || ""} label={field} onChange={(event) => changeField(field, event.target.value)} sx={inputSx}>
                  {formData[field] && !options.includes(formData[field]) ? <MenuItem value={formData[field]}>{formData[field]}</MenuItem> : null}
                  {options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                </Select>
              </FormControl> : <TextField
                fullWidth
                size="small"
                label={field}
                value={formData[field] || ""}
                onChange={(event) => changeField(field, event.target.value)}
                type={fieldType(field)}
                InputProps={{ readOnly: isSerial, sx: inputSx }}
                InputLabelProps={{ shrink: fieldType(field) === "date" || undefined, sx: inputSx }}
              />}
            </Grid>;
          })}
        </Grid> : null}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={loading || submitting || !columns.length}>
          {submitting ? "Submitting..." : "Submit Sale"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
