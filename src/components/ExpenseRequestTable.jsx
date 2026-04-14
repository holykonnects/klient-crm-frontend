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
} from "@mui/material";

import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";

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

/* ===================== Component ===================== */

export default function ExpenseRequestTable() {
  const { user } = useAuth();

  const loggedInName = user?.username || user?.name || user?.email || "";
  const loggedInEmail = user?.email || "";
  const role = user?.role || "";
  const roleBucket = getRoleBucket(role);
  const isAdmin = roleBucket === "admin";
  const isOperations = roleBucket === "operations" || isAdmin;
  const isAccounts = roleBucket === "accounts" || isAdmin;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const selectedCostSheetOption = useMemo(() => {
    const id = toStr(approvalForm["Existing Cost Sheet ID"]);
    if (!id) return null;
    return costSheetOptions.find((x) => toStr(x.costSheetId) === id) || null;
  }, [approvalForm, costSheetOptions]);

  const selectedLinkedEntityOption = useMemo(() => {
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

  const expenseTotal = useMemo(() => {
    return (expenseRows || []).reduce((acc, r) => acc + safeNum(r.amount), 0);
  }, [expenseRows]);

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
      const tasks = [loadMyRequests()];
      if (isOperations) {
        tasks.push(loadApprovalQueue(), loadMappingOptions());
      }
      if (isAccounts) {
        tasks.push(loadAccountsQueue());
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

  async function syncRequestToCostLine(row) {
    const requestId = toStr(row?.["Request ID"]);
    if (!requestId) {
      alert("Request ID missing.");
      return;
    }

    setSaving(true);
    try {
      await apiPost({
        action: "syncExpenseRequestToCostLine",
        data: {
          requestId,
          syncedBy: loggedInName,
          headName: "Miscellaneous",
          subcategory: "",
        },
      });

      setTimeout(async () => {
        await refreshAll();
      }, 250);

      alert("Expense request synced to Cost Line Items.");
    } catch (e) {
      console.error("SYNC_EXPENSE_REQUEST_ERROR", e);
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
      <Box sx={{ p: 2 }}>
        {/* HEADER */}
        <Box padding={4}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CurrencyRupeeIcon sx={{ color: cornflowerBlue }} />
              <Typography
                variant="h5"
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
              sx={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Refresh
            </Button>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openAddExpenseModal}
              sx={{ bgcolor: cornflowerBlue, fontFamily: "Montserrat, sans-serif" }}
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
              sx={{ minWidth: 240 }}
            />

            <FormControl size="small" sx={{ minWidth: 180 }}>
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

            <FormControl size="small" sx={{ minWidth: 160 }}>
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
        </Paper>

        {/* OPERATIONS QUEUE */}
        {isOperations ? (
          <Paper sx={{ p: 1.5, borderRadius: 2, border: "1px solid #eee", mb: 2 }}>
            <Typography sx={{ fontWeight: 900, fontSize: 14, mb: 1 }}>Approval Queue</Typography>

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
          </Paper>
        ) : null}

        {/* ACCOUNTS QUEUE */}
        {isAccounts ? (
          <Paper sx={{ p: 1.5, borderRadius: 2, border: "1px solid #eee" }}>
            <Typography sx={{ fontWeight: 900, fontSize: 14, mb: 1 }}>Accounts Queue</Typography>

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
                            onClick={() => syncRequestToCostLine(r)}
                            title="Sync to Cost Line"
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
          </Paper>
        ) : null}

        {/* ================= ADD EXPENSE REQUEST MODAL ================= */}
        <Dialog open={openAddModal} onClose={() => setOpenAddModal(false)} maxWidth="md" fullWidth>
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
                        p: 1.25,
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
                          size="small"
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
                  sx={{ fontFamily: "Montserrat, sans-serif" }}
                >
                  Add Another Line Item
                </Button>
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setOpenAddModal(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={submitExpenseRequestBatch}
              sx={{ bgcolor: cornflowerBlue }}
              disabled={saving}
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
                  value={selectedLinkedEntityOption}
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
                  value={selectedCostSheetOption}
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

          <DialogActions>
            <Button onClick={() => setOpenApprovalModal(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={saveApproval}
              sx={{ bgcolor: cornflowerBlue }}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}
