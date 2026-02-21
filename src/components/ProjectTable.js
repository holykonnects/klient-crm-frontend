// src/components/ProjectTable.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  InputAdornment,
  Chip,
  Paper,
  ListItemText,
  CircularProgress,
  Divider,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
} from "@mui/material";

import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import HistoryIcon from "@mui/icons-material/History";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import "@fontsource/montserrat";
import LoadingOverlay from "./LoadingOverlay";

const WEB_APP_BASE =
  "https://script.google.com/macros/s/AKfycbxLsPfXtpRuKOoB956pb6VfO4_Hx1cPEVpiZApTMKjxig0iL3EwodQaHCGItGyUwMnhzQ/exec";

const theme = createTheme({
  typography: { fontFamily: "Montserrat, sans-serif", fontSize: 10.5 },
});

const selectorStyle = { fontFamily: "Montserrat, sans-serif", fontSize: 12 };

const PROJECT_STATUS_COLORS = {
  "Not Started": "default",
  Active: "primary",
  "On Hold": "warning",
  Completed: "success",
  Cancelled: "error",
};
const TASK_STATUS_COLORS = {
  "Not Started": "default",
  "In Progress": "info",
  Completed: "success",
};

const DATE_FIELDS = new Set(["Timestamp", "Start Date", "End Date"]);
const MONEY_FIELDS = new Set(["Budget (₹)", "Actual Cost (₹)", "Variance (₹)"]);
const PERCENT_FIELDS = new Set(["Project Progress %"]);

// ----------------- helpers -----------------
const norm = (s) =>
  String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const pad = (n, w = 2) => String(n).padStart(w, "0");

/**
 * ✅ Robust Timestamp parser:
 * supports:
 * 1) Date object
 * 2) ISO / JS-parsable strings
 * 3) "DD/MM/YYYY HH:MM:SS" (optional .ms)
 * 4) compact: "DDMMYYYYHHMMSSmmm" e.g. 20022026163205328
 */
const parseAsDate = (v) => {
  if (!v && v !== 0) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;

  const s = String(v).trim();
  if (!s) return null;

  // compact: DDMMYYYYHHMMSSmmm (17 digits)
  if (/^\d{17}$/.test(s)) {
    const dd = Number(s.slice(0, 2));
    const mm = Number(s.slice(2, 4));
    const yyyy = Number(s.slice(4, 8));
    const HH = Number(s.slice(8, 10));
    const MI = Number(s.slice(10, 12));
    const SS = Number(s.slice(12, 14));
    const MS = Number(s.slice(14, 17));
    const d = new Date(yyyy, mm - 1, dd, HH, MI, SS, MS);
    return isNaN(d) ? null : d;
  }

  // "DD/MM/YYYY HH:MM:SS(.ms)" or "DD-MM-YYYY ..."
  const m = s.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?$/
  );
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const HH = Number(m[4] ?? 0);
    const MI = Number(m[5] ?? 0);
    const SS = Number(m[6] ?? 0);
    const MS = Number(String(m[7] ?? "0").padEnd(3, "0"));
    const d = new Date(yyyy, mm - 1, dd, HH, MI, SS, MS);
    return isNaN(d) ? null : d;
  }

  // fallback: JS date parse (ISO etc.)
  const d = new Date(s);
  return isNaN(d) ? null : d;
};

const formatDDMMYYYY_HHMMSSS = (v) => {
  const d = parseAsDate(v);
  if (!d) return String(v ?? "");
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const HH = pad(d.getHours());
  const MI = pad(d.getMinutes());
  const SS = pad(d.getSeconds());
  const MS = pad(d.getMilliseconds(), 3);
  return `${dd}/${mm}/${yyyy} ${HH}:${MI}:${SS}.${MS}`;
};

const isMultilineHeader = (h) =>
  /remarks|updates|description|notes/i.test(String(h));

const toStringArray = (val) => {
  if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter(Boolean);
  if (val == null || val === "") return [];
  if (typeof val === "string")
    return val.split(/[;,|]\s*/g).map((s) => s.trim()).filter(Boolean);
  if (typeof val === "object") {
    if (Array.isArray(val.values)) return toStringArray(val.values);
    return Object.values(val).map((v) => String(v).trim()).filter(Boolean);
  }
  return [];
};

const normalizeOptions = (val) => toStringArray(val);

// control header from Validation sheet
const MULTI_KEY = "Project Multiselect Fields"; // exact header name
const FALLBACK_MULTI = new Set([norm("Vendors"), norm("Assigned Team")]);

