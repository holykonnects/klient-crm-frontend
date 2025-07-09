import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Grid, Checkbox,
  Button, Popover, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useAuth } from './AuthContext'; // adjust path if needed
import '@fontsource/montserrat';


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

function AccountsTable() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [validationData, setValidationData] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [createDealRow, setCreateDealRow] = useState(null);
  const [dealFormData, setDealFormData] = useState({});
  const { username, role } = useAuth();
 

  const dataUrl = 'https://script.google.com/macros/s/AKfycbyh1_hms_eAcY40DZi6BXJAQe2tnD65nUTxtC6bX9S7s4TAh-Yh3psBZmhiPm_OAe6w/exec';
  const validationUrl = 'https://script.google.com/macros/s/AKfycbyaSwpMpH0RCTQkgwzme0N5WYgNP9aERhQs7mQCFX3CvBBFARne_jsM5YW6L705TdET/exec';
  const submitUrl = 'https://script.google.com/macros/s/AKfycbxZ87qfE6u-2jT8xgSlYJu5dG6WduY0lG4LmlXSOk2EGkWBH4CbZIwEJxEHI-Bmduoh/exec';

   useEffect(() => {
    fetch(dataUrl)
      .then(res => res.json())
      .then(data => {
        let filteredAccounts = data;

        if (role === 'End User') {
          filteredAccounts = data.filter(acc =>
            acc['Account Owner'] === username || acc['Lead Owner'] === username || acc['Owner'] === username
          );
        }

        setAccounts(filteredAccounts);
        setVisibleColumns(
          JSON.parse(localStorage.getItem(`visibleColumns-${username}-accounts`)) ||
          (filteredAccounts.length ? Object.keys(filteredAccounts[0]) : [])
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

  const handleColumnToggle = (col) => {
    setVisibleColumns(prev => {
      const updated = prev.includes(col)
        ? prev.filter(c => c !== col)
        : [...prev, col];
      localStorage.setItem(`visibleColumns-${username}-accounts`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelectAll = () => {
    const all = Object.keys(accounts[0] || {});
    setVisibleColumns(all);
    localStorage.setItem(`visibleColumns-${username}-accounts`, JSON.stringify(all));
  };

  const handleDeselectAll = () => {
    setVisibleColumns([]);
    localStorage.setItem(`visibleColumns-${username}-accounts`, JSON.stringify([]));
  };

  const filteredAccounts = [...accounts]
    .sort((a, b) => {
      if (!sortConfig.key) return 0;
      const aVal = a[sortConfig.key] || '';
      const bVal = b[sortConfig.key] || '';
      return sortConfig.direction === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    })
    .filter(acc => {
      try {
        return (
          ['First Name', 'Last Name', 'Company', 'Mobile Number'].some(field =>
            (acc[field] || '').toLowerCase().includes(searchTerm.toLowerCase())
          ) &&
          (!filterSource || acc['Lead Source'] === filterSource) &&
          (!filterOwner || acc['Lead Owner'] === filterOwner)
        );
      } catch (error) {
        return false;
      }
    });

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setDealFormData(prev => ({ ...prev, [name]: value }));
  };

    const openDealModal = (acc) => {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${String(now.getFullYear()).slice(-2)} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const accountOwner = acc['Lead Owner'] || acc['Account Owner'] || '';

    setCreateDealRow(acc);
    setDealFormData({
      ...acc,
      'Account Owner': accountOwner,
      'Timestamp': timestamp
    });
  };

  const handleSubmitDeal = async () => {
    const payload = {
      ...dealFormData,
      'Account Owner': dealFormData['Account Owner'] || dealFormData['Lead Owner'] || '',
      'Lead Owner': dealFormData['Lead Owner'] || dealFormData['Account Owner'] || '',
      'Timestamp': dealFormData['Timestamp']
    };


    try {
      await fetch(submitUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      alert('✅ Deal submitted successfully');
    } catch (err) {
      alert('❌ Error submitting deal');
    }

    setCreateDealRow(null);
  };

  if (loading) return <Typography>Loading accounts...</Typography>;

  return (
    <ThemeProvider theme={theme}>
      <Box padding={4}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
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
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Lead Source</InputLabel>
            <Select
              value={filterSource}
              label="Lead Source"
              onChange={e => setFilterSource(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {(validationData['Lead Source'] || []).map(opt => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Account Owner</InputLabel>
            <Select
              value={filterOwner}
              label="Account Owner"
              onChange={e => setFilterOwner(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {(validationData['Account Owner'] || []).map(opt => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
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
                  <IconButton onClick={() => openDealModal(acc)}><EditIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={!!createDealRow} onClose={() => setCreateDealRow(null)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
            Create Deal
          </DialogTitle>
          <DialogContent dividers>
            {[{
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
                  sx={{ backgroundColor: '#f0f4ff', fontFamily: 'Montserrat, sans-serif', fontWeight: 'bold' }}
                >
                  <Typography sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
                    {section.title}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {section.fields.map(field => (
                      <Grid item xs={6} key={field}>
                        {field === 'Account Owner' ? (
                          <TextField
                            fullWidth
                            label={field}
                            name={field}
                            value={dealFormData['Account Owner'] || dealFormData['Lead Owner'] || ''}
                            InputProps={{ readOnly: true }}
                            size="small"
                          />
                        ) : validationData[field] ? (
                          <FormControl fullWidth size="small">
                            <InputLabel>{field}</InputLabel>
                            <Select
                              label={field}
                              name={field}
                              value={dealFormData[field] || ''}
                              onChange={handleFieldChange}
                            >
                              {validationData[field].map((opt, idx) => (
                                <MenuItem key={idx} value={opt}>{opt}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : (
                          <TextField
                            fullWidth
                            label={field}
                            name={field}
                            value={dealFormData[field] || ''}
                            onChange={handleFieldChange}
                            size="small"
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
                Submit Deal
              </Button>
            </Box>
          </DialogContent>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default AccountsTable;
                        
