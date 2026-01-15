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

  // Orders read webapp (existing)
  const dataUrl =
    "https://script.google.com/macros/s/AKfycbznNnYHMwtflHMpomewXf3bwh696WyZUYjJFQ2Vpw8J9nJRetR8RdY8BzLC-MkmHeSf/exec";

  // Submit webapp (same as deals submitUrl, now supports updateOrder)
  const submitUrl =
    "https://script.google.com/macros/s/AKfycbxZ87qfE6u-2jT8xgSlYJu5dG6WduY0lG4LmlXSOk2EGkWBH4CbZIwEJxEHI-Bmduoh/exec";

  // Validation webapp (same as deals)
  const validationUrl =
    "https://script.google.com/macros/s/AKfycbyaSwpMpH0RCTQkgwzme0N5WYgNP9aERhQs7mQCFX3CvBBFARne_jsM5YW6L705TdET/exec";

  const safeTime = (x) => {
    const t = new Date(x || 0).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(dataUrl);
      const data = await res.json();

      const filtered =
        role === "End User"
          ? data.filter((d) =>
              [d["Account Owner"], d["Lead Owner"], d["Owner"]].includes(username)
            )
          : data;

      setAllOrders(filtered);

      // ✅ DEDUPE BY Order ID (latest row only)
      const seen = new Map();
      filtered.forEach((row) => {
        const key = row["Order ID"] || row["Deal Name"] || row["Account ID"] || JSON.stringify(row);
        const existing = seen.get(key);
        const tNew = safeTime(row["Timestamp"]);
        const tOld = safeTime(existing?.["Timestamp"]);
        if (!existing || tNew > tOld) seen.set(key, row);
      });

      // ✅ Show latest rows sorted DESC by timestamp by default
      const deduped = Array.from(seen.values()).sort(
        (a, b) => safeTime(b["Timestamp"]) - safeTime(a["Timestamp"])
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
  }, [username, role]);

  const handleSort = (key) => {
    const direction =
      sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
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
          (order[key] || "").toLowerCase().includes(searchTerm.toLowerCase())
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

  // open edit
  const handleEditClick = (row) => {
    setSelectedRow(row);
    setOrderFormData({ ...(row || {}) });
    setOrderFiles({ purchaseOrder: null, drawing: null, boq: null, proforma: null });
  };

  // logs
  const handleViewLogs = (row) => {
    const key = row["Order ID"];
    if (!key) {
      alert("No Order ID found for logs.");
      return;
    }
    const logs = allOrders
      .filter((r) => r["Order ID"] === key)
      .sort((a, b) => safeTime(b["Timestamp"]) - safeTime(a["Timestamp"]));
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

  const fileToBase64 = (file) => {
    if (!file) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = String(reader.result || "");
        const base64 = res.split("base64,")[1] || "";
        resolve({
          name: file.name,
          type: file.type || "application/octet-stream",
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
      const poObj = await fileToBase64(orderFiles.purchaseOrder);
      const drawingObj = await fileToBase64(orderFiles.drawing);
      const boqObj = await fileToBase64(orderFiles.boq);
      const proformaObj = await fileToBase64(orderFiles.proforma);

      const payload = { ...orderFormData };
      if (poObj) payload["Attach Purchase Order"] = poObj;
      if (drawingObj) payload["Attach Drawing"] = drawingObj;
      if (boqObj) payload["Attach BOQ"] = boqObj;
      if (proformaObj) payload["Proforma Invoice"] = proformaObj;

      await fetch(submitUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "updateOrder", data: payload }),
      });

      alert("✅ Order updated successfully (log appended).");
      setSelectedRow(null);
      fetchOrders();
    } catch (e) {
      console.error("Update order error:", e);
      alert("❌ Error updating order");
    } finally {
      setSaving(false);
    }
  };

  const isLikelyUrl = (v) => typeof v === "string" && /^https?:\/\//i.test(v);

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
                  <TableCell key={i}>{order[col]}</TableCell>
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
                  "Order Delivery Details",
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
              {
                title: "Deal Details",
                fields: ["Deal Name", "Type", "Deal Amount", "Next Step", "Remarks", "Stage"],
              },
              {
                title: "Customer Details",
                fields: [
                  "Account Owner",
                  "First Name",
                  "Last Name",
                  "Company",
                  "Mobile Number",
                  "Email ID",
                  "Fax",
                  "Website",
                  "Lead Source",
                  "Lead Status",
                  "Industry",
                  "Number of Employees",
                  "Requirement",
                  "Social Media",
                  "Description",
                  "Account ID",
                ],
              },
              {
                title: "Address Details",
                fields: [
                  "Billing Street",
                  "Billing City",
                  "Billing State",
                  "Billing Country",
                  "Billing PinCode",
                  "Billing Additional Description",
                  "Shipping Street",
                  "Shipping City",
                  "Shipping State",
                  "Shipping Country",
                  "Shipping PinCode",
                  "Shipping Additional Description",
                ],
              },
              {
                title: "Customer Banking Details",
                fields: [
                  "GST Number",
                  "Bank Account Number",
                  "IFSC Code",
                  "Bank Name",
                  "Bank Account Name",
                  "Banking Remarks",
                ],
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
                        {/* Attachments are handled separately (URL display + upload replacement buttons) */}
                        {["Attach Purchase Order", "Attach Drawing", "Attach BOQ", "Proforma Invoice"].includes(field) ? (
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
                              disabled={field === "Account Owner" || field === "Order ID"}
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
                            disabled={field === "Account Owner" || field === "Order ID" || field === "Timestamp"}
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
                      <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, mb: 1 }}>
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

                        <Grid item xs={12}>
                          <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontSize: 12, mt: 1 }}>
                            <strong>Existing Attach Purchase Order:</strong>{" "}
                            {isLikelyUrl(orderFormData["Attach Purchase Order"]) ? (
                              <a href={orderFormData["Attach Purchase Order"]} target="_blank" rel="noreferrer">
                                Open
                              </a>
                            ) : (
                              "—"
                            )}
                          </Typography>

                          <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontSize: 12 }}>
                            <strong>Existing Attach Drawing:</strong>{" "}
                            {isLikelyUrl(orderFormData["Attach Drawing"]) ? (
                              <a href={orderFormData["Attach Drawing"]} target="_blank" rel="noreferrer">
                                Open
                              </a>
                            ) : (
                              "—"
                            )}
                          </Typography>

                          <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontSize: 12 }}>
                            <strong>Existing Attach BOQ:</strong>{" "}
                            {isLikelyUrl(orderFormData["Attach BOQ"]) ? (
                              <a href={orderFormData["Attach BOQ"]} target="_blank" rel="noreferrer">
                                Open
                              </a>
                            ) : (
                              "—"
                            )}
                          </Typography>

                          <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontSize: 12 }}>
                            <strong>Existing Proforma Invoice:</strong>{" "}
                            {isLikelyUrl(orderFormData["Proforma Invoice"]) ? (
                              <a href={orderFormData["Proforma Invoice"]} target="_blank" rel="noreferrer">
                                Open
                              </a>
                            ) : (
                              "—"
                            )}
                          </Typography>
                        </Grid>
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

        {/* -------------------- LOGS MODAL -------------------- */}
        <Dialog open={logsOpen} onClose={() => setLogsOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            Order Change Logs
          </DialogTitle>
          <DialogContent dividers>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Order ID</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Stage</TableCell>
                  <TableCell>Payment Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orderLogs.map((log, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{log["Timestamp"]}</TableCell>
                    <TableCell>{log["Order ID"]}</TableCell>
                    <TableCell>{log["Company"]}</TableCell>
                    <TableCell>{log["Stage"]}</TableCell>
                    <TableCell>{log["Payment Status"]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default OrdersTable;
