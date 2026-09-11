// SalesTrackerTable.js
import React, { useMemo, useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Grid, Button, Popover,
  Accordion, AccordionSummary, AccordionDetails, TableSortLabel, TableContainer, Paper
} from '@mui/material';
import CurrencyRupee from '@mui/icons-material/CurrencyRupee';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAuth } from './AuthContext';
import LoadingOverlay from './LoadingOverlay';
import '@fontsource/montserrat';

const SHEET_URL = '/api/sales-tracker';
const FORM_SHEET_NAME = 'Sheet1';
const VALIDATION_SHEET_NAME = 'Sales Tracker Validation Tables';
const ENTITY_FIELD_COLUMN = 'Field';
const ENTITY_SELECTION_COLUMN = 'Field Selection';
const ENTITY_TYPES = ['Account', 'Deal', 'Order'];
const ENTITY_FIELD_ALIASES = ['Field', 'Linked Entity Type', 'Entity Type', 'Source Type'];
const ENTITY_SELECTION_ALIASES = ['Field Selection', 'Linked Entity', 'Linked Entity Name', 'Entity Selection'];
const SALES_OVERVIEW_COLUMNS = ['S.No', 'Field', 'Field Selection', 'Company', 'Basic Value'];

const fontStyle = { fontFamily: 'Montserrat, sans-serif', fontSize: 11 };
const filterFontStyle = { fontFamily: 'Montserrat, sans-serif', fontSize: 11 };
const modalInputStyle = { fontFamily: 'Montserrat, sans-serif', fontSize: 12 };

const num = (v) => parseFloat(String(v ?? '').replace(/[₹,\s]/g, '')) || 0;
const clean = (v) => String(v ?? '').trim();
const normalize = (v) => clean(v).toLowerCase().replace(/[^a-z0-9]/g, '');
const unique = (values) => [...new Set(values.map(clean).filter(Boolean))];

function findColumn(columns, aliases, fallback) {
  const aliasSet = new Set(aliases.map(normalize));
  return columns.find((col) => aliasSet.has(normalize(col))) || fallback;
}

function withEntityColumns(columns) {
  const next = [...columns];
  if (!next.some((col) => ENTITY_FIELD_ALIASES.map(normalize).includes(normalize(col)))) {
    next.push(ENTITY_FIELD_COLUMN);
  }
  if (!next.some((col) => ENTITY_SELECTION_ALIASES.map(normalize).includes(normalize(col)))) {
    next.push(ENTITY_SELECTION_COLUMN);
  }
  return next;
}

function joinLabel(parts) {
  return parts.map(clean).filter(Boolean).join(' - ');
}

function accountLabel(row = {}) {
  return joinLabel([
    row['Account ID'] || row['Lead ID'],
    row['Company'],
    [row['First Name'], row['Last Name']].map(clean).filter(Boolean).join(' '),
  ]);
}

function dealLabel(row = {}) {
  return joinLabel([
    row['Deal ID'],
    row['Deal Name'],
    row['Company'],
  ]);
}

