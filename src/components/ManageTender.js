import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, TextField, Button,
  Select, MenuItem, InputLabel, FormControl, Paper
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import '@fontsource/montserrat';

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 10.5
  }
});

const ManageTender = () => {
  const [formData, setFormData] = useState({});
  const [validationOptions, setValidationOptions] = useState({});
  const [success, setSuccess] = useState(null);

  const allFields = [
    'Bid Number', 'Bid Start Date', 'Bid End Date', 'Ministry/State Name',
    'Organisation Name', 'Work Type', 'Bid Type', 'EMD Amount',
    'EMD Exemption Available', 'Tender Budget', 'Pre Bid Meeting Date',
    'Pre Bid Meeting Venue', 'Tender Conditions', 'Tender Status',
    'Tender Remarks', 'Notification Status'
  ];

  useEffect(() => {
    fetchValidationOptions();
  }, []);

  const fetchValidationOptions = async () => {
    const res = await fetch('https://script.google.com/macros/s/AKfycbyaSwpMpH0RCTQkgwzme0N5WYgNP9aERhQs7mQCFX3CvBBFARne_jsM5YW6L705TdET/exec');
    const data = await res.json();
    setValidationOptions(data['Tender Validation Tables'] || {});
  };

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    try {
      const response = await fetch('https://script.google.com/macros/s/AKfycbyJqBc20hrZLKiPuKanwxDhqqbeqWW7-8x57Kvwjuep0bzRzRbDtD2wnuA1-VjaP1QfHQ/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      setSuccess(result.status === 'success');
      setFormData({});
    } catch (err) {
      console.error('Submit error:', err);
      setSuccess(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ py: 4, backgroundColor: '#f7faff', minHeight: '100vh' }}>
        <Paper elevation={3} sx={{ p: 4, maxWidth: 900, margin: 'auto', backgroundColor: '#fefefe' }}>
          <Box textAlign="center" mb={3}>
            <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 80, marginBottom: 10 }} />
            <Typography variant="h6" fontWeight="bold">Manage Tender</Typography>
          </Box>
          <Grid container spacing={2}>
            {allFields.map((field, idx) => (
              <Grid item xs={6} key={idx}>
                {["EMD Exemption Available", "Tender Status"].includes(field) ? (
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontFamily: 'Montserrat, sans-serif' }}>{field}</InputLabel>
                    <Select
                      value={formData[field] || ''}
                      onChange={(e) => handleChange(field, e.target.value)}
                      sx={{ fontFamily: 'Montserrat, sans-serif' }}
                    >
                      <MenuItem value="">Select</MenuItem>
                      {(validationOptions[field] || []).map((opt, i) => (
                        <MenuItem key={i} value={opt} sx={{ fontFamily: 'Montserrat, sans-serif' }}>{opt}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    label={field}
                    fullWidth
                    size="small"
                    value={formData[field] || ''}
                    onChange={(e) => handleChange(field, e.target.value)}
                    sx={{ fontFamily: 'Montserrat, sans-serif' }}
                  />
                )}
              </Grid>
            ))}
            <Grid item xs={12}>
              <Button variant="contained" onClick={handleSubmit} sx={{ backgroundColor: '#6495ED' }}>Submit</Button>
            </Grid>
            {success !== null && (
              <Grid item xs={12}>
                <Typography color={success ? 'green' : 'error'}>
                  {success ? 'Tender submitted successfully.' : 'Submission failed.'}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Paper>
      </Box>
    </ThemeProvider>
  );
};

export default ManageTender;
