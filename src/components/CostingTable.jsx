// src/components/CostingTable.jsx
import React, { useEffect, useMemo, useRef, useState, memo } from "react";
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
  Popover,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Grid,
  TableContainer,
  Paper,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RefreshIcon from "@mui/icons-material/Refresh";
import CurrencyRupeeIcon from "@mui/icons-material/CurrencyRupee";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import "@fontsource/montserrat";

import { useAuth } from "./AuthContext"; // adjust path if needed

const theme = createTheme({
  typography: { fontFamily: "Montserrat, sans-serif" },
});

const cornflowerBlue = "#6495ED";

// ✅ Your deployed Costing Web App URL
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

/**
 * ✅ JSONP GET (no-cors friendly)
 * Backend supports: ?action=...&callback=cb
 */
function jsonpGet(url) {
  return new Promise((resolve, reject) => {
    const cbName = `cb_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const cleanup = (script) => {
      try {
        delete window[cbName];
      } catch {}
      if (script && script.parentNode) script.parentNode.removeChild(script);
    };

    window[cbName] = (data) => {
      cleanup(script);
      resolve(data);
    };

    const script = document.createElement("script");
    script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${encodeURIComponent(cbName)}`;
    script.async = true;

    script.onerror = () => {
      cleanup(script);
      reject(new Error("JSONP load failed"));
    };

    document.body.appendChild(script);
  });
}

// ✅ NO-CORS SAFE POST (NO HEADERS, NO res.json())
async function apiPost(payload) {
  await fetch(BACKEND, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify(payload),
  });
  return { success: true };
}

function computeRowTotals(row) {
  const qty = safeNum(row["QTY"]);
  const rate = safeNum(row["Rate"]);
  const amount = row["Amount"] !== "" ? safeNum(row["Amount"]) : qty * rate;

  const gstPct = safeNum(row["GST %"]);
  const gstAmount = row["GST Amount"] !== "" ? safeNum(row["GST Amount"]) : (amount * gstPct) / 100;

  const total = row["Total Amount"] !== "" ? safeNum(row["Total Amount"]) : amount + gstAmount;

  return {
    ...row,
    Amount: amount ? amount : "",
    "GST Amount": gstAmount ? gstAmount : "",
    "Total Amount": total ? total : "",
  };
}

/* ===================== Memoized Head Section (fixes text lag) ===================== */
/**
 * Text lag fix:
 * - Do NOT store every keystroke into parent state (newRowByHead) because it re-renders all accordions.
 * - Keep draft input state local to each accordion (memoized).
 * - Parent only updates when Add Expense is clicked.
 */
