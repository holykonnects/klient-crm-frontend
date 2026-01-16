// src/components/OrdersTable.js
import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Checkbox,
  Button,
  Popover,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormGroup,
  FormControlLabel,
  Divider,
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import "@fontsource/montserrat";

import LoadingOverlay from "./LoadingOverlay";
import { useAuth } from "./AuthContext";

const theme = createTheme({
  typography: {
    fontFamily: "Montserrat, sans-serif",
    fontSize: 9,
  },
});

const selectorStyle = {
  fontFamily: "Montserrat, sans-serif",
  fontSize: 8,
};

const parseDDMMYYYY_HHMMSS = (ts) => {
  if (!ts) return 0;
  const raw = String(ts).trim();
  const [dPart, tPart] = raw.split(" ");
  if (!dPart) return 0;

  const [dd, mm, yyyy] = dPart.split("-").map((x) => parseInt(x, 10));
  const [HH = 0, MM = 0, SS = 0] = (tPart || "0:0:0").split(":").map((x) => parseInt(x, 10));

  if (!dd || !mm || !yyyy) return 0;
  const dt = new Date(yyyy, mm - 1, dd, HH, MM, SS);
  const t = dt.getTime();
  return Number.isFinite(t) ? t : 0;
};

const isUrl = (v) => typeof v === "string" && /^https?:\/\//i.test(v);

/**
 * Read response safely (JSON or text) so UI can show real backend errors.
 */
async function safeReadResponse(res) {
  const txt = await res.text();
  try {
    return { okParse: true, json: JSON.parse(txt), raw: txt };
  } catch {
    return { okParse: false, json: null, raw: txt };
  }
}

