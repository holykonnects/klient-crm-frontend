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
  CircularProgress,
  InputAdornment,
  Chip,
  Paper
} from '@mui/material';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import '@fontsource/montserrat';

const WEB_APP_BASE = 'https://script.google.com/macros/s/AKfycbxLsPfXtpRuKOoB956pb6VfO4_Hx1cPEVpiZApTMKjxig0iL3EwodQaHCGItGyUwMnhzQ/exec';

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 10.5
  }
});

const selectorStyle = { fontFamily: 'Montserrat, sans-serif', fontSize: 8 };

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
  const [visibleColumns, setVisibleColumns] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });

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
      if ((!visibleColumns || visibleColumns.length === 0) && Array.isArray(data.headers)) {
        const saved = JSON.parse(localStorage.getItem('visibleColumns-projects') || 'null');
        setVisibleColumns(saved || data.headers);
      }
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
      if (Array.isArray(data?.visibleColumns) && data.visibleColumns.length) {
        setVisibleColumns(data.visibleColumns);
        localStorage.setItem('visibleColumns-projects', JSON.stringify(data.visibleColumns));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchValidation();
    // eslint-disable-next-line
  }, []);

  const filteredRows = useMemo(() => {
    let out = [...rows];
    if (search) {
      const q = search.toLowerCase().trim();
      out = out.filter(r => headers.some(h => String(r[h] || '').toLowerCase().includes(q)));
    }
    Object.entries(filters).forEach(([h, val]) => {
      if (val) out = out.filter(r => (r[h] || '') === val);
    });
    if (sortConfig.key) {
      const { key, direction } = sortConfig;
      out.sort((a, b) => {
        const aVal = a[key] ?? '';
        const bVal = b[key] ?? '';
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
        return direction === 'asc' ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, headers, search, filters, sortConfig]);

  const handleOpenColumns = (e) => setAnchorEl(e.currentTarget);
  const handleCloseColumns = () => setAnchorEl(null);
  const toggleColumn = (col) => {
    setVisibleColumns(prev => {
      const updated = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
      localStorage.setItem('visibleColumns-projects', JSON.stringify(updated));
      return updated;
    });
  };
  const handleSelectAll = () => { setVisibleColumns(headers); localStorage.setItem('visibleColumns-projects', JSON.stringify(headers)); };
  const handleDeselectAll = () => { setVisibleColumns([]); localStorage.setItem('visibleColumns-projects', JSON.stringify([])); };

  const onAdd = () => {
    const obj = {}; headers.forEach(h => obj[h] = '');
    setEditingRow(obj); setModalOpen(true);
  };
  const onEdit = (row) => { setEditingRow({ ...row }); setModalOpen(true); };
  const handleSort = (key) => { setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' })); };

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
    <ThemeProvider theme={theme}>
      <Box padding={4}>
        <Paper elevation={0} sx={{ p: 1.5, mb: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 36 }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Projects</Typography>
            <Box sx={{ flex: 1 }} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 2, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
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
                )
              }}
            />
            {['Project Status','Project Manager','Task Status (Not Started / In Progress / Completed)'].map(h => (
              <FormControl key={h} size="small" sx={{ minWidth: 180 }}>
                <InputLabel>{h}</InputLabel>
                <Select label={h} value={filters[h] || ''} onChange={(e) => setFilters(prev => ({ ...prev, [h]: e.target.value }))}>
                  <MenuItem value="">All</MenuItem>
                  {(validation[h] || []).map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                </Select>
              </FormControl>
            ))}
            <IconButton onClick={handleOpenColumns} title="Columns"><ViewColumnIcon /></IconButton>
            <IconButton onClick={fetchProjects} title="Refresh"><RefreshIcon /></IconButton>
            <IconButton onClick={onAdd} color="primary" title="Add Project"><AddIcon /></IconButton>
          </Box>
        </Paper>

        <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={handleCloseColumns}>
          <Box padding={2} sx={selectorStyle}>
            <Button size="small" onClick={handleSelectAll}>Select All</Button>
            <Button size="small" onClick={handleDeselectAll}>Deselect All</Button>
            {headers.map(col => (
              <Box key={col}>
                <Checkbox
                  size="small"
                  checked={visibleColumns.includes(col)}
                  onChange={() => toggleColumn(col)}
                /> {col}
              </Box>
            ))}
          </Box>
        </Popover>

        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Table size="small" stickyHeader>
            <TableHead sx={{ '& th': { backgroundColor: '#6495ED', color: '#fff' } }}>
              <TableRow>
                {visibleColumns.map(header => (
                  <TableCell
                    key={header}
                    onClick={() => handleSort(header)}
                    sx={{ color: '#fff', cursor: 'pointer' }}
                  >
                    {header} {sortConfig.key === header ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </TableCell>
                ))}
                <TableCell style={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={(visibleColumns?.length || 0) + 1} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              )}
              {!loading && filteredRows.length === 0 && (
                <TableRow><TableCell colSpan={(visibleColumns?.length || 0) + 1} align="center">No records</TableCell></TableRow>
              )}
              {!loading && filteredRows.map((row, idx) => (
                <TableRow key={idx} hover>
                  {visibleColumns.map(h => (
                    <TableCell key={h}>{renderCell(h, row[h])}</TableCell>
                  ))}
                  <TableCell width={120}>
                    <IconButton size="small" onClick={() => onEdit(row)} title="Edit"><EditIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}

        <Dialog open={modalOpen} onClose={() => { setModalOpen(false); setEditingRow(null); }} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>{editingRow?.['Project ID (unique, auto-generated)'] ? 'Edit Project' : 'Add Project'}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              {headers.map(h => (
                <Grid item xs={12} sm={6} key={h}>
                  {validation[h]?.length > 0 ? (
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
            <Button onClick={handleSubmit} variant="contained" sx={{ backgroundColor: '#6495ED' }}>Save</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}