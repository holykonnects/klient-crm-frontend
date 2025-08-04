// src/components/TravelTable.js
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, Select, MenuItem, InputLabel, FormControl, IconButton,
  Dialog, DialogTitle, DialogContent, Grid, Button, Popover, Checkbox,
  FormControlLabel
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import SearchIcon from '@mui/icons-material/Search';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import '@fontsource/montserrat';
import ManageTravel from './ManageTravel';
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
  const { user } = useAuth();
  const [travelData, setTravelData] = useState([]);
  const [filters, setFilters] = useState({
    travelStatus: '',
    approvalStatus: '',
    department: '',
    travelType: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [columnAnchor, setColumnAnchor] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [validationOptions, setValidationOptions] = useState({});

  const allColumns = [
    'Travel ID', 'Requested By', 'Department', 'Designation', 'Travel Type', 'Travel Purpose',
    'Destination', 'Start Date', 'End Date', 'Mode of Travel', 'Accommodation Required',
    'Approval Status', 'Approved By', 'Travel Status'
  ];

  useEffect(() => {
    fetchData();
    fetchValidationOptions();
    const storedCols = JSON.parse(localStorage.getItem('travelVisibleColumns'));
    setVisibleColumns(storedCols || allColumns);
  }, []);

  const fetchData = async () => {
    const url = `https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec
?action=getTravelData&owner=${user?.username || ''}`;
    const res = await fetch(url);
    const json = await res.json();
    setTravelData(json.data || []);
  };

  const fetchValidationOptions = async () => {
    const url = `https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec
?action=getValidationOptions`;
    const res = await fetch(url);
    const json = await res.json();
    setValidationOptions(json);
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearch = (row) => {
    return (
      row['Travel ID']?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row['Requested By']?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row['Destination']?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const handleColumnToggle = (column) => {
    const updated = visibleColumns.includes(column)
      ? visibleColumns.filter(col => col !== column)
      : [...visibleColumns, column];
    setVisibleColumns(updated);
    localStorage.setItem('travelVisibleColumns', JSON.stringify(updated));
  };

  const filteredData = travelData
    .filter(row => {
      return (!filters.travelStatus || row['Travel Status'] === filters.travelStatus) &&
             (!filters.approvalStatus || row['Approval Status'] === filters.approvalStatus) &&
             (!filters.department || row['Department'] === filters.department) &&
             (!filters.travelType || row['Travel Type'] === filters.travelType);
    })
    .filter(handleSearch);

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', fontFamily: 'Montserrat' }}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 30, marginRight: 10 }} />
          Travel Management
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search Travel ID / Name / Destination"
            InputProps={{ startAdornment: <SearchIcon /> }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {['travelStatus', 'approvalStatus', 'department', 'travelType'].map((filterKey) => (
            <FormControl key={filterKey} size="small">
              <InputLabel>{filterKey.replace(/([A-Z])/g, ' $1')}</InputLabel>
              <Select
                name={filterKey}
                value={filters[filterKey]}
                onChange={handleFilterChange}
                sx={{ fontFamily: 'Montserrat' }}
              >
                <MenuItem value="">All</MenuItem>
                {(validationOptions[filterKey] || []).map(option => (
                  <MenuItem key={option} value={option}>{option}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}
          <IconButton onClick={(e) => setColumnAnchor(e.currentTarget)}>
            <ViewColumnIcon />
          </IconButton>
          <Popover
            open={Boolean(columnAnchor)}
            anchorEl={columnAnchor}
            onClose={() => setColumnAnchor(null)}
          >
            <Box sx={{ p: 1 }}>
              {allColumns.map(column => (
                <FormControlLabel
                  key={column}
                  control={
                    <Checkbox
                      checked={visibleColumns.includes(column)}
                      onChange={() => handleColumnToggle(column)}
                      sx={selectorStyle}
                    />
                  }
                  label={<span style={selectorStyle}>{column}</span>}
                />
              ))}
            </Box>
          </Popover>
        </Box>

        <Table size="small">
          <TableHead>
            <TableRow>
              {allColumns.filter(col => visibleColumns.includes(col)).map((col) => (
                <TableCell key={col}>{col}</TableCell>
              ))}
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData.map((row, idx) => (
              <TableRow key={idx}>
                {allColumns.filter(col => visibleColumns.includes(col)).map((col) => (
                  <TableCell key={col}>{row[col]}</TableCell>
                ))}
                <TableCell>
                  <IconButton onClick={() => setSelectedRow(row)}><EditIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {selectedRow && (
          <Dialog open onClose={() => setSelectedRow(null)} maxWidth="md" fullWidth>
            <DialogTitle>Edit Travel Entry</DialogTitle>
            <DialogContent>
              <ManageTravel
                travelData={selectedRow}
                validationOptions={validationOptions}
                onClose={() => setSelectedRow(null)}
                onSuccess={fetchData}
              />
            </DialogContent>
          </Dialog>
        )}
      </Box>
    </ThemeProvider>
  );
};

export default TravelTable;
