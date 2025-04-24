import React, { useEffect, useState } from 'react';
import {
Box, Typography, Table, TableHead, TableRow, TableCell,
TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
IconButton, Dialog, DialogTitle, DialogContent
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 9
  }
});

function LeadsTable() {
const [leads, setLeads] = useState([]);
const [loading, setLoading] = useState(true);
const [searchTerm, setSearchTerm] = useState('');
const [filterStatus, setFilterStatus] = useState('');
const [filterSource, setFilterSource] = useState('');
const [filterOwner, setFilterOwner] = useState('');
const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
const [selectedRow, setSelectedRow] = useState(null);

useEffect(() => {
fetch('https://script.google.com/macros/s/AKfycbwCmyJEEbAy4h3SY630yJSaB8Odd2wL_nfAmxvbKKU0oC4jrdWwgHab-KUpPzGzKBaEUA/exec')
.then(response => response.json())
.then(data => {
setLeads(data);
setLoading(false);
});
}, []);

const handleSort = (key) => {
const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
setSortConfig({ key, direction });
};

const sortedLeads = [...leads].sort((a, b) => {
if (!sortConfig.key) return 0;
const aVal = a[sortConfig.key] || '';
const bVal = b[sortConfig.key] || '';
return sortConfig.direction === 'asc'
? String(aVal).localeCompare(String(bVal))
: String(bVal).localeCompare(String(aVal));
});

const filteredLeads = sortedLeads
.filter(lead =>
['First Name', 'Last Name', 'Company', 'Mobile Number'].some(key =>
(lead[key] || '').toLowerCase().includes(searchTerm.toLowerCase())
) &&
(!filterStatus || lead['Lead Status'] === filterStatus) &&
(!filterSource || lead['Lead Source'] === filterSource) &&
(!filterOwner || lead['Lead Owner'] === filterOwner)
);

const uniqueStatuses = [...new Set(leads.map(d => d['Lead Status']).filter(Boolean))];
const uniqueSources = [...new Set(leads.map(d => d['Lead Source']).filter(Boolean))];
const uniqueOwners = [...new Set(leads.map(d => d['Lead Owner']).filter(Boolean))];

if (loading) return <Typography>Loading leads...</Typography>;

return (
    <Box padding={4}>
      <Box display="flex" alignItems="center" justifyContent="space-between" marginBottom={2}>
        <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
        <Typography variant="h5" fontWeight="bold">Leads Records</Typography>
      </Box>
    <ThemeProvider theme={theme}>
      <Box padding={4}>
        <Box display="flex" alignItems="center" justifyContent="space-between" marginBottom={2}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
          <Typography variant="h5" fontWeight="bold">Leads Records</Typography>
        </Box>

      <Box display="flex" gap={2} marginBottom={2} flexWrap="wrap" alignItems="center">
        <TextField
          label="Search"
          variant="outlined"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          size="small"
        />
        <FormControl size="small">
          <InputLabel>Lead Status</InputLabel>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} label="Lead Status">
            <MenuItem value="">All</MenuItem>
            {uniqueStatuses.map(status => (
              <MenuItem key={status} value={status}>{status}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel>Lead Source</InputLabel>
          <Select value={filterSource} onChange={e => setFilterSource(e.target.value)} label="Lead Source">
            <MenuItem value="">All</MenuItem>
            {uniqueSources.map(source => (
              <MenuItem key={source} value={source}>{source}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel>Lead Owner</InputLabel>
          <Select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} label="Lead Owner">
            <MenuItem value="">All</MenuItem>
            {uniqueOwners.map(owner => (
              <MenuItem key={owner} value={owner}>{owner}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
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
            <InputLabel>Lead Status</InputLabel>
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} label="Lead Status">
              <MenuItem value="">All</MenuItem>
              {uniqueStatuses.map(status => (
                <MenuItem key={status} value={status}>{status}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" variant="outlined" sx={{ minWidth: 200 }}>
            <InputLabel>Lead Source</InputLabel>
            <Select value={filterSource} onChange={e => setFilterSource(e.target.value)} label="Lead Source">
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
            {Object.keys(leads[0]).map(header => (
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
          {filteredLeads.map((lead, index) => (
            <TableRow key={index}>
              {Object.values(lead).map((value, i) => (
                <TableCell key={i}>{value}</TableCell>
        <Table>
          <TableHead>
            <TableRow style={{ backgroundColor: '#6495ED' }}>
              {Object.keys(leads[0]).map(header => (
                <TableCell
                  key={header}
                  onClick={() => handleSort(header)}
                  style={{ color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {header} {sortConfig.key === header ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </TableCell>
))}
              <TableCell>
                <IconButton onClick={() => setSelectedRow(lead)}>
                  <VisibilityIcon />
                </IconButton>
              </TableCell>
              <TableCell style={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
</TableRow>
          ))}
        </TableBody>
      </Table>
          </TableHead>
          <TableBody>
            {filteredLeads.map((lead, index) => (
              <TableRow key={index}>
                {Object.values(lead).map((value, i) => (
                  <TableCell key={i}>{value}</TableCell>
                ))}
                <TableCell>
                  <IconButton onClick={() => setSelectedRow(lead)}>
                    <VisibilityIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

      <Dialog open={!!selectedRow} onClose={() => setSelectedRow(null)} maxWidth="md" fullWidth>
        <DialogTitle>Lead Details</DialogTitle>
        <DialogContent dividers>
          {selectedRow && Object.entries(selectedRow).map(([key, value]) => (
            <Typography key={key}><strong>{key}:</strong> {value}</Typography>
          ))}
        </DialogContent>
      </Dialog>
    </Box>
        <Dialog open={!!selectedRow} onClose={() => setSelectedRow(null)} maxWidth="md" fullWidth>
          <DialogTitle>Lead Details</DialogTitle>
          <DialogContent dividers>
            {selectedRow && Object.entries(selectedRow).map(([key, value]) => (
              <Typography key={key}><strong>{key}:</strong> {value}</Typography>
            ))}
          </DialogContent>
        </Dialog>
      </Box>
    </ThemeProvider>
);
}

export default LeadsTable;
