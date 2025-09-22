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
  CircularProgress,
  InputAdornment,
  Chip
} from '@mui/material';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';


const WEB_APP_BASE = 'https://script.google.com/macros/s/AKfycbxLsPfXtpRuKOoB956pb6VfO4_Hx1cPEVpiZApTMKjxig0iL3EwodQaHCGItGyUwMnhzQ/exec';

const fontStyle = { fontFamily: 'Montserrat, sans-serif' };

const PROJECT_STATUS_COLORS = {
  'Not Started': 'default',
  'Active': 'primary',
  'On Hold': 'warning',
  'Completed': 'success',
  'Cancelled': 'error'
};
const TASK_STATUS_COLORS = {
  'Not Started': 'default',
  'In Progress': 'info',
  'Completed': 'success'
};
const DATE_FIELDS = new Set(['Timestamp','Start Date','End Date']);
const MONEY_FIELDS = new Set(['Budget (₹)','Actual Cost (₹)','Variance (₹)']);
const PERCENT_FIELDS = new Set(['Project Progress %']);

export default function ProjectTable() {
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState({});

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});

  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleCols, setVisibleCols] = useState(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);

  const fetchProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const url = `${WEB_APP_BASE}?action=getProjects`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data?.rows)) throw new Error('Invalid payload: rows missing');
      setRows(data.rows);
      setHeaders(data.headers || []);
      if (visibleCols.size === 0 && data.headers) setVisibleCols(new Set(data.headers));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchValidation = async () => {
    try {
      const url = `${WEB_APP_BASE}?action=getValidation&sheet=Validation Tables`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setValidation(data?.validation || {});
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchValidation();
  }, []);

  const filteredRows = useMemo(() => {
    let out = [...rows];
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(r => headers.some(h => String(r[h] || '').toLowerCase().includes(q)));
    }
    Object.entries(filters).forEach(([h, val]) => {
      if (val) out = out.filter(r => (r[h] || '') === val);
    });
    const ts = 'Timestamp';
    if (headers.includes(ts)) {
      out.sort((a,b) => new Date(b[ts]||0) - new Date(a[ts]||0));
    }
    return out;
  }, [rows, headers, search, filters]);

  const handleOpenColumns = (e) => setAnchorEl(e.currentTarget);
  const handleCloseColumns = () => setAnchorEl(null);
  const toggleColumn = (col) => {
    const next = new Set(visibleCols);
    if (next.has(col)) next.delete(col); else next.add(col);
    setVisibleCols(next);
  };

  const onAdd = () => {
    const obj = {};
    headers.forEach(h => obj[h] = '');
    setEditingRow(obj);
    setModalOpen(true);
  };

  const onEdit = (row) => {
    setEditingRow({ ...row });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = { action: 'addOrUpdateProject', data: editingRow };
      await fetch(WEB_APP_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setModalOpen(false);
      setEditingRow(null);
      await fetchProjects();
    } catch (err) {
      console.error(err);
      alert('Failed to submit. Please try again.');
    }
  };

  const formatMoney = (v) => {
    if (v === '' || v === null || v === undefined) return '';
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[₹,\s]/g,''));
    if (isNaN(n)) return String(v);
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
  };
  const formatDate = (v) => {
    const d = new Date(v);
    return isNaN(d) ? String(v ?? '') : d.toISOString().slice(0,10);
  };
  const renderCell = (header, value) => {
    if (value === null || value === undefined || value === '') return '';
    if (header === 'Project Status') {
      const color = PROJECT_STATUS_COLORS[String(value)] || 'default';
      return <Chip size="small" label={String(value)} color={color} variant={color==='default'?'outlined':'filled'} />;
    }
    if (header === 'Task Status (Not Started / In Progress / Completed)') {
      const color = TASK_STATUS_COLORS[String(value)] || 'default';
      return <Chip size="small" label={String(value)} color={color} variant={color==='default'?'outlined':'filled'} />;
    }
    if (PERCENT_FIELDS.has(header)) {
      const n = Number(value);
      return isNaN(n) ? String(value) : `${n}%`;
    }
    if (MONEY_FIELDS.has(header)) return formatMoney(value);
    if (DATE_FIELDS.has(header)) return formatDate(value);
    if (/Link|Documents/i.test(header) && typeof value === 'string' && /^https?:\/\//i.test(value)) return <a href={value} target="_blank" rel="noreferrer">Open</a>;
    if (header === 'Client (Linked Deal/Account ID)' && typeof value === 'string' && value.includes('|')) return value.split('|').slice(1).join('|');
    return String(value);
  };

  return (
    
      <Box sx={{ p: 2, ...fontStyle }}>
        <Paper elevation={0} sx={{ p: 1.5, mb: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
            <Typography variant="h6" sx={{ ...fontStyle, fontWeight: 700 }}>Projects</Typography>
            <Box sx={{ flex: 1 }} />
            <TextField
              size="small"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 280 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                style: fontStyle
              }}
            />
            {['Project Status', 'Project Manager', 'Task Status (Not Started / In Progress / Completed)'].map(h => (
              <FormControl key={h} size="small" sx={{ minWidth: 200 }}>
                <InputLabel>{h}</InputLabel>
                <Select value={filters[h] || ''} onChange={(e) => setFilters(prev => ({ ...prev, [h]: e.target.value }))}>
                  <MenuItem value=""><em>All</em></MenuItem>
                  {(validation[h] || []).map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                </Select>
              </FormControl>
            ))}
            <IconButton onClick={fetchProjects} title="Refresh"><RefreshIcon /></IconButton>
            <IconButton onClick={onAdd} color="primary" title="Add Project"><AddIcon /></IconButton>
            <IconButton onClick={handleOpenColumns} title="Columns"><ViewColumnIcon /></IconButton>
          </Box>
        </Paper>

        <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={handleCloseColumns} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Box sx={{ p: 2, ...fontStyle }}>
            <Typography sx={{ mb: 1, fontWeight: 600 }}>Show/Hide Columns</Typography>
            {headers.map(col => (
              <Box key={col} sx={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox checked={visibleCols.has(col)} onChange={() => toggleColumn(col)} size="small" />
                <Typography sx={{ fontSize: 12 }}>{col}</Typography>
              </Box>
            ))}
          </Box>
        </Popover>

        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: '#f7f9fc', fontWeight: 700 } }}>
                <TableCell sx={{ ...fontStyle, fontWeight: 700, width: 56 }}></TableCell>
                {headers.filter(h => visibleCols.has(h)).map(h => (
                  <TableCell key={h} sx={{ ...fontStyle, fontWeight: 700 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={headers.length + 1} align="center"><CircularProgress size={24} /></TableCell>
                </TableRow>
              )}
              {!loading && filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={headers.length + 1} align="center" sx={fontStyle}>No records</TableCell>
                </TableRow>
              )}
              {!loading && filteredRows.map((row, idx) => (
                <TableRow key={idx} hover sx={{ '&:nth-of-type(odd)': { bgcolor: 'rgba(0,0,0,0.015)' } }}>
                  <TableCell width={56}>
                    <IconButton size="small" onClick={() => onEdit(row)} title="Edit"><EditIcon fontSize="small" /></IconButton>
                  </TableCell>
                  {headers.filter(h => visibleCols.has(h)).map(h => (
                    <TableCell key={h} sx={{ ...fontStyle, fontSize: 13 }}>
                      {renderCell(h, row[h])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        {error && <Typography color="error" sx={{ mt: 2, ...fontStyle }}>{error}</Typography>}

        <Dialog open={modalOpen} onClose={() => { setModalOpen(false); setEditingRow(null); }} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>{editingRow?.['Project ID (unique, auto-generated)'] ? 'Edit Project' : 'Add Project'}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              {headers.map(h => (
                <Grid item xs={12} sm={6} key={h}>
                  {h === 'Client (Linked Deal/Account ID)' ? (
                    <ClientSelector
                      value={editingRow?.[h] || ''}
                      onChange={(val) => setEditingRow(prev => ({ ...prev, [h]: val }))}
                    />
                  ) : validation[h]?.length > 0 ? (
                    <FormControl fullWidth size="small">
                      <InputLabel>{h}</InputLabel>
                      <Select value={editingRow?.[h] || ''} onChange={(e) => setEditingRow(prev => ({ ...prev, [h]: e.target.value }))}>
                        {validation[h].map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField fullWidth size="small" label={h} value={editingRow?.[h] || ''} onChange={(e) => setEditingRow(prev => ({ ...prev, [h]: e.target.value }))} />
                  )}
                </Grid>
              ))}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setModalOpen(false); setEditingRow(null); }}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained">Save</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
}

/** ClientSelector — choose Accounts/Deals then a specific record; stores value as "source:id|label" */
function ClientSelector({ value, onChange }) {
  const [source, setSource] = React.useState(() => (String(value).startsWith('deals:') ? 'deals' : 'accounts'));
  const [options, setOptions] = React.useState([]); // [{id,label}]
  const [loading, setLoading] = React.useState(false);

  const fetchOptions = async (src) => {
    setLoading(true);
    try {
      const res = await fetch(`${WEB_APP_BASE}?action=getClientOptions&source=${encodeURIComponent(src)}`);
      const data = await res.json();
      // Expecting server to send label in the format: "Account/Deal Name : First Last : Mobile"
      setOptions(Array.isArray(data?.options) ? data.options : []);
    } catch (e) {
      console.error(e);
      setOptions([]);
    } finally { setLoading(false); }
  };

  React.useEffect(() => { fetchOptions(source); }, [source]);

  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Client Source</InputLabel>
        <Select label="Client Source" value={source} onChange={(e) => setSource(e.target.value)}>
          <MenuItem value="accounts">Accounts</MenuItem>
          <MenuItem value="deals">Deals</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small" fullWidth>
        <InputLabel>{loading ? 'Loading…' : 'Select Client'}</InputLabel>
        <Select
          label={loading ? 'Loading…' : 'Select Client'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map(opt => (
            <MenuItem key={opt.id} value={`${source}:${opt.id}|${opt.label}`}>{opt.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