function OrdersTable() {
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "asc" });

  // column selector
  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);

  // edit modal
  const [selectedRow, setSelectedRow] = useState(null);
  const [orderFormData, setOrderFormData] = useState({});
  const [validationData, setValidationData] = useState({});
  const [saving, setSaving] = useState(false);

  // logs modal
  const [logsOpen, setLogsOpen] = useState(false);
  const [orderLogs, setOrderLogs] = useState([]);

  // files (optional updates)
  const [orderFiles, setOrderFiles] = useState({
    purchaseOrder: null,
    drawing: null,
    boq: null,
    proforma: null,
  });

  const { user } = useAuth();
  const username = user?.username;
  const role = user?.role;

  // Orders read webapp
  const dataUrl =
    "https://script.google.com/macros/s/AKfycbznNnYHMwtflHMpomewXf3bwh696WyZUYjJFQ2Vpw8J9nJRetR8RdY8BzLC-MkmHeSf/exec";

  // Submit webapp (same as deals submitUrl; supports updateOrder)
  const submitUrl =
    "https://script.google.com/macros/s/AKfycbxZ87qfE6u-2jT8xgSlYJu5dG6WduY0lG4LmlXSOk2EGkWBH4CbZIwEJxEHI-Bmduoh/exec";

  // Validation webapp
  const validationUrl =
    "https://script.google.com/macros/s/AKfycbyaSwpMpH0RCTQkgwzme0N5WYgNP9aERhQs7mQCFX3CvBBFARne_jsM5YW6L705TdET/exec";

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(dataUrl);
      const data = await res.json();

      const filtered =
        role === "End User"
          ? data.filter((d) => [d["Account Owner"], d["Lead Owner"], d["Owner"]].includes(username))
          : data;

      setAllOrders(filtered);

      // ✅ latest by Order ID
      const seen = new Map();
      filtered.forEach((row) => {
        const key = row["Order ID"] || "";
        if (!key) return;

        const existing = seen.get(key);
        const tNew = parseDDMMYYYY_HHMMSS(row["Timestamp"]);
        const tOld = parseDDMMYYYY_HHMMSS(existing?.["Timestamp"]);
        if (!existing || tNew > tOld) seen.set(key, row);
      });

      const deduped = Array.from(seen.values()).sort(
        (a, b) => parseDDMMYYYY_HHMMSS(b["Timestamp"]) - parseDDMMYYYY_HHMMSS(a["Timestamp"])
      );

      setOrders(deduped);

      setVisibleColumns(
        JSON.parse(localStorage.getItem(`visibleColumns-${username}-orders`)) ||
          (deduped.length ? Object.keys(deduped[0]) : [])
      );
    } catch (e) {
      console.error("Orders fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetch(validationUrl)
      .then((r) => r.json())
      .then(setValidationData)
      .catch((e) => console.error("Validation fetch error:", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, role]);

  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction });
  };

  const sortedOrders = [...orders].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key] || "";
    const bVal = b[sortConfig.key] || "";
    return sortConfig.direction === "asc"
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const filteredOrders = sortedOrders.filter((order) => {
    try {
      return (
        ["Company", "Order ID", "Mobile Number", "Deal Name", "Account ID"].some((key) =>
          String(order[key] || "").toLowerCase().includes(searchTerm.toLowerCase())
        ) &&
        (!filterStage || order["Stage"] === filterStage) &&
        (!filterType || order["Type"] === filterType) &&
        (!filterSource || order["Lead Source"] === filterSource) &&
        (!filterOwner || order["Account Owner"] === filterOwner)
      );
    } catch {
      return false;
    }
  });

  const unique = (key) => [...new Set(orders.map((d) => d[key]).filter(Boolean))];

  const handleColumnToggle = (col) => {
    setVisibleColumns((prev) => {
      const updated = prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col];
      localStorage.setItem(`visibleColumns-${username}-orders`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelectAll = () => {
    const all = Object.keys(orders[0] || {});
    setVisibleColumns(all);
    localStorage.setItem(`visibleColumns-${username}-orders`, JSON.stringify(all));
  };

  const handleDeselectAll = () => {
    setVisibleColumns([]);
    localStorage.setItem(`visibleColumns-${username}-orders`, JSON.stringify([]));
  };

  const renderCell = (col, value) => {
    const fileCols = ["Attach Purchase Order", "Attach Drawing", "Attach BOQ", "Proforma Invoice"];
    if (fileCols.includes(col) && isUrl(value)) {
      return (
        <a href={value} target="_blank" rel="noreferrer">
          Open
        </a>
      );
    }
    return value || "";
  };

  // open edit
  const handleEditClick = (row) => {
    setSelectedRow(row);
    setOrderFormData({ ...(row || {}) });
    setOrderFiles({ purchaseOrder: null, drawing: null, boq: null, proforma: null });
  };

  // logs (FULL ROW)
  const handleViewLogs = (row) => {
    const key = row["Order ID"];
    if (!key) {
      alert("No Order ID found for logs.");
      return;
    }
    const logs = allOrders
      .filter((r) => r["Order ID"] === key)
      .sort((a, b) => parseDDMMYYYY_HHMMSS(b["Timestamp"]) - parseDDMMYYYY_HHMMSS(a["Timestamp"]));
    setOrderLogs(logs);
    setLogsOpen(true);
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setOrderFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleOrderFileChange = (key) => (e) => {
    const file = e.target.files?.[0] || null;
    setOrderFiles((prev) => ({ ...prev, [key]: file }));
  };

  /**
   * Convert browser File -> backend fileObj (adds size + label for better backend logging & naming)
   */
  const fileToBase64 = (file, label) => {
    if (!file) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = String(reader.result || "");
        const base64 = res.split("base64,")[1] || "";
        resolve({
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size || 0,
          label: label || "",
          base64,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmitOrderUpdate = async () => {
    if (!orderFormData?.["Order ID"]) {
      alert("❌ Order ID missing. Cannot update.");
      return;
    }

    setSaving(true);
    try {
      const poObj = await fileToBase64(orderFiles.purchaseOrder, "Attach Purchase Order");
      const drawingObj = await fileToBase64(orderFiles.drawing, "Attach Drawing");
      const boqObj = await fileToBase64(orderFiles.boq, "Attach BOQ");
      const proformaObj = await fileToBase64(orderFiles.proforma, "Proforma Invoice");

      const payload = { ...orderFormData };
      if (poObj) payload["Attach Purchase Order"] = poObj;
      if (drawingObj) payload["Attach Drawing"] = drawingObj;
      if (boqObj) payload["Attach BOQ"] = boqObj;
      if (proformaObj) payload["Proforma Invoice"] = proformaObj;

      // IMPORTANT:
      // - keep Content-Type text/plain to avoid OPTIONS preflight.
      // - do NOT use mode:no-cors if you want real success/error feedback.
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "updateOrder", data: payload }),
      });

      const parsed = await safeReadResponse(res);

      // Expect backend to return JSON: { ok: true } or { ok:false, error:"..." }
      const ok = parsed.okParse && parsed.json && parsed.json.ok === true;

      if (!ok) {
        const msg =
          (parsed.okParse && parsed.json && (parsed.json.error || parsed.json.message)) ||
          parsed.raw ||
          "Unknown error";
        throw new Error(msg);
      }

      alert("✅ Order updated successfully (log appended).");
      setSelectedRow(null);
      fetchOrders();
    } catch (e) {
      console.error("Update order error:", e);
      alert(`❌ Error updating order:\n${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const logHeaders = orderLogs?.[0] ? Object.keys(orderLogs[0]) : [];
  const logCols = logHeaders.length ? logHeaders : [];

  if (loading) return <LoadingOverlay />;

  return (
    <ThemeProvider theme={theme}>
      <Box padding={4}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
          <Typography variant="h5" fontWeight="bold">
            Orders Records
          </Typography>
        </Box>

        {/* Filters */}
        <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
          <TextField
            label="Search"
            variant="outlined"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />

          {["Stage", "Type", "Lead Source", "Account Owner"].map((label, index) => (
            <FormControl size="small" sx={{ minWidth: 200 }} key={index}>
              <InputLabel>{label}</InputLabel>
              <Select
                value={
                  label === "Stage"
                    ? filterStage
                    : label === "Type"
                    ? filterType
                    : label === "Lead Source"
                    ? filterSource
                    : filterOwner
                }
                onChange={(e) => {
                  if (label === "Stage") setFilterStage(e.target.value);
                  else if (label === "Type") setFilterType(e.target.value);
                  else if (label === "Lead Source") setFilterSource(e.target.value);
                  else setFilterOwner(e.target.value);
                }}
                label={label}
              >
                <MenuItem value="">All</MenuItem>
                {unique(label).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}

          {/* Column selector */}
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <ViewColumnIcon />
          </IconButton>

          <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
            <Box p={2} sx={selectorStyle}>
              <Typography variant="subtitle2">Column Visibility</Typography>
              <Button onClick={handleSelectAll}>Select All</Button>
              <Button onClick={handleDeselectAll}>Deselect All</Button>
              <FormGroup>
                {(orders[0] ? Object.keys(orders[0]) : []).map((col) => (
                  <FormControlLabel
                    key={col}
                    control={
                      <Checkbox
                        checked={visibleColumns.includes(col)}
                        onChange={() => handleColumnToggle(col)}
                      />
                    }
                    label={col}
                  />
                ))}
              </FormGroup>
            </Box>
          </Popover>
        </Box>

        {/* Table */}
        <Table>
          <TableHead>
            <TableRow style={{ backgroundColor: "#6495ED" }}>
              {visibleColumns.map((header) => (
                <TableCell
                  key={header}
                  onClick={() => handleSort(header)}
                  style={{ color: "white", cursor: "pointer", fontWeight: "bold" }}
                >
                  {header}{" "}
                  {sortConfig.key === header ? (sortConfig.direction === "asc" ? "↑" : "↓") : ""}
                </TableCell>
              ))}
              <TableCell style={{ color: "white", fontWeight: "bold" }}>Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredOrders.map((order, index) => (
              <TableRow key={index}>
                {visibleColumns.map((col, i) => (
                  <TableCell key={i}>{renderCell(col, order[col])}</TableCell>
                ))}
                <TableCell>
                  <IconButton onClick={() => handleEditClick(order)} title="Edit / Update Order">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleViewLogs(order)} title="View Logs">
                    <HistoryIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* -------------------- EDIT / UPDATE ORDER MODAL -------------------- */}
        <Dialog open={!!selectedRow} onClose={() => setSelectedRow(null)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            Edit / Update Order
          </DialogTitle>

          <DialogContent dividers>
            {[
              {
                title: "Order Details",
                fields: [
                  "Order ID",
                  "Product Required",
                  "Order Amount",
                  "Order Payment Terms",
                  "Order Onsite Contact Name",
                  "Order Onsite Contact Number",
                  "Order Onsite Contact Role",
                  "Order Delivery Date",
                  "Order Remarks",
                  "Order Update",
                  "Attach Purchase Order",
                  "Attach Drawing",
                  "Attach BOQ",
                  "Proforma Invoice",
                ],
              },
              {
                title: "Payment Details",
                fields: ["Payment Status", "Payment Amount", "Payment Details", "Notification Status"],
              },
            ].map((section) => (
              <Accordion key={section.title} defaultExpanded>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ backgroundColor: "#f0f4ff", fontFamily: "Montserrat, sans-serif" }}
                >
                  <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                    {section.title}
                  </Typography>
                </AccordionSummary>

                <AccordionDetails>
                  <Grid container spacing={2}>
                    {section.fields.map((field) => (
                      <Grid item xs={6} key={field}>
                        {["Attach Purchase Order", "Attach Drawing", "Attach BOQ", "Proforma Invoice"].includes(
                          field
                        ) ? (
                          <TextField
                            fullWidth
                            size="small"
                            label={field}
                            value={orderFormData[field] || ""}
                            disabled
                          />
                        ) : validationData[field] ? (
                          <FormControl fullWidth size="small">
                            <InputLabel>{field}</InputLabel>
                            <Select
                              name={field}
                              value={orderFormData[field] || ""}
                              label={field}
                              onChange={handleFieldChange}
                              disabled={field === "Order ID"}
                            >
                              {validationData[field].map((opt, idx) => (
                                <MenuItem key={idx} value={opt}>
                                  {opt}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : (
                          <TextField
                            fullWidth
                            size="small"
                            name={field}
                            label={field}
                            value={orderFormData[field] || ""}
                            onChange={handleFieldChange}
                            disabled={field === "Order ID"}
                            type={field === "Order Delivery Date" ? "date" : "text"}
                            InputLabelProps={field === "Order Delivery Date" ? { shrink: true } : undefined}
                          />
                        )}
                      </Grid>
                    ))}
                  </Grid>

                  {/* Attachments UI */}
                  {section.title === "Order Details" && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography
                        sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, mb: 1 }}
                      >
                        Attachments (upload new only if you want to replace)
                      </Typography>

                      <Grid container spacing={2}>
                        {[
                          ["purchaseOrder", "Replace Purchase Order"],
                          ["drawing", "Replace Drawing"],
                          ["boq", "Replace BOQ"],
                          ["proforma", "Replace Proforma Invoice"],
                        ].map(([key, label]) => (
                          <Grid item xs={6} key={key}>
                            <Button variant="outlined" component="label" fullWidth>
                              {label}
                              {orderFiles[key] ? `: ${orderFiles[key].name}` : ""}
                              <input hidden type="file" onChange={handleOrderFileChange(key)} />
                            </Button>
                          </Grid>
                        ))}
                      </Grid>
                    </>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setSelectedRow(null)}>Cancel</Button>
            <Button
              variant="contained"
              sx={{ backgroundColor: "#6495ED" }}
              onClick={handleSubmitOrderUpdate}
              disabled={saving}
            >
              {saving ? "Updating..." : "Update Order"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* -------------------- ORDER LOGS MODAL (FULL ROW) -------------------- */}
        <Dialog open={logsOpen} onClose={() => setLogsOpen(false)} maxWidth="xl" fullWidth>
          <DialogTitle sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            Order Change Logs (Full Row)
          </DialogTitle>
          <DialogContent dividers>
            {orderLogs.length === 0 ? (
              <Typography>No logs found.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow style={{ backgroundColor: "#6495ED" }}>
                    {logCols.map((h) => (
                      <TableCell key={h} style={{ color: "white", fontWeight: 700 }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orderLogs.map((log, idx) => (
                    <TableRow key={idx}>
                      {logCols.map((h) => (
                        <TableCell key={h}>{renderCell(h, log[h])}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLogsOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default OrdersTable;
