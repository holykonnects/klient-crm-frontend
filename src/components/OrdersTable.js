// src/components/OrdersTable.js
import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
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
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import "@fontsource/montserrat";

import LoadingOverlay from "./LoadingOverlay";
import { useAuth } from "./AuthContext";
import MobileActionMenu from "./MobileActionMenu";
import { CRM_TABLE_SX, crmRowUpdatedAt, latestCrmRows, newestCrmRows } from "../utils/crmTableUtils";
import {
  ORDER_ATTACHMENT_FIELD_BY_KEY,
  removeOrderAttachment,
  uploadOrderAttachment,
} from "../utils/orderAttachmentUpload";

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

const isUrl = (v) => typeof v === "string" && /^https?:\/\//i.test(v);

const isMobileColumn = (key = "") => {
  const normalizedKey = String(key || "").toLowerCase();
  return normalizedKey.includes("mobile") || normalizedKey.includes("phone");
};

const amountNumber = (value) => {
  const parsed = Number(String(value ?? "").replace(/[₹,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getOrderRowTime = (row) => crmRowUpdatedAt(row, ["Order Updated Time"]);

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
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [filterStage, setFilterStage] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterOwner, setFilterOwner] = useState("");

  // ✅ default sort: Timestamp desc (latest on top)
  const [sortConfig, setSortConfig] = useState({ key: "Timestamp", direction: "desc" });

  // column selector
  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);

  // edit modal
  const [selectedRow, setSelectedRow] = useState(null);
  const [orderFormData, setOrderFormData] = useState({});
  const [orderAmountMode, setOrderAmountMode] = useState("keep");
  const [orderAmountAddition, setOrderAmountAddition] = useState("");
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
  const orderFilesBusy = Object.values(orderFiles).some((file) =>
    ["uploading", "removing"].includes(file?.status)
  );

  const { user } = useAuth();
  const username = user?.username;
  const role = user?.role;

  // Orders read webapp
  const dataUrl =
    "/api/orders";

  // Submit webapp (supports updateOrder)
  const submitUrl =
    "/api/orders";

  // Validation webapp
  const validationUrl =
    "/api/orders?action=validation";

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

      const deduped = latestCrmRows(
        filtered,
        row => row["Order ID"],
        ["Order Updated Time"]
      );

      setOrders(deduped);

      setVisibleColumns(
        JSON.parse(localStorage.getItem(`visibleColumns-v2-${username}-orders`)) ||
          ['Order ID', 'Deal Name', 'Company', 'Order Status', 'Order Amount', 'Account Owner'].filter((key) => Object.keys(deduped[0] || {}).includes(key))
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

  /**
   * ✅ Correct sorting:
   * - Timestamp: numeric epoch
   * - Numeric-looking: numeric (₹, commas)
   * - Else string compare
   */
  const sortedOrders = useMemo(() => {
    const arr = [...orders];
    const key = sortConfig?.key || "";
    const dir = sortConfig?.direction === "asc" ? 1 : -1;
    if (!key) return arr;

    return arr.sort((a, b) => {
      // Timestamp sort
      if (key === "Timestamp") {
        const ta = getOrderRowTime(a);
        const tb = getOrderRowTime(b);
        return (ta - tb) * dir;
      }

      const aVal = a?.[key];
      const bVal = b?.[key];

      // numeric-ish sort
      const aNum = Number(String(aVal ?? "").replace(/[₹,]/g, "").trim());
      const bNum = Number(String(bVal ?? "").replace(/[₹,]/g, "").trim());
      const aIsNum = Number.isFinite(aNum) && String(aVal ?? "").trim() !== "";
      const bIsNum = Number.isFinite(bNum) && String(bVal ?? "").trim() !== "";
      if (aIsNum && bIsNum) return (aNum - bNum) * dir;

      // string sort
      const sA = String(aVal ?? "");
      const sB = String(bVal ?? "");
      return sA.localeCompare(sB) * dir;
    });
  }, [orders, sortConfig]);

  const filteredOrders = useMemo(() => {
    const query = deferredSearchTerm.toLowerCase();
    return sortedOrders.filter((order) => (
      ["Company", "Order ID", "Mobile Number", "Deal Name", "Account ID"].some((key) =>
        String(order[key] || "").toLowerCase().includes(query)
      ) &&
      (!filterStage || order["Stage"] === filterStage) &&
      (!filterType || order["Type"] === filterType) &&
      (!filterSource || order["Lead Source"] === filterSource) &&
      (!filterOwner || order["Account Owner"] === filterOwner)
    ));
  }, [sortedOrders, deferredSearchTerm, filterStage, filterType, filterSource, filterOwner]);

  const unique = (key) => [...new Set(orders.map((d) => d[key]).filter(Boolean))];

  const handleColumnToggle = (col) => {
    setVisibleColumns((prev) => {
      const updated = prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col];
      localStorage.setItem(`visibleColumns-v2-${username}-orders`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelectAll = () => {
    const all = Object.keys(orders[0] || {});
    setVisibleColumns(all);
    localStorage.setItem(`visibleColumns-v2-${username}-orders`, JSON.stringify(all));
  };

  const handleDeselectAll = () => {
    setVisibleColumns([]);
    localStorage.setItem(`visibleColumns-v2-${username}-orders`, JSON.stringify([]));
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
    if (isMobileColumn(col)) {
      return <MobileActionMenu mobile={value} />;
    }
    return value || "";
  };

  // open edit
  const handleEditClick = (row) => {
    setSelectedRow(row);
    setOrderFormData({ ...(row || {}) });
    setOrderAmountMode("keep");
    setOrderAmountAddition("");
    setOrderFiles({ purchaseOrder: null, drawing: null, boq: null, proforma: null });
  };

  // logs
  const handleViewLogs = (row) => {
    const key = String(row["Order ID"] || "").trim();
    if (!key) {
      alert("No Order ID found for logs.");
      return;
    }
    const logs = newestCrmRows(
      allOrders.filter((r) => String(r["Order ID"] || "").trim() === key),
      ["Order Updated Time"]
    );
    setOrderLogs(logs);
    setLogsOpen(true);
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setOrderFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleOrderFileChange = (key) => async (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    const field = ORDER_ATTACHMENT_FIELD_BY_KEY[key];
    const existing = orderFiles[key];
    if (existing?.receipt) {
      setOrderFiles((prev) => ({ ...prev, [key]: { ...existing, status: "removing" } }));
      try {
        await removeOrderAttachment(existing.receipt);
      } catch (error) {
        setOrderFiles((prev) => ({ ...prev, [key]: { ...existing, status: "error", error: error.message } }));
        alert(`❌ ${error.message || "Unable to replace attachment"}`);
        return;
      }
    }
    setOrderFiles((prev) => ({ ...prev, [key]: { file, name: file.name, size: file.size, status: "uploading" } }));
    try {
      const uploaded = await uploadOrderAttachment({ file, field, orderId: orderFormData?.["Order ID"] });
      setOrderFiles((prev) => (prev[key]?.file === file ? { ...prev, [key]: uploaded } : prev));
    } catch (error) {
      setOrderFiles((prev) => (
        prev[key]?.file === file
          ? { ...prev, [key]: { name: file.name, size: file.size, status: "error", error: error.message } }
          : prev
      ));
    }
  };

  const removeSelectedOrderFile = async (key) => {
    const selected = orderFiles[key];
    if (!selected || selected.status === "uploading" || selected.status === "removing") return;
    if (!selected.receipt) {
      setOrderFiles((prev) => ({ ...prev, [key]: null }));
      return;
    }
    setOrderFiles((prev) => ({ ...prev, [key]: { ...selected, status: "removing" } }));
    try {
      await removeOrderAttachment(selected.receipt);
      setOrderFiles((prev) => ({ ...prev, [key]: null }));
    } catch (error) {
      setOrderFiles((prev) => ({ ...prev, [key]: { ...selected, status: "error", error: error.message } }));
      alert(`❌ ${error.message || "Unable to remove attachment"}`);
    }
  };

  const closeOrderEditor = async () => {
    const selectedFiles = Object.values(orderFiles).filter(Boolean);
    if (saving || selectedFiles.some((file) => ["uploading", "removing"].includes(file.status))) return;
    try {
      await Promise.all(selectedFiles.filter((file) => file.receipt).map((file) => removeOrderAttachment(file.receipt)));
      setOrderFiles({ purchaseOrder: null, drawing: null, boq: null, proforma: null });
      setSelectedRow(null);
    } catch (error) {
      alert(`❌ ${error.message || "Unable to close while removing draft attachments"}`);
    }
  };

  const handleSubmitOrderUpdate = async () => {
    if (!orderFormData?.["Order ID"]) {
      alert("❌ Order ID missing. Cannot update.");
      return;
    }
    if (orderAmountMode === "add" && amountNumber(orderAmountAddition) <= 0) {
      alert("Please enter an amount greater than zero to add.");
      return;
    }

    setSaving(true);
    try {
      const selectedFiles = Object.values(orderFiles).filter(Boolean);
      if (selectedFiles.some((file) => ["uploading", "removing"].includes(file.status))) {
        throw new Error("Please wait for all attachment uploads to finish.");
      }
      const failedUpload = selectedFiles.find((file) => file.status !== "uploaded" || !file.url);
      if (failedUpload) throw new Error(failedUpload.error || `${failedUpload.name} has not uploaded successfully.`);

      const payload = { ...orderFormData };
      Object.entries(ORDER_ATTACHMENT_FIELD_BY_KEY).forEach(([key, field]) => {
        if (orderFiles[key]?.url) payload[field] = orderFiles[key].url;
      });
      payload.updatedByName = user?.username || user?.email || "";
      payload.updatedByEmail = user?.email || user?.username || "";
      payload.amountUpdate = {
        field: "Order Amount",
        mode: orderAmountMode,
        addition: orderAmountMode === "add" ? orderAmountAddition : "",
      };

      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateOrder", data: payload }),
      });

      const parsed = await safeReadResponse(res);
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
        <Box className="crm-page-header" display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <img className="crm-primary-logo" src="/assets/rido-sports-logo.png" alt="Rido Sports" />
          <Typography variant="h5" fontWeight="bold">
            Orders Records
          </Typography>
        </Box>

        {/* Filters */}
        <Box className="crm-filter-bar" display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
          <Box className="crm-search-tools">
            <TextField
              label="Search all order fields"
              variant="outlined"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
            />
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="Choose columns">
              <ViewColumnIcon />
            </IconButton>
          </Box>

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
        <Box className="crm-table-shell">
        <Table size="small" sx={CRM_TABLE_SX}>
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
        </Box>

        {/* -------------------- EDIT / UPDATE ORDER MODAL -------------------- */}
        <Dialog open={!!selectedRow} onClose={closeOrderEditor} maxWidth="md" fullWidth>
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
                          <TextField fullWidth size="small" label={field} value={orderFormData[field] || ""} disabled />
                        ) : field === "Order Amount" ? (
                          <Box>
                            <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 0.75 }}>
                              Order Amount: ₹ {amountNumber(selectedRow?.[field]).toLocaleString("en-IN")}
                            </Typography>
                            <ToggleButtonGroup
                              exclusive
                              fullWidth
                              size="small"
                              value={orderAmountMode}
                              onChange={(_, value) => value && setOrderAmountMode(value)}
                              aria-label="Order amount update choice"
                            >
                              <ToggleButton value="keep">Keep existing</ToggleButton>
                              <ToggleButton value="add">Add amount</ToggleButton>
                            </ToggleButtonGroup>
                            {orderAmountMode === "add" ? (
                              <TextField
                                fullWidth
                                size="small"
                                type="number"
                                label="Amount to add"
                                value={orderAmountAddition}
                                onChange={(event) => setOrderAmountAddition(event.target.value)}
                                inputProps={{ min: 0, step: "0.01" }}
                                helperText={`New total: ₹ ${(amountNumber(selectedRow?.[field]) + amountNumber(orderAmountAddition)).toLocaleString("en-IN")}`}
                                sx={{ mt: 1 }}
                              />
                            ) : null}
                          </Box>
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
                      <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, mb: 1 }}>
                        Attachments (upload new only if you want to replace)
                      </Typography>
                      <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontSize: 11, opacity: 0.75, mb: 1 }}>
                        Maximum 2 MB per attachment. Each replacement uploads immediately after selection.
                      </Typography>

                      <Grid container spacing={2}>
                        {[
                          ["purchaseOrder", "Replace Purchase Order"],
                          ["drawing", "Replace Drawing"],
                          ["boq", "Replace BOQ"],
                          ["proforma", "Replace Proforma Invoice"],
                        ].map(([key, label]) => {
                          const file = orderFiles[key];
                          return (
                            <Grid item xs={6} key={key}>
                              <Button
                                variant="outlined"
                                component="label"
                                fullWidth
                                disabled={saving || ["uploading", "removing"].includes(file?.status)}
                              >
                                {label}
                                <input
                                  key={file ? `${key}-${file.name}-${file.status}` : `${key}-empty`}
                                  hidden
                                  type="file"
                                  accept=".pdf,.png,.jpg,.jpeg"
                                  onChange={handleOrderFileChange(key)}
                                />
                              </Button>
                              {file ? (
                                <Box sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}>
                                  <Typography
                                    sx={{
                                      minWidth: 0,
                                      flex: 1,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      fontFamily: "Montserrat, sans-serif",
                                      fontSize: 11,
                                    }}
                                  >
                                    {file.status === "uploading"
                                      ? `Uploading: ${file.name}`
                                      : file.status === "removing"
                                      ? `Removing: ${file.name}`
                                      : file.status === "error"
                                      ? `Upload failed: ${file.error || file.name}`
                                      : `Uploaded: ${file.name}`}
                                  </Typography>
                                  <IconButton
                                    size="small"
                                    title={`Remove ${file.name}`}
                                    aria-label={`Remove ${file.name}`}
                                    disabled={saving || ["uploading", "removing"].includes(file.status)}
                                    onClick={() => removeSelectedOrderFile(key)}
                                  >
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              ) : null}
                            </Grid>
                          );
                        })}
                      </Grid>
                    </>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </DialogContent>

          <DialogActions>
            <Button onClick={closeOrderEditor} disabled={saving || orderFilesBusy}>Cancel</Button>
            <Button
              variant="contained"
              sx={{ backgroundColor: "#6495ED" }}
              onClick={handleSubmitOrderUpdate}
              disabled={saving || orderFilesBusy}
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
              <Table size="small" sx={CRM_TABLE_SX}>
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
