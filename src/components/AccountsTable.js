// AccountsTable.js
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, Select, MenuItem, InputLabel, FormControl, IconButton,
  Dialog, DialogTitle, DialogContent, Grid, Checkbox, Button, Popover,
  Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import { createTheme, ThemeProvider } from '@mui/material/styles';

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

const AccountsTable = () => {
  const [accounts, setAccounts] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [validationData, setValidationData] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);

  const accountDataUrl = 'https://script.google.com/macros/s/AKfycbyh1_hms_eAcY40DZi6BXJAQe2tnD65nUTxtC6bX9S7s4TAh-Yh3psBZmhiPm_OAe6w/exec';
  const validationUrl = 'https://script.google.com/macros/s/AKfycbzDZPePrzWhMv2t_lAeAEkVa-5J4my7xBonm4zIFOne-wtJ-EGKr0zXvBlmNtfuYaFhiQ/exec';

  useEffect(() => {
    fetch(accountDataUrl).then(res => res.json()).then(data => {
      setAccounts(data);
      setVisibleColumns(Object.keys(data[0] || {}));
    });
    fetch(validationUrl).then(res => res.json()).then(setValidationData);
  }, []);

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

  const filteredAccounts = sortedAccounts.filter(row =>
    ['First Name', 'Last Name', 'Company', 'Mobile Number', 'Lead ID'].some(field =>
      (row[field] || '').toLowerCase().includes(searchTerm.toLowerCase())
    ) &&
    (!filterSource || row['Lead Source'] === filterSource) &&
    (!filterOwner || row['Lead Owner'] === filterOwner)
  );

  const handleColumnToggle = (col) => {
    setVisibleColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleSelectAll = () => setVisibleColumns(Object.keys(accounts[0] || {}));
  const handleDeselectAll = () => setVisibleColumns([]);

  return (
    <ThemeProvider theme={theme}>
      <Box padding={4}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" mb={2}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
          <Typography variant="h5" fontWeight="bold">Accounts Records</Typography>
        </Box>

        {/* Filters */}
        <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
          <TextField
            size="small"
            label="Search"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {['Lead Source', 'Lead Owner'].map(key => (
            <FormControl size="small" sx={{ minWidth: 160 }} key={key}>
              <InputLabel>{key}</InputLabel>
              <Select
                value={key === 'Lead Source' ? filterSource : filterOwner}
                label={key}
                onChange={e => key === 'Lead Source' ? setFilterSource(e.target.value) : setFilterOwner(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {(validationData[key] || []).map(val => (
                  <MenuItem key={val} value={val}>{val}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}

          {/* Column Selector */}
          <IconButton onClick={e => setAnchorEl(e.currentTarget)}><ViewColumnIcon /></IconButton>
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
              {visibleColumns.map(col => (
                <TableCell key={col} style={{ color: 'white', fontWeight: 'bold' }} onClick={() => handleSort(col)}>
                  {col} {sortConfig.key === col ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </TableCell>
              ))}
              <TableCell style={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAccounts.map((row, index) => (
              <TableRow key={index}>
                {visibleColumns.map(col => <TableCell key={col}>{row[col]}</TableCell>)}
                <TableCell>
                  <IconButton onClick={() => setSelectedRow(row)}><VisibilityIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Modal: Create Deal from Account */}
        <Dialog open={!!selectedRow} onClose={() => setSelectedRow(null)} maxWidth="md" fullWidth>
          <DialogTitle>Create Deal</DialogTitle>
          <DialogContent dividers>
            {selectedRow && (
              <>
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}><strong>Deal Details</strong></AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      {['Deal Name', 'Type', 'Deal Amount', 'Next Step', 'Product Required', 'Remarks', 'Stage'].map(field => (
                        <Grid item xs={6} key={field}>
                          <TextField fullWidth size="small" label={field} />
                        </Grid>
                      ))}
                    </Grid>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}><strong>Customer Details</strong></AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      {[
                        'Timestamp', 'Account Owner', 'First Name', 'Last Name', 'Company',
                        'Mobile Number', 'Email ID', 'Fax', 'Website', 'Lead Source',
                        'Lead Status', 'Industry', 'Number of Employees', 'Annual Revenue',
                        'Social Media', 'Description'
                      ].map(field => (
                        <Grid item xs={6} key={field}>
                          <TextField fullWidth size="small" label={field} value={selectedRow[field] || ''} />
                        </Grid>
                      ))}
                    </Grid>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}><strong>Address Details</strong></AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      {['Street', 'City', 'State', 'Country', 'PinCode', 'Additional Description', 'Account ID'].map(field => (
                        <Grid item xs={6} key={field}>
                          <TextField fullWidth size="small" label={field} value={selectedRow[field] || ''} />
                        </Grid>
                      ))}
                    </Grid>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}><strong>Customer Banking Details</strong></AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      {['GST Number', 'Bank Account Number', 'IFSC Code', 'Bank Name', 'Bank Account Name', 'Banking Remarks'].map(field => (
                        <Grid item xs={6} key={field}>
                          <TextField fullWidth size="small" label={field} value={selectedRow[field] || ''} />
                        </Grid>
                      ))}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </>
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
};

export default AccountsTable;