/** CSV helpers */
const csvEscape = (v) => {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const downloadTextFile = (filename, content, mime = "text/csv;charset=utf-8") => {
  const blob = new Blob(["\uFEFF" + content], { type: mime }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/** Date range (inclusive) */
const parseYMDLocalStart = (ymd) => {
  if (!ymd) return null;
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

const parseYMDLocalEnd = (ymd) => {
  if (!ymd) return null;
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999);
};

const inDateRange = (value, fromYMD, toYMD) => {
  const d = parseAsDate(value);
  if (!d) return false;

  const from = parseYMDLocalStart(fromYMD);
  const to = parseYMDLocalEnd(toYMD);

  if (!from && !to) return true;
  if (from && !to) return d >= from;
  if (!from && to) return d <= to;
  return d >= from && d <= to;
};

export default function ProjectTable() {
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [rawHeaders, setRawHeaders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [validation, setValidation] = useState({});
  const [readonlyColumns, setReadonlyColumns] = useState(new Set());
  const [columnOrder, setColumnOrder] = useState([]);
  const [multiselectSetNorm, setMultiselectSetNorm] = useState(new Set());

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "Timestamp", direction: "desc" });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);

  const [logsOpen, setLogsOpen] = useState(false);
  const [logsRows, setLogsRows] = useState([]);

  const [submitting, setSubmitting] = useState(false);

  // ✅ Extract (Hybrid & Simple)
  const [extractOpen, setExtractOpen] = useState(false);
  const [extractProjectId, setExtractProjectId] = useState("__ALL__"); // "__ALL__" or specific ID
  const [extractFrom, setExtractFrom] = useState(""); // YYYY-MM-DD
  const [extractTo, setExtractTo] = useState(""); // YYYY-MM-DD
  const [extractMode, setExtractMode] = useState("changes"); // changes | snapshot
  const [extractUseDisplayFormatting, setExtractUseDisplayFormatting] = useState(true);

  // ✅ Download button "Submitting…" state
  const [extractDownloading, setExtractDownloading] = useState(false);

  // Snapshot column selector (full headers)
  const [extractSelectedColumns, setExtractSelectedColumns] = useState([]);

  // Changes column selector (small set)
  const CHANGE_COLUMNS_ALL = [
    "Project ID",
    "Project Name",
    "Timestamp",
    "Field",
    "Old Value",
    "New Value",
  ];
  const [changesSelectedColumns, setChangesSelectedColumns] = useState(CHANGE_COLUMNS_ALL);

  const isControlHeader = (h) => norm(h) === norm(MULTI_KEY);

  const isMulti = useCallback(
    (header) => multiselectSetNorm.has(norm(header)),
    [multiselectSetNorm]
  );

  // ✅ prevents multiple submits + provides button state
  const canCloseModal = !submitting;

  // Owner header (for auto-fill when picking client)
  const OWNER_HEADER = useMemo(() => {
    const lower = headers.map((h) => norm(h));
    const idx = lower.findIndex((h) =>
      ["owner", "account owner", "lead owner", "project owner", "requested by"].includes(h)
    );
    return idx >= 0 ? headers[idx] : null;
  }, [headers]);

  // ----------------- fetchers -----------------
  const fetchProjects = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${WEB_APP_BASE}?action=getProjects`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data?.rows)) throw new Error("Invalid payload: rows missing");

      setRows(data.rows);
      setRawHeaders(data.headers || []);

      if ((!visibleColumns || visibleColumns.length === 0) && Array.isArray(data.headers)) {
        const saved = JSON.parse(localStorage.getItem("visibleColumns-projects") || "null");
        if (saved) setVisibleColumns(saved);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const fetchValidation = async () => {
    try {
      const res = await fetch(`${WEB_APP_BASE}?action=getValidation&sheet=Validation Tables`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();

      const rawValidation = data?.validation || {};
      const normalizedValidation = Object.fromEntries(
        Object.entries(rawValidation).map(([k, v]) => [k, normalizeOptions(v)])
      );
      setValidation(normalizedValidation);

      if (Array.isArray(data?.visibleColumns) && data.visibleColumns.length) {
        setVisibleColumns(data.visibleColumns);
        localStorage.setItem("visibleColumns-projects", JSON.stringify(data.visibleColumns));
      }

      if (Array.isArray(data?.readonlyColumns)) setReadonlyColumns(new Set(data.readonlyColumns));
      if (Array.isArray(data?.columnOrder) && data.columnOrder.length) setColumnOrder(data.columnOrder);

      // multiselect list: prefer API -> else from Validation column MULTI_KEY
      let msRaw = data?.multiselectFields;
      if (!msRaw || (Array.isArray(msRaw) && msRaw.length === 0)) {
        msRaw = rawValidation[MULTI_KEY];
      }
      const msList = normalizeOptions(msRaw).map(norm);
      msList.push(...Array.from(FALLBACK_MULTI));
      setMultiselectSetNorm(new Set(msList));
    } catch (err) {
      console.warn("Validation fetch failed", err);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchValidation();
    // eslint-disable-next-line
  }, []);

  // apply column order & hide control header in UI
  useEffect(() => {
    if (!rawHeaders.length) return;

    const visible = rawHeaders.filter((h) => !isControlHeader(h)); // hide "Project Multiselect Fields"
    if (columnOrder && columnOrder.length) {
      const orderFiltered = columnOrder.filter((h) => visible.includes(h));
      const set = new Set(orderFiltered);
      const ordered = [...orderFiltered, ...visible.filter((h) => !set.has(h))];
      setHeaders(ordered);

      if (visibleColumns.length) {
        const vis = visibleColumns.filter((h) => ordered.includes(h));
        const rest = ordered.filter((h) => !vis.includes(h));
        setVisibleColumns([...vis, ...rest]);
      }
    } else {
      setHeaders(visible);
    }
  }, [rawHeaders, columnOrder]); // eslint-disable-line

  // ---------- latest row per Project ID ----------
  const PROJECT_ID_HEADER = "Project ID (unique, auto-generated)";

  const latestByProjectId = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const id = r[PROJECT_ID_HEADER];
      if (!id) return;
      const prev = map.get(id);
      const curTs = parseAsDate(r.Timestamp);
      if (!prev) {
        map.set(id, r);
      } else {
        const prevTs = parseAsDate(prev.Timestamp);
        if ((curTs && prevTs && curTs > prevTs) || (curTs && !prevTs)) {
          map.set(id, r);
        }
      }
    });
    return Array.from(map.values());
  }, [rows]);

  // ---------- derived rows (search/filter/sort) ----------
  const filteredRows = useMemo(() => {
    const tsKey = "Timestamp";
    let out = [...latestByProjectId];

    if (search) {
      const q = search.toLowerCase().trim();
      out = out.filter((r) => headers.some((h) => String(r[h] || "").toLowerCase().includes(q)));
    }

    Object.entries(filters).forEach(([h, val]) => {
      if (val) out = out.filter((r) => (r[h] || "") === val);
    });

    out.sort((a, b) => {
      if (sortConfig.key && sortConfig.key !== tsKey) {
        const aVal = a[sortConfig.key] ?? "";
        const bVal = b[sortConfig.key] ?? "";
        const cmp = String(aVal).localeCompare(String(bVal), undefined, {
          numeric: true,
          sensitivity: "base",
        });
        if (cmp !== 0) return sortConfig.direction === "asc" ? cmp : -cmp;
      }

      const da = parseAsDate(a[tsKey]);
      const db = parseAsDate(b[tsKey]);
      if (da && db) return db - da;
      if (da && !db) return -1;
      if (!da && db) return 1;
      return 0;
    });

    return out;
  }, [latestByProjectId, headers, search, filters, sortConfig]);

  // ---------- UI handlers ----------
  const handleOpenColumns = (e) => setAnchorEl(e.currentTarget);
  const handleCloseColumns = () => setAnchorEl(null);

  const toggleColumn = (col) => {
    setVisibleColumns((prev) => {
      const updated = prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col];
      localStorage.setItem("visibleColumns-projects", JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelectAll = () => {
    setVisibleColumns(headers);
    localStorage.setItem("visibleColumns-projects", JSON.stringify(headers));
  };

  const handleDeselectAll = () => {
    setVisibleColumns([]);
    localStorage.setItem("visibleColumns-projects", JSON.stringify([]));
  };

  const onAdd = () => {
    const obj = {};
    headers.forEach((h) => (obj[h] = isMulti(h) ? [] : ""));
    setEditingRow(obj);
    setModalOpen(true);
  };

  const onEdit = (row) => {
    const obj = { ...row };
    headers.forEach((h) => {
      if (isMulti(h)) obj[h] = toStringArray(obj[h]); // hydrate as array
    });
    setEditingRow(obj);
    setModalOpen(true);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const serializeRow = (rowObj) => {
    const out = {};
    headers.forEach((h) => {
      const v = rowObj[h];
      if (isMulti(h)) {
        out[h] = Array.isArray(v) ? v.join(", ") : v ?? "";
      } else if (typeof v === "string") {
        out[h] = v.trim();
      } else {
        out[h] = v ?? "";
      }
    });
    return out;
  };

  // ✅ submit guard + "Saving..." button state (prevents multiple submits)
  const handleSubmit = async () => {
    if (submitting) return; // hard guard
    setSubmitting(true);

    try {
      const payload = { action: "addOrUpdateProject", data: serializeRow(editingRow || {}) };
      await fetch(WEB_APP_BASE, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      setModalOpen(false);
      setEditingRow(null);
      await fetchProjects();
    } catch (err) {
      console.error(err);
      alert("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const openLogs = (projectId) => {
    const items = rows
      .filter((r) => r[PROJECT_ID_HEADER] === projectId)
      .sort((a, b) => {
        const da = parseAsDate(a.Timestamp);
        const db = parseAsDate(b.Timestamp);
        if (da && db) return db - da;
        if (da && !db) return -1;
        if (!da && db) return 1;
        return 0;
      });
    setLogsRows(items);
    setLogsOpen(true);
  };

  // ---------- render helpers ----------
  const formatMoney = (v) => {
    if (v === "" || v === null || v === undefined) return "";
    const n = typeof v === "number" ? v : Number(String(v).replace(/[₹,\s]/g, ""));
    if (isNaN(n)) return String(v);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(n);
  };

  const renderCell = (header, value) => {
    if (value === null || value === undefined || value === "") return "";
    if (header === "Project Status") {
      const color = PROJECT_STATUS_COLORS[String(value)] || "default";
      return (
        <Chip
          size="small"
          label={String(value)}
          color={color}
          variant={color === "default" ? "outlined" : "filled"}
        />
      );
    }
    if (header === "Task Status (Not Started / In Progress / Completed)") {
      const color = TASK_STATUS_COLORS[String(value)] || "default";
      return (
        <Chip
          size="small"
          label={String(value)}
          color={color}
          variant={color === "default" ? "outlined" : "filled"}
        />
      );
    }
    if (PERCENT_FIELDS.has(header)) {
      const n = Number(value);
      return isNaN(n) ? String(value) : `${n}%`;
    }
    if (MONEY_FIELDS.has(header)) return formatMoney(value);
    if (DATE_FIELDS.has(header)) return formatDDMMYYYY_HHMMSSS(value);
    if (/Link|Documents/i.test(header) && typeof value === "string" && /^https?:\/\//i.test(value)) {
      return (
        <a href={value} target="_blank" rel="noreferrer">
          Open
        </a>
      );
    }
    if (header === "Client (Linked Deal/Account ID)" && typeof value === "string" && value.includes("|")) {
      return value.split("|").slice(1).join("|");
    }
    if (isMulti(header)) {
      const arr = toStringArray(value);
      return (
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          {arr.map((v, i) => (
            <Chip key={`${header}-${i}`} size="small" variant="outlined" label={v} />
          ))}
        </Box>
      );
    }
    return String(value);
  };

  // curated filters; extend as needed
  const FILTER_LIST = [
    "Project Status",
    "Project Manager",
    "Task Status (Not Started / In Progress / Completed)",
    "Account Owner",
  ].filter((h) => headers.includes(h));

  // ---------- Logs Differentiator (highlight changed fields vs previous row) ----------
  const logsChangedSets = useMemo(() => {
    if (!logsRows?.length) return [];
    const arr = [];

    for (let i = 0; i < logsRows.length; i++) {
      const cur = logsRows[i] || {};
      const prev = logsRows[i + 1] || null;
      const changed = new Set();

      if (!prev) {
        arr.push(changed);
        continue;
      }

      headers.forEach((h) => {
        const a = isMulti(h) ? toStringArray(cur?.[h]).join(", ") : String(cur?.[h] ?? "");
        const b = isMulti(h) ? toStringArray(prev?.[h]).join(", ") : String(prev?.[h] ?? "");
        if (a !== b) changed.add(h);
      });

      arr.push(changed);
    }
    return arr;
  }, [logsRows, headers, isMulti]);

  // ---------- typing lag reduction ----------
  const setFieldValue = useCallback((key, value) => {
    setEditingRow((prev) => ({ ...(prev || {}), [key]: value }));
  }, []);

  // ===================== Extract logic =====================
  const formatForExport = useCallback(
    (header, value) => {
      if (!extractUseDisplayFormatting) {
        if (isMulti(header)) return toStringArray(value).join(", ");
        return value ?? "";
      }
      if (value === null || value === undefined || value === "") return "";
      if (PERCENT_FIELDS.has(header)) {
        const n = Number(value);
        return isNaN(n) ? String(value) : `${n}%`;
      }
      if (MONEY_FIELDS.has(header)) return formatMoney(value);
      if (DATE_FIELDS.has(header)) return formatDDMMYYYY_HHMMSSS(value);
      if (isMulti(header)) return toStringArray(value).join(", ");
      return String(value);
    },
    [extractUseDisplayFormatting, isMulti]
  );

  const projectOptions = useMemo(() => {
    const opts = latestByProjectId
      .map((r) => {
        const id = r?.[PROJECT_ID_HEADER];
        if (!id) return null;
        const name =
          r?.["Project Name"] ||
          r?.["Project"] ||
          r?.["Name"] ||
          r?.["Project Title"] ||
          "";
        return { id: String(id), name: String(name || "") };
      })
      .filter(Boolean);

    opts.sort((a, b) => {
      const an = a.name.toLowerCase();
      const bn = b.name.toLowerCase();
      const c = an.localeCompare(bn);
      return c !== 0 ? c : a.id.localeCompare(b.id, undefined, { numeric: true });
    });

    return opts;
  }, [latestByProjectId]);

  const ensureExtractDefaults = () => {
    const d = new Date();
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (!extractFrom) setExtractFrom(today);
    if (!extractTo) setExtractTo(today);
  };

  useEffect(() => {
    if (!extractOpen) return;
    ensureExtractDefaults();

    const savedSnap = JSON.parse(localStorage.getItem("extractColumns-projects") || "null");
    if (Array.isArray(savedSnap) && savedSnap.length) {
      const cleaned = savedSnap.filter((h) => headers.includes(h));
      setExtractSelectedColumns(cleaned.length ? cleaned : headers);
    } else {
      setExtractSelectedColumns(headers);
    }

    const savedChange = JSON.parse(localStorage.getItem("extractChangeCols-projects") || "null");
    if (Array.isArray(savedChange) && savedChange.length) {
      const cleaned = savedChange.filter((c) => CHANGE_COLUMNS_ALL.includes(c));
      setChangesSelectedColumns(cleaned.length ? cleaned : CHANGE_COLUMNS_ALL);
    } else {
      setChangesSelectedColumns(CHANGE_COLUMNS_ALL);
    }
    // eslint-disable-next-line
  }, [extractOpen, headers.length]);

  useEffect(() => {
    if (!headers.length) return;
    localStorage.setItem("extractColumns-projects", JSON.stringify(extractSelectedColumns));
  }, [extractSelectedColumns, headers]);

  useEffect(() => {
    localStorage.setItem("extractChangeCols-projects", JSON.stringify(changesSelectedColumns));
  }, [changesSelectedColumns]);

  const toggleExtractColumn = (col) => {
    setExtractSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };
  const extractSelectAll = () => setExtractSelectedColumns(headers);
  const extractDeselectAll = () => setExtractSelectedColumns([]);

  const toggleChangeCol = (col) => {
    setChangesSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };
  const selectAllChangeCols = () => setChangesSelectedColumns(CHANGE_COLUMNS_ALL);
  const deselectAllChangeCols = () => setChangesSelectedColumns([]);

  const getProjectHistoryOldestFirst = useCallback(
    (projectId) => {
      if (!projectId) return [];
      return rows
        .filter((r) => String(r?.[PROJECT_ID_HEADER] || "") === String(projectId))
        .slice()
        .sort((a, b) => {
          const da = parseAsDate(a.Timestamp);
          const db = parseAsDate(b.Timestamp);
          if (da && db) return da - db; // oldest -> newest
          if (da && !db) return -1;
          if (!da && db) return 1;
          return 0;
        });
    },
    [rows]
  );

  const getProjectDisplayName = useCallback(
    (projectId) => {
      const latest = latestByProjectId.find(
        (r) => String(r?.[PROJECT_ID_HEADER] || "") === String(projectId)
      );
      const name =
        latest?.["Project Name"] ||
        latest?.["Project"] ||
        latest?.["Name"] ||
        latest?.["Project Title"] ||
        "";
      return String(name || "");
    },
    [latestByProjectId]
  );

  // --------- CHANGES VIEW (for single or ALL projects) ---------
  const extractChangesRows = useMemo(() => {
    const normalizeDiffVal = (h, v) =>
      isMulti(h) ? toStringArray(v).join(", ") : String(v ?? "");

    const makeChangesForOneProject = (pid) => {
      const hist = getProjectHistoryOldestFirst(pid);
      if (!hist.length) return [];

      const entriesInRange = hist.filter((r) =>
        inDateRange(r?.Timestamp, extractFrom, extractTo)
      );
      if (!entriesInRange.length) return [];

      const out = [];
      const projectName = getProjectDisplayName(pid);

      entriesInRange.forEach((entry) => {
        const idx = hist.indexOf(entry);
        const prev = idx > 0 ? hist[idx - 1] : null;

        if (!prev) {
          headers.forEach((h) => {
            const newNorm = normalizeDiffVal(h, entry?.[h]);
            if (!newNorm) return;
            out.push({
              "Project ID": pid,
              "Project Name": projectName,
              Timestamp: entry?.Timestamp ?? "",
              Field: h,
              "Old Value": "",
              "New Value": formatForExport(h, entry?.[h]),
            });
          });
          return;
        }

        headers.forEach((h) => {
          const a = normalizeDiffVal(h, entry?.[h]);
          const b = normalizeDiffVal(h, prev?.[h]);
          if (a !== b) {
            out.push({
              "Project ID": pid,
              "Project Name": projectName,
              Timestamp: entry?.Timestamp ?? "",
              Field: h,
              "Old Value": formatForExport(h, prev?.[h]),
              "New Value": formatForExport(h, entry?.[h]),
            });
          }
        });
      });

      return out;
    };

    let out = [];
    if (extractProjectId === "__ALL__") {
      const allIds = Array.from(
        new Set(rows.map((r) => r?.[PROJECT_ID_HEADER]).filter(Boolean))
      ).map(String);
      allIds.forEach((pid) => {
        out = out.concat(makeChangesForOneProject(pid));
      });
    } else if (extractProjectId) {
      out = makeChangesForOneProject(String(extractProjectId));
    }

    out.sort((x, y) => {
      const dx = parseAsDate(x.Timestamp);
      const dy = parseAsDate(y.Timestamp);
      if (dx && dy) return dy - dx;
      if (dx && !dy) return -1;
      if (!dx && dy) return 1;

      const p = String(x["Project ID"] ?? "").localeCompare(
        String(y["Project ID"] ?? ""),
        undefined,
        { numeric: true }
      );
      if (p !== 0) return p;
      return String(x.Field ?? "").localeCompare(String(y.Field ?? ""));
    });

    return out;
  }, [
    extractProjectId,
    extractFrom,
    extractTo,
    rows,
    headers,
    isMulti,
    getProjectHistoryOldestFirst,
    getProjectDisplayName,
    PROJECT_ID_HEADER,
    formatForExport,
  ]);

  // --------- SNAPSHOT VIEW (for single or ALL projects) ---------
  const extractSnapshotRows = useMemo(() => {
    const withinRange = (r) => inDateRange(r?.Timestamp, extractFrom, extractTo);

    let out = [];
    if (extractProjectId === "__ALL__") {
      out = rows.filter((r) => r?.[PROJECT_ID_HEADER] && withinRange(r));
    } else if (extractProjectId) {
      out = rows.filter(
        (r) =>
          String(r?.[PROJECT_ID_HEADER] || "") === String(extractProjectId) &&
          withinRange(r)
      );
    }

    out.sort((a, b) => {
      const da = parseAsDate(a.Timestamp);
      const db = parseAsDate(b.Timestamp);
      if (da && db) return db - da;
      if (da && !db) return -1;
      if (!da && db) return 1;
      return 0;
    });

    return out;
  }, [extractProjectId, extractFrom, extractTo, rows, PROJECT_ID_HEADER]);

  // --------- Downloads ---------
  const downloadChangesCSV = async () => {
    if (extractDownloading) return;
    setExtractDownloading(true);
    try {
      const cols = (changesSelectedColumns || []).filter((c) => CHANGE_COLUMNS_ALL.includes(c));
      const finalCols = cols.length ? cols : CHANGE_COLUMNS_ALL;

      const lines = extractChangesRows.map((r) =>
        finalCols
          .map((c) =>
            csvEscape(c === "Timestamp" ? formatDDMMYYYY_HHMMSSS(r[c]) : r[c])
          )
          .join(",")
      );

      const csv = [finalCols.map(csvEscape).join(","), ...lines].join("\n");

      const fromPart = extractFrom ? extractFrom.replaceAll("-", "") : "START";
      const toPart = extractTo ? extractTo.replaceAll("-", "") : "END";
      const pid = extractProjectId === "__ALL__" ? "ALL_PROJECTS" : (extractProjectId || "PROJECT");

      downloadTextFile(`Project_Changes_${pid}_${fromPart}_to_${toPart}.csv`, csv);
    } finally {
      setExtractDownloading(false);
    }
  };

  const downloadSnapshotsCSV = async () => {
    if (extractDownloading) return;
    setExtractDownloading(true);
    try {
      const cols = (extractSelectedColumns || []).filter((h) => headers.includes(h));
      const finalCols = cols.length ? cols : headers;

      const lines = extractSnapshotRows.map((row) =>
        finalCols.map((h) => csvEscape(formatForExport(h, row?.[h]))).join(",")
      );

      const csv = [finalCols.map(csvEscape).join(","), ...lines].join("\n");

      const fromPart = extractFrom ? extractFrom.replaceAll("-", "") : "START";
      const toPart = extractTo ? extractTo.replaceAll("-", "") : "END";
      const pid = extractProjectId === "__ALL__" ? "ALL_PROJECTS" : (extractProjectId || "PROJECT");

      downloadTextFile(`Project_Snapshot_${pid}_${fromPart}_to_${toPart}.csv`, csv);
    } finally {
      setExtractDownloading(false);
    }
  };

  // ---------- render ----------
  return (
    <ThemeProvider theme={theme}>
      {(loading || submitting) && <LoadingOverlay />}

      <Box padding={4}>
        {/* Brand */}
        <Paper
          elevation={0}
          sx={{ p: 1.5, mb: 2, borderRadius: 3, border: "1px solid", borderColor: "divider" }}
        >
          <Box display="flex" alignItems="center" justifyContent="center" gap={2}>
            <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 72 }} />
          </Box>

          <Box display="flex" alignItems="center" justifyContent="center" mt={1}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Projects
            </Typography>
          </Box>

          <Box
            display="flex"
            justifyContent="flex-start"
            gap={2}
            mt={2}
            flexWrap="wrap"
            alignItems="center"
          >
            <TextField
              size="small"
              label="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 240 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="clear search"
                      edge="end"
                      onClick={() => setSearch("")}
                      size="small"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />

            {FILTER_LIST.map((h) => (
              <FormControl key={h} size="small" sx={{ minWidth: 180 }}>
                <InputLabel>{h}</InputLabel>
                <Select
                  label={h}
                  value={filters[h] || ""}
                  onChange={(e) => setFilters((prev) => ({ ...prev, [h]: e.target.value }))}
                >
                  <MenuItem value="">
                    <em>All</em>
                  </MenuItem>
                  {(validation[h] || []).map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ))}

            <IconButton onClick={handleOpenColumns} title="Columns" disabled={loading}>
              <ViewColumnIcon />
            </IconButton>

            {/* ✅ Extract */}
            <IconButton
              onClick={() => {
                ensureExtractDefaults();
                setExtractOpen(true);
              }}
              title="Extract"
              disabled={loading || submitting}
            >
              <FileDownloadIcon />
            </IconButton>

            <IconButton onClick={fetchProjects} title="Refresh" disabled={loading || submitting}>
              <RefreshIcon />
            </IconButton>
            <IconButton onClick={onAdd} color="primary" title="Add Project" disabled={loading || submitting}>
              <AddIcon />
            </IconButton>
          </Box>
        </Paper>

        {/* Column manager */}
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={handleCloseColumns}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Box padding={2} sx={selectorStyle}>
            <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
              <Button size="small" onClick={handleSelectAll}>
                Select All
              </Button>
              <Button size="small" onClick={handleDeselectAll}>
                Deselect All
              </Button>
            </Box>
            {headers.map((col) => (
              <Box key={col}>
                <Checkbox
                  size="small"
                  checked={visibleColumns.includes(col)}
                  onChange={() => toggleColumn(col)}
                />{" "}
                {col}
              </Box>
            ))}
          </Box>
        </Popover>

        {/* Table */}
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
          <Table size="small" stickyHeader>
            <TableHead
              sx={{
                "& .MuiTableCell-head": {
                  backgroundColor: "#6495ED",
                  color: "#fff",
                  fontWeight: 700,
                },
              }}
            >
              <TableRow>
                {visibleColumns.map((header) => (
                  <TableCell key={header} onClick={() => handleSort(header)} sx={{ cursor: "pointer" }}>
                    {header} {sortConfig.key === header ? (sortConfig.direction === "asc" ? "↥" : "↧") : ""}
                  </TableCell>
                ))}
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {!loading && filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={(visibleColumns?.length || 0) + 1} align="center">
                    No records
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                filteredRows.map((row, idx) => (
                  <TableRow key={idx} hover>
                    {visibleColumns.map((h) => (
                      <TableCell key={h}>{renderCell(h, row[h])}</TableCell>
                    ))}
                    <TableCell width={160}>
                      <IconButton size="small" onClick={() => onEdit(row)} title="Edit" disabled={submitting}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => openLogs(row[PROJECT_ID_HEADER])}
                        title="Logs"
                        disabled={submitting}
                      >
                        <HistoryIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Paper>

        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}

        {/* ===================== EXTRACT DIALOG ===================== */}
        <Dialog open={extractOpen} onClose={() => !extractDownloading && setExtractOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            Extract — Project Updates
          </DialogTitle>

          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Select Project</InputLabel>
                  <Select
                    label="Select Project"
                    value={extractProjectId}
                    onChange={(e) => setExtractProjectId(e.target.value)}
                    disabled={extractDownloading}
                  >
                    <MenuItem value="__ALL__">
                      <b>All Projects</b>
                    </MenuItem>

                    {projectOptions.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name ? `${p.name} — ${p.id}` : p.id}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  size="small"
                  type="date"
                  label="From"
                  InputLabelProps={{ shrink: true }}
                  value={extractFrom}
                  onChange={(e) => setExtractFrom(e.target.value)}
                  fullWidth
                  disabled={extractDownloading}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  size="small"
                  type="date"
                  label="To"
                  InputLabelProps={{ shrink: true }}
                  value={extractTo}
                  onChange={(e) => setExtractTo(e.target.value)}
                  fullWidth
                  disabled={extractDownloading}
                />
              </Grid>

              <Grid item xs={12}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    flexWrap: "wrap",
                  }}
                >
                  <ToggleButtonGroup
                    value={extractMode}
                    exclusive
                    onChange={(_, v) => v && setExtractMode(v)}
                    size="small"
                    disabled={extractDownloading}
                  >
                    <ToggleButton value="changes">Changes</ToggleButton>
                    <ToggleButton value="snapshot">Snapshot</ToggleButton>
                  </ToggleButtonGroup>

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={extractUseDisplayFormatting}
                        onChange={(e) => setExtractUseDisplayFormatting(e.target.checked)}
                        disabled={extractDownloading}
                      />
                    }
                    label="Formatted values"
                  />
                </Box>
              </Grid>

              {/* ===== Changes View ===== */}
              {extractMode === "changes" ? (
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5 }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 1,
                      }}
                    >
                      <Typography sx={{ fontWeight: 700, fontSize: 12 }}>
                        Columns (Changes View)
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                        <Button size="small" onClick={selectAllChangeCols} disabled={extractDownloading}>
                          Select All
                        </Button>
                        <Button size="small" onClick={deselectAllChangeCols} disabled={extractDownloading}>
                          Deselect All
                        </Button>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    <Grid container spacing={0.5}>
                      {CHANGE_COLUMNS_ALL.map((c) => (
                        <Grid item xs={12} sm={6} md={4} key={c}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={changesSelectedColumns.includes(c)}
                                onChange={() => toggleChangeCol(c)}
                                disabled={extractDownloading}
                              />
                            }
                            label={<Typography sx={{ fontSize: 12 }}>{c}</Typography>}
                          />
                        </Grid>
                      ))}
                    </Grid>

                    <Typography sx={{ fontSize: 11, opacity: 0.7, mt: 1 }}>
                      Changes found: <b>{extractChangesRows.length}</b>
                    </Typography>

                    <Divider sx={{ my: 1 }} />

                    {extractChangesRows.length === 0 ? (
                      <Typography sx={{ fontSize: 12 }}>
                        No changes found for selected project(s) in this date range.
                      </Typography>
                    ) : (
                      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                        <Table size="small" stickyHeader>
                          <TableHead
                            sx={{
                              "& .MuiTableCell-head": {
                                backgroundColor: "#6495ED",
                                color: "#fff",
                                fontWeight: 700,
                              },
                            }}
                          >
                            <TableRow>
                              {(changesSelectedColumns.length ? changesSelectedColumns : CHANGE_COLUMNS_ALL).map(
                                (c) => (
                                  <TableCell key={c}>{c}</TableCell>
                                )
                              )}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {extractChangesRows.slice(0, 50).map((r, i) => (
                              <TableRow key={i} hover>
                                {(changesSelectedColumns.length ? changesSelectedColumns : CHANGE_COLUMNS_ALL).map(
                                  (c) => (
                                    <TableCell key={c}>
                                      {c === "Timestamp" ? formatDDMMYYYY_HHMMSSS(r[c]) : r[c]}
                                    </TableCell>
                                  )
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {extractChangesRows.length > 50 ? (
                          <Typography sx={{ fontSize: 11, opacity: 0.7, p: 1 }}>
                            Showing first 50 rows in preview. Download to get all.
                          </Typography>
                        ) : null}
                      </Paper>
                    )}
                  </Paper>
                </Grid>
              ) : null}

              {/* ===== Snapshot View ===== */}
              {extractMode === "snapshot" ? (
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5 }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 1,
                      }}
                    >
                      <Typography sx={{ fontWeight: 700, fontSize: 12 }}>
                        Columns (Snapshot View)
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                        <Button size="small" onClick={extractSelectAll} disabled={extractDownloading}>
                          Select All
                        </Button>
                        <Button size="small" onClick={extractDeselectAll} disabled={extractDownloading}>
                          Deselect All
                        </Button>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    <Grid container spacing={0.5}>
                      {headers.map((col) => (
                        <Grid item xs={12} sm={6} md={4} key={col}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={extractSelectedColumns.includes(col)}
                                onChange={() => toggleExtractColumn(col)}
                                disabled={extractDownloading}
                              />
                            }
                            label={<Typography sx={{ fontSize: 12 }}>{col}</Typography>}
                          />
                        </Grid>
                      ))}
                    </Grid>

                    <Typography sx={{ fontSize: 11, opacity: 0.7, mt: 1 }}>
                      Snapshot rows found: <b>{extractSnapshotRows.length}</b>
                    </Typography>

                    <Divider sx={{ my: 1 }} />

                    {extractSnapshotRows.length === 0 ? (
                      <Typography sx={{ fontSize: 12 }}>
                        No snapshot rows found for selected project(s) in this date range.
                      </Typography>
                    ) : (
                      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                        <Table size="small" stickyHeader>
                          <TableHead
                            sx={{
                              "& .MuiTableCell-head": {
                                backgroundColor: "#6495ED",
                                color: "#fff",
                                fontWeight: 700,
                              },
                            }}
                          >
                            <TableRow>
                              {(extractSelectedColumns.length ? extractSelectedColumns : headers).map((h) => (
                                <TableCell key={h}>{h}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {extractSnapshotRows.slice(0, 25).map((row, i) => (
                              <TableRow key={i} hover>
                                {(extractSelectedColumns.length ? extractSelectedColumns : headers).map((h) => (
                                  <TableCell key={h}>{formatForExport(h, row?.[h])}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {extractSnapshotRows.length > 25 ? (
                          <Typography sx={{ fontSize: 11, opacity: 0.7, p: 1 }}>
                            Showing first 25 rows in preview. Download to get all.
                          </Typography>
                        ) : null}
                      </Paper>
                    )}
                  </Paper>
                </Grid>
              ) : null}
            </Grid>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setExtractOpen(false)} disabled={extractDownloading}>
              Close
            </Button>

            <Button
              variant="contained"
              sx={{ backgroundColor: "#6495ED" }}
              startIcon={extractDownloading ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />}
              onClick={() => (extractMode === "changes" ? downloadChangesCSV() : downloadSnapshotsCSV())}
              disabled={
                extractDownloading ||
                (extractMode === "changes"
                  ? extractChangesRows.length === 0
                  : extractSnapshotRows.length === 0)
              }
            >
              {extractDownloading ? "Submitting…" : "Download CSV"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Logs Modal */}
        <Dialog open={logsOpen} onClose={() => setLogsOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle>Project Logs (Highlights = Changed Fields)</DialogTitle>
          <DialogContent dividers>
            {logsRows.length === 0 ? (
              <Typography>No logs available.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {headers.map((h) => (
                      <TableCell key={h}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logsRows.map((row, i) => {
                    const changedSet = logsChangedSets[i] || new Set();
                    return (
                      <TableRow key={i}>
                        {headers.map((h) => {
                          const isChanged = changedSet.has(h);
                          return (
                            <TableCell
                              key={h}
                              sx={
                                isChanged
                                  ? {
                                      backgroundColor: "rgba(100,149,237,0.14)", // ✅ cornflower tint
                                      fontWeight: 400, // ✅ normal
                                    }
                                  : undefined
                              }
                            >
                              {h === "Timestamp"
                                ? formatDDMMYYYY_HHMMSSS(row[h])
                                : renderCell(h, row[h])}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLogsOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Add/Edit Modal */}
        <Dialog
          open={modalOpen}
          onClose={() => {
            if (!canCloseModal) return;
            setModalOpen(false);
            setEditingRow(null);
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            {editingRow?.[PROJECT_ID_HEADER] ? "Edit Project" : "Add Project"}
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              {headers.map((h) => {
                const isReadonly = readonlyColumns.has(h);
                const hasOptions = Array.isArray(validation[h]) && validation[h].length > 0;

                if (h === "Client (Linked Deal/Account ID)") {
                  return (
                    <Grid item xs={12} sm={6} key={h}>
                      <ClientSelector
                        value={editingRow?.[h] || ""}
                        disabled={isReadonly || submitting}
                        onPick={({ value, owner }) =>
                          setEditingRow((prev) => ({
                            ...prev,
                            [h]: value,
                            ...(OWNER_HEADER && owner ? { [OWNER_HEADER]: owner } : {}),
                          }))
                        }
                      />
                    </Grid>
                  );
                }

                if (hasOptions && isMulti(h)) {
                  const safeOptions = (validation[h] || []).map(String);
                  const valueArr = toStringArray(editingRow?.[h]);

                  return (
                    <Grid item xs={12} sm={6} key={h}>
                      <FormControl fullWidth size="small" disabled={isReadonly || submitting}>
                        <InputLabel>{h}</InputLabel>
                        <Select
                          label={h}
                          multiple
                          value={valueArr}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const next = Array.isArray(raw) ? raw : toStringArray(raw);
                            setFieldValue(h, next);
                          }}
                          renderValue={(selected) => (
                            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                              {selected.map((val) => (
                                <Chip key={`${h}-${val}`} size="small" variant="outlined" label={val} />
                              ))}
                            </Box>
                          )}
                        >
                          {safeOptions.map((opt) => {
                            const checked = valueArr.indexOf(opt) > -1;
                            return (
                              <MenuItem key={opt} value={opt}>
                                <Checkbox size="small" checked={checked} />
                                <ListItemText primary={opt} />
                              </MenuItem>
                            );
                          })}
                        </Select>
                      </FormControl>
                    </Grid>
                  );
                }

                if (hasOptions) {
                  return (
                    <Grid item xs={12} sm={6} key={h}>
                      <FormControl fullWidth size="small" disabled={isReadonly || submitting}>
                        <InputLabel>{h}</InputLabel>
                        <Select
                          label={h}
                          value={editingRow?.[h] || ""}
                          onChange={(e) => setFieldValue(h, e.target.value)}
                        >
                          {validation[h].map((opt) => (
                            <MenuItem key={opt} value={opt}>
                              {opt}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  );
                }

                return (
                  <Grid item xs={12} sm={6} key={h}>
                    <TextField
                      fullWidth
                      size="small"
                      label={h}
                      value={
                        Array.isArray(editingRow?.[h])
                          ? (editingRow?.[h] || []).join(", ")
                          : editingRow?.[h] || ""
                      }
                      onChange={(e) => setFieldValue(h, e.target.value)}
                      multiline={isMultilineHeader(h)}
                      minRows={isMultilineHeader(h) ? 3 : 1}
                      disabled={isReadonly || submitting}
                    />
                  </Grid>
                );
              })}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                if (!canCloseModal) return;
                setModalOpen(false);
                setEditingRow(null);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              sx={{ backgroundColor: "#6495ED" }}
              onClick={handleSubmit}
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {submitting ? "Saving…" : "Save"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

/** ✅ ClientSelector — searchable Deals/Accounts picker (Deal Name + Mobile + Company + ID) */
function ClientSelector({ value, onPick, disabled }) {
  const [source, setSource] = React.useState(() =>
    String(value).startsWith("deals:") ? "deals" : "accounts"
  );
  const [options, setOptions] = React.useState([]); // normalized list
  const [loading, setLoading] = React.useState(false);

  const fetchOptions = async (src) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${WEB_APP_BASE}?action=getClientOptions&source=${encodeURIComponent(src)}`
      );
      const data = await res.json();
      const list = Array.isArray(data?.options) ? data.options : [];

      // ✅ Normalize + build a strong label + searchable text + remove repeats
      const mapped = list
        .map((o) => {
          const id = String(o?.id ?? "").trim();
          const company = String(o?.company ?? "").trim();
          const mobile = String(o?.mobile ?? "").trim();
          const dealName = String(o?.dealName ?? "").trim();
          const owner = String(o?.owner ?? "").trim();

          // Deals: Deal Name | Company | Mobile | #ID
          // Accounts: Company | Mobile | #ID
          const label =
            src === "deals"
              ? [dealName || "Deal", company || "Client", mobile || "", id ? `#${id}` : ""]
                  .filter(Boolean)
                  .join(" | ")
              : [company || "Client", mobile || "", id ? `#${id}` : ""]
                  .filter(Boolean)
                  .join(" | ");

          const searchText = `${dealName} ${company} ${mobile} ${id} ${owner}`.toLowerCase();

          return {
            ...o,
            id,
            owner,
            company,
            mobile,
            dealName,
            label,
            searchText,
          };
        })
        .filter((o) => o.id);

      // ✅ Deduplicate by source:id
      const seen = new Set();
      const deduped = [];
      for (const o of mapped) {
        const key = `${src}:${o.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(o);
      }

      deduped.sort((a, b) =>
        String(a.label).localeCompare(String(b.label), undefined, { sensitivity: "base" })
      );

      setOptions(deduped);
    } catch (e) {
      console.error(e);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchOptions(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const currentId = React.useMemo(() => {
    if (!value) return "";
    const pipe = String(value).indexOf("|");
    const colon = String(value).indexOf(":");
    if (colon === -1) return "";
    const id = String(value).slice(colon + 1, pipe > colon ? pipe : undefined);
    return id;
  }, [value]);

  const currentOption = React.useMemo(() => {
    return options.find((o) => String(o.id) === String(currentId)) || null;
  }, [options, currentId]);

  const handlePick = (opt) => {
    if (!opt?.id) return;
    const owner = opt?.owner || "";
    const label = opt?.label || "";
    const v = `${source}:${opt.id}${label ? "|" + label : ""}`;
    onPick && onPick({ value: v, owner });
  };

  return (
    <Box sx={{ display: "flex", gap: 1, width: "100%" }}>
      <FormControl size="small" sx={{ minWidth: 160 }} disabled={disabled}>
        <InputLabel>Client Source</InputLabel>
        <Select label="Client Source" value={source} onChange={(e) => setSource(e.target.value)}>
          <MenuItem value="accounts">Accounts</MenuItem>
          <MenuItem value="deals">Deals</MenuItem>
        </Select>
      </FormControl>

      <Autocomplete
        fullWidth
        size="small"
        options={options}
        value={currentOption}
        loading={loading}
        disabled={disabled}
        onChange={(_, val) => handlePick(val)}
        getOptionLabel={(opt) => String(opt?.label || "")}
        isOptionEqualToValue={(opt, val) => String(opt?.id) === String(val?.id)}
        filterOptions={(opts, state) => {
          const q = String(state.inputValue || "").toLowerCase().trim();
          if (!q) return opts;
          return opts.filter((o) => String(o.searchText || "").includes(q));
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={loading ? "Loading…" : "Select Client (type Deal Name / Mobile / Company)"}
          />
        )}
      />
    </Box>
  );
}
