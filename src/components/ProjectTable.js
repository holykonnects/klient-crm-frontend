import React, { useEffect, useMemo, useState } from 'react';
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
  Paper,
  CircularProgress
} from '@mui/material';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';

// If you already have a shared DashboardLayout, import it; fallback provided
// import DashboardLayout from '@/components/DashboardLayout';
const DashboardLayout = ({ title, children }) => (
  <Box sx={{ p: 2 }}>
    <Typography variant="h6" sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, mb: 1 }}>{title}</Typography>
    {children}
  </Box>
);

// KK logo (ensure this path exists in your repo)
import KKLogo from 'public/assets/kk-logo.png';

/**
 * PROJECT TABLE (Frontend) — Mirrors Leads/Accounts UX
 * ---------------------------------------------------
 * - Montserrat styling, search, dynamic filters, column selector
 * - Inline Add/Edit modal grouped into sections
 * - Klient Konnect logo in header
 * - Dynamic headers & visibility driven by Google Sheets (Validation Tables)
 *
 * Backend endpoints (replace WEB_APP_BASE):
 *  GET  ?action=getProjects     → { headers: string[], rows: Array<Record<string,any>> }
 *  GET  ?action=getValidation   → { validation: { [Header]: string[] }, visibleColumns?: string[], readonlyColumns?: string[], order?: string[] }
 *  POST body                    → { action:'addOrUpdateProject', data: {...} }
 */

const WEB_APP_BASE = 'https://script.google.com/macros/s/AKfycbxLsPfXtpRuKOoB956pb6VfO4_Hx1cPEVpiZApTMKjxig0iL3EwodQaHCGItGyUwMnhzQ/exec';

// Fallbacks if Validation Tables doesn't provide config
const DEFAULT_ORDER = [
  'Timestamp',
  'Project ID (unique, auto-generated)',
  'Project Name',
  'Client (Linked Deal/Account ID)',
  'Project Manager',
  'Assigned Team',
  'Vendors',
  'Task Name',
  'Task Owner',
  'Task Status (Not Started / In Progress / Completed)',
  'Start Date',
  'End Date',
  'Project Progress %',
  'Project Status',
  'Remarks / Updates',
  'Budget (₹)',
  'Actual Cost (₹)',
  'Variance (₹)',
  'PO Link',
  'Invoice Link',
  'Payment Receipt Link',
  'Other Documents'
];

const DATE_FIELDS = ['Timestamp', 'Start Date', 'End Date'];
const CURRENCY_FIELDS = ['Budget (₹)', 'Actual Cost (₹)', 'Variance (₹)'];
const PERCENT_FIELDS = ['Project Progress %'];
const fontStyle = { fontFamily: 'Montserrat, sans-serif' };

