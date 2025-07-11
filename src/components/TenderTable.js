import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Grid, Checkbox,
  Popover, FormControlLabel, Button
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useAuth } from './AuthContext';
import '@fontsource/montserrat';

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
  const [tenders, setTenders] = useState([]);
  const [filteredTenders, setFilteredTenders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    ministry: '',
    bidType: ''
  });

  const [validationOptions, setValidationOptions] = useState({});
  const [selectedTender, setSelectedTender] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    return JSON.parse(localStorage.getItem('tenderVisibleColumns')) || {};
  });

  const allColumns = [
    'Bid Number', 'Bid Start Date', 'Bid End Date', 'Ministry/State Name',
    'Organisation Name', 'Work Type', 'Bid Type', 'EMD Amount',
    'EMD Exemption Available', 'Tender Budget', 'Pre Bid Meeting Date',
    'Pre Bid Meeting Venue', 'Tender Conditions', 'Tender Status',
    'Tender Remarks', 'Notification Status'
  ];

  useEffect(() => {
    fetchTenderData();
    fetchValidationOptions();
  }, []);

  const fetchTenderData = async () => {
    const response = await fetch('https://script.google.com/macros/s/AKfycbyJqBc20hrZLKiPuKanwxDhqqbeqWW7-8x57Kvwjuep0bzRzRbDtD2wnuA1-VjaP1QfHQ/exec');
    const data = await response.json();

    const viewable = user.role === 'Admin'
      ? data
      : data.filter(row => row['Owner'] === user.username);

    setTenders(viewable);
    setFilteredTenders(viewable);
  };

  const fetchValidationOptions = async () => {
    const res = await fetch('https://script.google.com/macros/s/AKfycbyaSwpMpH0RCTQkgwzme0N5WYgNP9aERhQs7mQCFX3CvBBFARne_jsM5YW6L705TdET/exec');
    const data = await res.json();
    setValidationOptions(data['Tender Validation Table'] || {});
  };

  const handleSearch = (e) => {
    const value = e.target.value.toLowerCase();
    setSearchTerm(value);
    applyFilters(filters, value);
  };

  const handleFilterChange = (key, value) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    applyFilters(updated, searchTerm);
  };

  const applyFilters = (filters, search) => {
    const filtered = tenders.filter(row => {
      return (
        (!filters.status || row['Tender Status'] === filters.status) &&
        (!filters.ministry || row['Ministry/State Name'] === filters.ministry) &&
        (!filters.bidType || row['Bid Type'] === filters.bidType) &&
        Object.values(row).some(val =>
          val?.toString().toLowerCase().includes(search)
        )
      );
    });
    setFilteredTenders(filtered);
  };

  const handleOpenModal = (tender) => {
    setSelectedTender({ ...tender });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedTender(null);
  };

  const handleInputChange = (key, value) => {
    setSelectedTender(prev => ({ ...prev, [key]: value }));
  };

  const handleColumnToggle = (column) => {
    const updated = { ...visibleColumns, [column]: !visibleColumns[column] };
    setVisibleColumns(updated);
    localStorage.setItem('tenderVisibleColumns', JSON.stringify(updated));
  };

  const handleSave = () => {
    console.log('Updated Tender:', selectedTender);
    handleCloseModal();
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Tender Management</Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label="Search"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={handleSearch}
          />

          {['status', 'ministry', 'bidType'].map(key => (
            <FormControl key={key} size="small">
              <InputLabel>{key.charAt(0).toUpperCase() + key.slice(1)}</InputLabel>
              <Select
                value={filters[key]}
                onChange={(e) => handleFilterChange(key, e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {key === 'ministry'
                  ? [...new Set(tenders.map(t => t['Ministry/State Name']))].filter(Boolean).map((opt, idx) => (
                      <MenuItem key={idx} value={opt}>{opt}</MenuItem>
                    ))
                  : (validationOptions[
                      key === 'status' ? 'Tender Status' : 'Bid Type'
                    ] || []).map((opt, idx) => (
                      <MenuItem key={idx} value={opt}>{opt}</MenuItem>
                    ))}
              </Select>
            </FormControl>
          ))}

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <ViewColumnIcon sx={selectorStyle} />
          </IconButton>
        </Box>

        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Box sx={{ p: 2 }}>
            {allColumns.map(col => (
              <FormControlLabel
                key={col}
                control={
                  <Checkbox
                    checked={visibleColumns[col] ?? true}
                    onChange={() => handleColumnToggle(col)}
                    sx={selectorStyle}
                  />
                }
                label={<Typography sx={selectorStyle}>{col}</Typography>}
              />
            ))}
          </Box>
        </Popover>

        <Table size="small">
          <TableHead>
            <TableRow>
              {allColumns.map(col => (
                visibleColumns[col] ?? true
                  ? <TableCell key={col}>{col}</TableCell>
                  : null
              ))}
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTenders.map((row, index) => (
              <TableRow key={index}>
                {allColumns.map(col =>
                  visibleColumns[col] ?? true
                    ? <TableCell key={col}>{row[col]}</TableCell>
                    : null
                )}
                <TableCell>
                  <IconButton onClick={() => handleOpenModal(row)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="md" fullWidth>
          <DialogTitle>Edit Tender</DialogTitle>
          <DialogContent dividers>
            {selectedTender && (
              <Grid container spacing={2}>
                {allColumns.map(col => (
                  <Grid item xs={6} key={col}>
                    <TextField
                      label={col}
                      value={selectedTender[col] || ''}
                      fullWidth
                      onChange={(e) => handleInputChange(col, e.target.value)}
                    />
                  </Grid>
                ))}
                <Grid item xs={12}>
                  <Button variant="contained" onClick={handleSave}>Save</Button>
                </Grid>
              </Grid>
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
};

export default TenderTable;
