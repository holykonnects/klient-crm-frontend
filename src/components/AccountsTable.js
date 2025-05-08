import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, Button, Accordion, AccordionSummary,
  AccordionDetails, TextField, Select, MenuItem
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 9.5,
  }
});

const AccountsTable = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDealRow, setCreateDealRow] = useState(null);
  const [formValues, setFormValues] = useState({});
  const formSubmitUrl = 'https://script.google.com/macros/s/YOUR_DEPLOYED_URL/exec';

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbyh1_hms_eAcY40DZi6BXJAQe2tnD65nUTxtC6bX9S7s4TAh-Yh3psBZmhiPm_OAe6w/exec')
      .then(response => response.json())
      .then(data => {
        setAccounts(data);
        setLoading(false);
      });
  }, []);

  const handleCreateDeal = (row) => {
    setCreateDealRow(row);

    // Prefill form with account information and placeholders for deal
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

  const handleSubmit = async () => {
    try {
      await fetch(formSubmitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      alert('✅ Deal Created Successfully');
      setCreateDealRow(null);
    } catch (error) {
      console.error('❌ Error creating deal:', error);
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

        <Table>
          <TableHead>
            <TableRow style={{ backgroundColor: '#6495ED' }}>
              {Object.keys(accounts[0] || {}).map(header => (
                <TableCell
                  key={header}
                  style={{ color: 'white', fontWeight: 'bold' }}
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
                {Object.values(acc).map((value, i) => (
                  <TableCell key={i}>{value}</TableCell>
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

        {/* Create Deal Modal */}
        <Dialog open={!!createDealRow} onClose={() => setCreateDealRow(null)} maxWidth="md" fullWidth>
          <DialogTitle>Create Deal</DialogTitle>
          <DialogContent dividers>

            {/* Basic Information */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="bold">Basic Information</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {['DealName', 'DealValue', 'Stage', 'ExpectedCloseDate', 'DealOwner', 'Type'].map((field, index) => (
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

            {/* Company Details */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="bold">Company Details</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {['Company', 'Mobile Number', 'Email ID', 'Website', 'Industry'].map((field, index) => (
                    <Grid item xs={6} key={index}>
                      <TextField
                        fullWidth
                        label={field}
                        name={field}
                        value={formValues[field]}
                        size="small"
                        disabled
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>

          </DialogContent>
          <DialogActions>
            <Button onClick={handleSubmit} variant="contained" sx={{ backgroundColor: '#6495ED' }}>
              Submit Deal
            </Button>
            <Button onClick={() => setCreateDealRow(null)} color="secondary">
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
};

export default AccountsTable;