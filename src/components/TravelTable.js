// Unified TravelTable.js with integrated ManageTravel modal
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, TextField, Select,
  MenuItem, FormControl, InputLabel, IconButton, Popover, Checkbox, Button, Grid,
  Dialog, DialogTitle, DialogContent, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import '@fontsource/montserrat';
import { useAuth } from './AuthContext';

const inputStyle = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: '0.9rem',
  width: '100%'
};

const TravelTable = () => {
  const { user } = useAuth();
  const [travelData, setTravelData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleCols, setVisibleCols] = useState([]);
  const [validationOptions, setValidationOptions] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  const fetchTravelData = async () => {
    try {
      const res = await fetch(`https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec?action=getTravelData&owner=${encodeURIComponent(user.username)}`);
      const json = await res.json();
      setTravelData(json.rows);
      setHeaders(json.headers);
      setVisibleCols(json.headers);
    } catch (err) {
      console.error('Error fetching travel data:', err);
    }
  };

  const fetchValidationOptions = async () => {
    try {
      const res = await fetch(`https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec?action=getValidationOptions`);
      const json = await res.json();
      setValidationOptions(json);
    } catch (err) {
      console.error('Error fetching validation options:', err);
    }
  };

  useEffect(() => {
    fetchTravelData();
    fetchValidationOptions();
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const filteredRows = travelData.filter(row => {
    return Object.entries(filters).every(([field, value]) =>
      !value || row[field] === value
    ) &&
    headers.some(h => row[h]?.toLowerCase().includes(search.toLowerCase()));
  });

  const handleModalOpen = (row = null) => {
    setSelectedRow(row);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedRow(null);
  };

  const handleSubmit = async (formData) => {
    try {
      const res = await fetch(`https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await res.json();
      if (result.success) {
        fetchTravelData();
        handleModalClose();
      } else {
        alert('Error submitting travel entry');
      }
    } catch (err) {
      console.error('Submission error:', err);
    }
  };

  const groupedSections = {
    'Traveler Info': ['Requested By', 'Department', 'Designation'],
    'Travel Details': ['Travel Type', 'Travel Purpose', 'Destination', 'Start Date', 'End Date', 'Mode of Travel'],
    'Booking & Budget': ['Preferred Airline / Train / Service', 'Accommodation Required', 'Hotel Preference', 'Expected Budget (₹)', 'Final Amount Spent (₹)', 'Supporting Documents (Link)'],
    'Approval & Status': ['Approval Status', 'Approved By', 'Travel Status', 'Remarks / Justification', 'Booking Confirmation Details', 'Expense Settlement Status']
  };

  return (
    <Box sx={{ p: 2, fontFamily: 'Montserrat, sans-serif' }}>
      <Typography variant="h6">Travel Management</Typography>
      <Box display="flex" gap={2} alignItems="center" my={2}>
        <TextField
          variant="outlined"
          size="small"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <SearchIcon /> }}
          sx={{ minWidth: 160 }}
        />
        {['Travel Status', 'Approval Status', 'Department', 'Travel Type'].map(field => (
          <FormControl key={field} size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{field}</InputLabel>
            <Select
              value={filters[field] || ''}
              onChange={e => handleFilterChange(field, e.target.value)}
              label={field}
            >
              <MenuItem value="">All</MenuItem>
              {[...(new Set(travelData.map(row => row[field]).filter(Boolean)))].map(opt => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </Select>
          </FormControl>
        ))}
        <Button variant="contained" sx={{ marginLeft: 'auto' }} onClick={() => handleModalOpen()}>Add Travel</Button>
      </Box>

      <Table size="small">
        <TableHead>
          <TableRow>
            {headers.filter(h => visibleCols.includes(h)).map(h => (
              <TableCell key={h}>{h}</TableCell>
            ))}
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredRows.map((row, idx) => (
            <TableRow key={idx}>
              {headers.filter(h => visibleCols.includes(h)).map(h => (
                <TableCell key={h}>{row[h]}</TableCell>
              ))}
              <TableCell>
                <IconButton onClick={() => handleModalOpen(row)}><EditIcon /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={modalOpen} onClose={handleModalClose} maxWidth="md" fullWidth>
        <DialogTitle>{selectedRow ? 'Edit Travel' : 'Add Travel'}</DialogTitle>
        <DialogContent>
          {Object.entries(groupedSections).map(([section, fields]) => (
            <Accordion key={section} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#f0f4ff' }}>
                <Typography sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>{section}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {fields.map(field => {
                    const isDropdown = Object.keys(validationOptions).includes(field);
                    const value = selectedRow?.[field] || (field === 'Requested By' ? user.username : '');
                    return (
                      <Grid item xs={12} sm={6} key={field}>
                        {isDropdown ? (
                          <FormControl fullWidth>
                            <InputLabel>{field}</InputLabel>
                            <Select
                              value={value}
                              label={field}
                              onChange={e => setSelectedRow(prev => ({ ...prev, [field]: e.target.value }))}
                            >
                              {validationOptions[field].map(opt => (
                                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : (
                          <TextField
                            label={field}
                            fullWidth
                            value={value}
                            onChange={e => setSelectedRow(prev => ({ ...prev, [field]: e.target.value }))}
                            sx={inputStyle}
                          />
                        )}
                      </Grid>
                    );
                  })}
                </Grid>
              </AccordionDetails>
            </Accordion>
          ))}
          <Box textAlign="right" mt={2}>
            <Button variant="contained" onClick={() => handleSubmit(selectedRow || { 'Requested By': user.username })}>
              {selectedRow ? 'Update' : 'Submit'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default TravelTable;

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
    <ThemeProvider theme={theme}>
      <Box sx={{ fontFamily: 'Montserrat, sans-serif', p: 3 }}>
        {loading && <LoadingOverlay />}

        <Box display="flex" justifyContent="space-between" mb={2} alignItems="center">
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
          <Typography variant="h5" fontWeight="bold">Travel Requests</Typography>
          <Button variant="contained" startIcon={<AddCircleIcon />} onClick={() => {
            setSelectedRow(null);
            setIsEdit(false);
            setOpenForm(true);
          }}>Add Travel</Button>
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
            <Button size="small" onClick={() => {
              setVisibleColumns(headers);
              localStorage.setItem(storageKey, JSON.stringify(headers));
            }}>Select All</Button>
            <Button size="small" onClick={() => {
              setVisibleColumns([]);
              localStorage.setItem(storageKey, JSON.stringify([]));
            }}>Deselect All</Button>
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
                  <IconButton onClick={() => {
                    setSelectedRow(row);
                    setIsEdit(true);
                    setOpenForm(true);
                  }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {openForm && (
          <Dialog open onClose={() => setOpenForm(false)} maxWidth="md" fullWidth>
            <DialogContent>
              <ManageTravel
                validationOptions={validationOptions}
                selectedRow={selectedRow}
                isEdit={isEdit}
                onClose={() => setOpenForm(false)}
                onSuccess={fetchData}
              />
            </DialogContent>
          </Dialog>
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
    </ThemeProvider>
  );
};

export default TravelTable;
