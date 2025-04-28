// LeadForm.js
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, Grid, MenuItem,
  createTheme, ThemeProvider, Paper, CircularProgress
} from '@mui/material';

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 9
  }
});

const validationURL = 'https://script.google.com/macros/s/AKfycbzDZPePrzWhMv2t_lAeAEkVa-5J4my7xBonm4zIFOne-wtJ-EGKr0zXvBlmNtfuYaFhiQ/exec'; // ✅ Your validation fetch URL

function LeadForm() {
  const [fields, setFields] = useState({});
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(validationURL)
      .then(response => response.json())
      .then(data => {
        setFields(data);
        // Initialize form data
        const initialForm = {};
        Object.keys(data).forEach(field => initialForm[field] = '');
        setFormData(initialForm);
        setLoading(false);
      });
  }, []);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Submitting lead:\n' + JSON.stringify(formData, null, 2));
    // TODO: Add submit logic to Google Sheet
  };

  if (loading) {
    return <Box display="flex" justifyContent="center" alignItems="center" height="80vh">
      <CircularProgress />
    </Box>;
  }

  return (
    <ThemeProvider theme={theme}>
      <Paper elevation={3} sx={{ maxWidth: 1000, margin: '2rem auto', padding: 4 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 80 }} />
          <Typography variant="h5" fontWeight="bold" color="#6495ED">
            Add New Lead
          </Typography>
        </Box>

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            {Object.keys(fields).map((field) => (
              <Grid item xs={12} sm={6} key={field}>
                {fields[field].length > 0 ? (
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label={field}
                    name={field}
                    value={formData[field]}
                    onChange={handleChange}
                  >
                    {fields[field].map(option => (
                      <MenuItem key={option} value={option}>{option}</MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <TextField
                    fullWidth
                    size="small"
                    label={field}
                    name={field}
                    value={formData[field]}
                    onChange={handleChange}
                  />
                )}
              </Grid>
            ))}
          </Grid>

          <Box mt={3} display="flex" justifyContent="flex-end">
            <Button type="submit" variant="contained" sx={{ backgroundColor: '#6495ED' }}>
              Submit Lead
            </Button>
          </Box>
        </Box>
      </Paper>
    </ThemeProvider>
  );
}

export default LeadForm;
