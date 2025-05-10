import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Grid,
  Accordion, AccordionSummary, AccordionDetails, Button,
  Checkbox, FormGroup, FormControlLabel, Menu
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
  const [createDealRow, setCreateDealRow] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);

  const formSubmitUrl = 'https://script.google.com/macros/s/YOUR_DEPLOYED_URL/exec';

  // Fetch Data
  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbyh1_hms_eAcY40DZi6BXJAQe2tnD65nUTxtC6bX9S7s4TAh-Yh3psBZmhiPm_OAe6w/exec')
      .then(response => response.json())
      .then(data => {
        setAccounts(data);
        setVisibleColumns(Object.keys(data[0] || {}));
        setLoading(false);
      });
  }, []);

  const handleCreateDeal = (row) => {
    setCreateDealRow(row);
    setFormValues(row);
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

        {/* Table */}
        <Table>
          <TableHead>
            <TableRow style={{ backgroundColor: '#6495ED' }}>
              {visibleColumns.map(header => (
                <TableCell
                  key={header}
                  style={{ color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                >
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

        {/* Modal */}
        <Dialog open={!!createDealRow} onClose={() => setCreateDealRow(null)} maxWidth="md" fullWidth>
          <DialogTitle>Create Deal</DialogTitle>
          <DialogContent dividers>

            {/* Deal Details */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="bold">Deal Details</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={6}><TextField fullWidth label="Deal Name" name="Deal Name" onChange={handleChange} /></Grid>
                  <Grid item xs={6}><TextField fullWidth label="Deal Value" name="Deal Value" onChange={handleChange} /></Grid>
                  <Grid item xs={6}><TextField fullWidth label="Expected Close Date" name="Expected Close Date" onChange={handleChange} /></Grid>
                  <Grid item xs={6}><TextField fullWidth label="Stage" name="Stage" onChange={handleChange} /></Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Payment & Delivery Details */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="bold">Payment & Delivery</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={6}><TextField fullWidth label="Billing Type" name="Billing Type" onChange={handleChange} /></Grid>
                  <Grid item xs={6}><TextField fullWidth label="Payment Terms" name="Payment Terms" onChange={handleChange} /></Grid>
                  <Grid item xs={6}><TextField fullWidth label="Delivery Date" name="Delivery Date" onChange={handleChange} /></Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Additional Information */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="bold">Additional Information</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12}><TextField fullWidth label="Description" name="Description" onChange={handleChange} /></Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </DialogContent>
          <Button variant="contained" onClick={handleDealSubmit} sx={{ m: 2 }}>
            Submit Deal
          </Button>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default AccountsTable;