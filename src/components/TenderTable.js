// Updated TenderTable.js with full LeadsTable parity
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Grid, Checkbox, Button, Popover,
  FormControlLabel
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import VisibilityIcon from '@mui/icons-material/Visibility';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import '@fontsource/montserrat';
import { useAuth } from './AuthContext';
import LoadingOverlay from './LoadingOverlay'; // Adjust path if needed

// ✅ ADDED: MUI Date Picker imports
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

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

// ✅ ADDED: small table styling for logs (simple + readable)
const logTableSx = {
  '& .MuiTableCell-root': {
    fontSize: 9,
    padding: '6px 8px',
    verticalAlign: 'top'
  }
};

const TenderTable = () => {
  const { user } = useAuth();
  const [allTenders, setAllTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tenders, setTenders] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [validationOptions, setValidationOptions] = useState({});
  const [viewRow, setViewRow] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [tenderLogs, setTenderLogs] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', ministry: '', bidType: '' });

  // ✅ ADDED: full log column selection + diff toggle
  const [logVisibleColumns, setLogVisibleColumns] = useState([]);
  const [logColAnchorEl, setLogColAnchorEl] = useState(null);
  const [showOnlyChanges, setShowOnlyChanges] = useState(true);

  const dataUrl = 'https://script.google.com/macros/s/AKfycbyJqBc20hrZLKiPuKanwxDhqqbeqWW7-8x57Kvwjuep0bzRzRbDtD2wnuA1-VjaP1QfHQ/exec';

  useEffect(() => {
    fetch(dataUrl)
      .then(res => res.json())
      .then(data => {
        const filteredData = user.role === 'End User'
          ? data.filter(row => row['Owner'] === user.username)
          : data;

        setAllTenders(filteredData);

        const deduped = [];
        const seen = new Map();
        filteredData.forEach(row => {
          const key = row['Bid Number'];
          const existing = seen.get(key);
          if (!existing || new Date(row.Timestamp) > new Date(existing.Timestamp)) {
            seen.set(key, row);
          }
        });
        seen.forEach(v => deduped.push(v));
        setTenders(deduped);
        setVisibleColumns(
          JSON.parse(localStorage.getItem(`visibleColumns-${user.username}-tenders`)) ||
          (deduped.length ? Object.keys(deduped[0]) : [])
        );
        setLoading(false);
      })
      .catch(err => {
        console.error('❌ Tender data fetch error:', err);
        setLoading(false);
      });

    fetch(dataUrl + '?action=dropdowns')
      .then(res => res.json())
      .then(setValidationOptions)
      .catch(err => console.error('❌ Dropdown fetch error:', err));
  }, [user.username, user.role]);

  // ✅ missing handler (your code calls handleFilterChange but it wasn't defined)
  const handleFilterChange = (filterKey, value) => {
    setFilters(prev => {
      if (filterKey === 'Tender Status') return { ...prev, status: value };
      if (filterKey === 'Ministry/State Name') return { ...prev, ministry: value };
      if (filterKey === 'Bid Type') return { ...prev, bidType: value };
      return prev;
    });
  };

  const handleColumnToggle = (col) => {
    setVisibleColumns(prev => {
      const updated = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
      localStorage.setItem(`visibleColumns-${user.username}-tenders`, JSON.stringify(updated));
      return updated;
    });
  };

  // ✅ log column toggle
  const handleLogColumnToggle = (col) => {
    setLogVisibleColumns(prev => {
      const updated = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
      localStorage.setItem(`logVisibleColumns-${user.username}-tenders`, JSON.stringify(updated));
      return updated;
    });
  };

  // ✅ detect date fields
  const isDateField = (fieldName) => /date/i.test(fieldName);

  // ✅ UPDATED: One formatter for all cell values (fixes ISO date strings too)
  const formatValue = (key, value) => {
    if (value === null || value === undefined) return '';

    // If GAS returns Date objects (rare in JSON), handle
    if (Object.prototype.toString.call(value) === '[object Date]') {
      const d = new Date(value);
      if (!isNaN(d)) {
        if (key === 'Timestamp') {
          return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
        }
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }

    const str = String(value).trim();
    if (!str) return '';

    // Timestamp: prefer date+time
    if (key === 'Timestamp') {
      const d = new Date(str);
      if (!isNaN(d)) {
        return d.toLocaleString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
          hour12: false
        });
      }
      return str;
    }

    // ISO date string like 2025-07-10T18:30:00.000Z
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(str)) {
      const d = new Date(str);
      if (!isNaN(d)) {
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }

    // If the column name looks like a date field, try to parse more aggressively
    if (isDateField(key)) {
      // dd/MM/yyyy (your standard)
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
        const d = dayjs(str, 'DD/MM/YYYY', true);
        if (d.isValid()) return d.format('DD MMM YYYY');
      }

      // yyyy-MM-dd (common)
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const d = dayjs(str, 'YYYY-MM-DD', true);
        if (d.isValid()) return d.format('DD MMM YYYY');
      }

      // try Date constructor
      const d2 = new Date(str);
      if (!isNaN(d2)) {
        return d2.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }

    return str;
  };

  const filteredTenders = tenders.filter(row => {
    return (
      (!filters.status || row['Tender Status'] === filters.status) &&
      (!filters.ministry || row['Ministry/State Name'] === filters.ministry) &&
      (!filters.bidType || row['Bid Type'] === filters.bidType) &&
      Object.values(row).some(val => (val || '').toString().toLowerCase().includes(activeSearch.toLowerCase()))
    );
  });

  const unique = (key) => [...new Set(tenders.map(d => d[key]).filter(Boolean))];

  const handleEditSubmit = async () => {
    const updated = {
      ...editRow,
      'Tender Updated Time': new Date().toLocaleString('en-GB', { hour12: false })
    };
    try {
      await fetch(dataUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      alert('✅ Tender updated successfully');
      setEditRow(null);
    } catch {
      alert('❌ Error updating tender');
    }
  };

  // logs compute columns & sort
  const handleViewLogs = (row) => {
    const key = row['Bid Number'];
    const logs = allTenders
      .filter(item => item['Bid Number'] === key)
      .slice()
      .sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp)); // oldest -> newest

    setTenderLogs(logs);

    const allCols = logs.length ? Object.keys(logs[logs.length - 1]) : [];
    const saved = JSON.parse(localStorage.getItem(`logVisibleColumns-${user.username}-tenders`));
    setLogVisibleColumns(saved || allCols);

    setShowOnlyChanges(true);
    setLogsOpen(true);
  };

  const handleUpdateChange = (e) => {
    const { name, value } = e.target;
    setEditRow(prev => ({ ...prev, [name]: value }));
  };

  // date picker handler for edit modal
  const handleEditDateChange = (field, newValue) => {
    const formatted = newValue ? dayjs(newValue).format('DD/MM/YYYY') : '';
    setEditRow(prev => ({ ...prev, [field]: formatted }));
  };

  // compute per-row changed fields vs previous row
  const computeChanges = (prevRow, currRow, cols) => {
    if (!prevRow) return cols;
    return cols.filter((col) => {
      const a = (prevRow?.[col] ?? '').toString();
      const b = (currRow?.[col] ?? '').toString();
      return a !== b;
    });
  };

  if (loading) return <LoadingOverlay />;

  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box p={4}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
            <Typography variant="h5" fontWeight="bold">Tender Records</Typography>
          </Box>

          <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
            <Box display="flex" alignItems="center">
              <TextField
                size="small"
                label="Search"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setActiveSearch(searchInput); }}
                sx={{ minWidth: 240 }}
              />
              <IconButton onClick={() => setActiveSearch(searchInput)} sx={{ ml: 1 }}>
                <SearchIcon />
              </IconButton>
            </Box>

            {['Tender Status', 'Ministry/State Name', 'Bid Type'].map(filterKey => (
              <FormControl size="small" sx={{ minWidth: 160 }} key={filterKey}>
                <InputLabel>{filterKey}</InputLabel>
                <Select
                  value={filters[filterKey === 'Tender Status' ? 'status' : filterKey === 'Ministry/State Name' ? 'ministry' : 'bidType']}
                  label={filterKey}
                  onChange={e => handleFilterChange(filterKey, e.target.value)}
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
                <Button
                  size="small"
                  onClick={() => {
                    if (!tenders[0]) return;
                    const cols = Object.keys(tenders[0]);
                    setVisibleColumns(cols);
                    localStorage.setItem(`visibleColumns-${user.username}-tenders`, JSON.stringify(cols));
                  }}
                >
                  Select All
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setVisibleColumns([]);
                    localStorage.setItem(`visibleColumns-${user.username}-tenders`, JSON.stringify([]));
                  }}
                >
                  Deselect All
                </Button>
                {Object.keys(tenders[0] || {}).map(col => (
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
                  <TableCell key={header} style={{ color: 'white', cursor: 'pointer' }}>{header}</TableCell>
                ))}
                <TableCell style={{ color: 'white' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTenders.map((row, index) => (
                <TableRow key={index}>
                  {visibleColumns.map((key, i) => (
                    <TableCell key={i}>
                      {formatValue(key, row[key])}
                    </TableCell>
                  ))}
                  <TableCell>
                    <IconButton onClick={() => setViewRow(row)}><VisibilityIcon /></IconButton>
                    <IconButton onClick={() => setEditRow(row)}><EditIcon /></IconButton>
                    <IconButton onClick={() => handleViewLogs(row)}><HistoryIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* View Modal */}
          <Dialog open={!!viewRow} onClose={() => setViewRow(null)} maxWidth="md" fullWidth>
            <DialogTitle>View Tender</DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2}>
                {viewRow && Object.entries(viewRow).map(([key, value]) => (
                  <Grid item xs={6} key={key}>
                    <TextField
                      fullWidth
                      size="small"
                      label={key}
                      value={formatValue(key, value)}
                      InputProps={{ readOnly: true }}
                    />
                  </Grid>
                ))}
              </Grid>
            </DialogContent>
          </Dialog>

          {/* View Logs */}
          <Dialog open={logsOpen} onClose={() => setLogsOpen(false)} maxWidth="xl" fullWidth>
            <DialogTitle>Tender Logs</DialogTitle>
            <DialogContent dividers>
              {/* Controls */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5} flexWrap="wrap" gap={1}>
                <FormControlLabel
                  sx={{ m: 0 }}
                  control={
                    <Checkbox
                      checked={showOnlyChanges}
                      onChange={(e) => setShowOnlyChanges(e.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography sx={{ fontSize: 10 }}>Show only changed fields</Typography>}
                />

                <Button
                  size="small"
                  startIcon={<ViewColumnIcon />}
                  onClick={(e) => setLogColAnchorEl(e.currentTarget)}
                  variant="outlined"
                  sx={{ fontSize: 10 }}
                >
                  Columns
                </Button>

                <Popover
                  open={Boolean(logColAnchorEl)}
                  anchorEl={logColAnchorEl}
                  onClose={() => setLogColAnchorEl(null)}
                >
                  <Box padding={2} sx={selectorStyle} minWidth={260}>
                    <Button
                      size="small"
                      onClick={() => {
                        const cols = tenderLogs.length ? Object.keys(tenderLogs[tenderLogs.length - 1]) : [];
                        setLogVisibleColumns(cols);
                        localStorage.setItem(`logVisibleColumns-${user.username}-tenders`, JSON.stringify(cols));
                      }}
                    >
                      Select All
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        setLogVisibleColumns([]);
                        localStorage.setItem(`logVisibleColumns-${user.username}-tenders`, JSON.stringify([]));
                      }}
                    >
                      Deselect All
                    </Button>

                    {(tenderLogs.length ? Object.keys(tenderLogs[tenderLogs.length - 1]) : []).map(col => (
                      <Box key={col}>
                        <Checkbox
                          size="small"
                          checked={logVisibleColumns.includes(col)}
                          onChange={() => handleLogColumnToggle(col)}
                        /> {col}
                      </Box>
                    ))}
                  </Box>
                </Popover>
              </Box>

              {/* Full logs table with simple diff (no bold everywhere) */}
              <Table size="small" sx={logTableSx}>
                <TableHead>
                  <TableRow style={{ backgroundColor: '#f7f9ff' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Version</TableCell>
                    {logVisibleColumns.map(col => (
                      <TableCell key={col} sx={{ fontWeight: 700 }}>
                        {col}
                      </TableCell>
                    ))}
                    <TableCell sx={{ fontWeight: 700 }}>Changed Fields</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {tenderLogs.map((log, idx) => {
                    const prev = idx > 0 ? tenderLogs[idx - 1] : null;
                    const changedCols = computeChanges(prev, log, logVisibleColumns);

                    return (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontSize: 9 }}>{idx + 1}</TableCell>

                        {logVisibleColumns.map(col => {
                          const isChanged = changedCols.includes(col);
                          const value = formatValue(col, log[col]);

                          // If showOnlyChanges is ON, blank out unchanged fields (but keep columns)
                          const displayValue = showOnlyChanges && prev && !isChanged ? '' : (value ?? '');

                          return (
                            <TableCell
                              key={col}
                              sx={
                                isChanged
                                  ? {
                                      borderLeft: '3px solid #6495ED',
                                      backgroundColor: '#f0f6ff' // subtle highlight, no bold
                                    }
                                  : undefined
                              }
                            >
                              {displayValue}
                            </TableCell>
                          );
                        })}

                        <TableCell sx={{ fontSize: 9 }}>
                          {prev ? changedCols.join(', ') : 'Initial Entry'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </DialogContent>
          </Dialog>

          {/* Edit Modal */}
          <Dialog open={!!editRow} onClose={() => setEditRow(null)} maxWidth="md" fullWidth>
            <DialogTitle>Edit Tender</DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2}>
                {editRow && Object.keys(editRow).map((key, i) => (
                  <Grid item xs={6} key={i}>
                    {validationOptions[key] ? (
                      <FormControl fullWidth size="small">
                        <InputLabel>{key}</InputLabel>
                        <Select
                          name={key}
                          value={editRow[key] || ''}
                          onChange={handleUpdateChange}
                          label={key}
                        >
                          {validationOptions[key].map((opt, idx) => (
                            <MenuItem key={idx} value={opt}>{opt}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : isDateField(key) ? (
                      <DatePicker
                        label={key}
                        value={editRow[key] ? dayjs(editRow[key], 'DD/MM/YYYY') : null}
                        onChange={(newValue) => handleEditDateChange(key, newValue)}
                        format="DD/MM/YYYY"
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: "small"
                          }
                        }}
                      />
                    ) : (
                      <TextField
                        fullWidth
                        label={key}
                        name={key}
                        value={editRow[key] || ''}
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
        </Box>
      </LocalizationProvider>
    </ThemeProvider>
  );
};

export default TenderTable;
