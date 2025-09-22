// src/components/ProjectTable.js
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
import ClearIcon from '@mui/icons-material/Clear';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import '@fontsource/montserrat';

const WEB_APP_BASE =
  'https://script.google.com/macros/s/AKfycbxLsPfXtpRuKOoB956pb6VfO4_Hx1cPEVpiZApTMKjxig0iL3EwodQaHCGItGyUwMnhzQ/exec';

const theme = createTheme({
  typography: { fontFamily: 'Montserrat, sans-serif', fontSize: 10.5 }
});

const selectorStyle = { fontFamily: 'Montserrat, sans-serif', fontSize: 12 };

const PROJECT_STATUS_COLORS = {
  'Not Started': 'default',
  Active: 'primary',
  'On Hold': 'warning',
  Completed: 'success',
  Cancelled: 'error'
};
const TASK_STATUS_COLORS = {
  'Not Started': 'default',
  'In Progress': 'info',
  Completed: 'success'
};
const DATE_FIELDS = new Set(['Timestamp', 'Start Date', 'End Date']);
const MONEY_FIELDS = new Set(['Budget (₹)', 'Actual Cost (₹)', 'Variance (₹)']);
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
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);

  // Detect an Owner header to auto-fill from Accounts/Deals picker
  const OWNER_HEADER = useMemo(() => {
    const lower = headers.map(h => String(h).toLowerCase());
    const idx = lower.findIndex(
      h => h === 'owner' || h === 'account owner' || h === 'lead owner'
    );
    return idx >= 0 ? headers[idx] : null;
  }, [headers]);

  // ----- Fetchers -----
  const fetchProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${WEB_APP_BASE}?action=getProjects`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data?.rows)) throw new Error('Invalid payload: rows missing');
      setRows(data.rows);
      setHeaders(data.headers || []);
      if (visibleColumns.length === 0 && Array.isArray(data.headers)) {
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
      const res = await fetch(`${WEB_APP_BASE}?action=getValidation&sheet=Validation Tables`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setValidation(data?.validation || {});
      if (Array.isArray(data?.visibleColumns) && data.visibleColumns.length) {
        setVisibleColumns(data.visibleColumns);
        localStorage.setItem(
          'visibleColumns-projects',
          JSON.stringify(data.visibleColumns)
        );
      }
    } catch (err) {
      console.warn('Validation fetch failed', err);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchValidation();
    // eslint-disable-next-line
  }, []);

  // ----- Derived rows (search/filter/sort) -----
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
        const cmp = String(aVal).localeCompare(String(bVal), undefined, {
          numeric: true,
          sensitivity: 'base'
        });
        return direction === 'asc' ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, headers, search, filters, sortConfig]);

  // ----- Handlers -----
  const handleOpenColumns = e => setAnchorEl(e.currentTarget);
  const handleCloseColumns = () => setAnchorEl(null);
  const toggleColumn = col => {
    setVisibleColumns(prev => {
      const updated = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
      localStorage.setItem('visibleColumns-projects', JSON.stringify(updated));
      return updated;
    });
  };
  const handleSelectAll = () => {
    setVisibleColumns(headers);
    localStorage.setItem('visibleColumns-projects', JSON.stringify(headers));
  };
  const handleDeselectAll = () => {
    setVisibleColumns([]);
    localStorage.setItem('visibleColumns-projects', JSON.stringify([]));
  };

  const onAdd = () => {
    const obj = {};
    headers.forEach(h => (obj[h] = ''));
    setEditingRow(obj);
    setModalOpen(true);
  };
  const onEdit = row => {
    setEditingRow({ ...row });
    setModalOpen(true);
  };
  const handleSort = key => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSubmit = async () => {
  try {
    const payload = { action: 'addOrUpdateProject', data: editingRow };
    await fetch(WEB_APP_BASE, {
      method: 'POST',
      mode: 'no-cors', // 👈 suppress CORS checks
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // 👈 avoids preflight
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

  // ----- Render helpers -----
  const formatMoney = v => {
    if (v === '' || v === null || v === undefined) return '';
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[₹,\s]/g, ''));
    if (isNaN(n)) return String(v);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(n);
  };
  const formatDate = v => {
    const d = new Date(v);
    return isNaN(d) ? String(v ?? '') : d.toISOString().slice(0, 10);
  };
  const renderCell = (header, value) => {
    if (value === null || value === undefined || value === '') return '';
    if (header === 'Project Status') {
      const color = PROJECT_STATUS_COLORS[String(value)] || 'default';
      return (
        <Chip
          size="small"
          label={String(value)}
          color={color}
          variant={color === 'default' ? 'outlined' : 'filled'}
        />
      );
    }
    if (header === 'Task Status (Not Started / In Progress / Completed)') {
      const color = TASK_STATUS_COLORS[String(value)] || 'default';
      return (
        <Chip
          size="small"
          label={String(value)}
          color={color}
          variant={color === 'default' ? 'outlined' : 'filled'}
        />
      );
    }
    if (PERCENT_FIELDS.has(header)) {
      const n = Number(value);
      return isNaN(n) ? String(value) : `${n}%`;
    }
    if (MONEY_FIELDS.has(header)) return formatMoney(value);
    if (DATE_FIELDS.has(header)) return formatDate(value);
    if (
      /Link|Documents/i.test(header) &&
      typeof value === 'string' &&
      /^https?:\/\//i.test(value)
    ) {
      return (
        <a href={value} target="_blank" rel="noreferrer">
          Open
        </a>
      );
    }
    if (
      header === 'Client (Linked Deal/Account ID)' &&
      typeof value === 'string' &&
      value.includes('|')
    ) {
      // stored as "source:id|label" — display the label only
      return value.split('|').slice(1).join('|');
    }
    return String(value);
  };

  // ----- UI -----
  return (
    <ThemeProvider theme={theme}>
      <Box padding={4}>
        {/* Title & toolbar (left aligned like Leads) */}
        <Paper
          elevation={0}
          sx={{ p: 1.5, mb: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
            <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Projects
            </Typography>
            <Box sx={{ flex: 1 }} />
          </Box>

          <Box
            display="flex"
            justifyContent="flex-start"
            gap={2}
            mt={1}
            flexWrap="wrap"
            alignItems="center"
          >
            <TextField
              size="small"
              label="Search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              sx={{ minWidth: 240 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton aria-label="clear search" edge="end" onClick={() => setSearch('')} size="small">
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null
              }}
            />

            {['Project Status', 'Project Manager', 'Task Status (Not Started / In Progress / Completed)'].map(
              h => (
                <FormControl key={h} size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>{h}</InputLabel>
                  <Select
                    label={h}
                    value={filters[h] || ''}
                    onChange={e => setFilters(prev => ({ ...prev, [h]: e.target.value }))}
                  >
                    <MenuItem value="">
                      <em>All</em>
                    </MenuItem>
                    {(validation[h] || []).map(opt => (
                      <MenuItem key={opt} value={opt}>
                        {opt}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )
            )}

            <IconButton onClick={handleOpenColumns} title="Columns">
              <ViewColumnIcon />
            </IconButton>
            <IconButton onClick={fetchProjects} title="Refresh">
              <RefreshIcon />
            </IconButton>
            <IconButton onClick={onAdd} color="primary" title="Add Project">
              <AddIcon />
            </IconButton>
          </Box>
        </Paper>

        {/* Column manager */}
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={handleCloseColumns}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Box padding={2} sx={selectorStyle}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Button size="small" onClick={handleSelectAll}>
                Select All
              </Button>
              <Button size="small" onClick={handleDeselectAll}>
                Deselect All
              </Button>
            </Box>
            {headers.map(col => (
              <Box key={col}>
                <Checkbox
                  size="small"
                  checked={visibleColumns.includes(col)}
                  onChange={() => toggleColumn(col)}
                />{' '}
                {col}
              </Box>
            ))}
          </Box>
        </Popover>

        {/* Table */}
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Table size="small" stickyHeader>
            <TableHead
              sx={{
                '& .MuiTableCell-head': {
                  backgroundColor: '#6495ED',
                  color: '#fff',
                  fontWeight: 700
                }
              }}
            >
              <TableRow>
                {visibleColumns.map(header => (
                  <TableCell
                    key={header}
                    onClick={() => handleSort(header)}
                    sx={{ cursor: 'pointer' }}
                  >
                    {header}{' '}
                    {sortConfig.key === header ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </TableCell>
                ))}
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={(visibleColumns?.length || 0) + 1} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              )}
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
                    {visibleColumns.map(h => (
                      <TableCell key={h}>{renderCell(h, row[h])}</TableCell>
                    ))}
                    <TableCell width={120}>
                      <IconButton size="small" onClick={() => onEdit(row)} title="Edit">
                        <EditIcon fontSize="small" />
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

        {/* Add/Edit Modal */}
        <Dialog
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingRow(null);
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
            {editingRow?.['Project ID (unique, auto-generated)'] ? 'Edit Project' : 'Add Project'}
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              {headers.map(h => (
                <Grid item xs={12} sm={6} key={h}>
                  {h === 'Client (Linked Deal/Account ID)' ? (
                    <ClientSelector
                      value={editingRow?.[h] || ''}
                      onPick={({ value, owner }) =>
                        setEditingRow(prev => ({
                          ...prev,
                          [h]: value,
                          ...(OWNER_HEADER && owner ? { [OWNER_HEADER]: owner } : {})
                        }))
                      }
                    />
                  ) : validation[h]?.length > 0 ? (
                    <FormControl fullWidth size="small">
                      <InputLabel>{h}</InputLabel>
                      <Select
                        label={h}
                        value={editingRow?.[h] || ''}
                        onChange={e =>
                          setEditingRow(prev => ({ ...prev, [h]: e.target.value }))
                        }
                      >
                        {validation[h].map(opt => (
                          <MenuItem key={opt} value={opt}>
                            {opt}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField
                      fullWidth
                      size="small"
                      label={h}
                      value={editingRow?.[h] || ''}
                      onChange={e => setEditingRow(prev => ({ ...prev, [h]: e.target.value }))}
                    />
                  )}
                </Grid>
              ))}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setModalOpen(false);
                setEditingRow(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="contained" sx={{ backgroundColor: '#6495ED' }} onClick={handleSubmit}>
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

/** ClientSelector — choose Accounts/Deals then a specific record; stores value as "source:id|label" and returns owner */
function ClientSelector({ value, onPick }) {
  const [source, setSource] = React.useState(() =>
    String(value).startsWith('deals:') ? 'deals' : 'accounts'
  );
  const [options, setOptions] = React.useState([]); // [{id,label,owner}]
  const [loading, setLoading] = React.useState(false);

  const fetchOptions = async src => {
    setLoading(true);
    try {
      const res = await fetch(
        `${WEB_APP_BASE}?action=getClientOptions&source=${encodeURIComponent(src)}`
      );
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

  // Derive current selected id from value "source:id|label"
  const currentId = React.useMemo(() => {
    if (!value) return '';
    const pipe = String(value).indexOf('|');
    const colon = String(value).indexOf(':');
    if (colon === -1) return '';
    const id = String(value).slice(colon + 1, pipe > colon ? pipe : undefined);
    return id;
  }, [value]);

  const handlePick = id => {
    const opt = options.find(o => String(o.id) === String(id));
    const label = opt?.label || '';
    const owner = opt?.owner || '';
    const v = `${source}:${id}${label ? '|' + label : ''}`;
    onPick && onPick({ value: v, owner });
  };

  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Client Source</InputLabel>
        <Select label="Client Source" value={source} onChange={e => setSource(e.target.value)}>
          <MenuItem value="accounts">Accounts</MenuItem>
          <MenuItem value="deals">Deals</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small" fullWidth>
        <InputLabel>{loading ? 'Loading…' : 'Select Client'}</InputLabel>
        <Select
          label={loading ? 'Loading…' : 'Select Client'}
          value={currentId}
          onChange={e => handlePick(e.target.value)}
        >
          {options.map(opt => (
            <MenuItem key={opt.id} value={opt.id}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
