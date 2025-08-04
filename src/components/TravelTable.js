// TravelTable.js with dynamic columns and modal trigger
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Grid, Button,
  Popover, Checkbox, FormControlLabel
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import SearchIcon from '@mui/icons-material/Search';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import '@fontsource/montserrat';
import ManageTravel from './ManageTravel';
import { useAuth } from './AuthContext';
import LoadingOverlay from './LoadingOverlay';

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
  const [allColumns, setAllColumns] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [filters, setFilters] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [columnAnchor, setColumnAnchor] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [validationOptions, setValidationOptions] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
    fetchValidationOptions();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec?action=getTravelData&owner=${user?.username || ''}`);
      const json = await res.json();
      setAllColumns(json.headers || []);
      setVisibleColumns(json.headers || []);
      setTravelData(json.rows || []);
    } catch (err) {
      console.error('❌ Error fetching travel data:', err);
    }
    setLoading(false);
  };

  const fetchValidationOptions = async () => {
    try {
      const url = `https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec?action=getValidationOptions`;
      const res = await fetch(url);
      const json = await res.json();
      setValidationOptions(json);
    } catch (err) {
      console.error('❌ Error fetching validation options:', err);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearch = (row) => {
    return (
      row['Travel ID']?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
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
      return Object.entries(filters).every(([key, value]) => !value || row[key] === value);
    })
    .filter(handleSearch);

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ p: 2 }}>
        {loading && <LoadingOverlay />}

        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', fontFamily: 'Montserrat' }}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 30, marginRight: 10 }} />
          Travel Management
        </Typography>

        <Button
          variant="contained"
          onClick={() => setSelectedRow({})}
          sx={{ fontFamily: 'Montserrat', mb: 2 }}
          startIcon={<FlightTakeoffIcon />}
        >
          + Add Travel
        </Button>

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search Travel ID / Name / Destination"
            InputProps={{ startAdornment: <SearchIcon /> }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {["Travel Status", "Approval Status", "Department", "Travel Type"].map((filterKey) => (
            <FormControl key={filterKey} size="small">
              <InputLabel>{filterKey}</InputLabel>
              <Select
                name={filterKey}
                value={filters[filterKey] || ''}
                onChange={handleFilterChange}
                sx={{ fontFamily: 'Montserrat' }}
              >
                <MenuItem value="">All</MenuItem>
                {(validationOptions[toCamelCase(filterKey)] || []).map(option => (
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
              {visibleColumns.map(col => <TableCell key={col}>{col}</TableCell>)}
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData.map((row, idx) => (
              <TableRow key={idx}>
                {visibleColumns.map(col => <TableCell key={col}>{row[col]}</TableCell>)}
                <TableCell>
                  <IconButton onClick={() => setSelectedRow(row)}><EditIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {selectedRow !== null && (
          <Dialog open onClose={() => setSelectedRow(null)} maxWidth="md" fullWidth>
            <DialogTitle>{selectedRow?.['Travel ID'] ? 'Edit Travel Entry' : 'New Travel Request'}</DialogTitle>
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

const toCamelCase = (text) =>
  text.replace(/[^a-zA-Z0-9]/g, ' ')
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (w, i) =>
      i === 0 ? w.toLowerCase() : w.toUpperCase()
    ).replace(/\s+/g, '');

export default TravelTable;