const HeadSection = memo(function HeadSection({
  head,
  headItems,
  headTotal,
  subcats,
  payList,
  loggedInName,
  loading,
  onAddLineItem,
  onSoftDeleteLineItem,
  lineItemHeaders,
}) {
  const [draft, setDraft] = useState(() => ({
    "Head Name": head,
    Subcategory: "",
    "Expense Date": new Date().toISOString().slice(0, 10),
    "Entered By": loggedInName,
    "Entry Tag": "",
    Particular: "",
    Details: "",
    QTY: "",
    Rate: "",
    Amount: "",
    "GST %": "",
    "GST Amount": "",
    "Total Amount": "",
    "Attachment Link": "",
    "Voucher/Invoice No": "",
    "Payment Status": "",
  }));

  // keep entered by updated if user changes (but don’t spam renders elsewhere)
  useEffect(() => {
    setDraft((p) => ({ ...p, "Entered By": loggedInName || p["Entered By"] || "" }));
  }, [loggedInName]);

  const setField = (key, value) => setDraft((p) => ({ ...p, [key]: value }));

  const handleAdd = () => onAddLineItem(head, draft, setDraft);

  return (
    <Accordion defaultExpanded={false}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{head}</Typography>
          <Typography sx={{ fontSize: 12, opacity: 0.85 }}>Total: ₹ {fmtINR(headTotal)}</Typography>
        </Box>
      </AccordionSummary>

      <AccordionDetails>
        {/* Add row */}
        <Paper sx={{ p: 1.2, mb: 1.2, borderRadius: 2, border: "1px dashed #d9e4ff" }}>
          <Typography sx={{ fontWeight: 800, fontSize: 12, mb: 1 }}>
            Add Expense
          </Typography>

          <Grid container spacing={1}>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Subcategory</InputLabel>
                <Select label="Subcategory" value={draft.Subcategory || ""} onChange={(e) => setField("Subcategory", e.target.value)}>
                  {subcats.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Expense Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={draft["Expense Date"] || ""}
                onChange={(e) => setField("Expense Date", e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField fullWidth size="small" label="Entry Tag" value={draft["Entry Tag"] || ""} onChange={(e) => setField("Entry Tag", e.target.value)} />
            </Grid>

            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Status</InputLabel>
                <Select label="Payment Status" value={draft["Payment Status"] || ""} onChange={(e) => setField("Payment Status", e.target.value)}>
                  {payList.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField fullWidth size="small" label="Particular" value={draft.Particular || ""} onChange={(e) => setField("Particular", e.target.value)} />
            </Grid>

            <Grid item xs={12} md={8}>
              <TextField fullWidth size="small" label="Details" value={draft.Details || ""} onChange={(e) => setField("Details", e.target.value)} />
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField fullWidth size="small" label="QTY" value={draft["QTY"] || ""} onChange={(e) => setField("QTY", e.target.value)} />
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField fullWidth size="small" label="Rate" value={draft["Rate"] || ""} onChange={(e) => setField("Rate", e.target.value)} />
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField fullWidth size="small" label="Amount" value={draft["Amount"] || ""} onChange={(e) => setField("Amount", e.target.value)} />
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField fullWidth size="small" label="GST %" value={draft["GST %"] || ""} onChange={(e) => setField("GST %", e.target.value)} />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Attachment Link"
                value={draft["Attachment Link"] || ""}
                onChange={(e) => setField("Attachment Link", e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Voucher/Invoice No"
                value={draft["Voucher/Invoice No"] || ""}
                onChange={(e) => setField("Voucher/Invoice No", e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={4} sx={{ display: "flex", alignItems: "center" }}>
              <Button
                variant="contained"
                onClick={handleAdd}
                disabled={loading}
                sx={{ bgcolor: cornflowerBlue, width: "100%" }}
              >
                {loading ? "Adding…" : "Add Expense"}
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Existing rows */}
        <Table size="small">
          <TableHead>
            <TableRow sx={{ background: "#f6f9ff" }}>
              {lineItemHeaders
                .filter((h) => h !== "Active")
                .map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 800, fontSize: 11 }}>
                    {h}
                  </TableCell>
                ))}
              <TableCell sx={{ fontWeight: 800, fontSize: 11 }}>Action</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {headItems.map((it, i) => (
              <TableRow key={i} hover>
                {lineItemHeaders
                  .filter((h) => h !== "Active")
                  .map((h) => (
                    <TableCell key={h} sx={{ fontSize: 11 }}>
                      {String(it[h] ?? "")}
                    </TableCell>
                  ))}
                <TableCell>
                  <IconButton onClick={() => onSoftDeleteLineItem(it)}>
                    <DeleteOutlineIcon sx={{ color: "#c62828" }} />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}

            {!headItems.length ? (
              <TableRow>
                <TableCell colSpan={lineItemHeaders.length + 1} sx={{ fontSize: 11, opacity: 0.7 }}>
                  No items under {head}.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </AccordionDetails>
    </Accordion>
  );
});

/* ===================== Component ===================== */

export default function CostingTable() {
  const { user } = useAuth();
  const loggedInName = user?.username || user?.name || user?.email || "";
  const role = user?.role || "";

  const [loading, setLoading] = useState(false);

  const [validation, setValidation] = useState({
    heads: [],
    subcategories: {},
    paymentStatus: [],
  });

  const [costSheets, setCostSheets] = useState([]);
  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");

  const [columnsOpen, setColumnsOpen] = useState(null);
  const [visibleCols, setVisibleCols] = useState({});

  // Modal states
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  const [activeSheet, setActiveSheet] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [lineItemHeaders, setLineItemHeaders] = useState([]);

  // ✅ Entity dropdown options for CREATE modal (no assumptions)
  const [entityOptions, setEntityOptions] = useState([]);
  const [entityLoading, setEntityLoading] = useState(false);

  // Create cost sheet form
  const [createForm, setCreateForm] = useState({
    Owner: "",
    "Linked Entity Type": "",
    "Linked Entity ID": "",
    "Linked Entity Name": "", // store the display string: Name | Company | Mobile | Owner
    "Client Name": "",
    "Project Type": "",
    Status: "Draft",
    Notes: "",
  });

  // used to prevent stale async setState
  const loadSeq = useRef(0);

  async function loadAll() {
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      // ✅ JSONP GET (no-cors friendly)
      const v = await jsonpGet(`${BACKEND}?action=getValidation`);
      if (seq !== loadSeq.current) return;

      setValidation({
        heads: Array.isArray(v?.heads) ? v.heads : [],
        subcategories: v?.subcategories || {},
        paymentStatus: Array.isArray(v?.paymentStatus) ? v.paymentStatus : [],
      });

      const sheets = await jsonpGet(`${BACKEND}?action=getCostSheets`);
      if (seq !== loadSeq.current) return;

      const arr = Array.isArray(sheets) ? sheets : [];
      setCostSheets(arr);

      if (arr.length) {
        const keys = Object.keys(arr[0]);
        const initial = {};
        keys.forEach((k) => (initial[k] = true));
        setVisibleCols(initial);
      }
    } catch (e) {
      console.error("COSTING_LOAD_ERROR", e);
      alert("Failed to load costing data (JSONP). Check deployed URL and permissions.");
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return costSheets.filter((r) => {
      const statusOk = !statusFilter || String(r["Status"] || "").trim() === statusFilter;
      const entityOk = !entityTypeFilter || String(r["Linked Entity Type"] || "").trim() === entityTypeFilter;

      const hay = Object.values(r)
        .map((x) => String(x || ""))
        .join(" ")
        .toLowerCase();

      const qOk = !q || hay.includes(q);
      return statusOk && entityOk && qOk;
    });
  }, [costSheets, search, statusFilter, entityTypeFilter]);

  const costSheetColumns = useMemo(() => {
    if (!costSheets.length) return [];
    return Object.keys(costSheets[0]);
  }, [costSheets]);

  function openColumns(e) {
    setColumnsOpen(e.currentTarget);
  }
  function closeColumns() {
    setColumnsOpen(null);
  }

  function openCreateModal() {
    setEntityOptions([]);
    setCreateForm((p) => ({
      ...p,
      Owner: loggedInName || p.Owner,
      Status: "Draft",
      "Linked Entity Type": "",
      "Linked Entity ID": "",
      "Linked Entity Name": "",
    }));
    setOpenCreate(true);
  }

  // ✅ Load entity dropdown when Linked Entity Type changes
  async function loadEntitiesForType(type) {
    const t = String(type || "").trim();
    if (!t) {
      setEntityOptions([]);
      return;
    }

    setEntityLoading(true);
    try {
      const res = await jsonpGet(
        `${BACKEND}?action=getEntities&type=${encodeURIComponent(t)}&owner=${encodeURIComponent(
          loggedInName || ""
        )}&role=${encodeURIComponent(role || "")}`
      );

      if (res?.success && Array.isArray(res.entities)) {
        setEntityOptions(res.entities);
      } else {
        console.error("GET_ENTITIES_ERROR", res);
        setEntityOptions([]);
        alert("Entities could not be loaded. Check headers mapping in GAS (availableHeaders logged in response).");
      }
    } catch (e) {
      console.error("GET_ENTITIES_FETCH_ERROR", e);
      setEntityOptions([]);
      alert("Entities could not be loaded (JSONP). Check deployment access.");
    } finally {
      setEntityLoading(false);
    }
  }

  async function createCostSheet() {
    setLoading(true);
    try {
      await apiPost({ action: "createCostSheet", data: { ...createForm } });

      setOpenCreate(false);

      // refresh after a short delay (no-cors can't read response)
      setTimeout(async () => {
        await loadAll();
      }, 800);

      alert("Cost Sheet created. Refreshing list…");
    } catch (e) {
      console.error("CREATE_COST_SHEET_ERROR", e);
      alert("Failed to create cost sheet.");
    } finally {
      setLoading(false);
    }
  }

  async function openEditModal(row) {
    setActiveSheet(row);
    setOpenEdit(true);
    setLoading(true);

    try {
      const id = row["Cost Sheet ID"];
      const items = await jsonpGet(
        `${BACKEND}?action=getCostSheetDetails&costSheetId=${encodeURIComponent(id)}`
      );
      const arr = Array.isArray(items) ? items : [];
      const activeOnly = arr.filter((x) => String(x["Active"] || "Yes") !== "No");
      setLineItems(activeOnly);

      const headers =
        activeOnly.length
          ? Object.keys(activeOnly[0])
          : [
              "Cost Sheet ID",
              "Head Name",
              "Subcategory",
              "Expense Date",
              "Entry Timestamp",
              "Entered By",
              "Entry Tag",
              "Particular",
              "Details",
              "QTY",
              "Rate",
              "Amount",
              "GST %",
              "GST Amount",
              "Total Amount",
              "Attachment Link",
              "Voucher/Invoice No",
              "Payment Status",
              "Active",
              "Owner",
              "Linked Entity Type",
              "Linked Entity ID",
              "Linked Entity Name",
            ];

      setLineItemHeaders(headers);
    } catch (e) {
      console.error("OPEN_EDIT_COST_SHEET_ERROR", e);
      alert("Failed to open cost sheet details.");
    } finally {
      setLoading(false);
    }
  }

  async function addLineItem(headName, draft, resetDraft) {
    if (!activeSheet) return;
    const costSheetId = activeSheet["Cost Sheet ID"];

    // build row using draft (local), then enrich with required keys
    let row = { ...(draft || {}) };
    row["Cost Sheet ID"] = costSheetId;
    row["Head Name"] = headName;
    row["Entered By"] = loggedInName || row["Entered By"] || "";

    // ✅ also stamp linkage fields into line items so end users see entity linkage per row
    row["Owner"] = activeSheet?.["Owner"] || row["Owner"] || loggedInName || "";
    row["Linked Entity Type"] = activeSheet?.["Linked Entity Type"] || row["Linked Entity Type"] || "";
    row["Linked Entity ID"] = activeSheet?.["Linked Entity ID"] || row["Linked Entity ID"] || "";
    row["Linked Entity Name"] = activeSheet?.["Linked Entity Name"] || row["Linked Entity Name"] || "";

    row = computeRowTotals(row);

    const hasSome =
      String(row.Particular || "").trim() ||
      String(row.Details || "").trim() ||
      String(row.Amount || "").trim();

    if (!hasSome) {
      alert("Please enter at least Particular / Details / Amount.");
      return;
    }

    setLoading(true);
    try {
      await apiPost({ action: "addLineItem", data: row });

      // refresh items after short delay
      setTimeout(async () => {
        const items = await jsonpGet(
          `${BACKEND}?action=getCostSheetDetails&costSheetId=${encodeURIComponent(costSheetId)}`
        );
        const arr = Array.isArray(items) ? items : [];
        const activeOnly = arr.filter((x) => String(x["Active"] || "Yes") !== "No");
        setLineItems(activeOnly);
      }, 800);

      // reset local draft
      if (typeof resetDraft === "function") {
        resetDraft({
          "Head Name": headName,
          Subcategory: "",
          "Expense Date": new Date().toISOString().slice(0, 10),
          "Entered By": loggedInName,
          "Entry Tag": "",
          Particular: "",
          Details: "",
          QTY: "",
          Rate: "",
          Amount: "",
          "GST %": "",
          "GST Amount": "",
          "Total Amount": "",
          "Attachment Link": "",
          "Voucher/Invoice No": "",
          "Payment Status": "",
        });
      }
    } catch (e) {
      console.error("ADD_LINE_ITEM_ERROR", e);
      alert("Failed to add line item.");
    } finally {
      setLoading(false);
    }
  }

  async function softDeleteLineItem(item) {
    if (!activeSheet) return;
    const costSheetId = activeSheet["Cost Sheet ID"];
    const particular = String(item["Particular"] || "").trim();

    if (!particular) {
      alert("Cannot delete: Particular is empty for this row.");
      return;
    }

    setLoading(true);
    try {
      await apiPost({
        action: "softDeleteLineItem",
        data: { costSheetId, particular },
      });

      // Optimistic UI (and refresh after a bit)
      setLineItems((p) => p.filter((x) => String(x["Particular"] || "").trim() !== particular));

      setTimeout(async () => {
        const items = await jsonpGet(
          `${BACKEND}?action=getCostSheetDetails&costSheetId=${encodeURIComponent(costSheetId)}`
        );
        const arr = Array.isArray(items) ? items : [];
        const activeOnly = arr.filter((x) => String(x["Active"] || "Yes") !== "No");
        setLineItems(activeOnly);
      }, 800);
    } catch (e) {
      console.error("SOFT_DELETE_ERROR", e);
      alert("Failed to delete line item. If two rows share same Particular, delete may be ambiguous.");
    } finally {
      setLoading(false);
    }
  }

  const totalsByHead = useMemo(() => {
    const out = {};
    (validation.heads || []).forEach((h) => (out[h] = 0));
    lineItems.forEach((li) => {
      const h = String(li["Head Name"] || "").trim();
      const total = safeNum(li["Total Amount"]);
      out[h] = safeNum(out[h]) + total;
    });
    return out;
  }, [lineItems, validation.heads]);

  const grandTotal = useMemo(() => {
    return Object.values(totalsByHead).reduce((a, b) => a + safeNum(b), 0);
  }, [totalsByHead]);

  const subcatsForHead = (head) => {
    const m = validation.subcategories || {};
    return Array.isArray(m[head]) ? m[head] : [];
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ p: 2 }}>
        {/* ✅ HEADER (Logo Left, Title Right) */}
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
                Costing
              </Typography>
            {loading ? (
              <Typography sx={{ fontSize: 12, opacity: 0.7 }}>Loading…</Typography>
            ) : null}
          </Box>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadAll}
              sx={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Refresh
            </Button>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateModal}
              sx={{ bgcolor: cornflowerBlue, fontFamily: "Montserrat, sans-serif" }}
            >
              Add Cost Sheet
            </Button>
          </Box>
        </Box>

        <Paper sx={{ p: 1.5, borderRadius: 2, border: "1px solid #eee" }}>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            <TextField
              size="small"
              label="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 240 }}
            />

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {["Draft", "Final", "Archived"].map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Linked Entity Type</InputLabel>
              <Select
                value={entityTypeFilter}
                label="Linked Entity Type"
                onChange={(e) => setEntityTypeFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {["Account", "Deal", "Project", "Order"].map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <IconButton onClick={openColumns}>
              <ViewColumnIcon />
            </IconButton>

            <Popover
              open={Boolean(columnsOpen)}
              anchorEl={columnsOpen}
              onClose={closeColumns}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            >
              <Box sx={{ p: 1.5 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 12, mb: 1 }}>
                  Columns
                </Typography>
                <FormGroup>
                  {costSheetColumns.map((c) => (
                    <FormControlLabel
                      key={c}
                      control={
                        <Checkbox
                          size="small"
                          checked={visibleCols[c] !== false}
                          onChange={(e) => setVisibleCols((p) => ({ ...p, [c]: e.target.checked }))}
                        />
                      }
                      label={<Typography sx={{ fontSize: 12 }}>{c}</Typography>}
                    />
                  ))}
                </FormGroup>
              </Box>
            </Popover>
          </Box>

          <Divider sx={{ my: 1 }} />

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ background: "#f6f9ff" }}>
                  {costSheetColumns
                    .filter((c) => visibleCols[c] !== false)
                    .map((c) => (
                      <TableCell key={c} sx={{ fontWeight: 800, fontSize: 12 }}>
                        {c}
                      </TableCell>
                    ))}
                  <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>Action</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {filtered.map((r, idx) => (
                  <TableRow key={idx} hover>
                    {costSheetColumns
                      .filter((c) => visibleCols[c] !== false)
                      .map((c) => (
                        <TableCell key={c} sx={{ fontSize: 12 }}>
                          {String(r[c] ?? "")}
                        </TableCell>
                      ))}
                    <TableCell>
                      <IconButton onClick={() => openEditModal(r)}>
                        <EditIcon sx={{ color: cornflowerBlue }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}

                {!filtered.length ? (
                  <TableRow>
                    <TableCell colSpan={costSheetColumns.length + 1} sx={{ fontSize: 12, opacity: 0.7 }}>
                      No cost sheets found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* ================= CREATE COST SHEET MODAL ================= */}
        <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontWeight: 800 }}>Create Cost Sheet</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
              {/* Owner */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Owner"
                  value={createForm["Owner"] || ""}
                  onChange={(e) => setCreateForm((p) => ({ ...p, Owner: e.target.value }))}
                />
              </Grid>

              {/* Linked Entity Type */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Linked Entity Type</InputLabel>
                  <Select
                    label="Linked Entity Type"
                    value={createForm["Linked Entity Type"] || ""}
                    onChange={async (e) => {
                      const type = e.target.value;
                      setCreateForm((p) => ({
                        ...p,
                        "Linked Entity Type": type,
                        "Linked Entity ID": "",
                        "Linked Entity Name": "",
                      }));
                      setEntityOptions([]);
                      await loadEntitiesForType(type);
                    }}
                  >
                    {["Account", "Deal", "Project", "Order"].map((t) => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Linked Entity Name (dropdown) */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small" disabled={!createForm["Linked Entity Type"] || entityLoading}>
                  <InputLabel>Linked Entity Name</InputLabel>
                  <Select
                    label="Linked Entity Name"
                    value={createForm["Linked Entity ID"] || ""}
                    onChange={(e) => {
                      const id = e.target.value;
                      const picked = (entityOptions || []).find((x) => String(x.id) === String(id));
                      setCreateForm((p) => ({
                        ...p,
                        "Linked Entity ID": id,
                        // Store display in "Linked Entity Name" as requested:
                        // Account/Project/Deal/Order Name | Company | Mobile Number | Owner
                        "Linked Entity Name": picked?.display || "",
                      }));
                    }}
                  >
                    {(entityOptions || []).map((opt) => (
                      <MenuItem key={opt.id} value={opt.id}>
                        {opt.display}
                      </MenuItem>
                    ))}
                    {!entityOptions.length ? (
                      <MenuItem value="" disabled>
                        {entityLoading ? "Loading…" : "No entities found"}
                      </MenuItem>
                    ) : null}
                  </Select>
                </FormControl>
              </Grid>

              {/* Linked Entity ID (read-only from dropdown) */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Linked Entity ID"
                  value={createForm["Linked Entity ID"] || ""}
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              {/* Client Name */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Client Name"
                  value={createForm["Client Name"] || ""}
                  onChange={(e) => setCreateForm((p) => ({ ...p, "Client Name": e.target.value }))}
                />
              </Grid>

              {/* Project Type */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Project Type"
                  value={createForm["Project Type"] || ""}
                  onChange={(e) => setCreateForm((p) => ({ ...p, "Project Type": e.target.value }))}
                />
              </Grid>

              {/* Status */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    label="Status"
                    value={createForm.Status || "Draft"}
                    onChange={(e) => setCreateForm((p) => ({ ...p, Status: e.target.value }))}
                  >
                    {["Draft", "Final", "Archived"].map((s) => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Notes */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Notes"
                  value={createForm.Notes || ""}
                  onChange={(e) => setCreateForm((p) => ({ ...p, Notes: e.target.value }))}
                  multiline
                  minRows={3}
                />
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={createCostSheet}
              sx={{ bgcolor: cornflowerBlue }}
              disabled={loading}
            >
              {loading ? "Creating…" : "Create"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ================= EDIT COST SHEET (LINE ITEMS) ================= */}
        <Dialog open={openEdit} onClose={() => setOpenEdit(false)} maxWidth="lg" fullWidth>
          <DialogTitle sx={{ fontWeight: 800 }}>
            Cost Sheet — {activeSheet?.["Cost Sheet ID"] || ""}
          </DialogTitle>

          <DialogContent dividers>
            <Box sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: 12, opacity: 0.8 }}>
                Linked: {activeSheet?.["Linked Entity Type"] || ""} — {activeSheet?.["Linked Entity ID"] || ""}
              </Typography>
              <Typography sx={{ fontSize: 12, opacity: 0.8 }}>
                Linked Entity Name: {activeSheet?.["Linked Entity Name"] || ""}
              </Typography>
              <Typography sx={{ fontSize: 12, opacity: 0.8 }}>
                Owner: {activeSheet?.["Owner"] || ""} | Status: {activeSheet?.["Status"] || ""}
              </Typography>
            </Box>

            <Paper sx={{ p: 1.2, mb: 1.2, borderRadius: 2, border: "1px solid #eee" }}>
              <Typography sx={{ fontWeight: 800, fontSize: 12 }}>
                Grand Total (Active Items): ₹ {fmtINR(grandTotal)}
              </Typography>
            </Paper>

            {(validation.heads || []).map((head) => {
              const headItems = lineItems.filter((x) => String(x["Head Name"] || "").trim() === head);
              const headTotal = safeNum(totalsByHead[head]);

              return (
                <HeadSection
                  key={head}
                  head={head}
                  headItems={headItems}
                  headTotal={headTotal}
                  subcats={subcatsForHead(head)}
                  payList={validation.paymentStatus || []}
                  loggedInName={loggedInName}
                  loading={loading}
                  onAddLineItem={addLineItem}
                  onSoftDeleteLineItem={softDeleteLineItem}
                  lineItemHeaders={lineItemHeaders}
                />
              );
            })}
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setOpenEdit(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}
