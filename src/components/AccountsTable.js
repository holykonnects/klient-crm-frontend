// 1. Imports and Theme Setup
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Grid, Checkbox,
  Button, Popover
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CreateDealModal from './CreateDealModal'; // If externalized

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 9.5
  }
});

const selectorStyle = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: 8
};

// 2. Component Definition
function AccountsTable() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [validationData, setValidationData] = useState({});

  // UI Config
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);

  // Modals
  const [selectedRow, setSelectedRow] = useState(null);
  const [createDealRow, setCreateDealRow] = useState(null);

  const dataUrl = 'https://script.google.com/macros/s/AKfycbyh1_hms_eAcY40DZi6BXJAQe2tnD65nUTxtC6bX9S7s4TAh-Yh3psBZmhiPm_OAe6w/exec';
  const validationUrl = 'https://script.google.com/macros/s/AKfycbzDZPePrzWhMv2t_lAeAEkVa-5J4my7xBonm4zIFOne-wtJ-EGKr0zXvBlmNtfuYaFhiQ/exec';

  // 3. Load Data
  useEffect(() => {
    fetch(dataUrl)
      .then(res => res.json())
      .then(data => {
        setAccounts(data);
        setVisibleColumns(data.length ? Object.keys(data[0]) : []);
        setLoading(false);
      });

    fetch(validationUrl)
      .then(res => res.json())
      .then(setValidationData);
  }, []);

  // 4. Sorting
  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
  };

  const sortedAccounts = [...accounts].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key] || '';
    const bVal = b[sortConfig.key] || '';
    return sortConfig.direction === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  // 5. Filtered Data
  const filteredAccounts = sortedAccounts.filter(acc =>
    ['First Name', 'Last Name', 'Company', 'Mobile Number', 'Lead ID'].some(field =>
      (acc[field] || '').toLowerCase().includes(searchTerm.toLowerCase())
    ) &&
    (!filterSource || acc['Lead Source'] === filterSource) &&
    (!filterOwner || acc['Lead Owner'] === filterOwner)
  );

  // 6. Column Selector Controls
  const handleColumnToggle = (col) => {
    setVisibleColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleSelectAll = () => setVisibleColumns(Object.keys(accounts[0] || {}));
  const handleDeselectAll = () => setVisibleColumns([]);

  if (loading) return <Typography>Loading Accounts...</Typography>;

  return (
    <ThemeProvider theme={theme}>
      <Box padding={4}>
        {/* Header */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
          <Typography variant="h5" fontWeight="bold">Accounts Records</Typography>
        </Box>

        {/* Filters & Search */}
        <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
          <TextField
            label="Search"
            variant="outlined"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />
          {['Lead Source', 'Lead Owner'].map(key => (
            <FormControl size="small" sx={{ minWidth: 160 }} key={key}>
              <InputLabel>{key}</InputLabel>
              <Select
                value={key === 'Lead Source' ? filterSource : filterOwner}
                label={key}
                onChange={e =>
                  key === 'Lead Source' ? setFilterSource(e.target.value) : setFilterOwner(e.target.value)
                }
              >
                <MenuItem value="">All</MenuItem>
                {(validationData[key] || []).map(val => (
                  <MenuItem key={val} value={val}>{val}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}

          {/* Column Selector */}
          <IconButton onClick={e => setAnchorEl(e.currentTarget)}>
            <ViewColumnIcon />
          </IconButton>
          <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
            <Box p={2} sx={selectorStyle}>
              <Button size="small" onClick={handleSelectAll}>Select All</Button>
              <Button size="small" onClick={handleDeselectAll}>Deselect All</Button>
              {Object.keys(accounts[0] || {}).map(col => (
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

        {/* Table */}
        <Table>
          <TableHead>
            <TableRow style={{ backgroundColor: '#6495ED' }}>
              {visibleColumns.map(header => (
                <TableCell
                  key={header}
                  onClick={() => handleSort(header)}
                  style={{ color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {header} {sortConfig.key === header ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </TableCell>
              ))}
              <TableCell style={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAccounts.map((acc, index) => (
              <TableRow key={index}>
                {visibleColumns.map((col, i) => (
                  <TableCell key={i}>{acc[col]}</TableCell>
                ))}
                <TableCell>
                  <IconButton onClick={() => setCreateDealRow(acc)}>
                    <VisibilityIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Deal Modal */}
        <Dialog open={!!createDealRow} onClose={() => setCreateDealRow(null)} maxWidth="md" fullWidth>
          <DialogTitle>Deal Management</DialogTitle>
          <DialogContent dividers>
            {/* Replace with Deal Modal or Inline Deal Form */}
            <CreateDealModal rowData={createDealRow} onClose={() => setCreateDealRow(null)} />
          </DialogContent>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default AccountsTable;
