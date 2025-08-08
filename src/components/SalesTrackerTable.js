// SalesTrackerTable.js
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Grid, Button, Popover,
  Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAuth } from './AuthContext';
import '@fontsource/montserrat';
import SalesModal from './SalesModal';

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec';
const FORM_SHEET_NAME = 'Sales Tracker';
const VALIDATION_SHEET_NAME = 'Sales Tracker Validation Tables';

const fontStyle = { fontFamily: 'Montserrat, sans-serif' };

const SalesTrackerTable = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [columns, setColumns] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [validationOptions, setValidationOptions] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    fetch(`${SHEET_URL}?action=getData&sheetName=${FORM_SHEET_NAME}`)
      .then(res => res.json())
      .then(data => {
        setSales(data);
        setFilteredSales(data);
        if (data.length > 0) {
          const cols = Object.keys(data[0]);
          setColumns(cols);
          setVisibleColumns(cols);
        }
      });
  }, []);

  useEffect(() => {
    fetch(`${SHEET_URL}?action=getValidationOptions&sheetName=${VALIDATION_SHEET_NAME}`)
      .then(res => res.json())
      .then(data => setValidationOptions(data));
  }, []);

  useEffect(() => {
    let filtered = [...sales];
    if (searchQuery) {
      filtered = filtered.filter(row =>
        Object.values(row).some(val => val?.toLowerCase?.().includes(searchQuery.toLowerCase()))
      );
    }

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        filtered = filtered.filter(row => row[key] === value);
      }
    });

    setFilteredSales(filtered);
  }, [searchQuery, filters, sales]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleColumnToggle = (column) => {
    setVisibleColumns(prev =>
      prev.includes(column) ? prev.filter(col => col !== column) : [...prev, column]
    );
  };

  const openColumnSelector = (e) => {
    setAnchorEl(e.currentTarget);
  };

  const closeColumnSelector = () => {
    setAnchorEl(null);
  };

  const openAddModal = () => {
    setSelectedRow(null);
    setModalOpen(true);
  };

  const openEditModal = (row) => {
    setSelectedRow(row);
    setModalOpen(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with logo and Add Sale */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <img
            src="/assets/kk-logo.png"
            alt="Klient Konnect Logo"
            style={{ height: 100 }}
          />
          <Typography
            variant="h6"
            sx={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 600,
              fontSize: '1.4rem',
              color: '#333',
            }}
          >
            Sales Tracker
          </Typography>
        </Box>

        <Button
          variant="contained"
          color="primary"
          startIcon={<CurrencyRupeeIcon />}
          onClick={openAddModal}
          sx={fontStyle}
        >
          Add Sale
        </Button>
      </Box>

      {/* Search and Filter Bar */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" gap={2}>
          <TextField
            variant="outlined"
            placeholder="Search"
            size="small"
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon />, sx: fontStyle }}
          />

          {["Status", "Type", "Sales Person"].map(filterKey => (
            validationOptions[filterKey] && (
              <FormControl key={filterKey} size="small" sx={{ minWidth: 160 }}>
                <InputLabel sx={fontStyle}>{filterKey}</InputLabel>
                <Select
                  value={filters[filterKey] || ''}
                  onChange={(e) => handleFilterChange(filterKey, e.target.value)}
                  sx={fontStyle}
                >
                  <MenuItem value="">All</MenuItem>
                  {validationOptions[filterKey].map(option => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )
          ))}
        </Box>

        <IconButton onClick={openColumnSelector}>
          <ViewColumnIcon />
        </IconButton>
      </Box>

      {/* Column Selector */}
      <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={closeColumnSelector}>
        <Box p={2}>
          {columns.map(col => (
            <FormControl key={col} fullWidth>
              <label style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(col)}
                  onChange={() => handleColumnToggle(col)}
                />{' '}
                {col}
              </label>
            </FormControl>
          ))}
        </Box>
      </Popover>

      {/* Table */}
      <Table size="small">
        <TableHead>
          <TableRow>
            {visibleColumns.map(col => (
              <TableCell key={col} sx={fontStyle}>{col}</TableCell>
            ))}
            <TableCell sx={fontStyle}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredSales.map((row, idx) => (
            <TableRow key={idx}>
              {visibleColumns.map(col => (
                <TableCell key={col} sx={fontStyle}>{row[col]}</TableCell>
              ))}
              <TableCell>
                <IconButton onClick={() => openEditModal(row)}>
                  <EditIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {modalOpen && (
        <SalesModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          validationOptions={validationOptions}
          selectedRow={selectedRow}
          onSuccess={() => {
            setModalOpen(false);
            // Optional refresh here
          }}
        />
      )}
    </Box>
  );
};

export default SalesTrackerTable;
