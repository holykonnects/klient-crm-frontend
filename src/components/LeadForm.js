import React, { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, Grid, MenuItem,
  createTheme, ThemeProvider, Paper, Select, InputLabel, FormControl
} from '@mui/material';
import '@fontsource/montserrat';
import logo from '../assets/klient-konnect-logo.png'; // Ensure correct path

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

  const fieldUrl = 'https://script.google.com/macros/s/AKfycbyJqBc20hrZLKiPuKanwxDhqqbeqWW7-8x57Kvwjuep0bzRzRbDtD2wnuA1-VjaP1QfHQ/exec?action=fields';
  const dropdownUrl = 'https://script.google.com/macros/s/AKfycbyJqBc20hrZLKiPuKanwxDhqqbeqWW7-8x57Kvwjuep0bzRzRbDtD2wnuA1-VjaP1QfHQ/exec?action=dropdowns';
  const submitUrl = 'https://script.google.com/macros/s/AKfycbyJqBc20hrZLKiPuKanwxDhqqbeqWW7-8x57Kvwjuep0bzRzRbDtD2wnuA1-VjaP1QfHQ/exec';

  useEffect(() => {
    const fetchFields = async () => {
      try {
        const res = await fetch(fieldUrl);
        const data = await res.json();
        const fieldNames = Object.keys(data[0] || {});
        setFields(fieldNames);
        const initialForm = {};
        fieldNames.forEach(field => (initialForm[field] = ''));
        setFormValues(initialForm);
      } catch (err) {
        console.error('Error fetching fields:', err);
      }
    };

    const fetchDropdowns = async () => {
      try {
        const res = await fetch(dropdownUrl);
        const data = await res.json();
        setDropdownOptions(data);
      } catch (err) {
        console.error('Error fetching dropdowns:', err);
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
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const payload = {
      ...formValues,
      Timestamp: timestamp
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

      alert('✅ Tender submitted successfully!');
      console.log('Submitted:', payload);

      // Reset form
      const reset = {};
      fields.forEach(field => (reset[field] = ''));
      setFormValues(reset);

    } catch (error) {
      console.error('❌ Error submitting tender:', error);
      alert('❌ Submission failed. Please try again.');
    }

    setSubmitting(false);
  };

  if (loading) {
    return <Typography>Loading Tender Form...</Typography>;
  }

  return (
    <ThemeProvider theme={theme}>
      <Paper elevation={3} sx={{ maxWidth: 900, margin: '2rem auto', padding: 4 }}>
        {/* Logo aligned top-left */}
        <Box display="flex" alignItems="center" mb={2}>
          <img src={logo} alt="Klient Konnect" style={{ height: 60 }} />
        </Box>

        {/* Form Title */}
        <Typography variant="h5" fontWeight="bold" color="#6495ED" mb={3}>
          Add New Tender
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            {fields.map((field, index) => (
              <Grid item xs={12} sm={6} key={index}>
                {dropdownOptions[field] ? (
                  <FormControl fullWidth size="small">
                    <InputLabel>{field}</InputLabel>
                    <Select
                      label={field}
                      name={field}
                      value={formValues[field]}
                      onChange={handleChange}
                    >
                      {dropdownOptions[field].map((opt, idx) => (
                        <MenuItem key={idx} value={opt}>{opt}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    fullWidth
                    label={field}
                    name={field}
                    value={formValues[field]}
                    onChange={handleChange}
                    size="small"
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
