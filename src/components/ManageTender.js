import React, { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, Grid, MenuItem,
  createTheme, ThemeProvider, Paper, Select, InputLabel, FormControl
} from '@mui/material';
import '@fontsource/montserrat';

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 9
  }
});

function ManageTender() {
  const [fields, setFields] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [formValues, setFormValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // URLs – UPDATE with your deployed Web App endpoint base
  const formSubmitUrl = 'https://script.google.com/macros/s/AKfycbyJqBc20hrZLKiPuKanwxDhqqbeqWW7-8x57Kvwjuep0bzRzRbDtD2wnuA1-VjaP1QfHQ/exec';
  const dropdownUrl = `${formSubmitUrl}?action=dropdowns`;

  useEffect(() => {
    const fetchFields = async () => {
      try {
        const response = await fetch(formSubmitUrl);
        const data = await response.json();
        const fieldNames = Object.keys(data[0] || {});
        setFields(fieldNames);

        const initial = {};
        fieldNames.forEach(f => (initial[f] = ''));
        setFormValues(initial);
      } catch (error) {
        console.error('Error fetching fields:', error);
      }
    };

    const fetchDropdowns = async () => {
      try {
        const response = await fetch(dropdownUrl);
        const data = await response.json();
        setDropdownOptions(data);
      } catch (error) {
        console.error('Error fetching dropdowns:', error);
      }
    };

    Promise.all([fetchFields(), fetchDropdowns()]).finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const now = new Date();
    const timestamp = now.toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });

    const payload = {
      ...formValues,
      Timestamp: timestamp
    };

    try {
      await fetch(formSubmitUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      alert('✅ Tender submitted successfully!');

      const reset = {};
      fields.forEach(field => (reset[field] = ''));
      setFormValues(reset);
    } catch (error) {
      console.error('❌ Submission failed:', error);
      alert('❌ Submission failed. Try again.');
    }

    setSubmitting(false);
  };

  if (loading) return <Typography>Loading Tender Form...</Typography>;

  return (
    <ThemeProvider theme={theme}>
      <Paper elevation={3} sx={{ maxWidth: 900, margin: '2rem auto', padding: 4 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 60 }} />
        </Box>

        <Typography variant="h5" fontWeight="bold" color="#6495ED" mb={3}>
          Add New Tender
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            {fields.map((field, idx) => (
              <Grid item xs={12} sm={6} key={idx}>
                {dropdownOptions[field] ? (
                  <FormControl fullWidth size="small">
                    <InputLabel>{field}</InputLabel>
                    <Select
                      label={field}
                      name={field}
                      value={formValues[field]}
                      onChange={handleChange}
                    >
                      {dropdownOptions[field].map((option, i) => (
                        <MenuItem key={i} value={option}>{option}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    fullWidth
                    size="small"
                    label={field}
                    name={field}
                    value={formValues[field]}
                    onChange={handleChange}
                  />
                )}
              </Grid>
            ))}
          </Grid>

          <Box mt={3} display="flex" justifyContent="flex-end">
            <Button type="submit" variant="contained" sx={{ backgroundColor: '#6495ED' }} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Tender'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </ThemeProvider>
  );
}

export default ManageTender;
