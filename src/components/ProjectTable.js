// src/components/ProjectTable.js
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

const parseAsDate = (v) => {
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

const pad = (n, w = 2) => String(n).padStart(w, "0");

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
  return `${dd}${mm}${yyyy} ${HH}${MI}${SS}${MS}`;
};

const isMultilineHeader = (h) => /remarks|updates|description|notes/i.test(String(h));

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
// fields that should always behave as multiselect in your setup
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

export default function ProjectTable() {
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [rawHeaders, setRawHeaders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [validation, setValidation] = useState({}); // { [header]: [options] }
  const [readonlyColumns, setReadonlyColumns] = useState(new Set());
  const [columnOrder, setColumnOrder] = useState([]);
  const [multiselectSetNorm, setMultiselectSetNorm] = useState(new Set()); // normalized names

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "Timestamp", direction: "desc" });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);

  const [logsOpen, setLogsOpen] = useState(false);
  const [logsRows, setLogsRows] = useState([]);

  // ✅ prevents multiple submits + provides button state
  const [submitting, setSubmitting] = useState(false);

  // ✅ Extract dialog + settings
  const [extractOpen, setExtractOpen] = useState(false);
  const [extractScope, setExtractScope] = useState("latest_filtered"); // latest_filtered | history_for_filtered | all_rows
  const [extractUseDisplayFormatting, setExtractUseDisplayFormatting] = useState(true);

  // ✅ Extract column selector (independent of table columns)
  const [extractColumnsMode, setExtractColumnsMode] = useState("custom"); // custom | visible | all
  const [extractColumns, setExtractColumns] = useState([]); // actual selected columns for export

  const isControlHeader = (h) => norm(h) === norm(MULTI_KEY);

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

      if (Array.isArray(data?.readonlyColumns)) {
        setReadonlyColumns(new Set(data.readonlyColumns));
      }

      if (Array.isArray(data?.columnOrder) && data.columnOrder.length) {
        setColumnOrder(data.columnOrder);
      }

      // multiselect list: prefer API -> else from Validation column MULTI_KEY
      let msRaw = data?.multiselectFields;
      if (!msRaw || (Array.isArray(msRaw) && msRaw.length === 0)) {
        msRaw = rawValidation[MULTI_KEY];
      }
      const msList = normalizeOptions(msRaw).map(norm);
      // add fallbacks explicitly (Vendors, Assigned Team)
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

  // ✅ load/save extract columns in localStorage (like table columns)
  useEffect(() => {
    if (!headers.length) return;

    // Load saved extract columns once per header change
    const saved = JSON.parse(localStorage.getItem("extractColumns-projects") || "null");
    if (Array.isArray(saved) && saved.length) {
      // keep only those still in headers
      const cleaned = saved.filter((h) => headers.includes(h));
      setExtractColumns(cleaned.length ? cleaned : headers);
    } else {
      // default: visible columns if available else all headers
      setExtractColumns(visibleColumns?.length ? visibleColumns : headers);
    }
    // eslint-disable-next-line
  }, [headers]);

  useEffect(() => {
    if (!headers.length) return;
    localStorage.setItem("extractColumns-projects", JSON.stringify(extractColumns));
  }, [extractColumns, headers.length]);

  // multiselect check using normalized names
  const isMulti = (header) => multiselectSetNorm.has(norm(header));

  // ---------- latest row per Project ID ----------
  const latestByProjectId = useMemo(() => {
    const idHeader = "Project ID (unique, auto-generated)";
    const map = new Map();
    rows.forEach((r) => {
      const id = r[idHeader];
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
      const da = new Date(a[tsKey]);
      const db = new Date(b[tsKey]);
      const delta = db - da || 0;
      return delta;
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
    const idHeader = "Project ID (unique, auto-generated)";
    const items = rows
      .filter((r) => r[idHeader] === projectId)
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

  // ---------- Extract logic ----------
  const getExtractRows = () => {
    const idHeader = "Project ID (unique, auto-generated)";

    if (extractScope === "latest_filtered") return filteredRows;

    if (extractScope === "history_for_filtered") {
      const ids = new Set(filteredRows.map((r) => r?.[idHeader]).filter(Boolean));
      return rows
        .filter((r) => ids.has(r?.[idHeader]))
        .sort((a, b) => {
          const da = parseAsDate(a.Timestamp);
          const db = parseAsDate(b.Timestamp);
          if (da && db) return db - da;
          if (da && !db) return -1;
          if (!da && db) return 1;
          return 0;
        });
    }

    return rows; // all_rows
  };

  const getExtractColumns = () => {
    if (extractColumnsMode === "all") return headers;
    if (extractColumnsMode === "visible") return (visibleColumns?.length ? visibleColumns : headers);
    // custom
    const safe = (extractColumns || []).filter((h) => headers.includes(h));
    return safe.length ? safe : headers;
  };

  const formatForExport = (header, value) => {
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
    if (header === "Client (Linked Deal/Account ID)" && typeof value === "string" && value.includes("|")) {
      return value.split("|").slice(1).join("|");
    }
    if (isMulti(header)) return toStringArray(value).join(", ");
    return String(value);
  };

  const handleDownloadCSV = () => {
    const cols = getExtractColumns();
    const dataRows = getExtractRows();

    const headerLine = cols.map(csvEscape).join(",");
    const lines = dataRows.map((r) => cols.map((h) => csvEscape(formatForExport(h, r?.[h]))).join(","));
    const csv = [headerLine, ...lines].join("\n");

    const now = new Date();
    const filename = `Projects_Extract_${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}_${pad(
      now.getHours()
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`;

    downloadTextFile(filename, csv);
  };

  // ✅ Extract Column Selector handlers
  const toggleExtractColumn = (col) => {
    setExtractColumns((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]));
  };

  const selectAllExtractColumns = () => setExtractColumns(headers);
  const deselectAllExtractColumns = () => setExtractColumns([]);

  // curated filters; extend as needed
  const FILTER_LIST = [
    "Project Status",
    "Project Manager",
    "Task Status (Not Started / In Progress / Completed)",
    "Account Owner",
  ].filter((h) => headers.includes(h));

  const canCloseModal = !submitting;

  return (
    <ThemeProvider theme={theme}>
      {(loading || submitting) && <LoadingOverlay />}

      <Box padding={4}>
        {/* Brand */}
        <Paper elevation={0} sx={{ p: 1.5, mb: 2, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <Box display="flex" alignItems="center" justifyContent="center" gap={2}>
            <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 72 }} />
          </Box>

          <Box display="flex" alignItems="center" justifyContent="center" mt={1}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Projects
            </Typography>
          </Box>

          <Box display="flex" justifyContent="flex-start" gap={2} mt={2} flexWrap="wrap" alignItems="center">
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
                    <IconButton aria-label="clear search" edge="end" onClick={() => setSearch("")} size="small">
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

            {/* ✅ Extract Button */}
            <IconButton onClick={() => setExtractOpen(true)} title="Extract (CSV)" disabled={loading || submitting}>
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
                <Checkbox size="small" checked={visibleColumns.includes(col)} onChange={() => toggleColumn(col)} />{" "}
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
                        onClick={() => openLogs(row["Project ID (unique, auto-generated)"])}
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

        {/* ✅ Extract Dialog with Column Selector */}
        <Dialog open={extractOpen} onClose={() => setExtractOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            Extract Projects (CSV)
          </DialogTitle>

          <DialogContent dividers>
            <Typography sx={{ fontSize: 12, opacity: 0.85, mb: 2 }}>
              Configure export below. No Apps Script update required (export is generated from the already-fetched table
              data).
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Data Scope</InputLabel>
                  <Select
                    label="Data Scope"
                    value={extractScope}
                    onChange={(e) => setExtractScope(e.target.value)}
                  >
                    <MenuItem value="latest_filtered">
                      Latest rows (table view) — {filteredRows.length} row(s)
                    </MenuItem>
                    <MenuItem value="history_for_filtered">Full history for current table projects (logs)</MenuItem>
                    <MenuItem value="all_rows">Entire sheet (all rows)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Columns Export Mode</InputLabel>
                  <Select
                    label="Columns Export Mode"
                    value={extractColumnsMode}
                    onChange={(e) => setExtractColumnsMode(e.target.value)}
                  >
                    <MenuItem value="custom">Custom column selection</MenuItem>
                    <MenuItem value="visible">Use table visible columns ({visibleColumns.length})</MenuItem>
                    <MenuItem value="all">All columns ({headers.length})</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={extractUseDisplayFormatting}
                      onChange={(e) => setExtractUseDisplayFormatting(e.target.checked)}
                    />
                  }
                  label="Use display formatting (dates/money/% as shown in table)"
                />
              </Grid>

              {/* ✅ Custom Column Selector */}
              {extractColumnsMode === "custom" && (
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 12 }}>
                        Select columns to export ({(extractColumns || []).length})
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1 }}>
                        <Button size="small" onClick={selectAllExtractColumns}>
                          Select All
                        </Button>
                        <Button size="small" onClick={deselectAllExtractColumns}>
                          Deselect All
                        </Button>
                      </Box>
                    </Box>

                    <Divider sx={{ mb: 1 }} />

                    <Grid container spacing={0.5}>
                      {headers.map((col) => (
                        <Grid item xs={12} sm={6} md={4} key={col}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={extractColumns.includes(col)}
                                onChange={() => toggleExtractColumn(col)}
                              />
                            }
                            label={
                              <Typography sx={{ fontSize: 12, fontFamily: "Montserrat, sans-serif" }}>
                                {col}
                              </Typography>
                            }
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>

                  <Typography sx={{ fontSize: 11, opacity: 0.7, mt: 1 }}>
                    ✅ Saved automatically (localStorage): <b>extractColumns-projects</b>
                  </Typography>
                </Grid>
              )}

              {/* Preview */}
              <Grid item xs={12}>
                <Divider sx={{ my: 1.5 }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>
                  Export Preview
                </Typography>
                <Typography sx={{ fontSize: 11, opacity: 0.75 }}>
                  Rows: {getExtractRows().length} | Columns: {getExtractColumns().length}
                </Typography>
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setExtractOpen(false)}>Close</Button>
            <Button
              variant="contained"
              sx={{ backgroundColor: "#6495ED" }}
              onClick={() => {
                handleDownloadCSV();
                setExtractOpen(false);
              }}
              startIcon={<FileDownloadIcon />}
              disabled={loading || submitting}
            >
              Download CSV
            </Button>
          </DialogActions>
        </Dialog>

        {/* Logs Modal */}
        <Dialog open={logsOpen} onClose={() => setLogsOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle>Project Logs</DialogTitle>
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
                  {logsRows.map((row, i) => (
                    <TableRow key={i}>
                      {headers.map((h) => (
                        <TableCell key={h}>
                          {h === "Timestamp" ? formatDDMMYYYY_HHMMSSS(row[h]) : renderCell(h, row[h])}
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

        {/* Add/Edit Modal */}
        <Dialog
          open={modalOpen}
          onClose={() => {
            if (submitting) return;
            setModalOpen(false);
            setEditingRow(null);
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            {editingRow?.["Project ID (unique, auto-generated)"] ? "Edit Project" : "Add Project"}
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

                  const handleMultiChange = (e) => {
                    const raw = e.target.value;
                    const next = Array.isArray(raw) ? raw : toStringArray(raw);
                    setEditingRow((prev) => ({ ...prev, [h]: next }));
                  };

                  return (
                    <Grid item xs={12} sm={6} key={h}>
                      <FormControl fullWidth size="small" disabled={isReadonly || submitting}>
                        <InputLabel>{h}</InputLabel>
                        <Select
                          label={h}
                          multiple
                          value={valueArr}
                          onChange={handleMultiChange}
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
                          onChange={(e) => setEditingRow((prev) => ({ ...prev, [h]: e.target.value }))}
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
                      value={Array.isArray(editingRow?.[h]) ? (editingRow?.[h] || []).join(", ") : editingRow?.[h] || ""}
                      onChange={(e) => setEditingRow((prev) => ({ ...prev, [h]: e.target.value }))}
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
                if (submitting) return;
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

/** ClientSelector — choose Accounts/Deals then a specific record; stores value as "source:id|label" and returns owner */
function ClientSelector({ value, onPick }) {
  const [source, setSource] = React.useState(() => (String(value).startsWith("deals:") ? "deals" : "accounts"));
  const [options, setOptions] = React.useState([]); // [{id,label,owner?}]
  const [loading, setLoading] = React.useState(false);

  const fetchOptions = async (src) => {
    setLoading(true);
    try {
      const res = await fetch(`${WEB_APP_BASE}?action=getClientOptions&source=${encodeURIComponent(src)}`);
      const data = await res.json();
      const list = Array.isArray(data?.options) ? data.options : [];
      setOptions(list);
    } catch (e) {
      console.error(e);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchOptions(source);
  }, [source]);

  const currentId = React.useMemo(() => {
    if (!value) return "";
    const pipe = String(value).indexOf("|");
    const colon = String(value).indexOf(":");
    if (colon === -1) return "";
    const id = String(value).slice(colon + 1, pipe > colon ? pipe : undefined);
    return id;
  }, [value]);

  const handlePick = (id) => {
    const opt = options.find((o) => String(o.id) === String(id));
    const label = opt?.label || "";
    const owner = opt?.owner || "";
    const v = `${source}:${id}${label ? "|" + label : ""}`;
    onPick && onPick({ value: v, owner });
  };

  return (
    <Box sx={{ display: "flex", gap: 1, width: "100%" }}>
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Client Source</InputLabel>
        <Select label="Client Source" value={source} onChange={(e) => setSource(e.target.value)}>
          <MenuItem value="accounts">Accounts</MenuItem>
          <MenuItem value="deals">Deals</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small" fullWidth>
        <InputLabel>{loading ? "Loading…" : "Select Client"}</InputLabel>
        <Select label={loading ? "Loading…" : "Select Client"} value={currentId} onChange={(e) => handlePick(e.target.value)}>
          {options.map((opt) => (
            <MenuItem key={opt.id} value={opt.id}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
