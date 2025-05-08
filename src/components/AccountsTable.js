import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Grid,
  Checkbox, FormGroup, FormControlLabel, Menu, Button,
  Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 9.5,
  }
});

const selectorStyle = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: 8.5
};

function AccountsTable() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [createDealRow, setCreateDealRow] = useState(null);
  const [formValues, setFormValues] = useState({});
  const formSubmitUrl = 'https://script.google.com/macros/s/YOUR_DEPLOYED_URL/exec';

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbyh1_hms_eAcY40DZi6BXJAQe2tnD65nUTxtC6bX9S7s4TAh-Yh3psBZmhiPm_OAe6w/exec')
      .then(response => response.json())
      .then(data => {
        setAccounts(data);
        setVisibleColumns(Object.keys(data[0] || {}));
        setLoading(false);
      });
  }, []);

  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
  };

  const handleColumnToggle = (column) => {
    setVisibleColumns(prev =>
      prev.includes(column) ? prev.filter(col => col !== column) : [...prev, column]
    );
  };

  const handleSelectAll = () => setVisibleColumns(Object.keys(accounts[0] || {}));
  const handleDeselectAll = () => setVisibleColumns([]);

  const handleCreateDeal = (row) => {
    setCreateDealRow(row);

    setFormValues({
      ...row,
      DealName: '',
      DealValue: '',
      Stage: '',
      ExpectedCloseDate: '',
      DealOwner: '',
      Type: '',
      Description: '',
      SocialMedia: '',
      AdditionalDescription: ''
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormValues(prev => ({ ...prev, [name]: value }));
  };

  const handleDealSubmit = async () => {
    try {
      await fetch(formSubmitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      alert('✅ Deal Created Successfully');
      setCreateDealRow(null);
    } catch (error) {
      console.error('Error creating deal:', error);
      alert('❌ Error creating deal. Please try again.');
    }
  };

  if (loading) return <Typography>Loading accounts...</Typography>;

  return (
    <ThemeProvider theme={theme}>
      <Box padding={4}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
          <Typography variant="h5" fontWeight="bold">Accounts Records</Typography>
        </Box>

        {/* Filters */}
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
            <InputLabel>Lead Source</InputLabel>
            <Select value={filterSource} onChange={e => setFilterSource(e.target.value)} label="Lead Source">
              <MenuItem value="">All</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Lead Owner</InputLabel>
            <Select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} label="Lead Owner">
              <MenuItem value="">All</MenuItem>
            </Select>
          </FormControl>

          <IconButton onClick={e => setAnchorEl(e.currentTarget)}>
            <ViewColumnIcon />
          </IconButton>
        </Box>

        {/* Table */}
        <Table>
          <TableHead>
            <TableRow style={{ backgroundColor: '#6495ED' }}>
              {visibleColumns.map(header => (
                <TableCell key={header} style={{ color: 'white', fontWeight: 'bold' }}>
                  {header}
                </TableCell>
              ))}
              <TableCell style={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((acc, index) => (
              <TableRow key={index}>
                {visibleColumns.map((col, i) => (
                  <TableCell key={i}>{acc[col]}</TableCell>
                ))}
                <TableCell>
                  <IconButton onClick={() => handleCreateDeal(acc)}>
                    <AddCircleIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Modal for Deal Creation */}
        <Dialog open={!!createDealRow} onClose={() => setCreateDealRow(null)} maxWidth="md" fullWidth>
          <DialogTitle>Create New Deal</DialogTitle>
          <DialogContent dividers>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Deal Details</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {Object.keys(formValues).map((field, idx) => (
                    <Grid item xs={6} key={idx}>
                      <TextField
                        label={field}
                        name={field}
                        value={formValues[field]}
                        onChange={handleChange}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
            <Box mt={2} display="flex" justifyContent="flex-end">
              <Button variant="contained" color="primary" onClick={handleDealSubmit}>
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