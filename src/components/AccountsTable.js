import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Grid,
  Accordion, AccordionSummary, AccordionDetails, Button
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

function AccountsTable() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [createDealRow, setCreateDealRow] = useState(null);
  const [formValues, setFormValues] = useState({});
  const formSubmitUrl = 'https://script.google.com/macros/s/YOUR_DEPLOYED_URL/exec';

  // Fetch Data
  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbyh1_hms_eAcY40DZi6BXJAQe2tnD65nUTxtC6bX9S7s4TAh-Yh3psBZmhiPm_OAe6w/exec')
      .then(response => response.json())
      .then(data => {
        setAccounts(data);
        setLoading(false);
      });
  }, []);

  // Open Modal
  const handleCreateDeal = (row) => {
    setCreateDealRow(row);
    setFormValues({
      DealName: '',
      DealValue: '',
      Stage: '',
      ExpectedCloseDate: '',
      DealOwner: '',
      Type: '',
      OrderNumber: '',
      CompanyName: row['Company'] || '',
      ContactPerson: `${row['First Name']} ${row['Last Name']}`,
      MobileNumber: row['Mobile Number'],
      EmailID: row['Email ID'],
      Street: row['Street'],
      City: row['City'],
      State: row['State'],
      Country: row['Country'],
      Pincode: row['PinCode'],
      BillingAddress: '',
      ShippingAddress: '',
      PaymentTerms: '',
      PaymentMode: '',
      AdditionalNotes: ''
    });
  };

  // Handle Form Change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormValues(prev => ({ ...prev, [name]: value }));
  };

  // Submit the Form
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
              <TableCell style={{ color: 'white', fontWeight: 'bold' }}>Company</TableCell>
              <TableCell style={{ color: 'white', fontWeight: 'bold' }}>First Name</TableCell>
              <TableCell style={{ color: 'white', fontWeight: 'bold' }}>Last Name</TableCell>
              <TableCell style={{ color: 'white', fontWeight: 'bold' }}>Mobile Number</TableCell>
              <TableCell style={{ color: 'white', fontWeight: 'bold' }}>Email ID</TableCell>
              <TableCell style={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((acc, index) => (
              <TableRow key={index}>
                <TableCell>{acc['Company']}</TableCell>
                <TableCell>{acc['First Name']}</TableCell>
                <TableCell>{acc['Last Name']}</TableCell>
                <TableCell>{acc['Mobile Number']}</TableCell>
                <TableCell>{acc['Email ID']}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleCreateDeal(acc)}>
                    <AddCircleIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Deal Modal */}
        <Dialog open={!!createDealRow} onClose={() => setCreateDealRow(null)} maxWidth="md" fullWidth>
          <DialogTitle>Create New Deal</DialogTitle>
          <DialogContent dividers>

            {/* Accordion Sections */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Deal Details</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {['DealName', 'DealValue', 'Stage', 'ExpectedCloseDate', 'DealOwner', 'Type', 'OrderNumber'].map((field, index) => (
                    <Grid item xs={6} key={index}>
                      <TextField
                        fullWidth
                        label={field}
                        name={field}
                        value={formValues[field]}
                        onChange={handleChange}
                        size="small"
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Additional Accordions */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Billing & Payment Details</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TextField
                  fullWidth
                  label="Billing Address"
                  name="BillingAddress"
                  value={formValues['BillingAddress']}
                  onChange={handleChange}
                  size="small"
                />
              </AccordionDetails>
            </Accordion>

            <Button variant="contained" color="primary" onClick={handleDealSubmit} sx={{ mt: 2 }}>
              Submit Deal
            </Button>
          </DialogContent>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default AccountsTable;