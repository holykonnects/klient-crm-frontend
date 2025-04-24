import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';

function LeadsTable() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [leadSourceFilter, setLeadSourceFilter] = useState('');
  const [leadOwnerFilter, setLeadOwnerFilter] = useState('');
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

  const filteredLeads = sortedLeads.filter(lead =>
    ['First Name', 'Last Name', 'Company', 'Mobile Number', 'Lead ID'].some(key =>
      (lead[key] || '').toLowerCase().includes(searchTerm.toLowerCase())
    ) &&
    (!leadSourceFilter || lead['Lead Source'] === leadSourceFilter) &&
    (!leadOwnerFilter || lead['Lead Owner'] === leadOwnerFilter)
  );

  const uniqueLeadSources = [...new Set(leads.map(d => d['Lead Source']).filter(Boolean))];
  const uniqueLeadOwners = [...new Set(leads.map(d => d['Lead Owner']).filter(Boolean))];

  if (loading) return <Typography>Loading leads...</Typography>;

  return (
    <Box padding={4}>
      <Box display="flex" alignItems="center" justifyContent="space-between" marginBottom={2}>
        {/* 🔷 Logo */}
        <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 40 }} />
        <Typography variant="h5" fontWeight="bold">Leads Records</Typography>
      </Box>

      {/* 🔍 Search + Filters */}
      <Box display="flex" gap={2} marginBottom={2} flexWrap="wrap" alignItems="center">
        <TextField
          label="Search"
          variant="outlined"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          size="small"
        />
        <FormControl size="small">
          <InputLabel>Lead Source</InputLabel>
          <Select
            value={leadSourceFilter}
            onChange={e => setLeadSourceFilter(e.target.value)}
            label="Lead Source"
          >
            <MenuItem value="">All</MenuItem>
            {uniqueLeadSources.map(src => (
              <MenuItem key={src} value={src}>{src}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel>Lead Owner</InputLabel>
          <Select
            value={leadOwnerFilter}
            onChange={e => setLeadOwnerFilter(e.target.value)}
            label="Lead Owner"
          >
            <MenuItem value="">All</MenuItem>
            {uniqueLeadOwners.map(owner => (
              <MenuItem key={owner} value={owner}>{owner}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* 🧾 Data Table */}
      <Table>
        <TableHead>
          <TableRow>
            {Object.keys(leads[0]).map(header => (
              <TableCell
                key={header}
                onClick={() => handleSort(header)}
                style={{ cursor: 'pointer', fontWeight: 'bold' }}
              >
                {header} {sortConfig.key === header ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
              </TableCell>
            ))}
            <TableCell><strong>Actions</strong></TableCell>
          </TableRow>
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

      {/* 👁 View Modal */}
      <Dialog open={!!selectedRow} onClose={() => setSelectedRow(null)} maxWidth="md" fullWidth>
        <DialogTitle>Lead Details</DialogTitle>
        <DialogContent dividers>
          {selectedRow && Object.entries(selectedRow).map(([key, value]) => (
            <Typography key={key}><strong>{key}:</strong> {value}</Typography>
          ))}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default LeadsTable;
