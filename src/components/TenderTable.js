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
      **setLoading(false);** // ✅ ADD THIS HERE
    })
    .catch(err => {
      console.error('❌ Tender data fetch error:', err);
      setLoading(false); // ✅ Ensure loading is cleared on error too
    });

  fetch(dataUrl + '?action=dropdowns')
    .then(res => res.json())
    .then(setValidationOptions)
    .catch(err => console.error('❌ Dropdown fetch error:', err));
}, [user.username, user.role]);


  const handleColumnToggle = (col) => {
    setVisibleColumns(prev => {
      const updated = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
      localStorage.setItem(`visibleColumns-${user.username}-tenders`, JSON.stringify(updated));
      return updated;
    });
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

  const handleViewLogs = (row) => {
    const key = row['Bid Number'];
    const logs = allTenders.filter(item => item['Bid Number'] === key);
    setTenderLogs(logs);
    setLogsOpen(true);
  };

  const handleUpdateChange = (e) => {
    const { name, value } = e.target;
    setEditRow(prev => ({ ...prev, [name]: value }));
  };

  if (loading) return <LoadingOverlay />;

  return (
    <ThemeProvider theme={theme}>
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
              <Button size="small" onClick={() => setVisibleColumns(Object.keys(tenders[0]))}>Select All</Button>
              <Button size="small" onClick={() => setVisibleColumns([])}>Deselect All</Button>
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
                  <TableCell key={i}>{row[key]}</TableCell>
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
                    value={value}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              ))}
            </Grid>
          </DialogContent>
        </Dialog>

        {/* View Logs */}
        <Dialog open={logsOpen} onClose={() => setLogsOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Tender Logs</DialogTitle>
          <DialogContent>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Tender Status</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Tender Remarks</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tenderLogs.map((log, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{log.Timestamp}</TableCell>
                    <TableCell>{log['Tender Status']}</TableCell>
                    <TableCell>{log['Owner']}</TableCell>
                    <TableCell>{log['Tender Remarks']}</TableCell>
                  </TableRow>
                ))}
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
    </ThemeProvider>
  );
};

export default TenderTable;