function orderLabel(row = {}) {
  return joinLabel([
    row['Order ID'],
    row['Deal Name'] || row['Order Name'],
    row['Company'],
  ]);
}

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
  const [entityRecords, setEntityRecords] = useState({ Account: [], Deal: [], Order: [] });

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
          const cols = withEntityColumns(Object.keys(sorted[0]));
          setColumns(cols);
          const saved = JSON.parse(localStorage.getItem('visibleColumns-v2-sales-tracker') || 'null');
          setVisibleColumns(saved || SALES_OVERVIEW_COLUMNS.filter((column) => cols.includes(column)));
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

  // Fetch CRM records for Sales Tracker entity linking.
  useEffect(() => {
    let cancelled = false;

    async function fetchEntityRecords() {
      try {
        const [accountsRes, dealsRes, ordersRes] = await Promise.all([
          fetch('/api/accounts'),
          fetch('/api/deals'),
          fetch('/api/orders'),
        ]);
        const [accounts, deals, orders] = await Promise.all([
          accountsRes.ok ? accountsRes.json() : [],
          dealsRes.ok ? dealsRes.json() : [],
          ordersRes.ok ? ordersRes.json() : [],
        ]);
        if (cancelled) return;
        setEntityRecords({
          Account: Array.isArray(accounts) ? accounts : [],
          Deal: Array.isArray(deals) ? deals : [],
          Order: Array.isArray(orders) ? orders : [],
        });
      } catch (err) {
        if (!cancelled) console.error('Error loading Sales Tracker entity options', err);
      }
    }

    fetchEntityRecords();
    return () => { cancelled = true; };
  }, []);

  const entitySelectionOptions = useMemo(() => ({
    Account: unique(entityRecords.Account.map(accountLabel)),
    Deal: unique(entityRecords.Deal.map(dealLabel)),
    Order: unique(entityRecords.Order.map(orderLabel)),
  }), [entityRecords]);
  const entityFieldColumn = useMemo(
    () => findColumn(columns, ENTITY_FIELD_ALIASES, ENTITY_FIELD_COLUMN),
    [columns]
  );
  const entitySelectionColumn = useMemo(
    () => findColumn(columns, ENTITY_SELECTION_ALIASES, ENTITY_SELECTION_COLUMN),
    [columns]
  );
  const modalColumns = useMemo(
    () => columns.filter((field) => field !== entityFieldColumn && field !== entitySelectionColumn),
    [columns, entityFieldColumn, entitySelectionColumn]
  );

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

  const handleColumnToggle = (column) => setVisibleColumns(prev => {
    const next = prev.includes(column) ? prev.filter(col => col !== column) : [...prev, column];
    localStorage.setItem('visibleColumns-v2-sales-tracker', JSON.stringify(next));
    return next;
  });

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

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      ...(field === entityFieldColumn ? { [entitySelectionColumn]: '' } : {})
    }));
  };

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
      Timestamp: selectedRow ? (formData.Timestamp || selectedRow.Timestamp) : (formData.Timestamp || timestamp),
      updatedByName: user?.username || user?.email || '',
      updatedByEmail: user?.email || user?.username || ''
    };

    try {
      const res = await fetch(SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());

      alert(`✅ Sale ${selectedRow ? 'updated' : 'added'} successfully`);
      setModalOpen(false);
      setSales(prev => {
        const next = selectedRow
          ? prev.map(row => String(row['S.No']) === String(originalSNo) ? payload : row)
          : [payload, ...prev];
        return [...next].sort((a, b) => num(b['S.No']) - num(a['S.No']));
      });
    } catch (err) {
      console.error('❌ Submission error:', err);
      alert('❌ Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const sumBasicValue = filteredSales.reduce((sum, row) => sum + num(row['Basic Value']), 0);

  return (
    <Box sx={{ p: 3 }}>
      {loading && <LoadingOverlay />}

      {/* Header with total */}
      <Box className="crm-page-header" display="flex" justifyContent="space-between" alignItems="center" mb={3} gap={2} flexWrap="wrap">
        <Box display="flex" alignItems="center" gap={2} minWidth={0}>
          <img className="crm-primary-logo" src="/assets/rido-sports-logo.png" alt="Rido Sports" />
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
      <Box className="crm-filter-bar" display="flex" justifyContent="space-between" alignItems="center" mb={2} gap={1} flexWrap="wrap">
        <Box display="flex" gap={2} flexWrap="wrap" sx={{ flex: '1 1 520px', minWidth: 0 }}>
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
      <TableContainer component={Paper} className="crm-table-shell" variant="outlined">
        <Table size="small" stickyHeader>
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
              <TableRow key={idx} hover>
                {visibleColumns.map(col => (
                  <TableCell key={col} sx={fontStyle} title={String(row[col] || '')}>{row[col]}</TableCell>
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
      </TableContainer>

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
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={modalInputStyle}>Field</InputLabel>
                    <Select
                      value={formData[entityFieldColumn] || ''}
                      label="Field"
                      onChange={(e) => handleFormChange(entityFieldColumn, e.target.value)}
                      sx={modalInputStyle}
                      MenuProps={{ PaperProps: { sx: { fontFamily: 'Montserrat, sans-serif', fontSize: '0.7rem' } } }}
                    >
                      {ENTITY_TYPES.map(option => (
                        <MenuItem key={option} value={option} sx={modalInputStyle}>{option}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small" disabled={!clean(formData[entityFieldColumn])}>
                    <InputLabel sx={modalInputStyle}>Field Selection</InputLabel>
                    <Select
                      value={formData[entitySelectionColumn] || ''}
                      label="Field Selection"
                      onChange={(e) => handleFormChange(entitySelectionColumn, e.target.value)}
                      sx={modalInputStyle}
                      MenuProps={{ PaperProps: { sx: { fontFamily: 'Montserrat, sans-serif', fontSize: '0.7rem' } } }}
                    >
                      {!entitySelectionOptions[clean(formData[entityFieldColumn])]?.length && (
                        <MenuItem value="" disabled sx={modalInputStyle}>
                          {clean(formData[entityFieldColumn])
                            ? `No ${clean(formData[entityFieldColumn]).toLowerCase()} records found`
                            : 'Select a field first'}
                        </MenuItem>
                      )}
                      {(entitySelectionOptions[clean(formData[entityFieldColumn])] || []).map(option => (
                        <MenuItem key={option} value={option} sx={modalInputStyle}>{option}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {modalColumns.map(field => {
                  const selectedEntityType = clean(formData[entityFieldColumn]);
                  const selectionOptions = entitySelectionOptions[selectedEntityType] || [];
                  const isEntityTypeField = field === entityFieldColumn;
                  const isEntitySelectionField = field === entitySelectionColumn;

                  return (
                  <Grid item xs={12} sm={6} key={field}>
                    {field === 'S No' || field === 'S.No' ? (
                      <TextField
                        label={field}
                        value={formData[field] || ''}
                        size="small"
                        fullWidth
                        InputProps={{ sx: modalInputStyle, readOnly: true }}
                        InputLabelProps={{ sx: modalInputStyle }}
                      />
                    ) : isEntityTypeField ? (
                      <FormControl fullWidth size="small">
                        <InputLabel sx={modalInputStyle}>{field}</InputLabel>
                        <Select
                          value={formData[field] || ''}
                          label={field}
                          onChange={(e) => handleFormChange(field, e.target.value)}
                          sx={modalInputStyle}
                          MenuProps={{ PaperProps: { sx: { fontFamily: 'Montserrat, sans-serif', fontSize: '0.7rem' } } }}
                        >
                          {ENTITY_TYPES.map(option => (
                            <MenuItem key={option} value={option} sx={modalInputStyle}>{option}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : isEntitySelectionField ? (
                      <FormControl fullWidth size="small" disabled={!selectedEntityType}>
                        <InputLabel sx={modalInputStyle}>{field}</InputLabel>
                        <Select
                          value={formData[field] || ''}
                          label={field}
                          onChange={(e) => handleFormChange(field, e.target.value)}
                          sx={modalInputStyle}
                          MenuProps={{ PaperProps: { sx: { fontFamily: 'Montserrat, sans-serif', fontSize: '0.7rem' } } }}
                        >
                          {!selectionOptions.length && (
                            <MenuItem value="" disabled sx={modalInputStyle}>
                              {selectedEntityType ? `No ${selectedEntityType.toLowerCase()} records found` : 'Select a field first'}
                            </MenuItem>
                          )}
                          {selectionOptions.map(option => (
                            <MenuItem key={option} value={option} sx={modalInputStyle}>{option}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
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
                  );
                })}
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
