import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, Button
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
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
  const formSubmitUrl = 'https://script.google.com/macros/s/AKfycbwCmyJEEbAy4h3SY630yJSaB8Odd2wL_nfAmxvbKKU0oC4jrdWwgHab-KUpPzGzKBaEUA/exec';

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
    setFormValues(row);
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
            <Grid container spacing={2}>
              {Object.keys(formValues).map((key, index) => (
                <Grid item xs={6} key={index}>
                  <TextField
                    fullWidth
                    label={key}
                    name={key}
                    value={formValues[key]}
                    onChange={handleChange}
                    size="small"
                  />
                </Grid>
              ))}
            </Grid>
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
