// src/components/DealsTable.js
import React, { useDeferredValue, useEffect, useState, useMemo, useCallback } from "react";
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
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { useAuth } from "./AuthContext";
import "@fontsource/montserrat";
import HistoryIcon from "@mui/icons-material/History";
import LoadingOverlay from "./LoadingOverlay";
import EventIcon from "@mui/icons-material/Event";
import CalendarView from "./CalendarView";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import CloseIcon from "@mui/icons-material/Close";
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
    fontSize: 10.5,
  },
});

const selectorStyle = {
  fontFamily: "Montserrat, sans-serif",
  fontSize: 8,
};

const isMobileColumn = (key = "") => {
  const normalizedKey = String(key || "").toLowerCase();

  return (
    normalizedKey.includes("mobile") ||
    normalizedKey.includes("phone")
  );
};

const amountNumber = (value) => {
  const parsed = Number(String(value ?? "").replace(/[₹,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

// ✅ MUST MATCH Orders sheet headers EXACTLY
const ORDER_ATTACHMENT_FIELDS = [
  "Attach Purchase Order",
  "Attach Drawing",
  "Attach BOQ",
  "Proforma Invoice",
];

/**
 * ✅ Deal key
 * - If "Order Distribution ID" exists (Closed Won), use it (stable)
 * - Else fallback to Deal Name + Account ID
 */
const dealKeyOf = (row) => {
  const finalId = row?.["Order Distribution ID"];
  if (finalId) return String(finalId).trim();
  return `${row?.["Deal Name"] || ""}__${row?.["Account ID"] || ""}`;
};

const getDealRowTime = (row) => crmRowUpdatedAt(row, ["Deal Updated Time"]);

/**
 * ✅ Memoized DealField to reduce typing lag in big modals
 * TextFields commit onBlur (smooth typing), Select commits onChange
 */
const DealField = React.memo(function DealField({
  field,
  value,
  validationData,
  disabled,
  onCommit,
  type,
}) {
  const isDropdown = Array.isArray(validationData?.[field]);
  const [local, setLocal] = useState(value ?? "");

  useEffect(() => {
    setLocal(value ?? "");
  }, [value]);

  if (isDropdown) {
    return (
      <FormControl fullWidth size="small">
        <InputLabel>{field}</InputLabel>
        <Select
          name={field}
          value={value ?? ""}
          label={field}
          onChange={(e) => onCommit(field, e.target.value)}
          disabled={disabled}
        >
          {validationData[field].map((opt, idx) => (
            <MenuItem key={idx} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  return (
    <TextField
      fullWidth
      size="small"
      name={field}
      label={field}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(field, local)}
      disabled={disabled}
      type={type || "text"}
      InputLabelProps={type === "date" ? { shrink: true } : undefined}
    />
  );
});

/**
 * ✅ Memoized OrderField to reduce typing lag in Order modal
 */
const OrderField = React.memo(function OrderField({
  field,
  value,
  validationData,
  disabled,
  onCommit,
  type,
}) {
  const isDropdown = Array.isArray(validationData?.[field]);
  const [local, setLocal] = useState(value ?? "");

  useEffect(() => {
    setLocal(value ?? "");
  }, [value]);

  if (isDropdown) {
    return (
      <FormControl fullWidth size="small">
        <InputLabel>{field}</InputLabel>
        <Select
          name={field}
          value={value ?? ""}
          label={field}
          onChange={(e) => onCommit(field, e.target.value)}
          disabled={disabled}
        >
          {validationData[field].map((opt, idx) => (
            <MenuItem key={idx} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  return (
    <TextField
      fullWidth
      size="small"
      name={field}
      label={field}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(field, local)}
      disabled={disabled}
      type={type || "text"}
      InputLabelProps={type === "date" ? { shrink: true } : undefined}
    />
  );
});

function DealsTable() {
  const [deals, setDeals] = useState([]);
  const [allDeals, setAllDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  // table controls
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [filterStage, setFilterStage] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "Timestamp", direction: "desc" });

  // column selector
  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);

  // edit deal modal
  const [selectedRow, setSelectedRow] = useState(null);
  const [dealFormData, setDealFormData] = useState({});
  const [dealAmountMode, setDealAmountMode] = useState("keep");
  const [dealAmountAddition, setDealAmountAddition] = useState("");
  const [validationData, setValidationData] = useState({});

  // ✅ saving UX for deal update
  const [savingDeal, setSavingDeal] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // logs
  const [logsOpen, setLogsOpen] = useState(false);
  const [dealLogs, setDealLogs] = useState([]);

  // calendar
  const [selectedEntryRow, setSelectedEntryRow] = useState(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [entryType, setEntryType] = useState("");

  // add order modal
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderBaseRow, setOrderBaseRow] = useState(null);
  const [orderDraftId, setOrderDraftId] = useState("");
  const [orderForm, setOrderForm] = useState({});
  const [orderFiles, setOrderFiles] = useState({
    purchaseOrder: null,
    drawing: null,
    boq: null,
    proforma: null,
  });

  // ✅ saving UX for order create
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderMsg, setOrderMsg] = useState("");
  const orderFilesBusy = Object.values(orderFiles).some((file) =>
    ["uploading", "removing"].includes(file?.status)
  );

  const { user } = useAuth();
  const username = user?.username;
  const role = user?.role;

  const dataUrl =
    "/api/deals";
  const submitUrl =
    "/api/deals";
  const validationUrl =
    "/api/deals?action=validation";

  const fetchDeals = async () => {
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

      setAllDeals(filtered);

      const dedupedLatest = latestCrmRows(filtered, dealKeyOf, ["Deal Updated Time"]);

      setDeals(dedupedLatest);

      const stored =
        JSON.parse(localStorage.getItem(`visibleColumns-v2-${username}-deals`)) || null;

      setVisibleColumns(stored || ['Deal Name', 'Company', 'Deal Stage', 'Deal Value', 'Account Owner', 'Order ID'].filter((key) => Object.keys(dedupedLatest[0] || {}).includes(key)));
    } catch (e) {
      console.error("Deals fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
    fetch(validationUrl)
      .then((res) => res.json())
      .then(setValidationData)
      .catch((e) => console.error("Validation fetch error:", e));
  }, [username, role]);

  // ✅ Sorting respects Timestamp properly
  const sortedDeals = useMemo(() => {
    const arr = [...deals];
    if (!sortConfig.key) return arr;

    const { key, direction } = sortConfig;

    arr.sort((a, b) => {
      if (key === "Timestamp") {
        const ta = getDealRowTime(a);
        const tb = getDealRowTime(b);
        return direction === "asc" ? ta - tb : tb - ta;
      }

      const aVal = a?.[key] ?? "";
      const bVal = b?.[key] ?? "";
      return direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    return arr;
  }, [deals, sortConfig]);

  const handleSort = (key) => {
    const direction =
      sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction });
  };

  const filteredDeals = useMemo(() => {
    const query = deferredSearchTerm.toLowerCase();
    return sortedDeals.filter((deal) => (
      ["First Name", "Last Name", "Deal Name", "Company", "Mobile Number", "Stage", "Account ID"].some(
        (key) => String(deal?.[key] || "").toLowerCase().includes(query)
      ) &&
      (!filterStage || deal?.["Stage"] === filterStage) &&
      (!filterType || deal?.["Type"] === filterType) &&
      (!filterSource || deal?.["Lead Source"] === filterSource) &&
      (!filterOwner || deal?.["Account Owner"] === filterOwner)
    ));
  }, [sortedDeals, deferredSearchTerm, filterStage, filterType, filterSource, filterOwner]);

  const unique = (key) => [...new Set(deals.map((d) => d?.[key]).filter(Boolean))];

  const handleColumnToggle = (col) => {
    setVisibleColumns((prev) => {
      const updated = prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col];
      localStorage.setItem(`visibleColumns-v2-${username}-deals`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelectAll = () => {
    const all = Object.keys(deals[0] || {});
    setVisibleColumns(all);
    localStorage.setItem(`visibleColumns-v2-${username}-deals`, JSON.stringify(all));
  };

  const handleDeselectAll = () => {
    setVisibleColumns([]);
    localStorage.setItem(`visibleColumns-v2-${username}-deals`, JSON.stringify([]));
  };

  // ----------------------------
  // Edit Deal
  // ----------------------------
  const handleEditClick = (deal) => {
    setSelectedRow(deal);
    setDealFormData({ ...(deal || {}) });
    setDealAmountMode("keep");
    setDealAmountAddition("");
    setSaveMsg("");
  };

  const commitDealField = useCallback((field, value) => {
    setDealFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmitDeal = async () => {
    if (savingDeal) return;
    if (dealAmountMode === "add" && amountNumber(dealAmountAddition) <= 0) {
      setSaveMsg("Enter an amount greater than zero.");
      return;
    }

    setSavingDeal(true);
    setSaveMsg("Updating...");

    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateDeal",
          data: {
            ...dealFormData,
            amountUpdate: {
              field: "Deal Amount",
              mode: dealAmountMode,
              addition: dealAmountMode === "add" ? dealAmountAddition : "",
            },
            updatedByName: user?.username || user?.email || "",
            updatedByEmail: user?.email || user?.username || "",
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());

      setSaveMsg("Updated ✅");
      setSelectedRow(null);
      fetchDeals();
    } catch (e) {
      console.error(e);
      setSaveMsg("Update failed ❌");
      alert("❌ Error updating deal");
    } finally {
      setTimeout(() => setSaveMsg(""), 1200);
      setSavingDeal(false);
    }
  };

  // ----------------------------
  // Logs (FULL ROW)
  // ----------------------------
  const handleViewLogs = (dealRow) => {
    const key = dealKeyOf(dealRow);
    if (!key || key === "__") {
      alert("No Deal Key found for logs.");
      return;
    }

    const logs = newestCrmRows(
      allDeals.filter((d) => dealKeyOf(d) === key),
      ["Deal Updated Time"]
    );

    setDealLogs(logs);
    setLogsOpen(true);
  };

  // ----------------------------
  // Calendar
  // ----------------------------
  const handleOpenMeetingFromRow = (row, type) => {
    setSelectedEntryRow(row);
    setEntryType(type);
    setShowCalendarModal(true);
  };

  // ----------------------------
  // Add Order (one order per deal)
  // ----------------------------
  const openAddOrder = (deal) => {
    if (deal?.["Order ID"]) {
      alert("⚠️ Order already exists for this deal. Please edit it from the Orders table.");
      return;
    }

    setOrderBaseRow(deal);
    setOrderDraftId(`ORD-${Date.now()}`);

    setOrderForm({
      "Order Amount": deal?.["Order Amount"] || "",
      "Order Delivery Date": deal?.["Order Delivery Date"] || "",
      "Order Remarks": deal?.["Order Remarks"] || "",

      "Order Payment Terms": "",
      "Order Onsite Contact Name": "",
      "Order Onsite Contact Number": "",
      "Order Onsite Contact Role": "",
      "Order Update": "",
      "Payment Status": "",
      "Payment Amount": "",
      "Payment Details": "",
      "Notification Status": "",
    });

    setOrderFiles({ purchaseOrder: null, drawing: null, boq: null, proforma: null });
    setOrderMsg("");
    setOrderOpen(true);
  };

  // ✅ useCallback = stable reference => less re-renders in memo fields
  const commitOrderField = useCallback((field, value) => {
    setOrderForm((prev) => ({ ...prev, [field]: value }));
  }, []);

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
      const uploaded = await uploadOrderAttachment({ file, field, orderId: orderDraftId });
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

  const closeOrderModal = async () => {
    const selectedFiles = Object.values(orderFiles).filter(Boolean);
    if (creatingOrder || selectedFiles.some((file) => ["uploading", "removing"].includes(file.status))) return;
    try {
      await Promise.all(selectedFiles.filter((file) => file.receipt).map((file) => removeOrderAttachment(file.receipt)));
      setOrderFiles({ purchaseOrder: null, drawing: null, boq: null, proforma: null });
      setOrderDraftId("");
      setOrderBaseRow(null);
      setOrderOpen(false);
    } catch (error) {
      alert(`❌ ${error.message || "Unable to close while removing draft attachments"}`);
    }
  };

  const handleCreateOrder = async () => {
    if (!orderBaseRow) return;
    if (creatingOrder) return;

    setCreatingOrder(true);
    setOrderMsg("Creating...");

    try {
      const selectedFiles = Object.values(orderFiles).filter(Boolean);
      if (selectedFiles.some((file) => ["uploading", "removing"].includes(file.status))) {
        throw new Error("Please wait for all attachment uploads to finish.");
      }
      const failedUpload = selectedFiles.find((file) => file.status !== "uploaded" || !file.url);
      if (failedUpload) throw new Error(failedUpload.error || `${failedUpload.name} has not uploaded successfully.`);
      const orderId = orderDraftId || `ORD-${Date.now()}`;

      // Minimal payload first (high chance to land)
      const payloadRow = {
        "Order ID": orderId,
        "Order Distribution ID": orderBaseRow?.["Order Distribution ID"] || "",
        "Account ID": orderBaseRow?.["Account ID"] || "",
        "Deal Name": orderBaseRow?.["Deal Name"] || "",
        "Account Owner": orderBaseRow?.["Account Owner"] || "",
        "Company": orderBaseRow?.["Company"] || "",
        "Mobile Number": orderBaseRow?.["Mobile Number"] || "",
        "Email ID": orderBaseRow?.["Email ID"] || "",
        ...orderForm,
      };

      Object.entries(ORDER_ATTACHMENT_FIELD_BY_KEY).forEach(([key, field]) => {
        payloadRow[field] = orderFiles[key]?.url || "";
      });
      payloadRow.updatedByName = user?.username || user?.email || "";
      payloadRow.updatedByEmail = user?.email || user?.username || "";

      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createOrder",
          data: payloadRow,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.ok !== true) {
        throw new Error(result.error || result.message || `Order creation failed (${res.status})`);
      }

      setOrderMsg("Created ✅");
      setOrderOpen(false);
      setOrderBaseRow(null);
      setOrderDraftId("");
      fetchDeals();
    } catch (e) {
      console.error("Create order error:", e);
      setOrderMsg("Create failed ❌");
      alert(`❌ ${e.message || "Error creating order"}`);
    } finally {
      setTimeout(() => setOrderMsg(""), 1200);
      setCreatingOrder(false);
    }
  };

  // Logs modal headers
  const allLogHeaders = dealLogs?.[0] ? Object.keys(dealLogs[0]) : [];
  const logHeaders = allLogHeaders;

  return (
    <ThemeProvider theme={theme}>
      {loading && <LoadingOverlay />}

      <Box padding={4}>
        <Box className="crm-page-header" display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <img className="crm-primary-logo" src="/assets/rido-sports-logo.png" alt="Rido Sports" />
          <Typography variant="h5" fontWeight="bold">
            Deals Records
          </Typography>
        </Box>

        {/* Filters and Search */}
        <Box className="crm-filter-bar" display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
          <Box className="crm-search-tools">
            <TextField
              label="Search all deal fields"
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

          <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
            <Box p={2} sx={selectorStyle}>
              <Typography variant="subtitle2">Column Visibility</Typography>
              <Button onClick={handleSelectAll}>Select All</Button>
              <Button onClick={handleDeselectAll}>Deselect All</Button>
              <FormGroup>
                {(deals[0] ? Object.keys(deals[0]) : []).map((col) => (
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
                  style={{ color: "white", cursor: "pointer" }}
                >
                  {header}{" "}
                  {sortConfig.key === header ? (sortConfig.direction === "asc" ? "↑" : "↓") : ""}
                </TableCell>
              ))}
              <TableCell style={{ color: "white", fontWeight: "bold" }}>Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredDeals.map((deal, index) => (
              <TableRow key={index}>
                {visibleColumns.map((col, i) => (
                  <TableCell key={i}>
                    {isMobileColumn(col) ? (
                      <MobileActionMenu mobile={deal?.[col]} />
                    ) : (
                      deal?.[col] ?? ""
                    )}
                  </TableCell>
                ))}
                <TableCell>
                  <IconButton onClick={() => handleEditClick(deal)} title="Edit Deal">
                    <EditIcon />
                  </IconButton>

                  <IconButton
                    onClick={() => openAddOrder(deal)}
                    title={deal?.["Order ID"] ? "Order already exists" : "Add Order"}
                    disabled={!!deal?.["Order ID"]}
                  >
                    <AddShoppingCartIcon />
                  </IconButton>

                  <IconButton onClick={() => handleViewLogs(deal)} title="Logs">
                    <HistoryIcon />
                  </IconButton>

                  <IconButton
                    onClick={() => handleOpenMeetingFromRow(deal, "Deal")}
                    title="Schedule Meeting"
                  >
                    <EventIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </Box>

        {/* -------------------- Edit Deal Modal -------------------- */}
        <Dialog open={!!selectedRow} onClose={() => setSelectedRow(null)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>
            Edit Deal
          </DialogTitle>

          <DialogContent dividers>
            {[
              {
                title: "Deal Details",
                fields: [
                  "Deal Name",
                  "Type",
                  "Deal Amount",
                  "Next Step",
                  "Product Required",
                  "Remarks",
                  "Stage",
                ],
              },
              {
                title: "Customer Details",
                fields: [
                  "Timestamp",
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
                ],
              },
              {
                title: "Address Details",
                fields: [
                  "Go To Section",
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
                  "Account ID",
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
              <Accordion key={section.title} defaultExpanded={section.title === "Deal Details"}>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ backgroundColor: "#f0f4ff", fontFamily: "Montserrat, sans-serif" }}
                >
                  <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>
                    {section.title}
                  </Typography>
                </AccordionSummary>

                <AccordionDetails>
                  <Grid container spacing={2}>
                    {section.fields.map((field) => (
                      <Grid item xs={6} key={field}>
                        {field === "Deal Amount" ? (
                          <Box>
                            <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 0.75 }}>
                              Deal Amount: ₹ {amountNumber(selectedRow?.[field]).toLocaleString("en-IN")}
                            </Typography>
                            <ToggleButtonGroup
                              exclusive
                              fullWidth
                              size="small"
                              value={dealAmountMode}
                              onChange={(_, value) => value && setDealAmountMode(value)}
                              aria-label="Deal amount update choice"
                            >
                              <ToggleButton value="keep">Keep existing</ToggleButton>
                              <ToggleButton value="add">Add amount</ToggleButton>
                            </ToggleButtonGroup>
                            {dealAmountMode === "add" ? (
                              <TextField
                                fullWidth
                                size="small"
                                type="number"
                                label="Amount to add"
                                value={dealAmountAddition}
                                onChange={(event) => setDealAmountAddition(event.target.value)}
                                inputProps={{ min: 0, step: "0.01" }}
                                helperText={`New total: ₹ ${(amountNumber(selectedRow?.[field]) + amountNumber(dealAmountAddition)).toLocaleString("en-IN")}`}
                                sx={{ mt: 1 }}
                              />
                            ) : null}
                          </Box>
                        ) : (
                          <DealField
                            field={field}
                            value={dealFormData?.[field] || ""}
                            validationData={validationData}
                            disabled={field === "Account Owner" || field === "Account ID" || field === "Timestamp"}
                            onCommit={commitDealField}
                          />
                        )}
                      </Grid>
                    ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}

            <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>
                {saveMsg || ""}
              </Typography>

              <Button
                variant="contained"
                sx={{ backgroundColor: "#6495ED" }}
                onClick={handleSubmitDeal}
                disabled={savingDeal}
              >
                {savingDeal ? "Updating..." : "Update Deal"}
              </Button>
            </Box>
          </DialogContent>
        </Dialog>

        {/* -------------------- Add Order Modal -------------------- */}
        <Dialog open={orderOpen} onClose={closeOrderModal} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            Add Order
          </DialogTitle>

          <DialogContent dividers>
            <Accordion defaultExpanded>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ backgroundColor: "#f0f4ff", fontFamily: "Montserrat, sans-serif" }}
              >
                <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                  Order Creation Fields
                </Typography>
              </AccordionSummary>

              <AccordionDetails>
                <Grid container spacing={2}>
                  {[
                    "Order Amount",
                    "Order Delivery Date",
                    "Order Remarks",
                    "Order Payment Terms",
                    "Order Onsite Contact Name",
                    "Order Onsite Contact Number",
                    "Order Onsite Contact Role",
                    "Order Update",
                    "Payment Status",
                    "Payment Amount",
                    "Payment Details",
                    "Notification Status",
                  ].map((field) => (
                    <Grid item xs={6} key={field}>
                      <OrderField
                        field={field}
                        value={orderForm?.[field] || ""}
                        validationData={validationData}
                        disabled={creatingOrder}
                        onCommit={commitOrderField}
                        type={field === "Order Delivery Date" ? "date" : "text"}
                      />
                    </Grid>
                  ))}

                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, mb: 1 }}>
                      Attachments
                    </Typography>
                    <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontSize: 11, opacity: 0.75 }}>
                      Each file uploads to Drive immediately after selection. The Orders sheet stores only the confirmed Drive link.
                    </Typography>
                    <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontSize: 11, opacity: 0.75 }}>
                      Maximum 2 MB per attachment. Every selected file must finish uploading before the order is created.
                    </Typography>
                  </Grid>

                  {ORDER_ATTACHMENT_FIELDS.map((label) => {
                    const fileKey =
                      label === "Attach Purchase Order"
                        ? "purchaseOrder"
                        : label === "Attach Drawing"
                        ? "drawing"
                        : label === "Attach BOQ"
                        ? "boq"
                        : "proforma";

                    const file = orderFiles?.[fileKey];

                    return (
                      <Grid item xs={6} key={label}>
                        <Button
                          variant="outlined"
                          component="label"
                          fullWidth
                          disabled={creatingOrder || ["uploading", "removing"].includes(file?.status)}
                          sx={{ justifyContent: "flex-start" }}
                        >
                          {label}
                          <input
                            key={file ? `${fileKey}-${file.name}-${file.status}` : `${fileKey}-empty`}
                            hidden
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handleOrderFileChange(fileKey)}
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
                                opacity: 0.8,
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
                              disabled={creatingOrder || ["uploading", "removing"].includes(file.status)}
                              onClick={() => removeSelectedOrderFile(fileKey)}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ) : null}
                      </Grid>
                    );
                  })}
                </Grid>
              </AccordionDetails>
            </Accordion>

            <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>
                {orderMsg || ""}
              </Typography>

              <Button
                variant="contained"
                sx={{ backgroundColor: "#6495ED" }}
                onClick={handleCreateOrder}
                disabled={creatingOrder || orderFilesBusy}
              >
                {creatingOrder ? "Creating..." : "Create Order"}
              </Button>
            </Box>
          </DialogContent>

          <DialogActions>
            <Button onClick={closeOrderModal} disabled={creatingOrder || orderFilesBusy}>
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* -------------------- DEAL LOGS MODAL (FULL ROW) -------------------- */}
        <Dialog open={logsOpen} onClose={() => setLogsOpen(false)} maxWidth="xl" fullWidth>
          <DialogTitle sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            Deal Change Logs (Full Row)
          </DialogTitle>
          <DialogContent dividers>
            {dealLogs.length === 0 ? (
              <Typography>No logs found.</Typography>
            ) : (
              <Table size="small" sx={CRM_TABLE_SX}>
                <TableHead>
                  <TableRow style={{ backgroundColor: "#6495ED" }}>
                    {logHeaders.map((h) => (
                      <TableCell key={h} style={{ color: "white", fontWeight: 700 }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dealLogs.map((log, idx) => (
                    <TableRow key={idx}>
                      {logHeaders.map((h) => (
                        <TableCell key={h}>
                          {isMobileColumn(h) ? (
                            <MobileActionMenu mobile={log?.[h]} />
                          ) : (
                            log?.[h] ?? ""
                          )}
                        </TableCell>
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

        {/* Calendar Modal */}
        {showCalendarModal && (
          <CalendarView
            open={showCalendarModal}
            onClose={() => setShowCalendarModal(false)}
            entryType={entryType}
            selectedEntryRow={selectedEntryRow}
            mode="existing"
          />
        )}
      </Box>
    </ThemeProvider>
  );
}

export default DealsTable;
