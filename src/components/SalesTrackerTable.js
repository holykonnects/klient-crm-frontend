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

const fontStyle = { fontFamily: 'Montserrat, sans-serif', fontSize: '0.7rem' };
const filterFontStyle = { fontFamily: 'Montserrat, sans-serif', fontSize: '0.65rem' };
const modalInputStyle = { fontFamily: 'Montserrat, sans-serif', fontSize: '0.7rem' };

const num = (v) => parseFloat(String(v ?? '').replace(/[₹,\s]/g, '')) || 0;

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
  const [originalSNo, setOriginalSNo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orderBy, setOrderBy] = useState('S.No');
  const [order, setOrder] = useState('desc');

  // Fetch table data
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${SHEET_URL}?action=getData&sheetName=${FORM_SHEET_NAME}`);
        const data = await res.json();
        // Default sort by S No desc on landing
        const sorted = [...data].sort((a, b) => num(b['S.No']) - num(a['S.No']));
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

  // Fetch validation options (dropdowns)
  useEffect(() => {
    fetch(`${SHEET_URL}?action=getValidationOptions&sheetName=${VALIDATION_SHEET_NAME}`)
      .then(res => res.json())
      .then(data => setValidationOptions(data))
      .catch(() => {});
  }, []);

  // Search, filter, sort pipeline
  useEffect(() => {
    let filtered = [...sales];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(row =>
        Object.values(row).some(val => val?.toString?.().toLowerCase().includes(q))
      );
    }

    Object.entries(filters).forEach(([key, value]) => {
      if (value) filtered = filtered.filter(row => row[key] === value);
    });

    const sorted = [...filtered].sort((a, b) => {
      const aVal = a[orderBy];
      const bVal = b[orderBy];

      if (orderBy === 'Timestamp') {
        const aT = new Date(aVal || 0).getTime();
        const bT = new Date(bVal || 0).getTime();
        return order === 'asc' ? aT - bT : bT - aT;
      }

      // Numeric-first compare
      const aNum = num(aVal);
      const bNum = num(bVal);
      const bothNumeric = !isNaN(aNum) && !isNaN(bNum);
      if (bothNumeric) return order === 'asc' ? aNum - bNum : bNum - aNum;

      // Fallback to string compare
      const aStr = (aVal ?? '').toString();
      const bStr = (bVal ?? '').toString();
      return order === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    setFilteredSales(sorted);
  }, [searchQuery, filters, sales, order, orderBy]);

  const handleSort = (field) => {
    if (orderBy === field) setOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setOrderBy(field); setOrder('asc'); }
  };

  const handleFilterChange = (field, value) => setFilters(prev => ({ ...prev, [field]: value }));

  const handleColumnToggle = (column) => setVisibleColumns(prev => (
    prev.includes(column) ? prev.filter(col => col !== column) : [...prev, column]
  ));

  const openColumnSelector = (e) => setAnchorEl(e.currentTarget);
  const closeColumnSelector = () => setAnchorEl(null);

  // Add modal: prefill next S No and keep it read-only
  const openAddModal = () => {
    const maxSno = sales.reduce((max, row) => Math.max(max, num(row['S.No'])), 0);
    setSelectedRow(null);
    setOriginalSNo(null);

    const initialForm = { 'S.No': String(maxSno + 1) };
    columns.forEach(field => { if (!(field in initialForm)) initialForm[field] = ''; });

    setFormData(initialForm);
    setModalOpen(true);
  };

  // Edit modal: edit current row, keep original S No for backend match
  const openEditModal = (row) => {
    setSelectedRow(row);
    setOriginalSNo(row['S.No'] ?? null);
    setFormData(row);
    setModalOpen(true);
  };

  const handleFormChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setSubmitting(true);

    // Preserve identifier for edit, autopopulate timestamp for add
    const now = new Date();
    const timestamp = now.toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });

    const payload = {
      ...formData,
      mode: selectedRow ? 'edit' : 'add',
      originalSNo: selectedRow ? originalSNo : undefined,
      Timestamp: selectedRow ? (formData.Timestamp || selectedRow.Timestamp) : (formData.Timestamp || timestamp)
    };

    try {
      await fetch(SHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      alert(`✅ Sale ${selectedRow ? 'updated' : 'added'} successfully`);
      setModalOpen(false);
      window.location.reload();
    } catch (err) {
      console.error('❌ Submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const sumBasicValue = filteredSales.reduce((sum, row) => sum + num(row['Basic Value']), 0);

  return (
    <Box sx={{ p: 3 }}>
      {loading && <LoadingOverlay />}

      {/* Header with total */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect Logo" style={{ height: 100 }} />
          <Typography variant="h6" sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '1.2rem', color: '#333' }}>
            Sales Tracker
          </Typography>
        </Box>
        <Box textAlign="right">
          <Typography sx={{ fontWeight: 600, fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem', mb: 1 }}>
            Total Basic Value: ₹{sumBasicValue.toLocaleString('en-IN')}
          </Typography>
          <Button variant="contained" color="primary" startIcon={<CurrencyRupee />} onClick={openAddModal} sx={fontStyle}>
            Add Sale
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" gap={2}>
          <TextField
            variant="outlined"
            placeholder="Search"
            size="small"
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon />, sx: filterFontStyle }}
          />

          {Object.keys(validationOptions).map(filterKey => (
            validationOptions[filterKey] && (
              <FormControl key={filterKey} size="small" sx={{ minWidth: 160 }}>
                <InputLabel sx={filterFontStyle}>{filterKey}</InputLabel>
                <Select
                  value={filters[filterKey] || ''}
                  onChange={(e) => handleFilterChange(filterKey, e.target.value)}
                  sx={filterFontStyle}
                  MenuProps={{ PaperProps: { sx: { fontFamily: 'Montserrat, sans-serif', fontSize: '0.65rem' } } }}
                >
                  <MenuItem value="" sx={filterFontStyle}>All</MenuItem>
                  {validationOptions[filterKey].map(option => (
                    <MenuItem key={option} value={option} sx={filterFontStyle}>{option}</MenuItem>
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

      {/* Column selector */}
      <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={closeColumnSelector}>
        <Box p={2}>
          {columns.map(col => (
            <FormControl key={col} fullWidth>
              <label style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10 }}>
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
          <TableRow sx={{ backgroundColor: '#6495ED' }}>
            {visibleColumns.map(col => (
              <TableCell key={col} sx={{ ...fontStyle, color: '#fff', textAlign: 'center' }}>
                <TableSortLabel
                  active={orderBy === col}
                  direction={orderBy === col ? order : 'asc'}
                  onClick={() => handleSort(col)}
                  sx={{ color: '#fff' }}
                >
                  {col}
                </TableSortLabel>
              </TableCell>
            ))}
            <TableCell sx={{ ...fontStyle, color: '#fff', textAlign: 'center' }}>Actions</TableCell>
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

      {/* Modal */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '1rem' }}>
          {selectedRow ? 'Edit Sale' : 'Add Sale'}
        </DialogTitle>
        <DialogContent dividers>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#f0f4ff', fontFamily: 'Montserrat, sans-serif' }}>
              <Typography sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '0.85rem' }}>Sale Details</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {columns.map(field => (
                  <Grid item xs={12} sm={6} key={field}>
                    {field === 'S No' ? (
                      <TextField
                        label={field}
                        value={formData[field] || ''}
                        size="small"
                        fullWidth
                        InputProps={{ sx: modalInputStyle, readOnly: true }}
                        InputLabelProps={{ sx: modalInputStyle }}
                      />
                    ) : validationOptions[field] ? (
                      <FormControl fullWidth size="small">
                        <InputLabel sx={modalInputStyle}>{field}</InputLabel>
                        <Select
                          value={formData[field] || ''}
                          onChange={(e) => handleFormChange(field, e.target.value)}
                          sx={modalInputStyle}
                          MenuProps={{ PaperProps: { sx: { fontFamily: 'Montserrat, sans-serif', fontSize: '0.7rem' } } }}
                        >
                          {validationOptions[field].map(option => (
                            <MenuItem key={option} value={option} sx={modalInputStyle}>{option}</MenuItem>
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
                        InputProps={{ sx: modalInputStyle }}
                        InputLabelProps={{ sx: modalInputStyle }}
                      />
                    )}
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>
        </DialogContent>
        <Box textAlign="right" p={2}>
          <Button onClick={handleSubmit} variant="contained" disabled={submitting} sx={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.7rem' }}>
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
};

export default SalesTrackerTable;
