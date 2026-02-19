// src/components/CostingTable.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Divider,
  Grid,
  TableContainer,
  Paper,
  Drawer,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import RefreshIcon from "@mui/icons-material/Refresh";
import CurrencyRupeeIcon from "@mui/icons-material/CurrencyRupee";
import CloseIcon from "@mui/icons-material/Close";

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

/**
 * ✅ Payment Status values (as you clarified)
 * Used ONLY as a fallback when validation table returns none.
 */
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
  const gstAmount =
    row["GST Amount"] !== "" ? safeNum(row["GST Amount"]) : (amount * gstPct) / 100;

  const total =
    row["Total Amount"] !== "" ? safeNum(row["Total Amount"]) : amount + gstAmount;

  return {
    ...row,
    Amount: amount ? amount : "",
    "GST Amount": gstAmount ? gstAmount : "",
    "Total Amount": total ? total : "",
  };
}

// Live totals in drawer (same idea, but always recompute from QTY/Rate + GST%)
function recomputeDraftLive(next) {
  const qty = safeNum(next["QTY"]);
  const rate = safeNum(next["Rate"]);
  const hasQtyRate = qty > 0 && rate > 0;

  const auto = Boolean(next.__autoAmount);
  const userHasManualAmount = String(next["Amount"] ?? "").trim() !== "" && !auto;

  let amount = next["Amount"];
  if (hasQtyRate && !userHasManualAmount) amount = qty * rate;

  const gstPct = safeNum(next["GST %"]);
  const hasAmount = String(amount ?? "").trim() !== "";
  const gstAmount = hasAmount ? (safeNum(amount) * gstPct) / 100 : "";
  const total = hasAmount ? safeNum(amount) + safeNum(gstAmount) : "";

  return {
    ...next,
    Amount: amount === 0 ? "" : amount,
    "GST Amount": gstAmount === 0 ? "" : gstAmount,
    "Total Amount": total === 0 ? "" : total,
    __autoAmount: hasQtyRate && !userHasManualAmount,
  };
}

/**
 * ✅ Non-breaking validation normalizer
 * - If backend returns heads/subcategories/paymentStatus (your old working format) -> use as-is
 * - Otherwise fallback to common sheet-style keys (Cost Heads / Payment Status)
 * - ✅ UPDATE: if paymentStatus is empty, fallback to DEFAULT_PAYMENT_STATUSES (as you clarified)
 */
function normalizeValidationResponse(raw) {
  const v = raw?.data ? raw.data : raw;

  // ✅ Prefer your original expected keys (this preserves old behavior)
  const headsDirect = Array.isArray(v?.heads) ? v.heads : null;
  const subcatsDirect =
    v?.subcategories && typeof v.subcategories === "object" ? v.subcategories : null;
  const payDirect = Array.isArray(v?.paymentStatus) ? v.paymentStatus : null;

  if (headsDirect || subcatsDirect || payDirect) {
    const cleanedPay = (payDirect || []).filter((x) => String(x || "").trim());
    return {
      heads: headsDirect || [],
      subcategories: subcatsDirect || {},
      paymentStatus: cleanedPay.length ? cleanedPay : DEFAULT_PAYMENT_STATUSES,
    };
  }

  // fallback (only if original keys not present)
  const heads =
    (Array.isArray(v?.costHeads) && v.costHeads) ||
    (Array.isArray(v?.["Cost Heads"]) && v["Cost Heads"]) ||
    [];

  const paymentStatus =
    (Array.isArray(v?.["Payment Status"]) && v["Payment Status"]) ||
    (Array.isArray(v?.payment_status) && v.payment_status) ||
    [];

  const subcategories =
    (v?.subcategoryMap && typeof v.subcategoryMap === "object" && v.subcategoryMap) ||
    {};

  const cleanedPay = (paymentStatus || []).filter((x) => String(x || "").trim());

  return {
    heads,
    subcategories,
    paymentStatus: cleanedPay.length ? cleanedPay : DEFAULT_PAYMENT_STATUSES,
  };
}

/* ===================== Component ===================== */

