import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 9
  }
});

function AccountsTable() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterLeadSource, setFilterLeadSource] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbyh1_hms_eAcY40DZi6BXJAQe2tnD65nUTxtC6bX9S7s4TAh-Yh3psBZmhiPm_OAe6w/exec')
      .then(response => response.json())
      .then(data => {
        setAccounts(data);
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

  const filteredAccounts = sortedAccounts
    .filter(acc =>
      ['First Name', 'Last Name', 'Company', 'Mobile Number', 'Lead Status', 'Lead ID'].some(key =>
        (acc[key] || '').toLowerCase().includes(searchTerm.toLowerCase())
      ) &&
      (!filterStage || acc['Lead Status'] === filterStage) &&
      (!filterType || acc['Type'] === filterType) &&
      (!filterLeadSource || acc['Lead Source'] === filterLeadSource) &&
      (!filterOwner || acc['Lead Owner'] === filterOwner)
    );

  const uniqueStages = [...new Set(accounts.map(d => d['Lead Status']).filter(Boolean))];
  const uniqueTypes = [...new Set(accounts.map(d => d['Type']).filter(Boolean))];
  const uniqueSources = [...new Set(accounts.map(d => d['Lead Source']).filter(Boolean))];
  const uniqueOwners = [...new Set(accounts.map(d => d['Lead Owner']).filter(Boolean))];

  if (loading) return <Typography>Loading accounts...</Typography>;

  return (
    <ThemeProvider theme={theme}>
      <Box padding={4}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Accounts Records
        </Typography>

        <Box display="flex" gap={2} marginBottom={2} flexWrap="wrap" alignItems="center">
          <TextField
            label="Search"
            variant="outlined"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" variant="outlined" sx={{ minWidth: 200 }}>
            <InputLabel>Stage</InputLabel>
            <Select value={filterStage} onChange={e => setFilterStage(e.target.value)} label="Stage">
              <MenuItem value="">All</MenuItem>
              {uniqueStages.map(stage => (
                <MenuItem key={stage} value={stage}>{stage}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" variant="outlined" sx={{ minWidth: 200 }}>
            <InputLabel>Type</InputLabel>
            <Select value={filterType} onChange={e => setFilterType(e.target.value)} label="Type">
              <MenuItem value="">All</MenuItem>
              {uniqueTypes.map(type => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" variant="outlined" sx={{ minWidth: 200 }}>
            <InputLabel>Lead Source</InputLabel>
            <Select value={filterLeadSource} onChange={e => setFilterLeadSource(e.target.value)} label="Lead Source">
              <MenuItem value="">All</MenuItem>
              {uniqueSources.map(source => (
                <MenuItem key={source} value={source}>{source}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" variant="outlined" sx={{ minWidth: 200 }}>
            <InputLabel>Lead Owner</InputLabel>
            <Select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} label="Lead Owner">
              <MenuItem value="">All</MenuItem>
              {uniqueOwners.map(owner => (
                <MenuItem key={owner} value={owner}>{owner}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Table>
          <TableHead>
            <TableRow style={{ backgroundColor: '#6495ED' }}>
              {Object.keys(accounts[0]).map(header => (
                <TableCell
                  key={header}
                  onClick={() => handleSort(header)}
                  style={{ color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
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
                {Object.values(acc).map((value, i) => (
                  <TableCell key={i}>{value}</TableCell>
                ))}
                <TableCell>
                  <IconButton href={acc['Prefilled Link']} target="_blank" rel="noopener noreferrer">
                    <VisibilityIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </ThemeProvider>
  );
}

export default AccountsTable;
