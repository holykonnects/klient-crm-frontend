// src/components/DealsTable.js
import React, { useEffect, useState, useMemo } from "react";
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

/**
 * ✅ Flexible timestamp parser
 * Supports dd-MM-yyyy HH:mm:ss, dd/MM/yyyy HH:mm:ss, ISO strings, Date, epoch
 */
const parseTimestampFlexible = (ts) => {
  if (!ts) return 0;

  if (ts instanceof Date) {
    const t = ts.getTime();
    return Number.isFinite(t) ? t : 0;
  }

  if (typeof ts === "number") {
    return Number.isFinite(ts) ? ts : 0;
  }

  const raw = String(ts).trim();
  if (!raw) return 0;

  // ISO / native parse first
  const dp = Date.parse(raw);
  if (Number.isFinite(dp)) return dp;

  // dd-MM-yyyy or dd/MM/yyyy with optional time
  const m = raw.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/
  );
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const yyyy = parseInt(m[3], 10);
    const HH = parseInt(m[4] ?? "0", 10);
    const MM = parseInt(m[5] ?? "0", 10);
    const SS = parseInt(m[6] ?? "0", 10);

    if (dd && mm && yyyy) {
      const dt = new Date(yyyy, mm - 1, dd, HH, MM, SS);
      const t = dt.getTime();
      return Number.isFinite(t) ? t : 0;
    }
  }

  return 0;
};

/**
 * ✅ Stable key for logs + dedupe
 * NOTE: If you have a better always-present deal id column, add it here.
 */
const dealKeyOf = (row) =>
  `${row?.["Deal Name"] || ""}__${row?.["Account ID"] || ""}`;

