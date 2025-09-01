import React, { useEffect, useMemo, useState, useDeferredValue } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Grid, Checkbox, Button, Popover, InputAdornment
} from '@mui/material';
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

  // live search state (no more Enter)
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const deferredSearch = useDeferredValue(debouncedSearch); // keeps typing smooth

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

  const [leadLogs, setLeadLogs] = useState([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [allLeads, setAllLeads] = useState([]);

  const { user } = useAuth();
  const username = user?.username;
  const role = user?.role;

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

        // dedupe by Mobile Number keeping latest Timestamp
        const seen = new Map();
        filteredData.forEach(row => {
          const key = row['Mobile Number'];
          const existing = seen.get(key);
          if (!existing || new Date(row.Timestamp) > new Date(existing.Timestamp)) {
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

  const sortedLeads = useMemo(() => {
    if (!sortConfig.key) return leads;
    const { key, direction } = sortConfig;
    const copy = [...leads];
    copy.sort((a, b) => {
      const aVal = a[key] ?? '';
      const bVal = b[key] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [leads, sortConfig]);

  // live filter using deferred + debounced search
  const filteredLeads = useMemo(() => {
    const q = (deferredSearch || '').toLowerCase().trim();
    return sortedLeads.filter(lead => {
      const matchesSearch = !q || ['First Name', 'Last Name', 'Company', 'Mobile Number'].some(k =>
        String(lead[k] || '').toLowerCase().includes(q)
      );
      const matchesStatus = !filterStatus || lead['Lead Status'] === filterStatus;
      const matchesSource = !filterSource || lead['Lead Source'] === filterSource;
      const matchesOwner  = !filterOwner  || lead['Lead Owner']  === filterOwner;
      return matchesSearch && matchesStatus && matchesSource && matchesOwner;
    });
  }, [sortedLeads, deferredSearch, filterStatus, filterSource, filterOwner]);

  const unique = (key) => [...new Set(leads.map(d => d[key]).filter(Boolean))];

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

  const handleViewLogs = (leadRow) => {
    const key = leadRow['Mobile Number'];
    const logs = allLeads.filter(lead => lead['Mobile Number'] === key);
    setLeadLogs(logs);
    setLogsOpen(true);
  };

  const handleUpdateChange = (e) => {
    const { name, value } = e.target;
    setEditRow(prev => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async () => {
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
    } catch {
      alert('❌ Error updating lead');
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
          <Box display="flex" alignItems="center">
            <TextField
              size="small"
              label="Search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
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
                      onClick={() => setSearchInput('')}
                      size="small"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null
              }}
              helperText="Type to search (no Enter needed)"
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
                onChange={e =>
                  filterKey === 'Lead Status' ? setFilterStatus(e.target.value) :
                  filterKey === 'Lead Source' ? setFilterSource(e.target.value) :
                  setFilterOwner(e.target.value)
                }
              >
                <MenuItem value="">All</MenuItem>
                {unique(filterKey).map(item => (
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
            {filteredLeads.map((lead, index) => (
              <TableRow key={index}>
                {visibleColumns.map((key, i) => (
                  <TableCell key={i}>{lead[key]}</TableCell>
                ))}
                <TableCell>
                  <IconButton onClick={() => setViewRow(lead)}><VisibilityIcon /></IconButton>
                  <IconButton onClick={() => setEditRow(lead)}><EditIcon /></IconButton>
                  <IconButton onClick={() => handleViewLogs(lead)}><HistoryIcon /></IconButton>
                  <IconButton onClick={() => handleOpenMeetingFromRow(lead, 'Lead')}><EventIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* View Modal */}
        <Dialog open={!!viewRow} onClose={() => setViewRow(null)} maxWidth="md" fullWidth>
          <DialogTitle>View Lead</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              {viewRow && Object.entries(viewRow).map(([key, value]) => (
                <Grid item xs={6} key={key}>
                  <TextField
                    fullWidth
                    size="small"
                    label={key}
                    value={value}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              ))}
            </Grid>
          </DialogContent>
        </Dialog>

        {/* Logs Modal */}
        <Dialog open={logsOpen} onClose={() => setLogsOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Lead Change Logs</DialogTitle>
          <DialogContent>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Lead Status</TableCell>
                  <TableCell>Lead Owner</TableCell>
                  <TableCell>Remarks</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leadLogs.map((log, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{log.Timestamp}</TableCell>
                    <TableCell>{log['Lead Status']}</TableCell>
                    <TableCell>{log['Lead Owner']}</TableCell>
                    <TableCell>{log['Remarks']}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={!!editRow} onClose={() => setEditRow(null)} maxWidth="md" fullWidth>
          <DialogTitle>Edit Lead</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              {editRow && Object.keys(editRow).map((key, i) => (
                <Grid item xs={6} key={i}>
                  {validationOptions[key] ? (
                    <FormControl fullWidth size="small">
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
                    />
                  )}
                </Grid>
              ))}
            </Grid>
            <Box mt={3} display="flex" justifyContent="flex-end">
              <Button variant="contained" sx={{ backgroundColor: '#6495ED' }} onClick={handleEditSubmit}>
                Save Changes
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
