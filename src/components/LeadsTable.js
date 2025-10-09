// LeadsTable.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Grid, Checkbox, Button, Popover,
  InputAdornment, TablePagination
} from '@mui/material';
import { Link as MUILink } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import HistoryIcon from '@mui/icons-material/History';
import EventIcon from '@mui/icons-material/Event';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useAuth } from './AuthContext';
import '@fontsource/montserrat';
import LoadingOverlay from './LoadingOverlay';
import CalendarView from './CalendarView';

/* ---------- small debounce helper (no extra deps) ---------- */
function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ---------- URL helpers ---------- */
const looksLikeUrl = (val = '') =>
  /^https?:\/\/|^www\.|^[\w-]+\.[\w.-]+(\/|$)/i.test(String(val).trim());

const normalizeUrl = (val = '') => {
  const v = String(val).trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};
const displayUrl = (val = '') => String(val).trim().replace(/^https?:\/\//i, '');

/* ---------- sort/helpers ---------- */
const safeDate = (v) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

/* ---------- key helper: Lead ID primary, Mobile fallback ---------- */
const getLeadKey = (row = {}) =>
  String(row['Lead ID'] || row['Mobile Number'] || '').trim();

/* ---------- theme ---------- */
const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 10.5
  }
});

const selectorStyle = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: 8
};