export default function CostingTable() {
  const { user } = useAuth();
  const loggedInName = user?.username || user?.name || user?.email || "";
  const role = user?.role || "";

  const [loading, setLoading] = useState(false);

  const [validation, setValidation] = useState({
    heads: [],
    subcategories: {},
    paymentStatus: DEFAULT_PAYMENT_STATUSES, // ✅ default-safe (no assumption beyond your clarified enum)
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

  // ✅ Drawer menu containment ref (FIX for dropdown hidden behind drawer)
  const drawerPaperRef = useRef(null);

  // ✅ MenuProps to force Select menus to render INSIDE the Drawer (no portal stacking issues)
  const drawerMenuProps = useMemo(() => {
    return {
      disablePortal: true,
      container: drawerPaperRef.current,
      PaperProps: {
        sx: {
          zIndex: (t) => (t?.zIndex?.modal ?? 1300) + 80,
        },
      },
    };
  }, [openEdit]); // ensures ref is available when edit modal (and drawer) are mounted

  // Create cost sheet form
  const [createForm, setCreateForm] = useState({
    Owner: "",
    "Linked Entity Type": "",
    "Linked Entity ID": "",
    "Linked Entity Name": "", // store the display string
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
      const rawV = await jsonpGet(`${BACKEND}?action=getValidation`);
      if (seq !== loadSeq.current) return;

      const parsed = normalizeValidationResponse(rawV);
      setValidation(parsed);

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

  // ✅ ensures validation exists before opening edit/drawer (prevents empty dropdowns)
  async function ensureValidationLoaded() {
    const hasAny =
      (validation.heads && validation.heads.length) ||
      (validation.paymentStatus && validation.paymentStatus.length) ||
      (validation.subcategories && Object.keys(validation.subcategories).length);

    if (hasAny) return;

    try {
      const rawV = await jsonpGet(`${BACKEND}?action=getValidation`);
      const parsed = normalizeValidationResponse(rawV);
      setValidation(parsed);
    } catch (e) {
      console.error("ENSURE_VALIDATION_ERROR", e);
      // keep silent: table can still work, dropdowns just won't
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return costSheets.filter((r) => {
      const statusOk = !statusFilter || String(r["Status"] || "").trim() === statusFilter;
      const entityOk =
        !entityTypeFilter ||
        String(r["Linked Entity Type"] || "").trim() === entityTypeFilter;

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
        alert(
          "Entities could not be loaded. Check headers mapping in GAS (availableHeaders logged in response)."
        );
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
    // ✅ make sure validation is present so drawer dropdowns are not empty
    await ensureValidationLoaded();

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

  async function refreshLineItemsForActiveSheet(costSheetId) {
    const items = await jsonpGet(
      `${BACKEND}?action=getCostSheetDetails&costSheetId=${encodeURIComponent(costSheetId)}`
    );
    const arr = Array.isArray(items) ? items : [];
    const activeOnly = arr.filter((x) => String(x["Active"] || "Yes") !== "No");
    setLineItems(activeOnly);
  }

  async function addLineItemRow(row) {
    if (!activeSheet) return;
    const costSheetId = activeSheet["Cost Sheet ID"];

    let payloadRow = { ...(row || {}) };
    if ("__autoAmount" in payloadRow) delete payloadRow.__autoAmount;

    payloadRow["Cost Sheet ID"] = costSheetId;

    // stamp linkage fields into line items
    payloadRow["Owner"] =
      activeSheet?.["Owner"] || payloadRow["Owner"] || loggedInName || "";
    payloadRow["Linked Entity Type"] =
      activeSheet?.["Linked Entity Type"] || payloadRow["Linked Entity Type"] || "";
    payloadRow["Linked Entity ID"] =
      activeSheet?.["Linked Entity ID"] || payloadRow["Linked Entity ID"] || "";
    payloadRow["Linked Entity Name"] =
      activeSheet?.["Linked Entity Name"] || payloadRow["Linked Entity Name"] || "";

    // ensure entered by
    payloadRow["Entered By"] = loggedInName || payloadRow["Entered By"] || "";

    // compute totals (final)
    payloadRow = computeRowTotals(payloadRow);

    const hasSome =
      String(payloadRow.Particular || "").trim() ||
      String(payloadRow.Details || "").trim() ||
      String(payloadRow.Amount || "").trim();

    if (!hasSome) {
      alert("Please enter at least Particular / Details / Amount.");
      return;
    }

    setLoading(true);
    try {
      await apiPost({ action: "addLineItem", data: payloadRow });

      setTimeout(async () => {
        await refreshLineItemsForActiveSheet(costSheetId);
      }, 800);
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

      // Optimistic UI
      setLineItems((p) =>
        p.filter((x) => String(x["Particular"] || "").trim() !== particular)
      );

      setTimeout(async () => {
        await refreshLineItemsForActiveSheet(costSheetId);
      }, 800);
    } catch (e) {
      console.error("SOFT_DELETE_ERROR", e);
      alert(
        "Failed to delete line item. If two rows share same Particular, delete may be ambiguous."
      );
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

  /* ===================== Drawer Editor State ===================== */

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState("add"); // "add" | "edit"
  const [drawerOriginal, setDrawerOriginal] = useState(null);

  const blankDraft = (headPreset) =>
    recomputeDraftLive({
      "Head Name": headPreset || "",
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
      __autoAmount: false,
    });

  const [drawerDraft, setDrawerDraft] = useState(() => blankDraft(""));

  // keep entered by updated if user changes while drawer open
  useEffect(() => {
    setDrawerDraft((p) => ({
      ...p,
      "Entered By": loggedInName || p["Entered By"] || "",
    }));
  }, [loggedInName]);

  async function openDrawerAdd(headPreset) {
    await ensureValidationLoaded();

    setDrawerMode("add");
    setDrawerOriginal(null);
    setDrawerDraft(blankDraft(headPreset));
    setDrawerOpen(true);
  }

  async function openDrawerEdit(item) {
    await ensureValidationLoaded();

    const headName = String(item?.["Head Name"] || "").trim();
    setDrawerMode("edit");
    setDrawerOriginal(item || null);

    const pre = recomputeDraftLive({
      "Head Name": headName,
      Subcategory: item?.Subcategory ?? "",
      "Expense Date": item?.["Expense Date"] ?? new Date().toISOString().slice(0, 10),
      "Entered By": loggedInName,
      "Entry Tag": item?.["Entry Tag"] ?? "",
      Particular: item?.Particular ?? "",
      Details: item?.Details ?? "",
      QTY: item?.["QTY"] ?? "",
      Rate: item?.["Rate"] ?? "",
      Amount: item?.["Amount"] ?? "",
      "GST %": item?.["GST %"] ?? "",
      "GST Amount": item?.["GST Amount"] ?? "",
      "Total Amount": item?.["Total Amount"] ?? "",
      "Attachment Link": item?.["Attachment Link"] ?? "",
      "Voucher/Invoice No": item?.["Voucher/Invoice No"] ?? "",
      "Payment Status": item?.["Payment Status"] ?? "",
      __autoAmount: false,
    });

    setDrawerDraft(pre);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  function setDrawerField(key, value) {
    setDrawerDraft((p) => {
      if (key === "Amount") {
        const next = { ...p, Amount: value, __autoAmount: false };
        return recomputeDraftLive(next);
      }
      const next = { ...p, [key]: value };
      if (key === "Head Name") next.Subcategory = "";
      return recomputeDraftLive(next);
    });
  }

  async function saveDrawer() {
    if (!activeSheet) return;

    if (drawerMode === "edit" && drawerOriginal) {
      const oldParticular = String(drawerOriginal["Particular"] || "").trim();
      if (!oldParticular) {
        alert("Cannot edit: Original row Particular is empty, delete would be ambiguous.");
        return;
      }
      setLoading(true);
      try {
        await apiPost({
          action: "softDeleteLineItem",
          data: { costSheetId: activeSheet["Cost Sheet ID"], particular: oldParticular },
        });

        await addLineItemRow(drawerDraft);

        setDrawerOpen(false);
      } catch (e) {
        console.error("EDIT_SAVE_ERROR", e);
        alert(
          "Failed to save edit. Note: delete is by Particular, if duplicates exist it can be ambiguous."
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    await addLineItemRow(drawerDraft);
    setDrawerOpen(false);
  }

  async function saveDrawerAndNew() {
    if (!activeSheet) return;

    const headKeep = String(drawerDraft?.["Head Name"] || "").trim();

    if (drawerMode === "edit") {
      await saveDrawer();
      setTimeout(() => {
        openDrawerAdd(headKeep);
      }, 0);
      return;
    }

    await addLineItemRow(drawerDraft);
    setDrawerDraft(blankDraft(headKeep));
  }

  /* ===================== Table columns for line items ===================== */

  const defaultLineItemCols = [
    "Head Name",
    "Subcategory",
    "Expense Date",
    "Particular",
    "QTY",
    "Rate",
    "Amount",
    "GST %",
    "GST Amount",
    "Total Amount",
    "Payment Status",
    "Attachment Link",
    "Voucher/Invoice No",
    "Entered By",
    "Entry Tag",
    "Details",
  ];

  const lineItemCols = useMemo(() => {
    if (!lineItemHeaders?.length) return defaultLineItemCols;

    const available = new Set(lineItemHeaders);
    const picked = defaultLineItemCols.filter((c) => available.has(c));

    if (!picked.length) return lineItemHeaders.filter((h) => h !== "Active");
    return picked;
  }, [lineItemHeaders]);

  /* ===================== Render ===================== */

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ p: 2 }}>
        {/* ✅ HEADER (Logo Left, Title Right) */}
        <Box padding={4}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CurrencyRupeeIcon sx={{ color: cornflowerBlue }} />
              <Typography variant="h5" fontWeight="bold" sx={{ fontFamily: "Montserrat, sans-serif" }}>
                Costing
              </Typography>

              {loading ? (
                <Typography sx={{ fontSize: 12, opacity: 0.7, ml: 1 }}>
                  Loading…
                </Typography>
              ) : null}
            </Box>
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
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
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
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
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
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Owner"
                  value={createForm["Owner"] || ""}
                  onChange={(e) => setCreateForm((p) => ({ ...p, Owner: e.target.value }))}
                />
              </Grid>

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
                      <MenuItem key={t} value={t}>
                        {t}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

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

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Linked Entity ID"
                  value={createForm["Linked Entity ID"] || ""}
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Client Name"
                  value={createForm["Client Name"] || ""}
                  onChange={(e) => setCreateForm((p) => ({ ...p, "Client Name": e.target.value }))}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Project Type"
                  value={createForm["Project Type"] || ""}
                  onChange={(e) => setCreateForm((p) => ({ ...p, "Project Type": e.target.value }))}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    label="Status"
                    value={createForm.Status || "Draft"}
                    onChange={(e) => setCreateForm((p) => ({ ...p, Status: e.target.value }))}
                  >
                    {["Draft", "Final", "Archived"].map((s) => (
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

        {/* ================= EDIT COST SHEET (TABLE + RIGHT DRAWER) ================= */}
        <Dialog open={openEdit} onClose={() => setOpenEdit(false)} maxWidth="lg" fullWidth>
          <DialogTitle sx={{ fontWeight: 800 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.4 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Typography sx={{ fontWeight: 900 }}>
                  Cost Sheet — {activeSheet?.["Cost Sheet ID"] || ""}
                </Typography>

                {activeSheet?.["Status"] ? (
                  <Typography
                    sx={{
                      fontSize: 11,
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      bgcolor: "#eef4ff",
                      border: "1px solid #d9e4ff",
                      fontWeight: 800,
                    }}
                  >
                    {String(activeSheet["Status"])}
                  </Typography>
                ) : null}
              </Box>

              <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "#1f2a44" }}>
                {activeSheet?.["Linked Entity Name"] || "—"}
              </Typography>

              <Typography sx={{ fontSize: 12, opacity: 0.75 }}>
                Linked: {activeSheet?.["Linked Entity Type"] || ""} — {activeSheet?.["Linked Entity ID"] || ""}
                {"  "} | Owner: {activeSheet?.["Owner"] || ""}
              </Typography>
            </Box>
          </DialogTitle>

          <DialogContent dividers sx={{ position: "relative" }}>
            <Paper
              sx={{
                p: 1.2,
                mb: 1.2,
                borderRadius: 2,
                border: "1px solid #eee",
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "#fff",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                <Typography sx={{ fontWeight: 900, fontSize: 12 }}>
                  Grand Total (Active Items): ₹ {fmtINR(grandTotal)}
                </Typography>

                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  sx={{ bgcolor: cornflowerBlue }}
                  disabled={loading}
                  onClick={() => openDrawerAdd("")}
                >
                  Add Line Item
                </Button>
              </Box>
            </Paper>

            <Paper sx={{ borderRadius: 2, border: "1px solid #eee", overflow: "hidden" }}>
              <TableContainer sx={{ maxHeight: 520 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ background: "#f6f9ff" }}>
                      {lineItemCols.map((c) => (
                        <TableCell key={c} sx={{ fontWeight: 900, fontSize: 11, whiteSpace: "nowrap" }}>
                          {c}
                        </TableCell>
                      ))}
                      <TableCell sx={{ fontWeight: 900, fontSize: 11, whiteSpace: "nowrap" }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {lineItems.map((it, idx) => (
                      <TableRow key={idx} hover>
                        {lineItemCols.map((c) => (
                          <TableCell key={c} sx={{ fontSize: 11, verticalAlign: "top" }}>
                            {String(it[c] ?? "")}
                          </TableCell>
                        ))}
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          <IconButton
                            title="Edit (will soft-delete old row and append updated row)"
                            onClick={() => openDrawerEdit(it)}
                            disabled={loading}
                          >
                            <EditIcon sx={{ color: cornflowerBlue }} />
                          </IconButton>

                          <IconButton
                            onClick={() => softDeleteLineItem(it)}
                            disabled={loading}
                            title="Delete"
                          >
                            <DeleteOutlineIcon sx={{ color: "#c62828" }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}

                    {!lineItems.length ? (
                      <TableRow>
                        <TableCell colSpan={lineItemCols.length + 1} sx={{ fontSize: 12, opacity: 0.7 }}>
                          No line items found for this cost sheet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* RIGHT DRAWER */}
            <Drawer
              anchor="right"
              open={drawerOpen}
              onClose={closeDrawer}
              sx={{
                zIndex: (t) => (t?.zIndex?.modal ?? 1300) + 20,
              }}
              ModalProps={{ keepMounted: true }}
              PaperProps={{
                ref: drawerPaperRef,
                sx: {
                  width: { xs: "100%", sm: 420 },
                  p: 2,
                  zIndex: (t) => (t?.zIndex?.modal ?? 1300) + 21,
                },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ fontWeight: 900, fontSize: 16 }}>
                  {drawerMode === "edit" ? "Edit Line Item" : "Add Line Item"}
                </Typography>

                <IconButton onClick={closeDrawer}>
                  <CloseIcon />
                </IconButton>
              </Box>

              <Divider sx={{ mb: 1.5 }} />

              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Head Name</InputLabel>
                  <Select
                    label="Head Name"
                    value={drawerDraft["Head Name"] || ""}
                    onChange={(e) => setDrawerField("Head Name", e.target.value)}
                    MenuProps={drawerMenuProps}
                  >
                    {(validation.heads || []).map((h) => (
                      <MenuItem key={h} value={h}>
                        {h}
                      </MenuItem>
                    ))}
                    {!validation.heads?.length ? (
                      <MenuItem value="" disabled>
                        No heads found
                      </MenuItem>
                    ) : null}
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                  <InputLabel>Subcategory</InputLabel>
                  <Select
                    label="Subcategory"
                    value={drawerDraft.Subcategory || ""}
                    onChange={(e) => setDrawerField("Subcategory", e.target.value)}
                    MenuProps={drawerMenuProps}
                  >
                    {subcatsForHead(drawerDraft["Head Name"] || "").map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                    {!subcatsForHead(drawerDraft["Head Name"] || "").length ? (
                      <MenuItem value="" disabled>
                        No subcategories
                      </MenuItem>
                    ) : null}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  size="small"
                  label="Expense Date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={drawerDraft["Expense Date"] || ""}
                  onChange={(e) => setDrawerField("Expense Date", e.target.value)}
                />

                <TextField
                  fullWidth
                  size="small"
                  label="Entry Tag"
                  value={drawerDraft["Entry Tag"] || ""}
                  onChange={(e) => setDrawerField("Entry Tag", e.target.value)}
                />

                <FormControl size="small" fullWidth>
                  <InputLabel>Payment Status</InputLabel>
                  <Select
                    label="Payment Status"
                    value={drawerDraft["Payment Status"] || ""}
                    onChange={(e) => setDrawerField("Payment Status", e.target.value)}
                    MenuProps={drawerMenuProps}
                  >
                    {(validation.paymentStatus || DEFAULT_PAYMENT_STATUSES).map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                    {!(validation.paymentStatus || []).length ? (
                      <MenuItem value="" disabled>
                        No payment statuses
                      </MenuItem>
                    ) : null}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  size="small"
                  label="Particular"
                  value={drawerDraft.Particular || ""}
                  onChange={(e) => setDrawerField("Particular", e.target.value)}
                />

                <TextField
                  fullWidth
                  size="small"
                  label="Details"
                  value={drawerDraft.Details || ""}
                  onChange={(e) => setDrawerField("Details", e.target.value)}
                  multiline
                  minRows={2}
                />

                <Grid container spacing={1}>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="QTY"
                      value={drawerDraft["QTY"] || ""}
                      onChange={(e) => setDrawerField("QTY", e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Rate"
                      value={drawerDraft["Rate"] || ""}
                      onChange={(e) => setDrawerField("Rate", e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="GST %"
                      value={drawerDraft["GST %"] || ""}
                      onChange={(e) => setDrawerField("GST %", e.target.value)}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Amount"
                      value={drawerDraft["Amount"] || ""}
                      onChange={(e) => setDrawerField("Amount", e.target.value)}
                      InputProps={{ readOnly: Boolean(drawerDraft.__autoAmount) }}
                      helperText={drawerDraft.__autoAmount ? "Auto (QTY × Rate)" : "Manual"}
                    />
                  </Grid>

                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="GST Amount"
                      value={drawerDraft["GST Amount"] || ""}
                      InputProps={{ readOnly: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Total Amount"
                      value={drawerDraft["Total Amount"] || ""}
                      InputProps={{ readOnly: true }}
                    />
                  </Grid>
                </Grid>

                <TextField
                  fullWidth
                  size="small"
                  label="Attachment Link"
                  value={drawerDraft["Attachment Link"] || ""}
                  onChange={(e) => setDrawerField("Attachment Link", e.target.value)}
                />

                <TextField
                  fullWidth
                  size="small"
                  label="Voucher/Invoice No"
                  value={drawerDraft["Voucher/Invoice No"] || ""}
                  onChange={(e) => setDrawerField("Voucher/Invoice No", e.target.value)}
                />

                <Divider sx={{ my: 0.5 }} />

                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button variant="outlined" fullWidth onClick={closeDrawer} disabled={loading}>
                    Cancel
                  </Button>

                  <Button
                    variant="contained"
                    fullWidth
                    sx={{ bgcolor: cornflowerBlue }}
                    onClick={saveDrawer}
                    disabled={loading}
                  >
                    {loading ? "Saving…" : "Save"}
                  </Button>
                </Box>

                <Button
                  variant="contained"
                  fullWidth
                  sx={{ bgcolor: "#1f2a44" }}
                  onClick={saveDrawerAndNew}
                  disabled={loading}
                >
                  {loading ? "Saving…" : "Save & New"}
                </Button>

                {drawerMode === "edit" ? (
                  <Typography sx={{ fontSize: 11, opacity: 0.75 }}>
                    Note: Edit works by marking the old row inactive (delete by Particular) and appending the updated row.
                  </Typography>
                ) : null}
              </Box>
            </Drawer>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setOpenEdit(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}
