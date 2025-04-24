import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Checkbox,
  FormGroup, FormControlLabel, Menu, Button
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 9,
  }
});

function DealsTable() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [selectedRow, setSelectedRow] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbwJvHUNBaOAWf9oPagM1_SOZ4q4n4cV06a1d03C2zv9EBJVDqyK9zSRklZLu2_TZRNd/exec')
      .then(response => response.json())
      .then(data => {
        setDeals(data);
        setVisibleColumns(Object.keys(data[0] || {}));
        setLoading(false);
      });
  }, []);

  const handleSort = key => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
  };

  const sortedDeals = [...deals].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key] || '';
    const bVal = b[sortConfig.key] || '';
    return sortConfig.direction === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const filteredDeals = sortedDeals
    .filter(deal =>
      ['Deal Name', 'Company', 'Mobile Number', 'Stage', 'Account ID'].some(key =>
        String(deal[key] || '').toLowerCase().includes(searchTerm.toLowerCase())
      ) &&
      (!filterStage || deal['Stage'] === filterStage) &&
      (!filterType || deal['Type'] === filterType) &&
      (!filterSource || deal['Lead Source'] === filterSource) &&
      (!filterOwner || deal['Account Owner'] === filterOwner)
    );

  const uniqueStages = [...new Set(deals.map(d => d['Stage']).filter(Boolean))];
  const uniqueTypes = [...new Set(deals.map(d => d['Type']).filter(Boolean))];
  const uniqueSources = [...new Set(deals.map(d => d['Lead Source']).filter(Boolean))];
  const uniqueOwners = [...new Set(deals.map(d => d['Account Owner']).filter(Boolean))];

  const handleColumnToggle = (column) => {
    setVisibleColumns(prev =>
      prev.includes(column) ? prev.filter(col => col !== column) : [...prev, column]
    );
  };

  const handleSelectAll = () => setVisibleColumns(Object.keys(deals[0] || {}));
  const handleDeselectAll = () => setVisibleColumns([]);

  if (loading) return <Typography>Loading deals...</Typography>;

  return (
    <ThemeProvider theme={theme}>
      <Box padding={4}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
          <Typography variant="h5" fontWeight="bold">Deals Records</Typography>
        </Box>

        <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
          <TextField
            label="Search"
            variant="outlined"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Stage</InputLabel>
            <Select value={filterStage} onChange={e => setFilterStage(e.target.value)} label="Stage">
              <MenuItem value="">All</MenuItem>
              {uniqueStages.map(stage => <MenuItem key={stage} value={stage}>{stage}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Type</InputLabel>
            <Select value={filterType} onChange={e => setFilterType(e.target.value)} label="Type">
              <MenuItem value="">All</MenuItem>
              {uniqueTypes.map(type => <MenuItem key={type} value={type}>{type}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Lead Source</InputLabel>
            <Select value={filterSource} onChange={e => setFilterSource(e.target.value)} label="Lead Source">
              <MenuItem value="">All</MenuItem>
              {uniqueSources.map(src => <MenuItem key={src} value={src}>{src}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Account Owner</InputLabel>
            <Select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} label="Account Owner">
              <MenuItem value="">All</MenuItem>
              {uniqueOwners.map(owner => <MenuItem key={owner} value={owner}>{owner}</MenuItem>)}
            </Select>
          </FormControl>

          <IconButton onClick={e => setAnchorEl(e.currentTarget)}>
            <ViewColumnIcon />
          </IconButton>
          <Menu open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
            <Box p={2}>
              <Typography variant="subtitle2">Column Visibility</Typography>
              <FormGroup>
                <Button onClick={handleSelectAll}>Select All</Button>
                <Button onClick={handleDeselectAll}>Deselect All</Button>
                {(deals[0] && Object.keys(deals[0])).map(col => (
                  <FormControlLabel
                    key={col}
                    control={
                      <Checkbox
                        checked={visibleColumns.includes(col)}
                        onChange={() => handleColumnToggle(col)}
                      />
                    }
                    label={col}
                  />
                ))}
              </FormGroup>
            </Box>
          </Menu>
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
            {filteredDeals.map((deal, index) => (
              <TableRow key={index}>
                {visibleColumns.map((col, i) => (
                  <TableCell key={i}>{deal[col]}</TableCell>
                ))}
                <TableCell>
                  <IconButton onClick={() => setSelectedRow(deal)}>
                    <VisibilityIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={!!selectedRow} onClose={() => setSelectedRow(null)} maxWidth="md" fullWidth>
          <DialogTitle>Deal Details</DialogTitle>
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

export default DealsTable;
