import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Grid, Checkbox,
  Button, Popover, Accordion, AccordionSummary, AccordionDetails,
  Menu, FormGroup, FormControlLabel
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useAuth } from './AuthContext';
import '@fontsource/montserrat';
import HistoryIcon from '@mui/icons-material/History';
import LoadingOverlay from './LoadingOverlay'; // Adjust path if needed 

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 10.5
  }
});

const selectorStyle = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: 8
};

function DealsTable() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [dealFormData, setDealFormData] = useState({});
  const [validationData, setValidationData] = useState({});
  const [allDeals, setAllDeals] = useState([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [dealLogs, setDealLogs] = useState([]);
  
  const { user } = useAuth();
  const username = user?.username;
  const role = user?.role;

  const dataUrl = 'https://script.google.com/macros/s/AKfycbwJvHUNBaOAWf9oPagM1_SOZ4q4n4cV06a1d03C2zv9EBJVDqyK9zSRklZLu2_TZRNd/exec';
  const submitUrl = 'https://script.google.com/macros/s/AKfycbxZ87qfE6u-2jT8xgSlYJu5dG6WduY0lG4LmlXSOk2EGkWBH4CbZIwEJxEHI-Bmduoh/exec';
  const validationUrl = 'https://script.google.com/macros/s/AKfycbyaSwpMpH0RCTQkgwzme0N5WYgNP9aERhQs7mQCFX3CvBBFARne_jsM5YW6L705TdET/exec';

  useEffect(() => {
    fetch(dataUrl)
      .then(res => res.json())
      .then(data => {
        const filtered = role === 'End User'
          ? data.filter(d => [d['Account Owner'], d['Lead Owner'], d['Owner']].includes(username))
          : data;

        setAllDeals(filtered);

        const seen = new Map();
        filtered.forEach(row => {
          const key = row['Order ID'] || row['Deal Name'];
          const existing = seen.get(key);
          if (!existing || new Date(row.Timestamp) > new Date(existing.Timestamp)) {
            seen.set(key, row);
          }
        });
        const deduplicated = Array.from(seen.values());

        setDeals(deduplicated);
        setVisibleColumns(
          JSON.parse(localStorage.getItem(`visibleColumns-${username}-deals`)) ||
          (deduplicated.length ? Object.keys(deduplicated[0]) : [])
        );
        setLoading(false);
      });

    fetch(validationUrl)
      .then(res => res.json())
      .then(setValidationData);
  }, [username, role]);

  const handleSort = (key) => {
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

  const filteredDeals = sortedDeals.filter(deal => {
    try {
      return (
        ['Deal Name', 'Company', 'Mobile Number', 'Stage', 'Account ID'].some(key =>
          (deal[key] || '').toLowerCase().includes(searchTerm.toLowerCase())
        ) &&
        (!filterStage || deal['Stage'] === filterStage) &&
        (!filterType || deal['Type'] === filterType) &&
        (!filterSource || deal['Lead Source'] === filterSource) &&
        (!filterOwner || deal['Account Owner'] === filterOwner)
      );
    } catch {
      return false;
    }
  });

  const unique = (key) => [...new Set(deals.map(d => d[key]).filter(Boolean))];

  const handleColumnToggle = (col) => {
    setVisibleColumns(prev => {
      const updated = prev.includes(col)
        ? prev.filter(c => c !== col)
        : [...prev, col];
      localStorage.setItem(`visibleColumns-${username}-deals`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelectAll = () => {
    const all = Object.keys(deals[0] || {});
    setVisibleColumns(all);
    localStorage.setItem(`visibleColumns-${username}-deals`, JSON.stringify(all));
  };

  const handleDeselectAll = () => {
    setVisibleColumns([]);
    localStorage.setItem(`visibleColumns-${username}-deals`, JSON.stringify([]));
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setDealFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditClick = (deal) => {
    setSelectedRow(deal);
    setDealFormData(deal);
  };

  const handleSubmitDeal = async () => {
    try {
      await fetch(submitUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dealFormData)
      });
      alert('✅ Deal updated successfully');
    } catch {
      alert('❌ Error updating deal');
    }
    setSelectedRow(null);
  };

  const handleViewLogs = (dealRow) => {
    const key = dealRow['Order ID'] || dealRow['Deal Name'];
    const logs = allDeals.filter(d => (d['Order ID'] || d['Deal Name']) === key);
    setDealLogs(logs);
    setLogsOpen(true);
  };

  return (
    <ThemeProvider theme={theme}>
    {loading && <LoadingOverlay />}
      <Box padding={4}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
          <Typography variant="h5" fontWeight="bold">Deals Records</Typography>
        </Box>

        {/* Filters and Search */}
        <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
          <TextField
            label="Search"
            variant="outlined"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />
          {['Stage', 'Type', 'Lead Source', 'Account Owner'].map((label, index) => (
            <FormControl size="small" sx={{ minWidth: 200 }} key={index}>
              <InputLabel>{label}</InputLabel>
              <Select
                value={
                  label === 'Stage' ? filterStage :
                  label === 'Type' ? filterType :
                  label === 'Lead Source' ? filterSource :
                  filterOwner
                }
                onChange={e => {
                  if (label === 'Stage') setFilterStage(e.target.value);
                  else if (label === 'Type') setFilterType(e.target.value);
                  else if (label === 'Lead Source') setFilterSource(e.target.value);
                  else setFilterOwner(e.target.value);
                }}
                label={label}
              >
                <MenuItem value="">All</MenuItem>
                {unique(label).map(option => (
                  <MenuItem key={option} value={option}>{option}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <ViewColumnIcon />
          </IconButton>
          <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
            <Box p={2} sx={selectorStyle}>
              <Typography variant="subtitle2">Column Visibility</Typography>
              <Button onClick={handleSelectAll}>Select All</Button>
              <Button onClick={handleDeselectAll}>Deselect All</Button>
              <FormGroup>
                {Object.keys(deals[0] || {}).map(col => (
                  <FormControlLabel
                    key={col}
                    control={<Checkbox checked={visibleColumns.includes(col)} onChange={() => handleColumnToggle(col)} />}
                    label={col}
                  />
                ))}
              </FormGroup>
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
                  style={{ color: 'white', cursor: 'pointer' }}
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
                  <IconButton onClick={() => handleEditClick(deal)}><EditIcon /></IconButton>
                  <IconButton onClick={() => handleViewLogs(deal)}><HistoryIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={!!selectedRow} onClose={() => setSelectedRow(null)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
            Edit Deal
          </DialogTitle>
          <DialogContent dividers>
            {[{
              title: 'Order Details',
              fields: ['Order ID', 'Order Amount', 'Order Product Description', 'Order Details', 'Order Delivery Details', 'Order Delivery Date', 'Order Remarks']
            }, {
              title: 'Deal Details',
              fields: ['Deal Name', 'Type', 'Deal Amount', 'Next Step', 'Product Required', 'Remarks', 'Stage']
            }, {
              title: 'Customer Details',
              fields: ['Timestamp', 'Account Owner', 'First Name', 'Last Name', 'Company', 'Mobile Number',
                'Email ID', 'Fax', 'Website', 'Lead Source', 'Lead Status', 'Industry',
                'Number of Employees', 'Annual Revenue', 'Social Media', 'Description']
            }, {
              title: 'Address Details',
              fields: ['Street', 'City', 'State', 'Country', 'PinCode', 'Additional Description', 'Account ID']
            }, {
              title: 'Customer Banking Details',
              fields: ['GST Number', 'Bank Account Number', 'IFSC Code', 'Bank Name', 'Bank Account Name', 'Banking Remarks']
            }].map(section => (
              <Accordion key={section.title} defaultExpanded>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ backgroundColor: '#f0f4ff', fontFamily: 'Montserrat, sans-serif' }}
                >
                  <Typography sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
                    {section.title}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {section.fields.map(field => (
                      <Grid item xs={6} key={field}>
                        {validationData[field] ? (
                          <FormControl fullWidth size="small">
                            <InputLabel>{field}</InputLabel>
                            <Select
                              name={field}
                              value={dealFormData[field] || ''}
                              label={field}
                              onChange={handleFieldChange}
                              disabled={field === 'Account Owner'} 
                            >
                              {validationData[field].map((opt, idx) => (
                                <MenuItem key={idx} value={opt}>{opt}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : (
                          <TextField
                            fullWidth
                            size="small"
                            name={field}
                            label={field}
                            value={dealFormData[field] || ''}
                            onChange={handleFieldChange}
                            disabled={field === 'Order ID' || field === 'Account ID'}
                          />
                        )}
                      </Grid>
                    ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}
            
            <Box mt={2} display="flex" justifyContent="flex-end">
              <Button variant="contained" sx={{ backgroundColor: '#6495ED' }} onClick={handleSubmitDeal}>
                Update Deal
              </Button>
            </Box>
          </DialogContent>
              
          </Dialog><Dialog open={logsOpen} onClose={() => setLogsOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle>Deal Change Logs</DialogTitle>
            <DialogContent>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Deal Name</TableCell>
                    <TableCell>Order ID</TableCell>
                    <TableCell>Account Owner</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dealLogs.map((log, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{log.Timestamp}</TableCell>
                      <TableCell>{log['Deal Name']}</TableCell>
                      <TableCell>{log['Order ID']}</TableCell>
                      <TableCell>{log['Account Owner']}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DialogContent>
          </Dialog>
        </Box>
      </ThemeProvider>
      );
}

export default DealsTable;
