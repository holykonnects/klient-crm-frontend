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
  Autocomplete,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import RefreshIcon from "@mui/icons-material/Refresh";
import CurrencyRupeeIcon from "@mui/icons-material/CurrencyRupee";
import CloseIcon from "@mui/icons-material/Close";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";

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
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s.replace(/,/g, ""));
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
    script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${encodeURIComponent(
      cbName
    )}`;
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

/**
 * ✅ KEY FIX: Amount should NOT get “stagnant”.
 * Rules:
 * - If Amount is provided by user (non-empty) => use that.
 * - Else if QTY and Rate present => auto Amount = QTY * Rate.
 * - GST Amount and Total always recompute from Amount + GST%.
 * - Amount stays editable ALWAYS.
 * - __autoAmount only drives helper text (manual vs auto), not readOnly.
 */
function recomputeDraftLive(next) {
  const qty = safeNum(next["QTY"]);
  const rate = safeNum(next["Rate"]);
  const gstPct = safeNum(next["GST %"]);

  const amountStr = String(next["Amount"] ?? "").trim();
  const hasManualAmount = amountStr !== "";

  const canAuto = qty > 0 && rate > 0;
  const autoAmount = canAuto ? qty * rate : 0;

  const amountVal = hasManualAmount ? safeNum(amountStr) : canAuto ? autoAmount : 0;

  const gstAmountVal = amountVal > 0 ? (amountVal * gstPct) / 100 : 0;
  const totalVal = amountVal > 0 ? amountVal + gstAmountVal : 0;

  return {
    ...next,
    Amount: hasManualAmount ? next["Amount"] : canAuto ? autoAmount : "",
    "GST Amount": amountVal > 0 ? gstAmountVal : "",
    "Total Amount": amountVal > 0 ? totalVal : "",
    __autoAmount: !hasManualAmount && canAuto,
  };
}

// final compute before submit
function computeRowTotals(row) {
  const tmp = recomputeDraftLive({ ...row });
  const cleaned = { ...tmp };
  delete cleaned.__autoAmount;
  return cleaned;
}

const DEFAULT_PAYMENT_STATUSES = ["pending", "partially paid", "paid", "hold/disputed"];

function normalizeValidationResponse(raw) {
  const v = raw?.data ? raw.data : raw;

  const headsDirect = Array.isArray(v?.heads) ? v.heads : null;
  const subcatsDirect =
    v?.subcategories && typeof v.subcategories === "object" ? v.subcategories : null;
  const payDirect = Array.isArray(v?.paymentStatus) ? v.paymentStatus : null;

  if (headsDirect || subcatsDirect || payDirect) {
    const pay = (payDirect && payDirect.length ? payDirect : DEFAULT_PAYMENT_STATUSES).map(
      (x) => String(x).trim()
    );
    return {
      heads: headsDirect || [],
      subcategories: subcatsDirect || {},
      paymentStatus: pay,
    };
  }

  const heads =
    (Array.isArray(v?.costHeads) && v.costHeads) ||
    (Array.isArray(v?.["Cost Heads"]) && v["Cost Heads"]) ||
    [];

  const paymentStatusRaw =
    (Array.isArray(v?.["Payment Status"]) && v["Payment Status"]) ||
    (Array.isArray(v?.payment_status) && v.payment_status) ||
    [];

  const paymentStatus =
    paymentStatusRaw && paymentStatusRaw.length
      ? paymentStatusRaw.map((x) => String(x).trim())
      : DEFAULT_PAYMENT_STATUSES;

  const subcategories =
    (v?.subcategoryMap && typeof v.subcategoryMap === "object" && v.subcategoryMap) ||
    {};

  return { heads, subcategories, paymentStatus };
}

function getExtractColsStorageKey(userKey) {
  return `kk_costing_extract_cols_v1::${userKey || "anon"}`;
}

function safeJsonParse(s, fallback) {
  try {
    const v = JSON.parse(s);
    return v ?? fallback;
  } catch {
    return fallback;
  }
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
    paymentStatus: DEFAULT_PAYMENT_STATUSES,
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

  // ✅ Entity options + search input
  const [entityOptions, setEntityOptions] = useState([]);
  const [entityLoading, setEntityLoading] = useState(false);
  const [entitySearchText, setEntitySearchText] = useState("");

  // ✅ existing cost sheet search text
  const [existingSheetSearchText, setExistingSheetSearchText] = useState("");

  // ✅ Drawer menu containment ref
  const drawerPaperRef = useRef(null);

  // ===== Extraction =====
  const [openExtract, setOpenExtract] = useState(false);
  const [extractForm, setExtractForm] = useState({
    entityType: "",
    linkedEntityId: "",
    particular: "",
    paymentStatus: "",
    from: "",
    to: "",
    format: "csv",
  });

  const [extractColumnsAnchor, setExtractColumnsAnchor] = useState(null);
  const [extractVisibleCols, setExtractVisibleCols] = useState({});
  const [extractColsTouched, setExtractColsTouched] = useState(false);

  const fallbackLineItemHeaders = useMemo(() => {
    return [
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
  }, []);

  const extractAllColumns = useMemo(() => {
    const hs = Array.isArray(lineItemHeaders) && lineItemHeaders.length ? lineItemHeaders : null;
    return hs || fallbackLineItemHeaders;
  }, [lineItemHeaders, fallbackLineItemHeaders]);

  useEffect(() => {
    if (!openExtract) return;

    const userKey = String(loggedInName || "").trim();
    const storageKey = getExtractColsStorageKey(userKey);

    const allDefault = {};
    (extractAllColumns || []).forEach((c) => (allDefault[c] = true));

    const cached = safeJsonParse(localStorage.getItem(storageKey), null);

    setExtractVisibleCols((prev) => {
      if (extractColsTouched && prev && Object.keys(prev).length) return prev;

      if (cached && typeof cached === "object") {
        const next = { ...allDefault };
        Object.keys(next).forEach((k) => {
          if (k in cached) next[k] = cached[k] !== false;
        });
        return next;
      }

      return allDefault;
    });
  }, [openExtract, extractAllColumns, loggedInName, extractColsTouched]);

  function openExtractColumns(e) {
    setExtractColumnsAnchor(e.currentTarget);
  }
  function closeExtractColumns() {
    setExtractColumnsAnchor(null);
  }

  const selectedExtractFields = useMemo(() => {
    const keys = Object.keys(extractVisibleCols || {});
    if (!keys.length) return [];
    return keys.filter((k) => extractVisibleCols[k] !== false);
  }, [extractVisibleCols]);

  function triggerExtraction() {
    const baseParams = {
      action: "exportCosting",
      ...Object.fromEntries(
        Object.entries(extractForm).filter(([_, v]) => String(v || "").trim())
      ),
    };

    const params = new URLSearchParams(baseParams);

    const allCount = (extractAllColumns || []).length;
    const selCount = selectedExtractFields.length;

    if (selCount > 0 && selCount < allCount) {
      params.set("fields", JSON.stringify(selectedExtractFields));
    }

    const url = `${BACKEND}?${params.toString()}`;
    window.open(url, "_blank");
    setOpenExtract(false);
  }

  // Create cost sheet form
  const [createForm, setCreateForm] = useState({
    Owner: "",
    "Linked Entity Type": "",
    "Linked Entity ID": "",
    "Linked Entity Name": "", // store display string
    "Client Name": "",
    "Project Type": "",
    Status: "Draft",
    Notes: "",
  });

  /* ===================== ✅ ADD EXPENSE (Existing OR New Cost Sheet) ===================== */
  const [openAddExpense, setOpenAddExpense] = useState(false);
  const [addExpenseMode, setAddExpenseMode] = useState("existing"); // "existing" | "new"
  const [selectedExistingSheetId, setSelectedExistingSheetId] = useState("");
  const [addExpenseItems, setAddExpenseItems] = useState([]);

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
    setEntitySearchText("");
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

  /**
   * ✅ ENTITY SEARCH FIX
   * - Use Autocomplete (searchable) instead of Select.
   * - Also send optional q to backend (if your GAS ignores it, it still works with local filtering).
   */
  async function loadEntitiesForType(type, q = "") {
    const t = String(type || "").trim();
    if (!t) {
      setEntityOptions([]);
      return;
    }

    setEntityLoading(true);
    try {
      const url =
        `${BACKEND}?action=getEntities` +
        `&type=${encodeURIComponent(t)}` +
        `&owner=${encodeURIComponent(loggedInName || "")}` +
        `&role=${encodeURIComponent(role || "")}` +
        `&q=${encodeURIComponent(String(q || "").trim())}`;

      const res = await jsonpGet(url);

      if (res?.success && Array.isArray(res.entities)) {
        setEntityOptions(res.entities);
      } else if (Array.isArray(res)) {
        // if backend returns plain array
        setEntityOptions(res);
      } else {
        console.error("GET_ENTITIES_ERROR", res);
        setEntityOptions([]);
      }
    } catch (e) {
      console.error("GET_ENTITIES_FETCH_ERROR", e);
      setEntityOptions([]);
    } finally {
      setEntityLoading(false);
    }
  }

  async function createCostSheet() {
    setLoading(true);
    try {
      await apiPost({ action: "createCostSheet", data: { ...createForm } });

      setOpenCreate(false);

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

    payloadRow["Owner"] =
      activeSheet?.["Owner"] || payloadRow["Owner"] || loggedInName || "";
    payloadRow["Linked Entity Type"] =
      activeSheet?.["Linked Entity Type"] || payloadRow["Linked Entity Type"] || "";
    payloadRow["Linked Entity ID"] =
      activeSheet?.["Linked Entity ID"] || payloadRow["Linked Entity ID"] || "";
    payloadRow["Linked Entity Name"] =
      activeSheet?.["Linked Entity Name"] || payloadRow["Linked Entity Name"] || "";

    payloadRow["Entered By"] = loggedInName || payloadRow["Entered By"] || "";

    // ✅ final compute
    payloadRow = computeRowTotals(payloadRow);

    const hasSome =
      String(payloadRow.Particular || "").trim() ||
      String(payloadRow.Details || "").trim() ||
      String(payloadRow.Amount || "").trim() ||
      (safeNum(payloadRow["QTY"]) > 0 && safeNum(payloadRow["Rate"]) > 0);

    if (!hasSome) {
      alert("Please enter at least Particular / Details / Amount OR QTY & Rate.");
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
      Amount: "", // manual
      "GST %": "",
      "GST Amount": "",
      "Total Amount": "",
      "Attachment Link": "",
      "Voucher/Invoice No": "",
      "Payment Status": "",
      __autoAmount: false,
    });

  const [drawerDraft, setDrawerDraft] = useState(() => blankDraft(""));

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
      const next = { ...p, [key]: value };
      if (key === "Head Name") next.Subcategory = "";
      return recomputeDraftLive(next);
    });
  }

  function forceAutoAmountInDrawer() {
    // ✅ user can click “Use Auto” anytime: clears Amount so auto applies if QTY+Rate present
    setDrawerDraft((p) => recomputeDraftLive({ ...p, Amount: "" }));
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

  /* ===================== Add Expense Modal (MULTI ITEMS) ===================== */

  function setAddExpenseItemField(index, key, value) {
    setAddExpenseItems((prev) => {
      const next = [...prev];
      const cur = next[index] ? { ...next[index] } : blankDraft("");

      const updated = { ...cur, [key]: value };
      if (key === "Head Name") updated.Subcategory = "";
      next[index] = recomputeDraftLive(updated);
      return next;
    });
  }

  function forceAutoAmountForExpenseItem(index) {
    setAddExpenseItems((prev) => {
      const next = [...prev];
      const cur = next[index] ? { ...next[index] } : blankDraft("");
      next[index] = recomputeDraftLive({ ...cur, Amount: "" });
      return next;
    });
  }

  function addAnotherExpenseItem() {
    setAddExpenseItems((prev) => {
      const last = prev && prev.length ? prev[prev.length - 1] : null;
      const headKeep = String(last?.["Head Name"] || "").trim();
      return [...(prev || []), blankDraft(headKeep)];
    });
  }

  function removeExpenseItem(index) {
    setAddExpenseItems((prev) => {
      const arr = [...(prev || [])];
      arr.splice(index, 1);
      return arr.length ? arr : [blankDraft("")];
    });
  }

  const addExpenseTotals = useMemo(() => {
    const items = Array.isArray(addExpenseItems) ? addExpenseItems : [];
    const sum = items.reduce((acc, it) => acc + safeNum(it?.["Total Amount"]), 0);
    return { count: items.length, total: sum };
  }, [addExpenseItems]);

  function openAddExpenseModal() {
    setAddExpenseMode("existing");
    setSelectedExistingSheetId("");
    setExistingSheetSearchText("");
    setEntityOptions([]);
    setEntitySearchText("");
    setCreateForm((p) => ({
      ...p,
      Owner: loggedInName || p.Owner,
      Status: "Draft",
      "Linked Entity Type": "",
      "Linked Entity ID": "",
      "Linked Entity Name": "",
    }));
    setAddExpenseItems([blankDraft("")]);
    setOpenAddExpense(true);
  }

  async function submitAddExpense() {
    await ensureValidationLoaded();

    const items = Array.isArray(addExpenseItems) ? addExpenseItems : [];
    if (!items.length) {
      alert("Please add at least one line item.");
      return;
    }

    const cleanedItems = items.map((it) => computeRowTotals({ ...(it || {}), "Entered By": loggedInName }));

    const validItems = cleanedItems.filter((payloadRow) => {
      const hasSome =
        String(payloadRow.Particular || "").trim() ||
        String(payloadRow.Details || "").trim() ||
        String(payloadRow.Amount || "").trim() ||
        (safeNum(payloadRow["QTY"]) > 0 && safeNum(payloadRow["Rate"]) > 0);
      return hasSome;
    });

    if (!validItems.length) {
      alert("Please enter at least Particular / Details / Amount OR QTY & Rate in at least one line item.");
      return;
    }

    setLoading(true);
    try {
      if (addExpenseMode === "existing") {
        if (!selectedExistingSheetId) {
          alert("Please select an existing Cost Sheet.");
          return;
        }

        const sheetRow = (costSheets || []).find(
          (x) => String(x["Cost Sheet ID"]) === String(selectedExistingSheetId)
        );

        for (const payloadRow of validItems) {
          payloadRow["Cost Sheet ID"] = selectedExistingSheetId;

          payloadRow["Owner"] = sheetRow?.["Owner"] || payloadRow["Owner"] || loggedInName || "";
          payloadRow["Linked Entity Type"] =
            sheetRow?.["Linked Entity Type"] || payloadRow["Linked Entity Type"] || "";
          payloadRow["Linked Entity ID"] =
            sheetRow?.["Linked Entity ID"] || payloadRow["Linked Entity ID"] || "";
          payloadRow["Linked Entity Name"] =
            sheetRow?.["Linked Entity Name"] || payloadRow["Linked Entity Name"] || "";

          await apiPost({ action: "addLineItem", data: payloadRow });
        }

        setOpenAddExpense(false);

        setTimeout(async () => {
          await loadAll();
        }, 800);

        alert(
          validItems.length === 1
            ? "Line item added to existing Cost Sheet."
            : `${validItems.length} line items added to existing Cost Sheet.`
        );
        return;
      }

      // new cost sheet mode (same limitation as before: no-cors cannot return new ID)
      if (!createForm["Linked Entity Type"] || !createForm["Linked Entity ID"]) {
        alert("Please select Linked Entity Type and Linked Entity for the new Cost Sheet.");
        return;
      }

      const first = validItems[0];
      if (validItems.length > 1) {
        alert(
          "Note: In 'Create New Cost Sheet' mode, only the first line item will be submitted in one go. " +
            "After the sheet is created and refresh completes, add remaining items to that cost sheet."
        );
      }

      const costSheetData = {
        ...createForm,
        Owner: createForm.Owner || loggedInName || "",
      };

      await apiPost({
        action: "createCostSheetAndAddLineItem",
        data: {
          costSheetData,
          lineItemData: {
            ...first,
            Owner: costSheetData.Owner,
            "Linked Entity Type": costSheetData["Linked Entity Type"],
            "Linked Entity ID": costSheetData["Linked Entity ID"],
            "Linked Entity Name": costSheetData["Linked Entity Name"],
          },
        },
      });

      setOpenAddExpense(false);

      setTimeout(async () => {
        await loadAll();
      }, 800);

      alert("New Cost Sheet created and first line item added.");
    } catch (e) {
      console.error("ADD_EXPENSE_ERROR", e);
      alert("Failed to submit expense.");
    } finally {
      setLoading(false);
    }
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
        {/* ✅ HEADER */}
        <Box padding={4}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CurrencyRupeeIcon sx={{ color: cornflowerBlue }} />
              <Typography variant="h5" fontWeight="bold" sx={{ fontFamily: "Montserrat, sans-serif" }}>
                Costing
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
              onClick={loadAll}
              sx={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Refresh
            </Button>

            <Button
              variant="outlined"
              onClick={() => {
                setOpenExtract(true);
                setExtractColsTouched(false);
              }}
              sx={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Extract
            </Button>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openAddExpenseModal}
              sx={{ bgcolor: "#1f2a44", fontFamily: "Montserrat, sans-serif" }}
            >
              Add Expense
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
                <Typography sx={{ fontWeight: 800, fontSize: 12, mb: 1 }}>Columns</Typography>
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
                      <TableCell key={c} sx={{ fontWeight: 800, fontSize: 12 }}>{c}</TableCell>
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
                        <TableCell key={c} sx={{ fontSize: 12 }}>{String(r[c] ?? "")}</TableCell>
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

        {/* ================= EXTRACT MODAL ================= */}
        <Dialog open={openExtract} onClose={() => setOpenExtract(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800 }}>Extract Costing Data</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2, borderColor: "#e9eefc", bgcolor: "#fbfcff" }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <Box>
                      <Typography sx={{ fontWeight: 900, fontSize: 12 }}>Columns to Export</Typography>
                      <Typography sx={{ fontSize: 11, opacity: 0.75 }}>
                        Selected:{" "}
                        {selectedExtractFields.length
                          ? `${selectedExtractFields.length} / ${extractAllColumns.length}`
                          : `All (${extractAllColumns.length})`}
                      </Typography>
                    </Box>

                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ViewColumnIcon />}
                      onClick={openExtractColumns}
                      sx={{ fontFamily: "Montserrat, sans-serif" }}
                    >
                      Select Columns
                    </Button>
                  </Box>

                  <Popover
                    open={Boolean(extractColumnsAnchor)}
                    anchorEl={extractColumnsAnchor}
                    onClose={closeExtractColumns}
                    anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                  >
                    <Box sx={{ p: 1.5, maxWidth: 420 }}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                        <Typography sx={{ fontWeight: 900, fontSize: 12 }}>Export Columns</Typography>

                        <Box sx={{ display: "flex", gap: 1 }}>
                          <Button
                            size="small"
                            onClick={() => {
                              const all = {};
                              (extractAllColumns || []).forEach((c) => (all[c] = true));
                              setExtractVisibleCols(all);
                              setExtractColsTouched(true);
                            }}
                          >
                            Select All
                          </Button>
                          <Button
                            size="small"
                            onClick={() => {
                              const none = {};
                              (extractAllColumns || []).forEach((c) => (none[c] = false));
                              setExtractVisibleCols(none);
                              setExtractColsTouched(true);
                            }}
                          >
                            Clear
                          </Button>
                        </Box>
                      </Box>

                      <Divider sx={{ mb: 1 }} />

                      <FormGroup>
                        {(extractAllColumns || []).map((c) => (
                          <FormControlLabel
                            key={c}
                            control={
                              <Checkbox
                                size="small"
                                checked={extractVisibleCols[c] !== false}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setExtractVisibleCols((p) => ({ ...p, [c]: checked }));
                                  setExtractColsTouched(true);

                                  const userKey = String(loggedInName || "").trim();
                                  const storageKey = getExtractColsStorageKey(userKey);
                                  const next = { ...(extractVisibleCols || {}), [c]: checked };
                                  try {
                                    localStorage.setItem(storageKey, JSON.stringify(next));
                                  } catch {}
                                }}
                              />
                            }
                            label={<Typography sx={{ fontSize: 12 }}>{c}</Typography>}
                          />
                        ))}
                      </FormGroup>

                      <Divider sx={{ mt: 1 }} />

                      <Typography sx={{ fontSize: 11, opacity: 0.75, mt: 1 }}>
                        If you keep all selected, export will behave as “export all columns”.
                      </Typography>
                    </Box>
                  </Popover>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Linked Entity Type</InputLabel>
                  <Select
                    label="Linked Entity Type"
                    value={extractForm.entityType}
                    onChange={(e) => setExtractForm((p) => ({ ...p, entityType: e.target.value }))}
                  >
                    <MenuItem value="">All</MenuItem>
                    {["Account", "Deal", "Project", "Order"].map((t) => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Linked Entity ID"
                  value={extractForm.linkedEntityId}
                  onChange={(e) => setExtractForm((p) => ({ ...p, linkedEntityId: e.target.value }))}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Particular"
                  value={extractForm.particular}
                  onChange={(e) => setExtractForm((p) => ({ ...p, particular: e.target.value }))}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Status</InputLabel>
                  <Select
                    label="Payment Status"
                    value={extractForm.paymentStatus}
                    onChange={(e) => setExtractForm((p) => ({ ...p, paymentStatus: e.target.value }))}
                  >
                    <MenuItem value="">All</MenuItem>
                    {(validation.paymentStatus || DEFAULT_PAYMENT_STATUSES).map((s) => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="From Date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={extractForm.from}
                  onChange={(e) => setExtractForm((p) => ({ ...p, from: e.target.value }))}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="To Date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={extractForm.to}
                  onChange={(e) => setExtractForm((p) => ({ ...p, to: e.target.value }))}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Format</InputLabel>
                  <Select
                    label="Format"
                    value={extractForm.format}
                    onChange={(e) => setExtractForm((p) => ({ ...p, format: e.target.value }))}
                  >
                    <MenuItem value="csv">CSV</MenuItem>
                    <MenuItem value="xlsx">Excel (XLSX)</MenuItem>
                    <MenuItem value="pdf">PDF</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setOpenExtract(false)}>Cancel</Button>
            <Button variant="contained" onClick={triggerExtraction} sx={{ bgcolor: cornflowerBlue }}>
              Download
            </Button>
          </DialogActions>
        </Dialog>

        {/* ================= ✅ ADD EXPENSE MODAL ================= */}
        <Dialog open={openAddExpense} onClose={() => setOpenAddExpense(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontWeight: 800 }}>Add Expense</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Mode</InputLabel>
                  <Select label="Mode" value={addExpenseMode} onChange={(e) => setAddExpenseMode(e.target.value)}>
                    <MenuItem value="existing">Add to Existing Cost Sheet</MenuItem>
                    <MenuItem value="new">Create New Cost Sheet</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper
                  variant="outlined"
                  sx={{
                    height: "100%",
                    p: 1.1,
                    borderRadius: 2,
                    borderColor: "#e9eefc",
                    bgcolor: "#fbfcff",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: 0.4,
                  }}
                >
                  <Typography sx={{ fontWeight: 900, fontSize: 12 }}>Batch Summary</Typography>
                  <Typography sx={{ fontSize: 12, opacity: 0.8 }}>
                    Line items: {addExpenseTotals.count} | Total: ₹ {fmtINR(addExpenseTotals.total)}
                  </Typography>
                </Paper>
              </Grid>

              {addExpenseMode === "existing" ? (
                <Grid item xs={12}>
                  {/* ✅ Searchable existing sheet picker */}
                  <Autocomplete
                    options={costSheets || []}
                    value={
                      (costSheets || []).find(
                        (x) => String(x["Cost Sheet ID"]) === String(selectedExistingSheetId)
                      ) || null
                    }
                    inputValue={existingSheetSearchText}
                    onInputChange={(_, v) => setExistingSheetSearchText(v)}
                    onChange={(_, v) => setSelectedExistingSheetId(v ? v["Cost Sheet ID"] : "")}
                    getOptionLabel={(cs) =>
                      [
                        cs?.["Cost Sheet ID"],
                        cs?.["Linked Entity Name"],
                        cs?.["Owner"],
                        cs?.["Status"],
                      ]
                        .filter(Boolean)
                        .join(" — ")
                    }
                    renderInput={(params) => (
                      <TextField {...params} size="small" label="Existing Cost Sheet" />
                    )}
                  />
                </Grid>
              ) : (
                <>
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
                          setEntitySearchText("");
                          await loadEntitiesForType(type, "");
                        }}
                      >
                        {["Account", "Deal", "Project", "Order"].map((t) => (
                          <MenuItem key={t} value={t}>{t}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    {/* ✅ Searchable entity picker (Deals/Projects/Orders/Accounts) */}
                    <Autocomplete
                      disabled={!createForm["Linked Entity Type"]}
                      loading={entityLoading}
                      options={entityOptions || []}
                      value={
                        (entityOptions || []).find(
                          (x) => String(x.id) === String(createForm["Linked Entity ID"])
                        ) || null
                      }
                      inputValue={entitySearchText}
                      onInputChange={async (_, v) => {
                        setEntitySearchText(v);
                        // If you want server-side filtering, this will help once GAS supports q.
                        // If GAS ignores q, still fine: Autocomplete filters locally.
                        if (createForm["Linked Entity Type"]) {
                          await loadEntitiesForType(createForm["Linked Entity Type"], v);
                        }
                      }}
                      onChange={(_, v) => {
                        setCreateForm((p) => ({
                          ...p,
                          "Linked Entity ID": v ? v.id : "",
                          "Linked Entity Name": v ? v.display : "",
                        }));
                      }}
                      getOptionLabel={(opt) => String(opt?.display || opt?.name || opt?.id || "")}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          label="Linked Entity (Search Deals/Projects/Orders/Accounts)"
                          helperText={
                            !createForm["Linked Entity Type"]
                              ? "Select Linked Entity Type first"
                              : "Type to search"
                          }
                        />
                      )}
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
                          <MenuItem key={s} value={s}>{s}</MenuItem>
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
                      minRows={2}
                    />
                  </Grid>
                </>
              )}

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                  <Typography sx={{ fontWeight: 900, fontSize: 12 }}>Line Items</Typography>

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addAnotherExpenseItem}
                    sx={{ fontFamily: "Montserrat, sans-serif" }}
                  >
                    Add Another Line Item
                  </Button>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                  {(addExpenseItems || []).map((it, idx) => (
                    <Paper
                      key={idx}
                      variant="outlined"
                      sx={{ p: 1.25, borderRadius: 2, borderColor: "#e9eefc", bgcolor: "#ffffff" }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1 }}>
                        <Typography sx={{ fontWeight: 900, fontSize: 12 }}>
                          Item #{idx + 1} — Total: ₹ {fmtINR(safeNum(it?.["Total Amount"]))}
                        </Typography>

                        <IconButton
                          size="small"
                          onClick={() => removeExpenseItem(idx)}
                          disabled={(addExpenseItems || []).length <= 1}
                          title={(addExpenseItems || []).length <= 1 ? "At least one line item is required" : "Remove this line item"}
                        >
                          <RemoveCircleOutlineIcon sx={{ color: (addExpenseItems || []).length <= 1 ? "#bbb" : "#c62828" }} />
                        </IconButton>
                      </Box>

                      <Grid container spacing={1.25}>
                        <Grid item xs={12} md={6}>
                          <FormControl size="small" fullWidth>
                            <InputLabel>Head Name</InputLabel>
                            <Select
                              label="Head Name"
                              value={it?.["Head Name"] || ""}
                              onChange={(e) => setAddExpenseItemField(idx, "Head Name", e.target.value)}
                            >
                              {(validation.heads || []).map((h) => (
                                <MenuItem key={h} value={h}>{h}</MenuItem>
                              ))}
                              {!validation.heads?.length ? (
                                <MenuItem value="" disabled>No heads found</MenuItem>
                              ) : null}
                            </Select>
                          </FormControl>
                        </Grid>

                        <Grid item xs={12} md={6}>
                          <FormControl size="small" fullWidth>
                            <InputLabel>Subcategory</InputLabel>
                            <Select
                              label="Subcategory"
                              value={it?.Subcategory || ""}
                              onChange={(e) => setAddExpenseItemField(idx, "Subcategory", e.target.value)}
                            >
                              {subcatsForHead(it?.["Head Name"] || "").map((s) => (
                                <MenuItem key={s} value={s}>{s}</MenuItem>
                              ))}
                              {!subcatsForHead(it?.["Head Name"] || "").length ? (
                                <MenuItem value="" disabled>No subcategories</MenuItem>
                              ) : null}
                            </Select>
                          </FormControl>
                        </Grid>

                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Expense Date"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            value={it?.["Expense Date"] || ""}
                            onChange={(e) => setAddExpenseItemField(idx, "Expense Date", e.target.value)}
                          />
                        </Grid>

                        <Grid item xs={12} md={6}>
                          <FormControl size="small" fullWidth>
                            <InputLabel>Payment Status</InputLabel>
                            <Select
                              label="Payment Status"
                              value={it?.["Payment Status"] || ""}
                              onChange={(e) => setAddExpenseItemField(idx, "Payment Status", e.target.value)}
                            >
                              {(validation.paymentStatus || DEFAULT_PAYMENT_STATUSES).map((s) => (
                                <MenuItem key={s} value={s}>{s}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>

                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Particular"
                            value={it?.Particular || ""}
                            onChange={(e) => setAddExpenseItemField(idx, "Particular", e.target.value)}
                          />
                        </Grid>

                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Details"
                            value={it?.Details || ""}
                            onChange={(e) => setAddExpenseItemField(idx, "Details", e.target.value)}
                            multiline
                            minRows={2}
                          />
                        </Grid>

                        <Grid item xs={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="QTY"
                            value={it?.["QTY"] || ""}
                            onChange={(e) => setAddExpenseItemField(idx, "QTY", e.target.value)}
                          />
                        </Grid>

                        <Grid item xs={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Rate"
                            value={it?.["Rate"] || ""}
                            onChange={(e) => setAddExpenseItemField(idx, "Rate", e.target.value)}
                          />
                        </Grid>

                        <Grid item xs={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="GST %"
                            value={it?.["GST %"] || ""}
                            onChange={(e) => setAddExpenseItemField(idx, "GST %", e.target.value)}
                          />
                        </Grid>

                        <Grid item xs={8}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Amount (manual OR auto)"
                            value={it?.["Amount"] || ""}
                            onChange={(e) => setAddExpenseItemField(idx, "Amount", e.target.value)}
                            helperText={it?.__autoAmount ? "Auto (QTY × Rate). You can still override." : "Manual (or leave blank to auto from QTY×Rate)."}
                          />
                        </Grid>

                        <Grid item xs={4} sx={{ display: "flex", alignItems: "center" }}>
                          <Button
                            variant="outlined"
                            size="small"
                            fullWidth
                            onClick={() => forceAutoAmountForExpenseItem(idx)}
                            sx={{ fontFamily: "Montserrat, sans-serif" }}
                          >
                            Use Auto
                          </Button>
                        </Grid>

                        <Grid item xs={6}>
                          <TextField fullWidth size="small" label="GST Amount" value={it?.["GST Amount"] || ""} InputProps={{ readOnly: true }} />
                        </Grid>

                        <Grid item xs={6}>
                          <TextField fullWidth size="small" label="Total Amount" value={it?.["Total Amount"] || ""} InputProps={{ readOnly: true }} />
                        </Grid>

                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Attachment Link"
                            value={it?.["Attachment Link"] || ""}
                            onChange={(e) => setAddExpenseItemField(idx, "Attachment Link", e.target.value)}
                          />
                        </Grid>

                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Voucher/Invoice No"
                            value={it?.["Voucher/Invoice No"] || ""}
                            onChange={(e) => setAddExpenseItemField(idx, "Voucher/Invoice No", e.target.value)}
                          />
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setOpenAddExpense(false)}>Cancel</Button>
            <Button variant="contained" onClick={submitAddExpense} sx={{ bgcolor: cornflowerBlue }} disabled={loading}>
              {loading ? "Submitting…" : "Submit"}
            </Button>
          </DialogActions>
        </Dialog>

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
                      setEntitySearchText("");
                      await loadEntitiesForType(type, "");
                    }}
                  >
                    {["Account", "Deal", "Project", "Order"].map((t) => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                {/* ✅ Searchable entity picker */}
                <Autocomplete
                  disabled={!createForm["Linked Entity Type"]}
                  loading={entityLoading}
                  options={entityOptions || []}
                  value={
                    (entityOptions || []).find(
                      (x) => String(x.id) === String(createForm["Linked Entity ID"])
                    ) || null
                  }
                  inputValue={entitySearchText}
                  onInputChange={async (_, v) => {
                    setEntitySearchText(v);
                    if (createForm["Linked Entity Type"]) {
                      await loadEntitiesForType(createForm["Linked Entity Type"], v);
                    }
                  }}
                  onChange={(_, v) => {
                    setCreateForm((p) => ({
                      ...p,
                      "Linked Entity ID": v ? v.id : "",
                      "Linked Entity Name": v ? v.display : "",
                    }));
                  }}
                  getOptionLabel={(opt) => String(opt?.display || opt?.name || opt?.id || "")}
                  renderInput={(params) => (
                    <TextField {...params} size="small" label="Linked Entity (Search)" />
                  )}
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
                      <MenuItem key={s} value={s}>{s}</MenuItem>
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
            <Button variant="contained" onClick={createCostSheet} sx={{ bgcolor: cornflowerBlue }} disabled={loading}>
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
                          <IconButton title="Edit" onClick={() => openDrawerEdit(it)} disabled={loading}>
                            <EditIcon sx={{ color: cornflowerBlue }} />
                          </IconButton>

                          <IconButton onClick={() => softDeleteLineItem(it)} disabled={loading} title="Delete">
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
              sx={{ zIndex: (t) => (t?.zIndex?.modal ?? 1300) + 20 }}
              ModalProps={{ keepMounted: true }}
              PaperProps={{
                ref: drawerPaperRef,
                sx: { width: { xs: "100%", sm: 420 }, p: 2, zIndex: (t) => (t?.zIndex?.modal ?? 1300) + 21 },
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
                  >
                    {(validation.heads || []).map((h) => (
                      <MenuItem key={h} value={h}>{h}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                  <InputLabel>Subcategory</InputLabel>
                  <Select
                    label="Subcategory"
                    value={drawerDraft.Subcategory || ""}
                    onChange={(e) => setDrawerField("Subcategory", e.target.value)}
                  >
                    {subcatsForHead(drawerDraft["Head Name"] || "").map((s) => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                    {!subcatsForHead(drawerDraft["Head Name"] || "").length ? (
                      <MenuItem value="" disabled>No subcategories</MenuItem>
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
                  >
                    {(validation.paymentStatus || DEFAULT_PAYMENT_STATUSES).map((s) => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
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
                    <TextField fullWidth size="small" label="QTY" value={drawerDraft["QTY"] || ""} onChange={(e) => setDrawerField("QTY", e.target.value)} />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField fullWidth size="small" label="Rate" value={drawerDraft["Rate"] || ""} onChange={(e) => setDrawerField("Rate", e.target.value)} />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField fullWidth size="small" label="GST %" value={drawerDraft["GST %"] || ""} onChange={(e) => setDrawerField("GST %", e.target.value)} />
                  </Grid>

                  {/* ✅ FIX: Amount ALWAYS editable, but supports auto */}
                  <Grid item xs={8}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Amount (manual OR auto)"
                      value={drawerDraft["Amount"] || ""}
                      onChange={(e) => setDrawerField("Amount", e.target.value)}
                      helperText={
                        drawerDraft.__autoAmount
                          ? "Auto (QTY × Rate). You can still override."
                          : "Manual (or leave blank to auto from QTY×Rate)."
                      }
                    />
                  </Grid>

                  <Grid item xs={4} sx={{ display: "flex", alignItems: "center" }}>
                    <Button
                      variant="outlined"
                      size="small"
                      fullWidth
                      onClick={forceAutoAmountInDrawer}
                      sx={{ fontFamily: "Montserrat, sans-serif" }}
                    >
                      Use Auto
                    </Button>
                  </Grid>

                  <Grid item xs={6}>
                    <TextField fullWidth size="small" label="GST Amount" value={drawerDraft["GST Amount"] || ""} InputProps={{ readOnly: true }} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField fullWidth size="small" label="Total Amount" value={drawerDraft["Total Amount"] || ""} InputProps={{ readOnly: true }} />
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
                  <Button variant="outlined" fullWidth onClick={closeDrawer} disabled={loading}>Cancel</Button>
                  <Button variant="contained" fullWidth sx={{ bgcolor: cornflowerBlue }} onClick={saveDrawer} disabled={loading}>
                    {loading ? "Saving…" : "Save"}
                  </Button>
                </Box>

                <Button variant="contained" fullWidth sx={{ bgcolor: "#1f2a44" }} onClick={saveDrawerAndNew} disabled={loading}>
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