export default function ProjectTable() {
  // Live headers from sheet + rows
  const [headers, setHeaders] = useState(DEFAULT_ORDER);
  const [rows, setRows] = useState([]);

  // Config & validation from "Validation Tables"
  const [validation, setValidation] = useState({});
  const [readonlyCols, setReadonlyCols] = useState(new Set());
  const [columnOrder, setColumnOrder] = useState(DEFAULT_ORDER);
  const [visibleCols, setVisibleCols] = useState(new Set(DEFAULT_ORDER));

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pmFilter, setPmFilter] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);

  // Load data
  const fetchProjects = async () => {
    setLoading(true); setError('');
    try {
      const url = `${WEB_APP_BASE}?action=getProjects`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data?.rows) || !Array.isArray(data?.headers)) throw new Error('Invalid payload');
      setRows(data.rows);
      setHeaders(data.headers);
      if (columnOrder === DEFAULT_ORDER) setColumnOrder(data.headers);
    } catch (e) {
      console.error(e); setError(e.message || 'Failed to load projects');
    } finally { setLoading(false); }
  };

  // Load validation + UI config from Validation Tables
  const fetchValidation = async () => {
    try {
      const url = `${WEB_APP_BASE}?action=getValidation`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setValidation(data?.validation || {});
      setVisibleCols(new Set((data?.visibleColumns && data.visibleColumns.length) ? data.visibleColumns : DEFAULT_ORDER));
      setReadonlyCols(new Set(data?.readonlyColumns || []));
      if (Array.isArray(data?.order) && data.order.length) setColumnOrder(data.order);
    } catch (e) {
      console.warn('Validation/config load warning:', e);
      // keep fallbacks
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchValidation();
  }, []);

  // Filter lists (from Validation Tables)
  const allPMs = useMemo(() => (validation['Project Manager'] || []).filter(Boolean), [validation]);
  const allProjectStatus = useMemo(() => (validation['Project Status'] || []).filter(Boolean), [validation]);
  const allTaskStatus = useMemo(() => (validation['Task Status (Not Started / In Progress / Completed)'] || []).filter(Boolean), [validation]);

  const filteredRows = useMemo(() => {
    let out = [...rows];
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(r => headers.some(h => String(r[h] ?? '').toLowerCase().includes(q)));
    }
    if (statusFilter) out = out.filter(r => (r['Project Status'] || '') === statusFilter);
    if (pmFilter) out = out.filter(r => (r['Project Manager'] || '') === pmFilter);
    if (taskStatusFilter) out = out.filter(r => (r['Task Status (Not Started / In Progress / Completed)'] || '') === taskStatusFilter);
    out.sort((a, b) => new Date(b['Timestamp'] || 0) - new Date(a['Timestamp'] || 0));
    return out;
  }, [rows, headers, search, statusFilter, pmFilter, taskStatusFilter]);

  const handleOpenColumns = (e) => setAnchorEl(e.currentTarget);
  const handleCloseColumns = () => setAnchorEl(null);
  const toggleColumn = (col) => {
    const next = new Set(visibleCols);
    if (next.has(col)) next.delete(col); else next.add(col);
    setVisibleCols(next);
  };

  const orderedColumns = columnOrder.filter(h => headers.includes(h));
  const displayColumns = orderedColumns.filter(h => visibleCols.has(h));

  const onAdd = () => { setEditingRow(makeEmptyRow(headers)); setModalOpen(true); };
  const onEdit = (row) => { setEditingRow({ ...row }); setModalOpen(true); };

  const handleSubmit = async () => {
    if (!editingRow['Project Name'] && !editingRow['Client (Linked Deal/Account ID)']) {
      alert('Please fill Project Name or Client.');
      return;
    }
    try {
      const payload = { action: 'addOrUpdateProject', data: editingRow };
      const res = await fetch(WEB_APP_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok && res.type !== 'opaque') throw new Error(`Server returned ${res.status}`);
      setModalOpen(false); setEditingRow(null);
      await fetchProjects();
    } catch (e) {
      console.error(e); alert('Failed to submit.');
    }
  };

  return (
    <DashboardLayout title="Projects">
      {/* Header mimicking LeadsTable */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, px: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <img src={KKLogo} alt="Klient Konnect" style={{ height: 28 }} />
          <Typography sx={{ ...fontStyle, fontWeight: 700 }}>Project Management</Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <TextField size="small" label="Search" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 280 }} inputProps={{ style: fontStyle }} />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Project Status</InputLabel>
          <Select label="Project Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <MenuItem value=""><em>All</em></MenuItem>
            {allProjectStatus.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Project Manager</InputLabel>
          <Select label="Project Manager" value={pmFilter} onChange={(e) => setPmFilter(e.target.value)}>
            <MenuItem value=""><em>All</em></MenuItem>
            {allPMs.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel>Task Status</InputLabel>
          <Select label="Task Status" value={taskStatusFilter} onChange={(e) => setTaskStatusFilter(e.target.value)}>
            <MenuItem value=""><em>All</em></MenuItem>
            {allTaskStatus.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
          </Select>
        </FormControl>
        <IconButton onClick={fetchProjects} title="Refresh"><RefreshIcon /></IconButton>
        <IconButton onClick={onAdd} color="primary" title="Add Project"><AddIcon /></IconButton>
        <IconButton onClick={handleOpenColumns} title="Columns"><ViewColumnIcon /></IconButton>
        <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={handleCloseColumns} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Box sx={{ p: 2, ...fontStyle }}>
            <Typography sx={{ mb: 1, fontWeight: 600 }}>Show/Hide Columns</Typography>
            {orderedColumns.map(col => (
              <Box key={col} sx={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox checked={visibleCols.has(col)} onChange={() => toggleColumn(col)} size="small" />
                <Typography sx={{ fontSize: 12 }}>{col}</Typography>
              </Box>
            ))}
          </Box>
        </Popover>
      </Box>

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...fontStyle, fontWeight: 700 }}></TableCell>
              {displayColumns.map(h => (
                <TableCell key={h} sx={{ ...fontStyle, fontWeight: 700 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={displayColumns.length + 1} align="center"><CircularProgress size={24} /></TableCell></TableRow>
            )}
            {!loading && filteredRows.length === 0 && (
              <TableRow><TableCell colSpan={displayColumns.length + 1} align="center" sx={fontStyle}>No records</TableCell></TableRow>
            )}
            {!loading && filteredRows.map((row, idx) => (
              <TableRow key={idx} hover>
                <TableCell width={56}>
                  <IconButton size="small" onClick={() => onEdit(row)} title="Edit"><EditIcon fontSize="small" /></IconButton>
                </TableCell>
                {displayColumns.map(h => (
                  <TableCell key={h} sx={{ ...fontStyle, fontSize: 13 }}>
                    {formatCell(h, row[h])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <EditModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingRow(null); }}
        row={editingRow}
        setRow={setEditingRow}
        validation={validation}
        readonlyCols={readonlyCols}
        headers={headers}
        onSubmit={handleSubmit}
      />

      {error && <Typography color="error" sx={{ mt: 2, ...fontStyle }}>{error}</Typography>}
    </DashboardLayout>
  );
}

/* ---------------- Helpers ---------------- */

const makeEmptyRow = (headers) => {
  const obj = {}; headers.forEach(h => { obj[h] = ''; }); return obj;
};

const toNumber = (v) => {
  if (typeof v === 'number') return v;
  if (!v) return NaN; const n = Number(String(v).replace(/[₹,\s]/g, ''));
  return isNaN(n) ? NaN : n;
};

const DATE_FIELDS_SET = new Set(DATE_FIELDS);
const CURRENCY_FIELDS_SET = new Set(CURRENCY_FIELDS);
const PERCENT_FIELDS_SET = new Set(PERCENT_FIELDS);

const formatCell = (header, value) => {
  if (value === undefined || value === null || value === '') return '';
  if (DATE_FIELDS_SET.has(header)) {
    const d = new Date(value); return isNaN(d) ? String(value) : d.toISOString().slice(0, 10);
  }
  if (CURRENCY_FIELDS_SET.has(header)) {
    const n = toNumber(value); if (isNaN(n)) return String(value);
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
  }
  if (PERCENT_FIELDS_SET.has(header)) {
    const n = Number(value); return isNaN(n) ? String(value) : `${n}%`;
  }
  if (/Link|Documents/i.test(header) && typeof value === 'string' && /^https?:\/\//i.test(value)) {
    return <a href={value} target="_blank" rel="noreferrer">Open</a>;
  }
  return String(value);
};

function Section({ title, children }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3 }}>
      <Typography sx={{ fontWeight: 700, mb: 1, fontFamily: 'Montserrat, sans-serif' }}>{title}</Typography>
      {children}
    </Paper>
  );
}

function Field({ header, row, setRow, validation, readonly }) {
  const valList = validation[header] || [];
  const value = row?.[header] ?? '';
  const onChange = (v) => setRow(prev => ({ ...prev, [header]: v }));

  const commonProps = {
    fullWidth: true,
    size: 'small',
    sx: { mb: 2 },
    value,
    onChange: (e) => onChange(e.target.value),
    disabled: readonly
  };

  if (valList.length > 0) {
    return (
      <FormControl {...commonProps}>
        <InputLabel>{header}</InputLabel>
        <Select label={header} value={value} onChange={(e) => onChange(e.target.value)} disabled={readonly}>
          {valList.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
        </Select>
      </FormControl>
    );
  }

  if (/Link|Documents/i.test(header)) {
    return <TextField {...commonProps} label={header} placeholder="https://..." />;
  }

  if (header === 'Project Progress %') {
    return <TextField {...commonProps} label={header} type="number" inputProps={{ min: 0, max: 100 }} />;
  }

  if (['Budget (₹)', 'Actual Cost (₹)', 'Variance (₹)'].includes(header)) {
    return <TextField {...commonProps} label={header} type="number" />;
  }

  if (['Timestamp', 'Start Date', 'End Date'].includes(header)) {
    const type = header === 'Timestamp' ? 'datetime-local' : 'date';
    return <TextField {...commonProps} label={header} type={type} />;
  }

  return <TextField {...commonProps} label={header} />;
}

function EditModal({ open, onClose, row, setRow, validation, readonlyCols, headers, onSubmit }) {
  if (!row) return null;
  const disabledId = Boolean(row['Project ID (unique, auto-generated)']);
  const isReadonly = (h) => readonlyCols.has(h) || (h === 'Project ID (unique, auto-generated)' && disabledId);

  // Auto-calc Variance on change of Budget/Actual
  const setField = (h, v) => {
    setRow(prev => {
      const next = { ...prev, [h]: v };
      if (h === 'Budget (₹)' || h === 'Actual Cost (₹)') {
        const b = toNumber(next['Budget (₹)']);
        const a = toNumber(next['Actual Cost (₹)']);
        if (!isNaN(b) || !isNaN(a)) next['Variance (₹)'] = (isNaN(b) ? 0 : b) - (isNaN(a) ? 0 : a);
      }
      return next;
    });
  };

  // Groupings mirror Leads/Accounts
  const projectInfo = [
    'Project ID (unique, auto-generated)',
    'Project Name',
    'Client (Linked Deal/Account ID)',
    'Project Manager',
    'Assigned Team',
    'Vendors',
    'Project Status'
  ].filter(h => headers.includes(h));

  const tasksProgress = [
    'Task Name',
    'Task Owner',
    'Task Status (Not Started / In Progress / Completed)',
    'Start Date',
    'End Date',
    'Project Progress %',
    'Remarks / Updates'
  ].filter(h => headers.includes(h));

  const finance = ['Budget (₹)', 'Actual Cost (₹)', 'Variance (₹)'].filter(h => headers.includes(h));
  const documents = ['PO Link', 'Invoice Link', 'Payment Receipt Link', 'Other Documents'].filter(h => headers.includes(h));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
        {disabledId ? 'Edit Project' : 'Add Project'}
      </DialogTitle>
      <DialogContent dividers>
        <Section title="Project Info">
          <Grid container spacing={2}>
            {projectInfo.map(h => (
              <Grid item xs={12} sm={6} key={h}>
                <Field header={h} row={row} setRow={setRow} validation={validation} readonly={isReadonly(h)} />
              </Grid>
            ))}
          </Grid>
        </Section>

        <Section title="Tasks & Progress">
          <Grid container spacing={2}>
            {tasksProgress.map(h => (
              <Grid item xs={12} sm={6} key={h}>
                <Field header={h} row={row} setRow={setRow} validation={validation} readonly={isReadonly(h)} />
              </Grid>
            ))}
          </Grid>
        </Section>

        <Section title="Finance">
          <Grid container spacing={2}>
            {finance.map(h => (
              <Grid item xs={12} sm={4} key={h}>
                <Field header={h} row={row} setRow={setRow} validation={validation} readonly={isReadonly(h)} />
              </Grid>
            ))}
          </Grid>
        </Section>

        <Section title="Documents">
          <Grid container spacing={2}>
            {documents.map(h => (
              <Grid item xs={12} sm={6} key={h}>
                <Field header={h} row={row} setRow={setRow} validation={validation} readonly={isReadonly(h)} />
              </Grid>
            ))}
          </Grid>
        </Section>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onSubmit} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}