const LeadsTable = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  // live search state
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 250);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [validationOptions, setValidationOptions] = useState({});
  const [selectedEntryRow, setSelectedEntryRow] = useState(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [entryType, setEntryType] = useState('');

  // submit guard
  const [submitting, setSubmitting] = useState(false);

  // pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);

  // Logs modal states
  const [leadLogs, setLeadLogs] = useState([]);
  const [logColumns, setLogColumns] = useState([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [allLeads, setAllLeads] = useState([]);
  const [logsKeyInfo, setLogsKeyInfo] = useState({ mobile: '', name: '', company: '' });

  const { user } = useAuth();
  const username = user?.username;
  const role = user?.role;

  // URLs
  const dataUrl = 'https://script.google.com/macros/s/AKfycbwCmyJEEbAy4h3SY630yJSaB8Odd2wL_nfAmxvbKKU0oC4jrdWwgHab-KUpPzGzKBaEUA/exec';
  const formSubmitUrl = 'https://script.google.com/macros/s/AKfycbwCmyJEEbAy4h3SY630yJSaB8Odd2wL_nfAmxvbKKU0oC4jrdWwgHab-KUpPzGzKBaEUA/exec';
  const validationUrl = 'https://script.google.com/macros/s/AKfycbzDZPePrzWhMv2t_lAeAEkVa-5J4my7xBonm4zIFOne-wtJ-EGKr0zXvBlmNtfuYaFhiQ/exec';

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(dataUrl);
        const data = await res.json();

        const filteredData = role === 'End User'
          ? data.filter(lead => lead['Lead Owner'] === username)
          : data;

        if (cancelled) return;

        setAllLeads(filteredData);

        // dedupe by Lead ID (fallback Mobile) keeping latest Timestamp
        const seen = new Map();
        filteredData.forEach(row => {
          const key = getLeadKey(row);
          if (!key) return; // skip if no identifier
          const existing = seen.get(key);
          if (!existing || safeDate(row.Timestamp) > safeDate(existing.Timestamp)) {
            seen.set(key, row);
          }
        });
        const deduplicated = Array.from(seen.values());
        setLeads(deduplicated);

        setVisibleColumns(
          JSON.parse(localStorage.getItem(`visibleColumns-${username}-leads`)) ||
          (deduplicated.length ? Object.keys(deduplicated[0]) : [])
        );
      } catch (e) {
        console.error('Failed to fetch leads', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    (async () => {
      try {
        const res = await fetch(validationUrl);
        const json = await res.json();
        if (!cancelled) setValidationOptions(json);
      } catch (e) {
        console.error('Failed to fetch validation options', e);
      }
    })();

    return () => { cancelled = true; };
  }, [username, role]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  /* ---------- memoized unique values for dropdowns ---------- */
  const uniqueValues = useMemo(() => {
    const status = new Set();
    const source = new Set();
    const owner = new Set();
    for (const d of leads) {
      if (d['Lead Status']) status.add(d['Lead Status']);
      if (d['Lead Source']) source.add(d['Lead Source']);
      if (d['Lead Owner']) owner.add(d['Lead Owner']);
    }
    return {
      status: [...status],
      source: [...source],
      owner: [...owner]
    };
  }, [leads]);

  /* ---------- filter first, then sort (on smaller set) ---------- */
  const filteredLeads = useMemo(() => {
    const q = (debouncedSearch || '').toLowerCase().trim();

    const filtered = leads.filter(lead => {
      const matchesSearch = !q || ['First Name', 'Last Name', 'Company', 'Mobile Number'].some(k =>
        String(lead[k] || '').toLowerCase().includes(q)
      );
      const matchesStatus = !filterStatus || lead['Lead Status'] === filterStatus;
      const matchesSource = !filterSource || lead['Lead Source'] === filterSource;
      const matchesOwner  = !filterOwner  || lead['Lead Owner']  === filterOwner;
      return matchesSearch && matchesStatus && matchesSource && matchesOwner;
    });

    if (!sortConfig.key) return filtered;

    const { key, direction } = sortConfig;
    return [...filtered].sort((a, b) => {
      const aVal = a[key] ?? '';
      const bVal = b[key] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? cmp : -cmp;
    });
  }, [leads, debouncedSearch, filterStatus, filterSource, filterOwner, sortConfig]);

  /* ---------- pagination (and cap while searching) ---------- */
  const pagedRows = useMemo(() => {
    if ((debouncedSearch || '').trim()) return filteredLeads.slice(0, 300); // extra snappy while typing
    const start = page * rowsPerPage;
    return filteredLeads.slice(start, start + rowsPerPage);
  }, [filteredLeads, page, rowsPerPage, debouncedSearch]);

  const handleColumnToggle = (col) => {
    setVisibleColumns(prev => {
      const updated = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
      localStorage.setItem(`visibleColumns-${username}-leads`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelectAll = () => {
    const all = Object.keys(leads[0] || {});
    setVisibleColumns(all);
    localStorage.setItem(`visibleColumns-${username}-leads`, JSON.stringify(all));
  };

  const handleDeselectAll = () => {
    setVisibleColumns([]);
    localStorage.setItem(`visibleColumns-${username}-leads`, JSON.stringify([]));
  };

  /* ---------- Logs: show full rows, newest first ---------- */
  const preferredOrderBoost = (columns) => {
    const priority = [
      'Timestamp',
      'Lead ID',
      'Lead Status',
      'Lead Owner',
      'Remarks',
      'Quotation Link',
      'First Name',
      'Last Name',
      'Company',
      'Mobile Number',
      'Email ID'
    ];
    const set = new Set(priority);
    const prioritized = priority.filter(c => columns.includes(c));
    const rest = columns.filter(c => !set.has(c)).sort((a, b) => a.localeCompare(b));
    return [...prioritized, ...rest];
  };

  const handleViewLogs = (leadRow) => {
    const key = getLeadKey(leadRow);
    const logs = allLeads
      .filter(lead => getLeadKey(lead) === key)
      .sort((a, b) => safeDate(b.Timestamp) - safeDate(a.Timestamp)); // newest first

    // Dynamic union of columns
    const colSet = new Set();
    logs.forEach(row => Object.keys(row || {}).forEach(k => colSet.add(k)));
    const allCols = preferredOrderBoost(Array.from(colSet));

    setLogsKeyInfo({
      mobile: leadRow['Mobile Number'] || '',
      name: [leadRow['First Name'], leadRow['Last Name']].filter(Boolean).join(' ').trim(),
      company: leadRow['Company'] || ''
    });

    setLeadLogs(logs);
    setLogColumns(allCols);
    setLogsOpen(true);
  };

  const handleUpdateChange = (e) => {
    const { name, value } = e.target;
    setEditRow(prev => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();

    // Guard against double-submits
    if (submitting) return;
    setSubmitting(true);

    const updated = {
      ...editRow,
      'Lead Updated Time': new Date().toLocaleString('en-GB', { hour12: false })
    };

    try {
      await fetch(formSubmitUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      alert('✅ Lead updated successfully');
      setEditRow(null);
    } catch (err) {
      console.error(err);
      alert('❌ Error updating lead');
    } finally {
      // Always release the lock
      setTimeout(() => setSubmitting(false), 0);
    }
  };

  const handleOpenMeetingFromRow = (row, type) => {
    setSelectedEntryRow(row);
    setEntryType(type); // 'Lead', 'Account', 'Deal'
    setShowCalendarModal(true);
  };

  return (
    <ThemeProvider theme={theme}>
      {loading && <LoadingOverlay />}
      <Box padding={4}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
          <Typography variant="h5" fontWeight="bold">Leads Records</Typography>
        </Box>

        <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
          {/* Search (live, debounced, no helper text) */}
          <Box display="flex" alignItems="center">
            <TextField
              size="small"
              label="Search"
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setPage(0); }}
              sx={{ minWidth: 240 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchInput ? (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="clear search"
                      edge="end"
                      onClick={() => { setSearchInput(''); setPage(0); }}
                      size="small"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null
              }}
            />
          </Box>

          {['Lead Status', 'Lead Source', 'Lead Owner'].map(filterKey => (
            <FormControl size="small" sx={{ minWidth: 160 }} key={filterKey}>
              <InputLabel>{filterKey}</InputLabel>
              <Select
                value={
                  filterKey === 'Lead Status' ? filterStatus :
                  filterKey === 'Lead Source' ? filterSource :
                  filterOwner
                }
                label={filterKey}
                onChange={e => {
                  if (filterKey === 'Lead Status') setFilterStatus(e.target.value);
                  else if (filterKey === 'Lead Source') setFilterSource(e.target.value);
                  else setFilterOwner(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">All</MenuItem>
                {(filterKey === 'Lead Status' ? uniqueValues.status
                  : filterKey === 'Lead Source' ? uniqueValues.source
                  : uniqueValues.owner).map(item => (
                    <MenuItem key={item} value={item}>{item}</MenuItem>
                  ))}
              </Select>
            </FormControl>
          ))}

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <ViewColumnIcon />
          </IconButton>
          <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
            <Box padding={2} sx={selectorStyle}>
              <Button size="small" onClick={handleSelectAll}>Select All</Button>
              <Button size="small" onClick={handleDeselectAll}>Deselect All</Button>
              {Object.keys(leads[0] || {}).map(col => (
                <Box key={col}>
                  <Checkbox
                    size="small"
                    checked={visibleColumns.includes(col)}
                    onChange={() => handleColumnToggle(col)}
                  /> {col}
                </Box>
              ))}
            </Box>
          </Popover>
        </Box>

        <Table>
          <TableHead>
            <TableRow style={{ backgroundColor: '#6495ED' }}>
              {visibleColumns.map(header => (
                <TableCell
                  key={header}
                  onClick={() => handleSort(header)}
                  style={{ color: 'white', cursor: 'pointer' }}
                >
                  {header} {sortConfig.key === header ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </TableCell>
              ))}
              <TableCell style={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedRows.map((lead, index) => (
              <TableRow key={index}>
                {visibleColumns.map((key, i) => {
                  const value = lead[key];
                  // Auto-link ONLY Quotation Link column
                  if (key === 'Quotation Link' && looksLikeUrl(value)) {
                    const href = normalizeUrl(value);
                    return (
                      <TableCell key={i}>
                        <MUILink
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="hover"
                          sx={{ wordBreak: 'break-all' }}
                        >
                          {displayUrl(value)}
                        </MUILink>
                      </TableCell>
                    );
                  }
                  return <TableCell key={i}>{value}</TableCell>;
                })}
                <TableCell>
                  <IconButton onClick={() => setViewRow(lead)} disabled={submitting}><VisibilityIcon /></IconButton>
                  <IconButton onClick={() => setEditRow(lead)} disabled={submitting}><EditIcon /></IconButton>
                  <IconButton onClick={() => handleViewLogs(lead)} disabled={submitting}><HistoryIcon /></IconButton>
                  <IconButton onClick={() => handleOpenMeetingFromRow(lead, 'Lead')} disabled={submitting}><EventIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <TablePagination
          component="div"
          count={filteredLeads.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[50, 100, 200]}
        />

        {/* View Modal */}
        <Dialog open={!!viewRow} onClose={() => setViewRow(null)} maxWidth="md" fullWidth>
          <DialogTitle>View Lead</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              {viewRow && Object.entries(viewRow).map(([key, value]) => (
                <Grid item xs={6} key={key}>
                  {key === 'Quotation Link' && looksLikeUrl(value) ? (
                    <MUILink
                      href={normalizeUrl(value)}
                      target="_blank"
                      rel="noopener noreferrer"
                      underline="hover"
                      sx={{ display: 'inline-block', mt: 2, wordBreak: 'break-all' }}
                    >
                      {displayUrl(value)}
                    </MUILink>
                  ) : (
                    <TextField
                      fullWidth
                      size="small"
                      label={key}
                      value={value ?? ''}
                      InputProps={{ readOnly: true }}
                    />
                  )}
                </Grid>
              ))}
            </Grid>
          </DialogContent>
        </Dialog>

        {/* Logs Modal - FULL ROWS, NEWEST FIRST */}
        <Dialog open={logsOpen} onClose={() => setLogsOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle>
            Lead Change Logs
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {logsKeyInfo.company ? `${logsKeyInfo.company} • ` : ''}
              {logsKeyInfo.name ? `${logsKeyInfo.name} • ` : ''}
              {logsKeyInfo.mobile ? `+91 ${logsKeyInfo.mobile}` : ''}
            </Typography>
          </DialogTitle>
          <DialogContent dividers>
            {leadLogs.length === 0 ? (
              <Typography>No logs found for this lead.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {logColumns.map(col => (
                      <TableCell key={col} sx={{ fontWeight: 600 }}>{col}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leadLogs.map((log, idx) => (
                    <TableRow key={idx}>
                      {logColumns.map((col) => {
                        const val = log[col] ?? '';
                        if (col === 'Quotation Link' && looksLikeUrl(val)) {
                          return (
                            <TableCell key={col}>
                              <MUILink
                                href={normalizeUrl(val)}
                                target="_blank"
                                rel="noopener noreferrer"
                                underline="hover"
                                sx={{ wordBreak: 'break-all' }}
                              >
                                {displayUrl(val)}
                              </MUILink>
                            </TableCell>
                          );
                        }
                        return <TableCell key={col}>{String(val)}</TableCell>;
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog
          open={!!editRow}
          onClose={() => {
            if (submitting) return; // prevent close during save
            setSubmitting(false);
            setEditRow(null);
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Edit Lead</DialogTitle>

          {/* Wrap fields in a form so Enter uses the guarded handler */}
          <DialogContent
            dividers
            component="form"
            onSubmit={handleEditSubmit}
            onKeyDown={(e) => {
              if (submitting && (e.key === 'Enter' || e.key === 'NumpadEnter')) {
                e.preventDefault();
              }
            }}
          >
            <Grid container spacing={2}>
              {editRow && Object.keys(editRow).map((key, i) => (
                <Grid item xs={6} key={i}>
                  {validationOptions[key] ? (
                    <FormControl fullWidth size="small" disabled={submitting}>
                      <InputLabel>{key}</InputLabel>
                      <Select
                        name={key}
                        value={editRow[key]}
                        onChange={handleUpdateChange}
                        label={key}
                      >
                        {validationOptions[key].map((opt, idx) => (
                          <MenuItem key={idx} value={opt}>{opt}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField
                      fullWidth
                      label={key}
                      name={key}
                      value={editRow[key]}
                      onChange={handleUpdateChange}
                      size="small"
                      disabled={submitting}
                      autoFocus={i === 0}
                    />
                  )}
                </Grid>
              ))}
            </Grid>

            <Box mt={3} display="flex" justifyContent="flex-end" gap={1}>
              <Button
                onClick={() => {
                  if (submitting) return;
                  setEditRow(null);
                }}
                disabled={submitting}
                variant="text"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="contained"
                sx={{ backgroundColor: '#6495ED' }}
                disabled={submitting}
              >
                {submitting ? 'Saving…' : 'Save Changes'}
              </Button>
            </Box>
          </DialogContent>
        </Dialog>

        {showCalendarModal && (
          <CalendarView
            open={showCalendarModal}
            onClose={() => setShowCalendarModal(false)}
            entryType={entryType}
            selectedEntryRow={selectedEntryRow}
            mode="existing"
          />
        )}
      </Box>
    </ThemeProvider>
  );
};

export default LeadsTable;
