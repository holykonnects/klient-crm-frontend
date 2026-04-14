// src/components/ExpenseRequestTable.jsx
import React, { useEffect, useMemo, useState } from "react";
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
  Button,
  Divider,
  Grid,
  TableContainer,
  Paper,
  Chip,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import Autocomplete from "@mui/material/Autocomplete";

import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import CurrencyRupeeIcon from "@mui/icons-material/CurrencyRupee";
import EditIcon from "@mui/icons-material/Edit";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import CloseIcon from "@mui/icons-material/Close";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import "@fontsource/montserrat";

import { useAuth } from "./AuthContext";

const theme = createTheme({
  typography: { fontFamily: "Montserrat, sans-serif" },
});

const cornflowerBlue = "#6495ED";

// ✅ Same costing backend
const BACKEND =
  "https://script.google.com/macros/s/AKfycbzqSTBoeAPCKx9GD9V3Dx7M8YobMzrwkOft49w2SQG3e25tlIW2SysmmuqnQXsAuvP4/exec";

const DEFAULT_PAYMENT_STATUSES = ["Pending", "Partially Paid", "Paid", "Hold/Disputed"];

/* ===================== helpers ===================== */

function safeNum(v) {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function fmtINR(n) {
  try {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
  } catch {
    return String(n);
  }
}

function toStr(v) {
  return String(v == null ? "" : v).trim();
}

/**
 * ✅ JSONP GET (no-cors friendly)
 */
function jsonpGet(url) {
  return new Promise((resolve, reject) => {
    const cbName = `cb_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    let scriptEl = null;

    const cleanup = () => {
      try {
        delete window[cbName];
      } catch {}
      if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
    };

    window[cbName] = (data) => {
      cleanup();
      resolve(data);
    };

    scriptEl = document.createElement("script");
    scriptEl.src = `${url}${url.includes("?") ? "&" : "?"}callback=${encodeURIComponent(cbName)}`;
    scriptEl.async = true;

    scriptEl.onerror = () => {
      cleanup();
      reject(new Error("JSONP load failed"));
    };

    document.body.appendChild(scriptEl);
  });
}

// ✅ NO-CORS SAFE POST
async function apiPost(payload) {
  await fetch(BACKEND, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify(payload),
  });
  return { success: true };
}

function getRoleBucket(role) {
  const r = String(role || "").toLowerCase().trim();
  if (r === "admin") return "admin";
  if (r === "operations manager" || r === "operations" || r === "ops manager") return "operations";
  if (r === "accounts" || r === "accounts team" || r === "finance") return "accounts";
  return "end_user";
}

function statusChipColor(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return { bg: "#e8f5e9", color: "#2e7d32", border: "#c8e6c9" };
  if (s === "rejected") return { bg: "#ffebee", color: "#c62828", border: "#ffcdd2" };
  if (s === "on hold") return { bg: "#fff8e1", color: "#ef6c00", border: "#ffe0b2" };
  if (s === "yes") return { bg: "#e3f2fd", color: "#1565c0", border: "#bbdefb" };
  return { bg: "#eef4ff", color: "#1f2a44", border: "#d9e4ff" };
}

function getCostSheetDisplayLabel(opt) {
  if (!opt) return "";
  return String(opt.display || opt.label || opt.costSheetId || "");
}

function getLinkedEntityDisplayLabel(opt) {
  if (!opt) return "";
  return String(opt.display || "");
}

function makeBlankExpenseRow() {
  return { particular: "", description: "", amount: "" };
}

function normalizeValidationResponse(raw) {
  const v = raw?.data ? raw.data : raw;

  const headsDirect = Array.isArray(v?.heads) ? v.heads : null;
  const subcatsDirect =
    v?.subcategories && typeof v.subcategories === "object" ? v.subcategories : null;
  const payDirect = Array.isArray(v?.paymentStatus) ? v.paymentStatus : null;

  if (headsDirect || subcatsDirect || payDirect) {
    const pay = (payDirect && payDirect.length ? payDirect : DEFAULT_PAYMENT_STATUSES).map((x) =>
      String(x).trim()
    );
    return {
      heads: headsDirect || [],
      subcategories: subcatsDirect || {},
      paymentStatus: pay,
    };
  }

  return {
    heads: [],
    subcategories: {},
    paymentStatus: DEFAULT_PAYMENT_STATUSES,
  };
}

/* ===================== Component ===================== */

export default function ExpenseRequestTable() {
  const { user } = useAuth();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const loggedInName = user?.username || user?.name || user?.email || "";
  const loggedInEmail = user?.email || "";
  const role = user?.role || "";
  const roleBucket = getRoleBucket(role);
  const isAdmin = roleBucket === "admin";
  const isOperations = roleBucket === "operations" || isAdmin;
  const isAccounts = roleBucket === "accounts" || isAdmin;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [validation, setValidation] = useState({
    heads: [],
    subcategories: {},
    paymentStatus: DEFAULT_PAYMENT_STATUSES,
  });

  const [requests, setRequests] = useState([]);
  const [approvalQueue, setApprovalQueue] = useState([]);
  const [accountsQueue, setAccountsQueue] = useState([]);
  const [costSheetOptions, setCostSheetOptions] = useState([]);
  const [linkedEntityOptions, setLinkedEntityOptions] = useState([]);

  const [search, setSearch] = useState("");
  const [approvalStatusFilter, setApprovalStatusFilter] = useState("");
  const [syncFilter, setSyncFilter] = useState("");

  const [openAddModal, setOpenAddModal] = useState(false);
  const [openApprovalModal, setOpenApprovalModal] = useState(false);
  const [openAccountsModal, setOpenAccountsModal] = useState(false);

  const [expenseRows, setExpenseRows] = useState([makeBlankExpenseRow()]);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const [approvalForm, setApprovalForm] = useState({
    requestId: "",
    approvalStatus: "Approved",
    "Linked Entity Type": "",
    "Linked Entity ID": "",
    "Linked Entity Name": "",
    "Existing Cost Sheet ID": "",
    "Existing Cost Sheet Name": "",
    "Operations Remarks": "",
    "Rejection Remarks": "",
    "Hold Remarks": "",
  });

  const [accountsForm, setAccountsForm] = useState({
    requestId: "",
    headName: "Miscellaneous",
    subcategory: "",
    amount: "",
    gstPct: "",
    expenseDate: "",
    details: "",
    paymentStatus: "Pending",
    voucherNo: "",
    "Linked Entity Type": "",
    "Linked Entity ID": "",
    "Linked Entity Name": "",
    "Existing Cost Sheet ID": "",
    "Existing Cost Sheet Name": "",
  });

  const selectedApprovalCostSheetOption = useMemo(() => {
    const id = toStr(approvalForm["Existing Cost Sheet ID"]);
    if (!id) return null;
    return costSheetOptions.find((x) => toStr(x.costSheetId) === id) || null;
  }, [approvalForm, costSheetOptions]);

  const selectedApprovalLinkedEntityOption = useMemo(() => {
    const type = toStr(approvalForm["Linked Entity Type"]);
    const id = toStr(approvalForm["Linked Entity ID"]);
    const name = toStr(approvalForm["Linked Entity Name"]);

    return (
      linkedEntityOptions.find(
        (x) =>
          toStr(x.linkedEntityType) === type &&
          toStr(x.linkedEntityId) === id &&
          toStr(x.linkedEntityName) === name
      ) || null
    );
  }, [approvalForm, linkedEntityOptions]);

  const selectedAccountsCostSheetOption = useMemo(() => {
    const id = toStr(accountsForm["Existing Cost Sheet ID"]);
    if (!id) return null;
    return costSheetOptions.find((x) => toStr(x.costSheetId) === id) || null;
  }, [accountsForm, costSheetOptions]);

  const selectedAccountsLinkedEntityOption = useMemo(() => {
    const type = toStr(accountsForm["Linked Entity Type"]);
    const id = toStr(accountsForm["Linked Entity ID"]);
    const name = toStr(accountsForm["Linked Entity Name"]);

    return (
      linkedEntityOptions.find(
        (x) =>
          toStr(x.linkedEntityType) === type &&
          toStr(x.linkedEntityId) === id &&
          toStr(x.linkedEntityName) === name
      ) || null
    );
  }, [accountsForm, linkedEntityOptions]);

  const expenseTotal = useMemo(() => {
    return (expenseRows || []).reduce((acc, r) => acc + safeNum(r.amount), 0);
  }, [expenseRows]);

  function subcatsForHead(head) {
    const m = validation.subcategories || {};
    return Array.isArray(m[head]) ? m[head] : [];
  }

  async function loadValidation() {
    const raw = await jsonpGet(`${BACKEND}?action=getValidation`);
    const parsed = normalizeValidationResponse(raw);
    setValidation(parsed);
  }

  async function loadMyRequests() {
    const res = await jsonpGet(
      `${BACKEND}?action=getExpenseRequests&raisedBy=${encodeURIComponent(
        loggedInName || ""
      )}&raisedByEmail=${encodeURIComponent(loggedInEmail || "")}&role=${encodeURIComponent(role || "")}`
    );
    setRequests(Array.isArray(res) ? res : []);
  }

  async function loadApprovalQueue() {
    const res = await jsonpGet(`${BACKEND}?action=getExpenseApprovalQueue`);
    setApprovalQueue(Array.isArray(res) ? res : []);
  }

  async function loadAccountsQueue() {
    const res = await jsonpGet(`${BACKEND}?action=getExpenseAccountsQueue`);
    setAccountsQueue(Array.isArray(res) ? res : []);
  }

  async function loadMappingOptions() {
    const [costSheetsRes, linkedEntitiesRes] = await Promise.all([
      jsonpGet(`${BACKEND}?action=getCostSheetsForMapping`),
      jsonpGet(`${BACKEND}?action=getLinkedEntitiesForMapping`),
    ]);

    setCostSheetOptions(Array.isArray(costSheetsRes) ? costSheetsRes : []);
    setLinkedEntityOptions(Array.isArray(linkedEntitiesRes) ? linkedEntitiesRes : []);
  }

  async function refreshAll() {
    setLoading(true);
    try {
      const tasks = [loadMyRequests(), loadValidation()];
      if (isOperations) {
        tasks.push(loadApprovalQueue(), loadMappingOptions());
      }
      if (isAccounts) {
        tasks.push(loadAccountsQueue(), loadMappingOptions());
      }
      await Promise.all(tasks);
    } catch (e) {
      console.error("EXPENSE_REQUEST_REFRESH_ERROR", e);
      alert("Failed to load expense requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, [loggedInName, loggedInEmail, role]);

  function openAddExpenseModal() {
    setExpenseRows([makeBlankExpenseRow()]);
    setOpenAddModal(true);
  }

  function setExpenseRowField(index, key, value) {
    setExpenseRows((prev) => {
      const next = [...prev];
      const current = { ...(next[index] || makeBlankExpenseRow()) };
      current[key] = value;
      next[index] = current;
      return next;
    });
  }

  function addExpenseRow() {
    setExpenseRows((prev) => [...(prev || []), makeBlankExpenseRow()]);
  }

  function removeExpenseRow(index) {
    setExpenseRows((prev) => {
      const next = [...(prev || [])];
      next.splice(index, 1);
      return next.length ? next : [makeBlankExpenseRow()];
    });
  }

  async function submitExpenseRequestBatch() {
    const cleanedRows = (expenseRows || [])
      .map((r) => ({
        particular: toStr(r.particular),
        description: toStr(r.description),
        amount: safeNum(r.amount),
      }))
      .filter((r) => r.particular && r.amount > 0);

    if (!cleanedRows.length) {
      alert("Please enter at least one valid expense row with Particular and Amount.");
      return;
    }

    setSaving(true);
    try {
      await apiPost({
        action: "createExpenseRequestBatch",
        data: {
          raisedBy: loggedInName,
          raisedByEmail: loggedInEmail,
          owner: loggedInName,
          rows: cleanedRows,
        },
      });

      setOpenAddModal(false);
      setExpenseRows([makeBlankExpenseRow()]);

      setTimeout(async () => {
        await refreshAll();
      }, 250);

      alert(
        cleanedRows.length === 1
          ? "Expense request submitted."
          : `${cleanedRows.length} expense requests submitted.`
      );
    } catch (e) {
      console.error("CREATE_EXPENSE_BATCH_ERROR", e);
      alert("Failed to submit expense request.");
    } finally {
      setSaving(false);
    }
  }

  function openApprovalForRow(row) {
    setSelectedRequest(row || null);
    setApprovalForm({
      requestId: toStr(row?.["Request ID"]),
      approvalStatus: toStr(row?.["Approval Status"]) || "Approved",
      "Linked Entity Type": toStr(row?.["Linked Entity Type"]),
      "Linked Entity ID": toStr(row?.["Linked Entity ID"]),
      "Linked Entity Name": toStr(row?.["Linked Entity Name"]),
      "Existing Cost Sheet ID": toStr(row?.["Existing Cost Sheet ID"]),
      "Existing Cost Sheet Name": toStr(row?.["Existing Cost Sheet Name"]),
      "Operations Remarks": toStr(row?.["Operations Remarks"]),
      "Rejection Remarks": toStr(row?.["Rejection Remarks"]),
      "Hold Remarks": toStr(row?.["Hold Remarks"]),
    });
    setOpenApprovalModal(true);
  }

  async function saveApproval() {
    if (!approvalForm.requestId) {
      alert("Request ID missing.");
      return;
    }

    if (!approvalForm.approvalStatus) {
      alert("Please select Approval Status.");
      return;
    }

    setSaving(true);
    try {
      await apiPost({
        action: "updateExpenseRequestApproval",
        data: {
          requestId: approvalForm.requestId,
          approvalStatus: approvalForm.approvalStatus,
          actionBy: loggedInName,
          "Linked Entity Type": approvalForm["Linked Entity Type"],
          "Linked Entity ID": approvalForm["Linked Entity ID"],
          "Linked Entity Name": approvalForm["Linked Entity Name"],
          "Existing Cost Sheet ID": approvalForm["Existing Cost Sheet ID"],
          "Existing Cost Sheet Name": approvalForm["Existing Cost Sheet Name"],
          "Operations Remarks": approvalForm["Operations Remarks"],
          "Rejection Remarks": approvalForm["Rejection Remarks"],
          "Hold Remarks": approvalForm["Hold Remarks"],
        },
      });

      setOpenApprovalModal(false);
      setSelectedRequest(null);

      setTimeout(async () => {
        await refreshAll();
      }, 250);

      alert("Expense request updated.");
    } catch (e) {
      console.error("UPDATE_EXPENSE_APPROVAL_ERROR", e);
      alert("Failed to update expense request.");
    } finally {
      setSaving(false);
    }
  }

  function openAccountsEdit(row) {
    setSelectedRequest(row || null);
    setAccountsForm({
      requestId: row["Request ID"] || "",
      headName: "Miscellaneous",
      subcategory: "",
      amount: row["Amount"] || "",
      gstPct: "",
      expenseDate: "",
      details: row["Description"] || "",
      paymentStatus: "Pending",
      voucherNo: "",
      "Linked Entity Type": row["Linked Entity Type"] || "",
      "Linked Entity ID": row["Linked Entity ID"] || "",
      "Linked Entity Name": row["Linked Entity Name"] || "",
      "Existing Cost Sheet ID": row["Existing Cost Sheet ID"] || "",
      "Existing Cost Sheet Name": row["Existing Cost Sheet Name"] || "",
    });
    setOpenAccountsModal(true);
  }

  async function handleAccountsSync() {
    if (!accountsForm.requestId) {
      alert("Request ID missing.");
      return;
    }

    setSaving(true);
    try {
      await apiPost({
        action: "syncExpenseRequestToCostLine",
        data: {
          requestId: accountsForm.requestId,
          syncedBy: loggedInName,
          headName: accountsForm.headName,
          subcategory: accountsForm.subcategory,
          amount: Number(accountsForm.amount || 0),
          gstPct: Number(accountsForm.gstPct || 0),
          expenseDate: accountsForm.expenseDate,
          details: accountsForm.details,
          paymentStatus: accountsForm.paymentStatus,
          voucherNo: accountsForm.voucherNo,
          "Linked Entity Type": accountsForm["Linked Entity Type"],
          "Linked Entity ID": accountsForm["Linked Entity ID"],
          "Linked Entity Name": accountsForm["Linked Entity Name"],
          "Existing Cost Sheet ID": accountsForm["Existing Cost Sheet ID"],
          "Existing Cost Sheet Name": accountsForm["Existing Cost Sheet Name"],
        },
      });

      setOpenAccountsModal(false);
      setSelectedRequest(null);

      setTimeout(async () => {
        await refreshAll();
      }, 250);

      alert("Expense request synced to Cost Line Items.");
    } catch (e) {
      console.error("HANDLE_ACCOUNTS_SYNC_ERROR", e);
      alert("Failed to sync expense request.");
    } finally {
      setSaving(false);
    }
  }

  const filteredMyRequests = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (requests || []).filter((r) => {
      const approvalOk =
        !approvalStatusFilter ||
        toStr(r["Approval Status"]).toLowerCase() === approvalStatusFilter.toLowerCase();

      const syncOk =
        !syncFilter ||
        toStr(r["Synced To Cost Line"]).toLowerCase() === syncFilter.toLowerCase();

      const hay = [
        r["Batch ID"],
        r["Request ID"],
        r["Particular"],
        r["Description"],
        r["Raised By"],
        r["Approval Status"],
        r["Attribution Status"],
      ]
        .map((x) => String(x || ""))
        .join(" ")
        .toLowerCase();

      const qOk = !q || hay.includes(q);
      return approvalOk && syncOk && qOk;
    });
  }, [requests, search, approvalStatusFilter, syncFilter]);

  const filteredApprovalQueue = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (approvalQueue || []).filter((r) => {
      const approvalOk =
        !approvalStatusFilter ||
        toStr(r["Approval Status"]).toLowerCase() === approvalStatusFilter.toLowerCase();

      const hay = [
        r["Request ID"],
        r["Raised By"],
        r["Particular"],
        r["Description"],
        r["Existing Cost Sheet Name"],
        r["Linked Entity Name"],
      ]
        .map((x) => String(x || ""))
        .join(" ")
        .toLowerCase();

      const qOk = !q || hay.includes(q);
      return approvalOk && qOk;
    });
  }, [approvalQueue, search, approvalStatusFilter]);

  const filteredAccountsQueue = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (accountsQueue || []).filter((r) => {
      const syncOk =
        !syncFilter ||
        toStr(r["Synced To Cost Line"]).toLowerCase() === syncFilter.toLowerCase();

      const hay = [
        r["Request ID"],
        r["Raised By"],
        r["Particular"],
        r["Existing Cost Sheet Name"],
        r["Linked Entity Name"],
        r["Approval Status"],
      ]
        .map((x) => String(x || ""))
        .join(" ")
        .toLowerCase();

      const qOk = !q || hay.includes(q);
      return syncOk && qOk;
    });
  }, [accountsQueue, search, syncFilter]);

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ p: isMobile ? 1 : 2 }}>
        {/* HEADER */}
        <Box padding={isMobile ? 1.5 : 4}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} gap={1}>
            <img
              src="/assets/kk-logo.png"
              alt="Klient Konnect"
              style={{ height: isMobile ? 60 : 100 }}
            />

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <CurrencyRupeeIcon sx={{ color: cornflowerBlue }} />
              <Typography
                variant={isMobile ? "h6" : "h5"}
                fontWeight="bold"
                sx={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Expense Requests
              </Typography>

              {loading ? (
                <Typography sx={{ fontSize: 12, opacity: 0.7, ml: 1 }}>Loading…</Typography>
              ) : null}
            </Box>
          </Box>

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={refreshAll}
              sx={{ fontFamily: "Montserrat, sans-serif", width: isMobile ? "100%" : "auto" }}
            >
              Refresh
            </Button>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openAddExpenseModal}
              sx={{
                bgcolor: cornflowerBlue,
                fontFamily: "Montserrat, sans-serif",
                width: isMobile ? "100%" : "auto",
              }}
            >
              Raise Expense Request
            </Button>
          </Box>
        </Box>

        {/* FILTERS */}
        <Paper sx={{ p: 1.5, borderRadius: 2, border: "1px solid #eee", mb: 2 }}>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            <TextField
              size="small"
              label="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: isMobile ? "100%" : 240 }}
            />

            <FormControl size="small" sx={{ minWidth: isMobile ? "100%" : 180 }}>
              <InputLabel>Approval Status</InputLabel>
              <Select
                value={approvalStatusFilter}
                label="Approval Status"
                onChange={(e) => setApprovalStatusFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {["Pending", "Approved", "Rejected", "On Hold"].map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: isMobile ? "100%" : 160 }}>
              <InputLabel>Synced</InputLabel>
              <Select
                value={syncFilter}
                label="Synced"
                onChange={(e) => setSyncFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="Yes">Yes</MenuItem>
                <MenuItem value="No">No</MenuItem>
              </Select>
            </FormControl>

            <Chip
              label={`Role: ${role || "User"}`}
              size="small"
              sx={{
                fontWeight: 700,
                bgcolor: "#eef4ff",
                border: "1px solid #d9e4ff",
                color: "#1f2a44",
              }}
            />
          </Box>
        </Paper>

        {/* MY REQUESTS */}
        <Paper sx={{ p: 1.5, borderRadius: 2, border: "1px solid #eee", mb: 2 }}>
          <Typography sx={{ fontWeight: 900, fontSize: 14, mb: 1 }}>My Requests</Typography>

          {isMobile ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {filteredMyRequests.map((r, idx) => {
                const approvalChip = statusChipColor(r["Approval Status"]);
                const syncChip = statusChipColor(r["Synced To Cost Line"]);

                return (
                  <Paper
                    key={toStr(r["Request ID"]) || idx}
                    sx={{
                      p: 1.25,
                      borderRadius: 2,
                      border: "1px solid #eee",
                    }}
                  >
                    <Typography sx={{ fontWeight: 800, fontSize: 13 }}>
                      {toStr(r["Particular"]) || "-"}
                    </Typography>

                    <Typography sx={{ fontSize: 12, opacity: 0.8, mt: 0.25 }}>
                      Request ID: {toStr(r["Request ID"]) || "-"}
                    </Typography>

                    <Typography sx={{ fontSize: 12, opacity: 0.8 }}>
                      Batch ID: {toStr(r["Batch ID"]) || "-"}
                    </Typography>

                    <Typography sx={{ fontSize: 12, mt: 0.5 }}>
                      ₹ {fmtINR(safeNum(r["Amount"]))}
                    </Typography>

                    <Typography sx={{ fontSize: 12, opacity: 0.8, mt: 0.5 }}>
                      {toStr(r["Description"]) || "-"}
                    </Typography>

                    <Typography sx={{ fontSize: 11, opacity: 0.7, mt: 0.5 }}>
                      {String(r["Timestamp"] || "")}
                    </Typography>

                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
                      <Chip
                        size="small"
                        label={toStr(r["Approval Status"]) || "-"}
                        sx={{
                          bgcolor: approvalChip.bg,
                          color: approvalChip.color,
                          border: `1px solid ${approvalChip.border}`,
                          fontWeight: 700,
                        }}
                      />
                      <Chip
                        size="small"
                        label={toStr(r["Synced To Cost Line"]) || "-"}
                        sx={{
                          bgcolor: syncChip.bg,
                          color: syncChip.color,
                          border: `1px solid ${syncChip.border}`,
                          fontWeight: 700,
                        }}
                      />
                    </Box>
                  </Paper>
                );
              })}

              {!filteredMyRequests.length ? (
                <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                  No expense requests found.
                </Typography>
              ) : null}
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ background: "#f6f9ff" }}>
                    <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Batch ID</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Request ID</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Particular</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Amount</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Approval</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Attribution</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Synced</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Timestamp</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredMyRequests.map((r, idx) => {
                    const approvalChip = statusChipColor(r["Approval Status"]);
                    const syncChip = statusChipColor(r["Synced To Cost Line"]);

                    return (
                      <TableRow key={toStr(r["Request ID"]) || idx} hover>
                        <TableCell sx={{ fontSize: 12 }}>{toStr(r["Batch ID"])}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{toStr(r["Request ID"])}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{toStr(r["Particular"])}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{toStr(r["Description"])}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>₹ {fmtINR(safeNum(r["Amount"]))}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>
                          <Chip
                            size="small"
                            label={toStr(r["Approval Status"]) || "-"}
                            sx={{
                              bgcolor: approvalChip.bg,
                              color: approvalChip.color,
                              border: `1px solid ${approvalChip.border}`,
                              fontWeight: 700,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{toStr(r["Attribution Status"]) || "-"}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>
                          <Chip
                            size="small"
                            label={toStr(r["Synced To Cost Line"]) || "-"}
                            sx={{
                              bgcolor: syncChip.bg,
                              color: syncChip.color,
                              border: `1px solid ${syncChip.border}`,
                              fontWeight: 700,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{String(r["Timestamp"] || "")}</TableCell>
                      </TableRow>
                    );
                  })}

                  {!filteredMyRequests.length ? (
                    <TableRow>
                      <TableCell colSpan={9} sx={{ fontSize: 12, opacity: 0.7 }}>
                        No expense requests found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {/* OPERATIONS QUEUE */}
        {isOperations ? (
          <Paper sx={{ p: 1.5, borderRadius: 2, border: "1px solid #eee", mb: 2 }}>
            <Typography sx={{ fontWeight: 900, fontSize: 14, mb: 1 }}>Approval Queue</Typography>

            {isMobile ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {filteredApprovalQueue.map((r, idx) => {
                  const approvalChip = statusChipColor(r["Approval Status"]);

                  return (
                    <Paper
                      key={toStr(r["Request ID"]) || idx}
                      sx={{ p: 1.25, borderRadius: 2, border: "1px solid #eee" }}
                    >
                      <Typography sx={{ fontWeight: 800, fontSize: 13 }}>
                        {toStr(r["Particular"]) || "-"}
                      </Typography>
                      <Typography sx={{ fontSize: 12, opacity: 0.8, mt: 0.25 }}>
                        Request ID: {toStr(r["Request ID"]) || "-"}
                      </Typography>
                      <Typography sx={{ fontSize: 12, opacity: 0.8 }}>
                        Raised By: {toStr(r["Raised By"]) || "-"}
                      </Typography>
                      <Typography sx={{ fontSize: 12, mt: 0.5 }}>
                        ₹ {fmtINR(safeNum(r["Amount"]))}
                      </Typography>
                      <Typography sx={{ fontSize: 12, opacity: 0.8, mt: 0.5 }}>
                        {toStr(r["Description"]) || "-"}
                      </Typography>
                      <Typography sx={{ fontSize: 12, opacity: 0.8, mt: 0.5 }}>
                        Linked Entity: {toStr(r["Linked Entity Name"]) || "-"}
                      </Typography>
                      <Typography sx={{ fontSize: 12, opacity: 0.8 }}>
                        Cost Sheet: {toStr(r["Existing Cost Sheet Name"]) || "-"}
                      </Typography>

                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
                        <Chip
                          size="small"
                          label={toStr(r["Approval Status"]) || "-"}
                          sx={{
                            bgcolor: approvalChip.bg,
                            color: approvalChip.color,
                            border: `1px solid ${approvalChip.border}`,
                            fontWeight: 700,
                          }}
                        />
                      </Box>

                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => openApprovalForRow(r)}
                        sx={{ bgcolor: cornflowerBlue, mt: 1, width: "100%" }}
                        disabled={saving}
                      >
                        Review
                      </Button>
                    </Paper>
                  );
                })}

                {!filteredApprovalQueue.length ? (
                  <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                    No approval items found.
                  </Typography>
                ) : null}
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ background: "#f6f9ff" }}>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Request ID</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Raised By</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Particular</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Amount</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Approval</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Linked Entity</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Cost Sheet</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {filteredApprovalQueue.map((r, idx) => {
                      const approvalChip = statusChipColor(r["Approval Status"]);

                      return (
                        <TableRow key={toStr(r["Request ID"]) || idx} hover>
                          <TableCell sx={{ fontSize: 12 }}>{toStr(r["Request ID"])}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{toStr(r["Raised By"])}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{toStr(r["Particular"])}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{toStr(r["Description"])}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>₹ {fmtINR(safeNum(r["Amount"]))}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>
                            <Chip
                              size="small"
                              label={toStr(r["Approval Status"]) || "-"}
                              sx={{
                                bgcolor: approvalChip.bg,
                                color: approvalChip.color,
                                border: `1px solid ${approvalChip.border}`,
                                fontWeight: 700,
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{toStr(r["Linked Entity Name"]) || "-"}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{toStr(r["Existing Cost Sheet Name"]) || "-"}</TableCell>
                          <TableCell>
                            <IconButton
                              onClick={() => openApprovalForRow(r)}
                              title="Review / Approve"
                              disabled={saving}
                            >
                              <EditIcon sx={{ color: cornflowerBlue }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {!filteredApprovalQueue.length ? (
                      <TableRow>
                        <TableCell colSpan={9} sx={{ fontSize: 12, opacity: 0.7 }}>
                          No approval items found.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        ) : null}

        {/* ACCOUNTS QUEUE */}
        {isAccounts ? (
          <Paper sx={{ p: 1.5, borderRadius: 2, border: "1px solid #eee" }}>
            <Typography sx={{ fontWeight: 900, fontSize: 14, mb: 1 }}>Accounts Queue</Typography>

            {isMobile ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {filteredAccountsQueue.map((r, idx) => {
                  const syncChip = statusChipColor(r["Synced To Cost Line"]);
                  const alreadySynced =
                    toStr(r["Synced To Cost Line"]).toLowerCase() === "yes";

                  return (
                    <Paper
                      key={toStr(r["Request ID"]) || idx}
                      sx={{ p: 1.25, borderRadius: 2, border: "1px solid #eee" }}
                    >
                      <Typography sx={{ fontWeight: 800, fontSize: 13 }}>
                        {toStr(r["Particular"]) || "-"}
                      </Typography>
                      <Typography sx={{ fontSize: 12, opacity: 0.8, mt: 0.25 }}>
                        Request ID: {toStr(r["Request ID"]) || "-"}
                      </Typography>
                      <Typography sx={{ fontSize: 12, opacity: 0.8 }}>
                        Raised By: {toStr(r["Raised By"]) || "-"}
                      </Typography>
                      <Typography sx={{ fontSize: 12, mt: 0.5 }}>
                        ₹ {fmtINR(safeNum(r["Amount"]))}
                      </Typography>
                      <Typography sx={{ fontSize: 12, opacity: 0.8, mt: 0.5 }}>
                        Linked Entity: {toStr(r["Linked Entity Name"]) || "-"}
                      </Typography>
                      <Typography sx={{ fontSize: 12, opacity: 0.8 }}>
                        Cost Sheet: {toStr(r["Existing Cost Sheet Name"]) || "-"}
                      </Typography>

                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
                        <Chip
                          size="small"
                          label={toStr(r["Synced To Cost Line"]) || "-"}
                          sx={{
                            bgcolor: syncChip.bg,
                            color: syncChip.color,
                            border: `1px solid ${syncChip.border}`,
                            fontWeight: 700,
                          }}
                        />
                      </Box>

                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => openAccountsEdit(r)}
                        sx={{ bgcolor: cornflowerBlue, mt: 1, width: "100%" }}
                        disabled={saving || alreadySynced}
                      >
                        Edit & Sync
                      </Button>
                    </Paper>
                  );
                })}

                {!filteredAccountsQueue.length ? (
                  <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                    No approved account items found.
                  </Typography>
                ) : null}
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ background: "#f6f9ff" }}>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Request ID</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Raised By</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Particular</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Amount</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Linked Entity</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Cost Sheet</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Synced</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {filteredAccountsQueue.map((r, idx) => {
                      const syncChip = statusChipColor(r["Synced To Cost Line"]);
                      const alreadySynced =
                        toStr(r["Synced To Cost Line"]).toLowerCase() === "yes";

                      return (
                        <TableRow key={toStr(r["Request ID"]) || idx} hover>
                          <TableCell sx={{ fontSize: 12 }}>{toStr(r["Request ID"])}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{toStr(r["Raised By"])}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{toStr(r["Particular"])}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>₹ {fmtINR(safeNum(r["Amount"]))}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{toStr(r["Linked Entity Name"]) || "-"}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{toStr(r["Existing Cost Sheet Name"]) || "-"}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>
                            <Chip
                              size="small"
                              label={toStr(r["Synced To Cost Line"]) || "-"}
                              sx={{
                                bgcolor: syncChip.bg,
                                color: syncChip.color,
                                border: `1px solid ${syncChip.border}`,
                                fontWeight: 700,
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton
                              onClick={() => openAccountsEdit(r)}
                              title="Edit & Sync"
                              disabled={saving || alreadySynced}
                            >
                              <SyncAltIcon
                                sx={{ color: alreadySynced ? "#bbb" : cornflowerBlue }}
                              />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {!filteredAccountsQueue.length ? (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ fontSize: 12, opacity: 0.7 }}>
                          No approved account items found.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        ) : null}

        {/* ================= ADD EXPENSE REQUEST MODAL ================= */}
        <Dialog
          open={openAddModal}
          onClose={() => setOpenAddModal(false)}
          maxWidth="md"
          fullWidth
          fullScreen={isMobile}
        >
          <DialogTitle sx={{ fontWeight: 800 }}>Raise Expense Request</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    borderColor: "#e9eefc",
                    bgcolor: "#fbfcff",
                  }}
                >
                  <Typography sx={{ fontWeight: 900, fontSize: 12 }}>Batch Summary</Typography>
                  <Typography sx={{ fontSize: 12, opacity: 0.8 }}>
                    Line items: {expenseRows.length} | Total: ₹ {fmtINR(expenseTotal)}
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                  {(expenseRows || []).map((row, idx) => (
                    <Paper
                      key={idx}
                      variant="outlined"
                      sx={{
                        p: isMobile ? 1 : 1.25,
                        borderRadius: 2,
                        borderColor: "#e9eefc",
                        bgcolor: "#ffffff",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                          mb: 1,
                        }}
                      >
                        <Typography sx={{ fontWeight: 900, fontSize: 12 }}>
                          Item #{idx + 1}
                        </Typography>

                        <IconButton
                          size={isMobile ? "medium" : "small"}
                          onClick={() => removeExpenseRow(idx)}
                          disabled={expenseRows.length <= 1}
                          title={
                            expenseRows.length <= 1
                              ? "At least one line item is required"
                              : "Remove this line item"
                          }
                        >
                          <CloseIcon sx={{ color: expenseRows.length <= 1 ? "#bbb" : "#c62828" }} />
                        </IconButton>
                      </Box>

                      <Grid container spacing={1.25}>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Particular"
                            value={row.particular || ""}
                            onChange={(e) =>
                              setExpenseRowField(idx, "particular", e.target.value)
                            }
                          />
                        </Grid>

                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Description"
                            value={row.description || ""}
                            onChange={(e) =>
                              setExpenseRowField(idx, "description", e.target.value)
                            }
                            multiline
                            minRows={2}
                          />
                        </Grid>

                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Amount"
                            value={row.amount || ""}
                            onChange={(e) => setExpenseRowField(idx, "amount", e.target.value)}
                          />
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={addExpenseRow}
                  sx={{
                    fontFamily: "Montserrat, sans-serif",
                    width: isMobile ? "100%" : "auto",
                  }}
                >
                  Add Another Line Item
                </Button>
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions
            sx={{
              position: isMobile ? "sticky" : "static",
              bottom: 0,
              background: "#fff",
              borderTop: isMobile ? "1px solid #eee" : "none",
              p: isMobile ? 1.5 : undefined,
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? 1 : 0,
            }}
          >
            <Button onClick={() => setOpenAddModal(false)} fullWidth={isMobile}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={submitExpenseRequestBatch}
              sx={{ bgcolor: cornflowerBlue }}
              disabled={saving}
              fullWidth={isMobile}
            >
              {saving ? "Submitting…" : "Submit"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ================= APPROVAL MODAL ================= */}
        <Dialog
          open={openApprovalModal}
          onClose={() => setOpenApprovalModal(false)}
          maxWidth="md"
          fullWidth
          fullScreen={isMobile}
        >
          <DialogTitle sx={{ fontWeight: 800 }}>Review Expense Request</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Request ID"
                  value={selectedRequest?.["Request ID"] || ""}
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Raised By"
                  value={selectedRequest?.["Raised By"] || ""}
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Particular"
                  value={selectedRequest?.["Particular"] || ""}
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Description"
                  value={selectedRequest?.["Description"] || ""}
                  InputProps={{ readOnly: true }}
                  multiline
                  minRows={2}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Amount"
                  value={`₹ ${fmtINR(safeNum(selectedRequest?.["Amount"]))}`}
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Approval Status</InputLabel>
                  <Select
                    label="Approval Status"
                    value={approvalForm.approvalStatus}
                    onChange={(e) =>
                      setApprovalForm((p) => ({ ...p, approvalStatus: e.target.value }))
                    }
                  >
                    {["Pending", "Approved", "Rejected", "On Hold"].map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Autocomplete
                  size="small"
                  options={linkedEntityOptions}
                  value={selectedApprovalLinkedEntityOption}
                  isOptionEqualToValue={(a, b) =>
                    toStr(a?.linkedEntityType) === toStr(b?.linkedEntityType) &&
                    toStr(a?.linkedEntityId) === toStr(b?.linkedEntityId) &&
                    toStr(a?.linkedEntityName) === toStr(b?.linkedEntityName)
                  }
                  getOptionLabel={getLinkedEntityDisplayLabel}
                  onChange={(_, picked) => {
                    setApprovalForm((p) => ({
                      ...p,
                      "Linked Entity Type": picked?.linkedEntityType || "",
                      "Linked Entity ID": picked?.linkedEntityId || "",
                      "Linked Entity Name": picked?.linkedEntityName || "",
                    }));
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Linked Entity / Site (Search)" />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Autocomplete
                  size="small"
                  options={costSheetOptions}
                  value={selectedApprovalCostSheetOption}
                  isOptionEqualToValue={(a, b) =>
                    toStr(a?.costSheetId) === toStr(b?.costSheetId)
                  }
                  getOptionLabel={getCostSheetDisplayLabel}
                  onChange={(_, picked) => {
                    setApprovalForm((p) => ({
                      ...p,
                      "Existing Cost Sheet ID": picked?.costSheetId || "",
                      "Existing Cost Sheet Name": picked?.display || "",
                    }));
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Existing Cost Sheet (Search)" />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Operations Remarks"
                  value={approvalForm["Operations Remarks"] || ""}
                  onChange={(e) =>
                    setApprovalForm((p) => ({
                      ...p,
                      "Operations Remarks": e.target.value,
                    }))
                  }
                  multiline
                  minRows={2}
                />
              </Grid>

              {approvalForm.approvalStatus === "Rejected" ? (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Rejection Remarks"
                    value={approvalForm["Rejection Remarks"] || ""}
                    onChange={(e) =>
                      setApprovalForm((p) => ({
                        ...p,
                        "Rejection Remarks": e.target.value,
                      }))
                    }
                    multiline
                    minRows={2}
                  />
                </Grid>
              ) : null}

              {approvalForm.approvalStatus === "On Hold" ? (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Hold Remarks"
                    value={approvalForm["Hold Remarks"] || ""}
                    onChange={(e) =>
                      setApprovalForm((p) => ({
                        ...p,
                        "Hold Remarks": e.target.value,
                      }))
                    }
                    multiline
                    minRows={2}
                  />
                </Grid>
              ) : null}
            </Grid>
          </DialogContent>

          <DialogActions
            sx={{
              position: isMobile ? "sticky" : "static",
              bottom: 0,
              background: "#fff",
              borderTop: isMobile ? "1px solid #eee" : "none",
              p: isMobile ? 1.5 : undefined,
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? 1 : 0,
            }}
          >
            <Button onClick={() => setOpenApprovalModal(false)} fullWidth={isMobile}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={saveApproval}
              sx={{ bgcolor: cornflowerBlue }}
              disabled={saving}
              fullWidth={isMobile}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ================= ACCOUNTS EDIT & SYNC MODAL ================= */}
        <Dialog
          open={openAccountsModal}
          onClose={() => setOpenAccountsModal(false)}
          maxWidth="md"
          fullWidth
          fullScreen={isMobile}
        >
          <DialogTitle sx={{ fontWeight: 800 }}>Edit & Sync Expense</DialogTitle>

          <DialogContent dividers>
            <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Request ID"
                  value={selectedRequest?.["Request ID"] || ""}
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Raised By"
                  value={selectedRequest?.["Raised By"] || ""}
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Particular"
                  value={selectedRequest?.["Particular"] || ""}
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid item xs={12}>
                <Autocomplete
                  size="small"
                  options={linkedEntityOptions}
                  value={selectedAccountsLinkedEntityOption}
                  isOptionEqualToValue={(a, b) =>
                    toStr(a?.linkedEntityType) === toStr(b?.linkedEntityType) &&
                    toStr(a?.linkedEntityId) === toStr(b?.linkedEntityId) &&
                    toStr(a?.linkedEntityName) === toStr(b?.linkedEntityName)
                  }
                  getOptionLabel={getLinkedEntityDisplayLabel}
                  onChange={(_, picked) => {
                    setAccountsForm((p) => ({
                      ...p,
                      "Linked Entity Type": picked?.linkedEntityType || "",
                      "Linked Entity ID": picked?.linkedEntityId || "",
                      "Linked Entity Name": picked?.linkedEntityName || "",
                    }));
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Linked Entity / Site (Search)" />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Autocomplete
                  size="small"
                  options={costSheetOptions}
                  value={selectedAccountsCostSheetOption}
                  isOptionEqualToValue={(a, b) =>
                    toStr(a?.costSheetId) === toStr(b?.costSheetId)
                  }
                  getOptionLabel={getCostSheetDisplayLabel}
                  onChange={(_, picked) => {
                    setAccountsForm((p) => ({
                      ...p,
                      "Existing Cost Sheet ID": picked?.costSheetId || "",
                      "Existing Cost Sheet Name": picked?.display || "",
                    }));
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Existing Cost Sheet (Search)" />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Head Name</InputLabel>
                  <Select
                    label="Head Name"
                    value={accountsForm.headName}
                    onChange={(e) =>
                      setAccountsForm((p) => ({
                        ...p,
                        headName: e.target.value,
                        subcategory: "",
                      }))
                    }
                  >
                    {(validation.heads || []).map((h) => (
                      <MenuItem key={h} value={h}>
                        {h}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Subcategory</InputLabel>
                  <Select
                    label="Subcategory"
                    value={accountsForm.subcategory}
                    onChange={(e) =>
                      setAccountsForm((p) => ({ ...p, subcategory: e.target.value }))
                    }
                  >
                    {subcatsForHead(accountsForm.headName).map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Amount"
                  value={accountsForm.amount}
                  onChange={(e) =>
                    setAccountsForm((p) => ({ ...p, amount: e.target.value }))
                  }
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="GST %"
                  value={accountsForm.gstPct}
                  onChange={(e) =>
                    setAccountsForm((p) => ({ ...p, gstPct: e.target.value }))
                  }
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Expense Date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={accountsForm.expenseDate}
                  onChange={(e) =>
                    setAccountsForm((p) => ({ ...p, expenseDate: e.target.value }))
                  }
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Status</InputLabel>
                  <Select
                    label="Payment Status"
                    value={accountsForm.paymentStatus}
                    onChange={(e) =>
                      setAccountsForm((p) => ({ ...p, paymentStatus: e.target.value }))
                    }
                  >
                    {(validation.paymentStatus || DEFAULT_PAYMENT_STATUSES).map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Details"
                  value={accountsForm.details}
                  onChange={(e) =>
                    setAccountsForm((p) => ({ ...p, details: e.target.value }))
                  }
                  multiline
                  minRows={2}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Voucher / Invoice No"
                  value={accountsForm.voucherNo}
                  onChange={(e) =>
                    setAccountsForm((p) => ({ ...p, voucherNo: e.target.value }))
                  }
                />
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions
            sx={{
              position: isMobile ? "sticky" : "static",
              bottom: 0,
              background: "#fff",
              borderTop: isMobile ? "1px solid #eee" : "none",
              p: isMobile ? 1.5 : undefined,
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? 1 : 0,
            }}
          >
            <Button onClick={() => setOpenAccountsModal(false)} fullWidth={isMobile}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleAccountsSync}
              sx={{ bgcolor: cornflowerBlue }}
              disabled={saving}
              fullWidth={isMobile}
            >
              {saving ? "Syncing…" : "Sync"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}
