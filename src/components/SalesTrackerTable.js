// SalesTrackerTable.js
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Grid, Button, Popover,
  Accordion, AccordionSummary, AccordionDetails, TableSortLabel
} from '@mui/material';
import CurrencyRupee from '@mui/icons-material/CurrencyRupee';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAuth } from './AuthContext';
import LoadingOverlay from './LoadingOverlay';
import '@fontsource/montserrat';

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbyRvS3mX3n0VoNgSPhaHUe44AtSTacJGYUcnoI593_XqEZ7g-Oi1vu_3TKyOjVuD_We/exec';
const FORM_SHEET_NAME = 'Sheet1';
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
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orderBy, setOrderBy] = useState('Timestamp');
  const [order, setOrder] = useState('desc');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${SHEET_URL}?action=getData&sheetName=${FORM_SHEET_NAME}`);
        const data = await res.json();
        const sorted = [...data].sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
        setSales(sorted);
        setFilteredSales(sorted);
        if (sorted.length > 0) {
          const cols = Object.keys(sorted[0]);
          setColumns(cols);
          setVisibleColumns(cols);
        }
      } catch (err) {
        console.error('Error loading sales data', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
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
    const sorted = [...filtered].sort((a, b) => {
      if (orderBy === 'Timestamp') {
        return order === 'asc'
          ? new Date(a.Timestamp) - new Date(b.Timestamp)
          : new Date(b.Timestamp) - new Date(a.Timestamp);
      }
      return order === 'asc'
        ? (a[orderBy] || '').localeCompare(b[orderBy] || '')
        : (b[orderBy] || '').localeCompare(a[orderBy] || '');
    });
    setFilteredSales(sorted);
  }, [searchQuery, filters, sales, order, orderBy]);

  const handleSort = (field) => {
    if (orderBy === field) {
      setOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(field);
      setOrder('asc');
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleColumnToggle = (column) => {
    setVisibleColumns(prev =>
      prev.includes(column) ? prev.filter(col => col !== column) : [...prev, column]
    );
  };

  const openColumnSelector = (e) => setAnchorEl(e.currentTarget);
  const closeColumnSelector = () => setAnchorEl(null);

  const openAddModal = () => {
    const maxSno = sales.reduce((max, row) => {
      const sno = parseInt(row['S No'], 10);
      return isNaN(sno) ? max : Math.max(max, sno);
    }, 0);
    setSelectedRow(null);
    setFormData({ 'S No': (maxSno + 1).toString() });
    setModalOpen(true);
  };

  const openEditModal = (row) => {
    setSelectedRow(row);
    setFormData(row);
    setModalOpen(true);
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const now = new Date();
    const timestamp = now.toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    const payload = { ...formData, Timestamp: timestamp };

    try {
      await fetch(SHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      alert('✅ Sale submitted successfully');
      setModalOpen(false);
    } catch (err) {
      console.error('❌ Submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const sumBasicValue = filteredSales.reduce((sum, row) => sum + (parseFloat(row['Basic Value']) || 0), 0);

  return (
    <Box sx={{ p: 3 }}>
      {loading && <LoadingOverlay />}

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect Logo" style={{ height: 100 }} />
          <Typography variant="h6" sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '1.4rem', color: '#333' }}>
            Sales Tracker
          </Typography>
        </Box>

        <Button variant="contained" color="primary" startIcon={<CurrencyRupee />} onClick={openAddModal} sx={fontStyle}>
          Add Sale
        </Button>
      </Box>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" gap={2}>
          <TextField
            variant="outlined"
            placeholder="Search"
            size="small"
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon />, sx: fontStyle }}
          />

          {Object.keys(validationOptions).map(filterKey => (
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

      <Table size="small">
        <TableHead>
          <TableRow sx={{ backgroundColor: '#6495ED' }}>
            {visibleColumns.map(col => (
              <TableCell key={col} sx={fontStyle}>
                <TableSortLabel
                  active={orderBy === col}
                  direction={orderBy === col ? order : 'asc'}
                  onClick={() => handleSort(col)}
                >
                  {col}
                </TableSortLabel>
              </TableCell>
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
          <TableRow>
            <TableCell colSpan={visibleColumns.length + 1} sx={{ fontWeight: 'bold', fontFamily: 'Montserrat, sans-serif' }}>
              Total Basic Value: ₹{sumBasicValue.toLocaleString('en-IN')}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
          {selectedRow ? 'Edit Sale' : 'Add Sale'}
        </DialogTitle>
        <DialogContent dividers>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#f0f4ff', fontFamily: 'Montserrat, sans-serif' }}>
              <Typography sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>Sale Details</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {columns.map(field => (
                  <Grid item xs={12} sm={6} key={field}>
                    {validationOptions[field] ? (
                      <FormControl fullWidth size="small">
                        <InputLabel>{field}</InputLabel>
                        <Select
                          value={formData[field] || ''}
                          onChange={(e) => handleFormChange(field, e.target.value)}
                        >
                          {validationOptions[field].map(option => (
                            <MenuItem key={option} value={option}>{option}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <TextField
                        label={field}
                        value={formData[field] || ''}
                        onChange={(e) => handleFormChange(field, e.target.value)}
                        size="small"
                        fullWidth
                      />
                    )}
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>
        </DialogContent>
        <Box textAlign="right" p={2}>
          <Button onClick={handleSubmit} variant="contained" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
};

export default SalesTrackerTable;