/**
 * ✅ Memoized field to reduce typing lag in big modals
 * - TextFields: local state updates onChange, commit to dealFormData onBlur
 * - Select: commit immediately onChange
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

function DealsTable() {
  const [deals, setDeals] = useState([]);
  const [allDeals, setAllDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  // table controls
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "asc" });

  // column selector
  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);

  // edit deal modal
  const [selectedRow, setSelectedRow] = useState(null);
  const [dealFormData, setDealFormData] = useState({});
  const [validationData, setValidationData] = useState({});

  // ✅ saving UX for update button
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
  const [orderForm, setOrderForm] = useState({});
  const [orderFiles, setOrderFiles] = useState({
    purchaseOrder: null,
    drawing: null,
    boq: null,
    proforma: null,
  });
  const [creatingOrder, setCreatingOrder] = useState(false);

  const { user } = useAuth();
  const username = user?.username;
  const role = user?.role;

  const dataUrl =
    "https://script.google.com/macros/s/AKfycbwJvHUNBaOAWf9oPagM1_SOZ4q4n4cV06a1d03C2zv9EBJVDqyK9zSRklZLu2_TZRNd/exec";
  const submitUrl =
    "https://script.google.com/macros/s/AKfycbxZ87qfE6u-2jT8xgSlYJu5dG6WduY0lG4LmlXSOk2EGkWBH4CbZIwEJxEHI-Bmduoh/exec";
  const validationUrl =
    "https://script.google.com/macros/s/AKfycbyaSwpMpH0RCTQkgwzme0N5WYgNP9aERhQs7mQCFX3CvBBFARne_jsM5YW6L705TdET/exec";

  const fetchDeals = async () => {
    setLoading(true);
    try {
      const res = await fetch(dataUrl);
      const data = await res.json();

      const filtered =
        role === "End User"
          ? data.filter((d) =>
              [d["Account Owner"], d["Lead Owner"], d["Owner"]].includes(
                username
              )
            )
          : data;

      setAllDeals(filtered);

      // ✅ Always show latest row per Deal Key
      const seen = new Map();
      filtered.forEach((row, idx) => {
        const key = dealKeyOf(row);
        const existing = seen.get(key);

        const tNew = parseTimestampFlexible(row?.["Timestamp"]);
        const tOld = parseTimestampFlexible(existing?.["Timestamp"]);

        if (!existing) {
          seen.set(key, { ...row, __idx: idx });
          return;
        }

        // both invalid timestamps: prefer later row (append order)
        if (tNew === 0 && tOld === 0) {
          if ((idx ?? 0) > (existing.__idx ?? -1)) {
            seen.set(key, { ...row, __idx: idx });
          }
          return;
        }

        if (tNew > tOld) {
          seen.set(key, { ...row, __idx: idx });
          return;
        }

        if (tNew === tOld && (idx ?? 0) > (existing.__idx ?? -1)) {
          seen.set(key, { ...row, __idx: idx });
        }
      });

      const dedupedLatest = Array.from(seen.values())
        .sort((a, b) => {
          const tb = parseTimestampFlexible(b?.["Timestamp"]);
          const ta = parseTimestampFlexible(a?.["Timestamp"]);
          if (tb !== ta) return tb - ta;
          return (b.__idx ?? 0) - (a.__idx ?? 0);
        })
        .map(({ __idx, ...rest }) => rest);

      setDeals(dedupedLatest);

      const stored =
        JSON.parse(
          localStorage.getItem(`visibleColumns-${username}-deals`)
        ) || null;

      setVisibleColumns(
        stored || (dedupedLatest.length ? Object.keys(dedupedLatest[0]) : [])
      );
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
        const ta = parseTimestampFlexible(a?.["Timestamp"]);
        const tb = parseTimestampFlexible(b?.["Timestamp"]);
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

  const filteredDeals = sortedDeals.filter((deal) => {
    try {
      return (
        [
          "First Name",
          "Last Name",
          "Deal Name",
          "Company",
          "Mobile Number",
          "Stage",
          "Account ID",
        ].some((key) =>
          (deal?.[key] || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        ) &&
        (!filterStage || deal?.["Stage"] === filterStage) &&
        (!filterType || deal?.["Type"] === filterType) &&
        (!filterSource || deal?.["Lead Source"] === filterSource) &&
        (!filterOwner || deal?.["Account Owner"] === filterOwner)
      );
    } catch {
      return false;
    }
  });

  const unique = (key) => [
    ...new Set(deals.map((d) => d?.[key]).filter(Boolean)),
  ];

  const handleColumnToggle = (col) => {
    setVisibleColumns((prev) => {
      const updated = prev.includes(col)
        ? prev.filter((c) => c !== col)
        : [...prev, col];
      localStorage.setItem(
        `visibleColumns-${username}-deals`,
        JSON.stringify(updated)
      );
      return updated;
    });
  };

  const handleSelectAll = () => {
    const all = Object.keys(deals[0] || {});
    setVisibleColumns(all);
    localStorage.setItem(
      `visibleColumns-${username}-deals`,
      JSON.stringify(all)
    );
  };

  const handleDeselectAll = () => {
    setVisibleColumns([]);
    localStorage.setItem(
      `visibleColumns-${username}-deals`,
      JSON.stringify([])
    );
  };

  // ----------------------------
  // Edit Deal (deal-only)
  // ----------------------------
  const handleEditClick = (deal) => {
    setSelectedRow(deal);
    setDealFormData({ ...(deal || {}) });
    setSaveMsg("");
  };

  // ✅ commit function used by memoized DealField (reduces typing lag)
  const commitField = (field, value) => {
    setDealFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitDeal = async () => {
    if (savingDeal) return; // ✅ block double-click

    setSavingDeal(true);
    setSaveMsg("Updating...");

    try {
      await fetch(submitUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "updateDeal", data: dealFormData }),
      });

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
  // Logs (FULL ROW VIEW)
  // ----------------------------
  const handleViewLogs = (dealRow) => {
    const key = dealKeyOf(dealRow);
    if (!key || key === "__") {
      alert("No Deal Name / Account ID found for logs.");
      return;
    }

    const logs = allDeals
      .filter((d) => dealKeyOf(d) === key)
      .map((r, idx) => ({ ...r, __idx: idx }))
      .sort((a, b) => {
        const tb = parseTimestampFlexible(b?.["Timestamp"]);
        const ta = parseTimestampFlexible(a?.["Timestamp"]);
        if (tb !== ta) return tb - ta;
        return (b.__idx ?? 0) - (a.__idx ?? 0);
      })
      .map(({ __idx, ...rest }) => rest);

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
      alert(
        "⚠️ Order already exists for this deal. Please edit it from the Orders table."
      );
      return;
    }

    setOrderBaseRow(deal);

    setOrderForm({
      "Order Amount": deal?.["Order Amount"] || "",
      "Order Delivery Date": deal?.["Order Delivery Date"] || "",
      "Order Delivery Details": deal?.["Order Delivery Details"] || "",
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

    setOrderFiles({
      purchaseOrder: null,
      drawing: null,
      boq: null,
      proforma: null,
    });
    setOrderOpen(true);
  };

  const handleOrderFieldChange = (e) => {
    const { name, value } = e.target;
    setOrderForm((prev) => ({ ...prev, [name]: value }));
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

  const handleCreateOrder = async () => {
    if (!orderBaseRow) return;

    setCreatingOrder(true);
    try {
      const orderId = `ORD-${Date.now()}`;

      const poObj = await fileToBase64(orderFiles.purchaseOrder);
      const drawingObj = await fileToBase64(orderFiles.drawing);
      const boqObj = await fileToBase64(orderFiles.boq);
      const proformaObj = await fileToBase64(orderFiles.proforma);

      const payloadRow = {
        ...orderBaseRow,
        "Order ID": orderId,
        ...orderForm,
        "Attach Purchase Order": poObj,
        "Attach Drawing": drawingObj,
        "Attach BOQ": boqObj,
        "Proforma Invoice": proformaObj,
      };

      await fetch(submitUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "createOrder", data: payloadRow }),
      });

      alert(
        "✅ Order created successfully (edit from Orders table going forward)."
      );
      setOrderOpen(false);
      setOrderBaseRow(null);
      fetchDeals();
    } catch (e) {
      console.error("Create order error:", e);
      alert("❌ Error creating order");
    } finally {
      setCreatingOrder(false);
    }
  };

  const allLogHeaders = dealLogs?.[0] ? Object.keys(dealLogs[0]) : [];
  const logHeaders = allLogHeaders;

  return (
    <ThemeProvider theme={theme}>
      {loading && <LoadingOverlay />}

      <Box padding={4}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
          <Typography variant="h5" fontWeight="bold">
            Deals Records
          </Typography>
        </Box>

        {/* Filters and Search */}
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

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <ViewColumnIcon />
          </IconButton>

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
        <Table>
          <TableHead>
            <TableRow style={{ backgroundColor: "#6495ED" }}>
              {visibleColumns.map((header) => (
                <TableCell
                  key={header}
                  onClick={() => handleSort(header)}
                  style={{ color: "white", cursor: "pointer" }}
                >
                  {header}{" "}
                  {sortConfig.key === header
                    ? sortConfig.direction === "asc"
                      ? "↑"
                      : "↓"
                    : ""}
                </TableCell>
              ))}
              <TableCell style={{ color: "white", fontWeight: "bold" }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredDeals.map((deal, index) => (
              <TableRow key={index}>
                {visibleColumns.map((col, i) => (
                  <TableCell key={i}>{deal?.[col] ?? ""}</TableCell>
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

        {/* -------------------- Edit Deal Modal (DEAL-ONLY) -------------------- */}
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
              <Accordion
                key={section.title}
                defaultExpanded={section.title === "Deal Details"} // ✅ reduce lag: only first section expanded
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    backgroundColor: "#f0f4ff",
                    fontFamily: "Montserrat, sans-serif",
                  }}
                >
                  <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>
                    {section.title}
                  </Typography>
                </AccordionSummary>

                <AccordionDetails>
                  <Grid container spacing={2}>
                    {section.fields.map((field) => (
                      <Grid item xs={6} key={field}>
                        <DealField
                          field={field}
                          value={dealFormData?.[field] || ""}
                          validationData={validationData}
                          disabled={
                            field === "Account Owner" ||
                            field === "Account ID" ||
                            field === "Timestamp"
                          }
                          onCommit={commitField}
                        />
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
        <Dialog open={orderOpen} onClose={() => setOrderOpen(false)} maxWidth="md" fullWidth>
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
                    "Order Delivery Details",
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
                      {validationData?.[field] ? (
                        <FormControl fullWidth size="small">
                          <InputLabel>{field}</InputLabel>
                          <Select
                            name={field}
                            value={orderForm?.[field] || ""}
                            label={field}
                            onChange={handleOrderFieldChange}
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
                          value={orderForm?.[field] || ""}
                          onChange={handleOrderFieldChange}
                          type={field === "Order Delivery Date" ? "date" : "text"}
                          InputLabelProps={
                            field === "Order Delivery Date" ? { shrink: true } : undefined
                          }
                        />
                      )}
                    </Grid>
                  ))}

                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, mb: 1 }}>
                      Attachments
                    </Typography>
                  </Grid>

                  <Grid item xs={6}>
                    <Button variant="outlined" component="label" fullWidth>
                      Attach Purchase Order{" "}
                      {orderFiles?.purchaseOrder ? `: ${orderFiles.purchaseOrder.name}` : ""}
                      <input hidden type="file" onChange={handleOrderFileChange("purchaseOrder")} />
                    </Button>
                  </Grid>

                  <Grid item xs={6}>
                    <Button variant="outlined" component="label" fullWidth>
                      Attach Drawing {orderFiles?.drawing ? `: ${orderFiles.drawing.name}` : ""}
                      <input hidden type="file" onChange={handleOrderFileChange("drawing")} />
                    </Button>
                  </Grid>

                  <Grid item xs={6}>
                    <Button variant="outlined" component="label" fullWidth>
                      Attach BOQ {orderFiles?.boq ? `: ${orderFiles.boq.name}` : ""}
                      <input hidden type="file" onChange={handleOrderFileChange("boq")} />
                    </Button>
                  </Grid>

                  <Grid item xs={6}>
                    <Button variant="outlined" component="label" fullWidth>
                      Proforma Invoice{" "}
                      {orderFiles?.proforma ? `: ${orderFiles.proforma.name}` : ""}
                      <input hidden type="file" onChange={handleOrderFileChange("proforma")} />
                    </Button>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            <Box mt={2} display="flex" justifyContent="flex-end">
              <Button
                variant="contained"
                sx={{ backgroundColor: "#6495ED" }}
                onClick={handleCreateOrder}
                disabled={creatingOrder}
              >
                {creatingOrder ? "Creating..." : "Create Order"}
              </Button>
            </Box>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setOrderOpen(false)}>Close</Button>
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
              <Table size="small">
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
                        <TableCell key={h}>{log?.[h] ?? ""}</TableCell>
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
