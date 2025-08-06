// TravelTable.js
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Grid, Checkbox, Button, Popover
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';
import FlightTakeoff from '@mui/icons-material/FlightTakeoff';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import '@fontsource/montserrat';
import LoadingOverlay from './LoadingOverlay';
import { useAuth } from './AuthContext';


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

const TravelTable = () => {
  const [travels, setTravels] = useState([]);
  const [allTravels, setAllTravels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTravel, setNewTravel] = useState({});
  const [fieldList, setFieldList] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });

  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterApproval, setFilterApproval] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterType, setFilterType] = useState('');
  const [viewRow, setViewRow] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [travelLogs, setTravelLogs] = useState([]);

  const { user } = useAuth();
  const loginUsername = user?.loginUsername || user?.username;
  const role = user?.role;

  const dataUrl = 'https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${dataUrl}?action=getTravelData&owner=${encodeURIComponent(loginUsername)}`);
        const { rows } = await res.json();
        const filteredData = role === 'End User'
          ? rows.filter(entry => entry['Requested By'] === loginUsername)
          : rows;
        const seen = new Map();
        filteredData.forEach(row => {
          const key = row['Travel ID'];
          const existing = seen.get(key);
          if (!existing || new Date(row.Timestamp) > new Date(existing.Timestamp)) {
            seen.set(key, row);
          }
        });
        const deduped = Array.from(seen.values());
        setTravels(deduped);
        setAllTravels(filteredData);
        setVisibleColumns(Object.keys(deduped[0] || {}));
      } catch (err) {
        console.error('❌ Error fetching travel data:', err.message);
        alert('Failed to fetch travel data.');
      } finally {
        setLoading(false);
      }
    };

    const fetchFieldList = async () => {
      try {
        const res = await fetch(`${dataUrl}?action=getTravelFields`);
        const data = await res.json();
        setFieldList(data.headers || []);
      } catch (err) {
        console.error('❌ Error fetching travel fields:', err.message);
      }
    };

    fetchData();
    fetchFieldList();
  }, [loginUsername, role]);

  const handleOpenAddModal = () => {
    const defaultData = {};
    fieldList.forEach(f => defaultData[f] = '');
    defaultData['Requested By'] = loginUsername;
    setNewTravel(defaultData);
    setAddModalOpen(true);
  };

  const handleCloseAddModal = () => setAddModalOpen(false);

  const handleAddChange = (e) => {
    const { name, value } = e.target;
    setNewTravel(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSubmit = async () => {
    const newEntry = {
      ...newTravel,
      'Travel ID': `TRAVEL-${Date.now()}`,
      'Timestamp': new Date().toLocaleString('en-GB', { hour12: false }),
      'Update Travel': 'Yes'
    };
    try {
      await fetch(dataUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry)
      });
      alert('✅ Travel request submitted');
      setAddModalOpen(false);
      window.location.reload();
    } catch {
      alert('❌ Failed to submit travel');
    }
  };

  const handleColumnToggle = (col) => {
    setVisibleColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
    const sorted = [...travels].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setTravels(sorted);
  };

  const unique = (key) => [...new Set(allTravels.map(item => item[key]).filter(Boolean))];

  const filteredTravels = travels.filter(row =>
    (!filterStatus || row['Travel Status'] === filterStatus) &&
    (!filterApproval || row['Approval Status'] === filterApproval) &&
    (!filterDepartment || row['Department'] === filterDepartment) &&
    (!filterType || row['Travel Type'] === filterType) &&
    (!activeSearch || Object.values(row).join(' ').toLowerCase().includes(activeSearch.toLowerCase()))
  );

  const handleViewLogs = (row) => {
    const logs = allTravels.filter(r => r['Travel ID'] === row['Travel ID']);
    const sorted = logs.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
    setTravelLogs(sorted);
    setLogsOpen(true);
  };


  return (
    <ThemeProvider theme={theme}>
      {loading && <LoadingOverlay />}
      <Box padding={4}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
          <Button
            variant="contained"
            startIcon={<FlightTakeoff />}
            onClick={handleOpenAddModal}
            sx={{ fontFamily: 'Montserrat, sans-serif', backgroundColor: '#6495ED' }}
          >
            Add Travel
          </Button>
        </Box>

        {/* Add Travel Modal */}
        <Dialog open={addModalOpen} onClose={handleCloseAddModal} maxWidth="md" fullWidth>
          <DialogTitle>Add Travel Request</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              {fieldList.map((field, idx) => (
                <Grid item xs={6} key={idx}>
                  <TextField
                    fullWidth
                    label={field}
                    name={field}
                    value={newTravel[field] || ''}
                    onChange={handleAddChange}
                    size="small"
                  />
                </Grid>
              ))}
            </Grid>
            <Box mt={2} display="flex" justifyContent="flex-end">
              <Button variant="contained" sx={{ backgroundColor: '#6495ED' }} onClick={handleAddSubmit}>
                Submit
              </Button>
            </Box>
          </DialogContent>
        </Dialog>

        {/* Filters and Column Selector */}
        <Box display="flex" gap={2} flexWrap="wrap" mb={2} alignItems="center">
          <Box display="flex" alignItems="center">
            <TextField
              size="small"
              label="Search"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setActiveSearch(searchInput)}
              sx={{ minWidth: 240 }}
            />
            <IconButton onClick={() => setActiveSearch(searchInput)}><SearchIcon /></IconButton>
          </Box>

          {[['Travel Status', filterStatus, setFilterStatus], ['Approval Status', filterApproval, setFilterApproval], ['Department', filterDepartment, setFilterDepartment], ['Travel Type', filterType, setFilterType]].map(([label, val, setter]) => (
            <FormControl size="small" sx={{ minWidth: 160 }} key={label}>
              <InputLabel>{label}</InputLabel>
              <Select value={val} label={label} onChange={e => setter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {unique(label).map(item => (
                  <MenuItem key={item} value={item}>{item}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}><ViewColumnIcon /></IconButton>
          <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
            <Box padding={2} sx={selectorStyle}>
              <Button size="small" onClick={() => setVisibleColumns(Object.keys(travels[0] || {}))}>Select All</Button>
              <Button size="small" onClick={() => setVisibleColumns([])}>Deselect All</Button>
              {Object.keys(travels[0] || {}).map(col => (
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

        {/* Travel Table */}
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
            {filteredTravels.map((row, index) => (
              <TableRow key={index}>
                {visibleColumns.map((key, i) => (
                  <TableCell key={i}>{row[key]}</TableCell>
                ))}
                <TableCell>  
                  <IconButton onClick={() => setEditRow(row)}><EditIcon /></IconButton>
                  <IconButton onClick={() => setViewRow(row)}><VisibilityIcon /></IconButton>
                  <IconButton onClick={() => handleViewLogs(row)}><HistoryIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* View Modal */}
        <Dialog open={!!viewRow} onClose={() => setViewRow(null)} maxWidth="md" fullWidth>
          <DialogTitle>View Travel</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              {viewRow && Object.entries(viewRow).map(([key, value]) => (
                <Grid item xs={6} key={key}>
                  <TextField fullWidth size="small" label={key} value={value} InputProps={{ readOnly: true }} />
                </Grid>
              ))}
            </Grid>
          </DialogContent>
        </Dialog>

        {/* Logs Modal */}
        <Dialog open={logsOpen} onClose={() => setLogsOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Travel Logs</DialogTitle>
          <DialogContent>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Requested By</TableCell>
                  <TableCell>Travel Status</TableCell>
                  <TableCell>Approval Status</TableCell>
                  <TableCell>Remarks / Justification</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {travelLogs.map((log, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{log.Timestamp}</TableCell>
                    <TableCell>{log['Requested By']}</TableCell>
                    <TableCell>{log['Travel Status']}</TableCell>
                    <TableCell>{log['Approval Status']}</TableCell>
                    <TableCell>{log['Remarks / Justification']}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={!!editRow} onClose={() => setEditRow(null)} maxWidth="md" fullWidth>
          <DialogTitle>Edit Travel</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              {editRow && Object.keys(editRow).map((key, i) => (
                <Grid item xs={6} key={i}>
                  <TextField
                    fullWidth
                    label={key}
                    name={key}
                    value={editRow[key]}
                    onChange={handleUpdateChange}
                    size="small"
                  />
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

export default TravelTable;
