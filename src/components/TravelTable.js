// Updated TravelTable.js aligned to LeadsTable.js UI/UX
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, FormControl,
  IconButton, Popover, Checkbox, Button, Grid, Dialog,
  DialogTitle, DialogContent, InputLabel
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';
import EditIcon from '@mui/icons-material/Edit';
import '@fontsource/montserrat';
import { useAuth } from './AuthContext';
import LoadingOverlay from './LoadingOverlay';
import ManageTravel from './ManageTravel';

const TravelTable = () => {
  const { user } = useAuth();
  const [travelData, setTravelData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [validationOptions, setValidationOptions] = useState({});
  const [logsOpen, setLogsOpen] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState([]);

  const storageKey = `visibleColumns-${user.username}-travel`;

  useEffect(() => {
    fetchData();
    fetchValidationOptions();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec?action=getTravelData&owner=${encodeURIComponent(user.username)}`);
      const result = await res.json();
      const filtered = user.role === 'Admin' ? result.rows : result.rows.filter(row => row['Requested By']?.toLowerCase() === user.username.toLowerCase());
      setHeaders(result.headers);
      setTravelData(filtered);
      const storedCols = JSON.parse(localStorage.getItem(storageKey));
      setVisibleColumns(storedCols || result.headers);
    } catch (err) {
      console.error('Error fetching travel data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchValidationOptions = async () => {
    try {
      const res = await fetch('https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec?action=getValidationOptions');
      const result = await res.json();
      setValidationOptions(result);
    } catch (err) {
      console.error('Error fetching validation options:', err);
    }
  };

  const handleSearch = () => setActiveSearch(searchInput);

  const handleFilterChange = (field, value) => setFilters(prev => ({ ...prev, [field]: value }));

  const handleColumnToggle = (col) => {
    const updated = visibleColumns.includes(col)
      ? visibleColumns.filter(c => c !== col)
      : [...visibleColumns, col];
    setVisibleColumns(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const handleSelectAll = () => {
    setVisibleColumns(headers);
    localStorage.setItem(storageKey, JSON.stringify(headers));
  };

  const handleDeselectAll = () => {
    setVisibleColumns([]);
    localStorage.setItem(storageKey, JSON.stringify([]));
  };

  const handleViewLogs = (row) => {
    const logs = travelData.filter(t => t['Travel ID'] === row['Travel ID']);
    setSelectedLogs(logs);
    setLogsOpen(true);
  };

  const filteredData = travelData.filter(row => {
    const matchSearch = Object.values(row).some(val => (val || '').toString().toLowerCase().includes(activeSearch.toLowerCase()));
    const matchFilters = Object.entries(filters).every(([k, v]) => !v || row[k] === v);
    return matchSearch && matchFilters;
  });

  return (
    <Box sx={{ fontFamily: 'Montserrat, sans-serif', p: 3 }}>
      {loading && <LoadingOverlay />}

      <Box display="flex" justifyContent="space-between" mb={2} alignItems="center">
        <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
        <Typography variant="h5" fontWeight="bold">Travel Requests</Typography>
        <Button variant="contained" startIcon={<AddCircleIcon />} onClick={() => setOpenForm(true)}>
          Add Travel
        </Button>
      </Box>

      <Grid container spacing={2} mb={2}>
        <Grid item>
          <TextField
            size="small"
            label="Search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            sx={{ minWidth: 240 }}
          />
          <IconButton onClick={handleSearch}><SearchIcon /></IconButton>
        </Grid>
        {["Travel Status", "Approval Status", "Department", "Travel Type"].map(key => (
          <Grid item key={key}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>{key}</InputLabel>
              <Select
                value={filters[key] || ''}
                onChange={(e) => handleFilterChange(key, e.target.value)}
                label={key}
              >
                <MenuItem value="">All</MenuItem>
                {validationOptions[key?.toLowerCase().replace(/ /g, '')]?.map(option => (
                  <MenuItem key={option} value={option}>{option}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        ))}
        <Grid item>
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}><ViewColumnIcon /></IconButton>
        </Grid>
      </Grid>

      <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
        <Box p={2} sx={{ fontFamily: 'Montserrat, sans-serif', fontSize: 8 }}>
          <Button size="small" onClick={handleSelectAll}>Select All</Button>
          <Button size="small" onClick={handleDeselectAll}>Deselect All</Button>
          {headers.map(col => (
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

      <Table size="small">
        <TableHead>
          <TableRow sx={{ backgroundColor: '#6495ED' }}>
            {visibleColumns.map(header => (
              <TableCell key={header} sx={{ color: 'white', fontWeight: 600 }}>{header}</TableCell>
            ))}
            <TableCell sx={{ color: 'white', fontWeight: 600 }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredData.map((row, idx) => (
            <TableRow key={idx}>
              {visibleColumns.map(col => (
                <TableCell key={col}>{row[col]}</TableCell>
              ))}
              <TableCell>
                <IconButton onClick={() => handleViewLogs(row)}><HistoryIcon fontSize="small" /></IconButton>
                <IconButton onClick={() => alert('✏️ Edit modal pending')}> <EditIcon fontSize="small" /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {openForm && (
        <Box mt={3}>
          <ManageTravel
            validationOptions={validationOptions}
            onClose={() => setOpenForm(false)}
            onSuccess={fetchData}
          />
        </Box>
      )}

      <Dialog open={logsOpen} onClose={() => setLogsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Travel Logs</DialogTitle>
        <DialogContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>Travel Status</TableCell>
                <TableCell>Approval Status</TableCell>
                <TableCell>Remarks / Justification</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {selectedLogs.map((log, idx) => (
                <TableRow key={idx}>
                  <TableCell>{log.Timestamp}</TableCell>
                  <TableCell>{log['Travel Status']}</TableCell>
                  <TableCell>{log['Approval Status']}</TableCell>
                  <TableCell>{log['Remarks / Justification']}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default TravelTable;
