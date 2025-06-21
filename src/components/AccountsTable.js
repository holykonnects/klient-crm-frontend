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

  const dataUrl = 'https://script.google.com/macros/s/AKfycbyh1_hms_eAcY40DZi6BXJAQe2tnD65nUTxtC6bX9S7s4TAh-Yh3psBZmhiPm_OAe6w/exec';
  const validationUrl = 'https://script.google.com/macros/s/AKfycbzDZPePrzWhMv2t_lAeAEkVa-5J4my7xBonm4zIFOne-wtJ-EGKr0zXvBlmNtfuYaFhiQ/exec';

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

  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
  };

  const handleColumnToggle = (col) => {
    setVisibleColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleSelectAll = () => setVisibleColumns(Object.keys(accounts[0] || {}));
  const handleDeselectAll = () => setVisibleColumns([]);

  const filteredAccounts = [...accounts]
    .sort((a, b) => {
      if (!sortConfig.key) return 0;
      const aVal = a[sortConfig.key] || '';
      const bVal = b[sortConfig.key] || '';
      return sortConfig.direction === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    })
    .filter(acc =>
      ['First Name', 'Last Name', 'Company', 'Mobile Number'].some(field =>
        (acc[field] || '').toLowerCase().includes(searchTerm.toLowerCase())
      ) &&
      (!filterSource || acc['Lead Source'] === filterSource) &&
      (!filterOwner || acc['Lead Owner'] === filterOwner)
    );

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setDealFormData(prev => ({ ...prev, [name]: value }));
  };

  const openDealModal = (acc) => {
    setCreateDealRow(acc);
    setDealFormData(acc); // prefill with account data
  };

  const handleSubmitDeal = () => {
    alert(JSON.stringify(dealFormData, null, 2));
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

        {/* Search and Filters */}
        <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
          <TextField
            label="Search"
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
                {(validationData[key] || []).map(opt => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}

          {/* Column Selector */}
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
                  <IconButton onClick={() => openDealModal(acc)}><EditIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Deal Modal */}
        <Dialog open={!!createDealRow} onClose={() => setCreateDealRow(null)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontFamily: 'Montserrat', fontWeight: 600 }}>Create Deal</DialogTitle>
          <DialogContent dividers>

            {/* Accordion: Deal Details */}
            <Accordion defaultExpanded>
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon />} 
                sx={{  
                  backgroundColor: '#f0f4ff',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 'bold'
                }}
              >
                <Typography sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
                  Deal Details
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {['Deal Name', 'Type', 'Deal Amount', 'Next Step', 'Product Required', 'Remarks', 'Stage'].map(field => (
                  <TextField
                    fullWidth
                    margin="dense"
                    key={field}
                    name={field}
                    label={field}
                    value={dealFormData[field] || ''}
                    onChange={handleFieldChange}
                    size="small"
                  />
                ))}
              </AccordionDetails>
            </Accordion>

            {/* Accordion: Customer & Billing */}
            <Accordion>
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon />}
                sx={{  
                  backgroundColor: '#f0f4ff',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 'bold'
                }}
              >
                <Typography sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
                  Customer Details
                </Typography>   
              </AccordionSummary>
              <AccordionDetails>
                {['Timestamp', 'Account Owner', 'First Name', 'Last Name', 'Company', 'Mobile Number', 'Email ID',
                  'Fax', 'Website', 'Lead Source', 'Lead Status', 'Industry', 'Number of Employees',
                  'Annual Revenue', 'Social Media', 'Description'].map(field => (
                  <TextField
                    fullWidth
                    margin="dense"
                    key={field}
                    name={field}
                    label={field}
                    value={dealFormData[field] || ''}
                    onChange={handleFieldChange}
                    size="small"
                  />
                ))}
              </AccordionDetails>
            </Accordion>

            {/* Accordion: Address */}
            <Accordion>
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon />}
                sx={{  
                  backgroundColor: '#f0f4ff',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 'bold'
                }}
              >
                <Typography sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
                  Address Details
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {['Street', 'City', 'State', 'Country', 'PinCode', 'Additional Description', 'Account ID'].map(field => (
                  <TextField
                    fullWidth
                    margin="dense"
                    key={field}
                    name={field}
                    label={field}
                    value={dealFormData[field] || ''}
                    onChange={handleFieldChange}
                    size="small"
                  />
                ))}
              </AccordionDetails>
            </Accordion>

            {/* Accordion: Banking */}
            <Accordion>
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon />}
                sx={{  
                  backgroundColor: '#f0f4ff',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 'bold'
                }}
              >
                <Typography sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
                  Customer Banking Details
                    </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {['GST Number', 'Bank Account Number', 'IFSC Code', 'Bank Name', 'Bank Account Name', 'Banking Remarks'].map(field => (
                  <TextField
                    fullWidth
                    margin="dense"
                    key={field}
                    name={field}
                    label={field}
                    value={dealFormData[field] || ''}
                    onChange={handleFieldChange}
                    size="small"
                  />
                ))}
              </AccordionDetails>
            </Accordion>

            {/* Submit */}
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
