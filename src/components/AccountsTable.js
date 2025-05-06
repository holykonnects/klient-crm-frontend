import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Grid,
  Checkbox, Button, Popover
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import CreateIcon from '@mui/icons-material/AddCircleOutline';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CreateDealModal from './CreateDealModal';

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 9.5,
  }
});

const selectorStyle = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: 8.5,
};

function AccountsTable() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [dealRow, setDealRow] = useState(null);

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbyh1_hms_eAcY40DZi6BXJAQe2tnD65nUTxtC6bX9S7s4TAh-Yh3psBZmhiPm_OAe6w/exec')
      .then(res => res.json())
      .then(data => {
        setAccounts(data);
        setVisibleColumns(data.length ? Object.keys(data[0]) : []);
        setLoading(false);
      });
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

  const filteredAccounts = sortedAccounts.filter(acc =>
    ['First Name', 'Last Name', 'Company', 'Mobile Number', 'Lead ID'].some(key =>
      (acc[key] || '').toLowerCase().includes(searchTerm.toLowerCase())
    ) &&
    (!filterSource || acc['Lead Source'] === filterSource) &&
    (!filterOwner || acc['Lead Owner'] === filterOwner)
  );

  const unique = (key) => [...new Set(accounts.map(d => d[key]).filter(Boolean))];

  const handleColumnToggle = (col) => {
    setVisibleColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleSelectAll = () => {
    if (accounts.length) setVisibleColumns(Object.keys(accounts[0]));
  };

  const handleDeselectAll = () => {
    setVisibleColumns([]);
  };

  if (loading) return <Typography>Loading accounts...</Typography>;

  return (
    <ThemeProvider theme={theme}>
      <Box padding={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
          <Typography variant="h5" fontWeight="bold">Accounts Records</Typography>
        </Box>

        <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
          <TextField
            label="Search"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Lead Source</InputLabel>
            <Select value={filterSource} onChange={e => setFilterSource(e.target.value)} label="Lead Source">
              <MenuItem value="">All</MenuItem>
              {unique('Lead Source').map(source => (
                <MenuItem key={source} value={source}>{source}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Lead Owner</InputLabel>
            <Select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} label="Lead Owner">
              <MenuItem value="">All</MenuItem>
              {unique('Lead Owner').map(owner => (
                <MenuItem key={owner} value={owner}>{owner}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <IconButton onClick={e => setAnchorEl(e.currentTarget)}>
            <ViewColumnIcon />
          </IconButton>
          <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
            <Box padding={2} sx={selectorStyle}>
              <Button onClick={handleSelectAll}>Select All</Button>
              <Button onClick={handleDeselectAll}>Deselect All</Button>
              {accounts[0] && Object.keys(accounts[0]).map(col => (
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
                  <IconButton onClick={() => setViewRow(acc)}><VisibilityIcon /></IconButton>
                  <IconButton onClick={() => setDealRow(acc)}><CreateIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* View Modal */}
        <Dialog open={!!viewRow} onClose={() => setViewRow(null)} maxWidth="md" fullWidth>
          <DialogTitle>Account Details</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              {viewRow && Object.entries(viewRow).map(([key, value]) => (
                <Grid item xs={6} key={key}>
                  <Typography><strong>{key}:</strong> {value}</Typography>
                </Grid>
              ))}
            </Grid>
          </DialogContent>
        </Dialog>

        {/* Create Deal Modal */}
        <CreateDealModal open={!!dealRow} onClose={() => setDealRow(null)} account={dealRow} />
      </Box>
    </ThemeProvider>
  );
}

export default AccountsTable;
