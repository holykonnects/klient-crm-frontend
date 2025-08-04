import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, FormControl,
  IconButton, Popover, Checkbox, Button, Grid
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import SearchIcon from '@mui/icons-material/Search';
import '@fontsource/montserrat';
import { useAuth } from './AuthContext';
import LoadingOverlay from './LoadingOverlay';
import ManageTravel from './ManageTravel';

const TravelTable = () => {
  const { user } = useAuth();
  const [travelData, setTravelData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [validationOptions, setValidationOptions] = useState({});

  useEffect(() => {
    fetchData();
    fetchValidationOptions();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch(`https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec?action=getTravelData&owner=${encodeURIComponent(user.username)}`);
      const result = await response.json();
      const filteredRows = result.rows.filter(row => user.role === 'Admin' || row['Requested By']?.toLowerCase() === user.username.toLowerCase());
      setHeaders(result.headers);
      setTravelData(filteredRows);
      setVisibleColumns(result.headers);
    } catch (err) {
      console.error('Error fetching travel data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchValidationOptions = async () => {
    try {
      const response = await fetch('https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec?action=getValidationOptions');
      const result = await response.json();
      setValidationOptions(result);
    } catch (err) {
      console.error('Error fetching validation options:', err);
    }
  };

  const handleSearchChange = (e) => setSearchText(e.target.value);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleColumnToggle = (column) => {
    setVisibleColumns(prev =>
      prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column]
    );
  };

  const filteredData = travelData.filter(row => {
    const matchesSearch = Object.values(row).some(val =>
      val?.toString().toLowerCase().includes(searchText.toLowerCase())
    );
    const matchesFilters = Object.entries(filters).every(([key, val]) =>
      !val || row[key] === val
    );
    return matchesSearch && matchesFilters;
  });

  return (
    <Box sx={{ fontFamily: 'Montserrat, sans-serif', p: 2 }}>
      {loading && <LoadingOverlay />}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
        </Box>
        <Box>
          <Button
            variant="contained"
            startIcon={<AddCircleIcon />}
            sx={{ fontFamily: 'Montserrat', textTransform: 'none' }}
            onClick={() => setOpenForm(true)}
          >
            Add Travel
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item>
          <TextField
            size="small"
            placeholder="Search"
            value={searchText}
            onChange={handleSearchChange}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" /> }}
            sx={{ minWidth: 160 }}
          />
        </Grid>
        <Grid item>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select
              value={filters['Travel Status'] || ''}
              onChange={(e) => handleFilterChange('Travel Status', e.target.value)}
              displayEmpty
            >
              <MenuItem value="">All Statuses</MenuItem>
              {validationOptions.travelStatus?.map(status => (
                <MenuItem key={status} value={status}>{status}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select
              value={filters['Approval Status'] || ''}
              onChange={(e) => handleFilterChange('Approval Status', e.target.value)}
              displayEmpty
            >
              <MenuItem value="">All Approvals</MenuItem>
              {validationOptions.approvalStatus?.map(status => (
                <MenuItem key={status} value={status}>{status}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select
              value={filters['Department'] || ''}
              onChange={(e) => handleFilterChange('Department', e.target.value)}
              displayEmpty
            >
              <MenuItem value="">All Departments</MenuItem>
              {validationOptions.department?.map(dep => (
                <MenuItem key={dep} value={dep}>{dep}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
        <ViewColumnIcon fontSize="small" />
      </IconButton>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2 }}>
          {headers.map(header => (
            <Box key={header}>
              <Checkbox
                checked={visibleColumns.includes(header)}
                onChange={() => handleColumnToggle(header)}
              />
              {header}
            </Box>
          ))}
        </Box>
      </Popover>

      <Table size="small">
        <TableHead>
          <TableRow>
            {headers.filter(h => visibleColumns.includes(h)).map(header => (
              <TableCell key={header} sx={{ fontWeight: 600 }}>{header}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredData.map((row, idx) => (
            <TableRow key={idx}>
              {headers.filter(h => visibleColumns.includes(h)).map(header => (
                <TableCell key={header}>{row[header]}</TableCell>
              ))}
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
    </Box>
  );
};

export default TravelTable;
