import React, { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, Grid, MenuItem,
  createTheme, ThemeProvider, Paper, Select, InputLabel, FormControl
} from '@mui/material';
import '@fontsource/montserrat';
import LoadingOverlay from './LoadingOverlay'; // Adjust path if needed

// ✅ ADDED: MUI Date Picker imports
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

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
  const dropdownUrl = `https://script.google.com/macros/s/AKfycbyJqBc20hrZLKiPuKanwxDhqqbeqWW7-8x57Kvwjuep0bzRzRbDtD2wnuA1-VjaP1QfHQ/exec?action=dropdowns`;

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

  // ✅ ADDED: detect date fields (minimal + safe)
  const isDateField = (fieldName) => /date/i.test(fieldName);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // ✅ ADDED: date picker handler (stores dd/MM/yyyy)
  const handleDateChange = (field, newValue) => {
    const formatted = newValue ? dayjs(newValue).format('DD/MM/YYYY') : '';
    setFormValues(prev => ({
      ...prev,
      [field]: formatted
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

  if (loading) return <LoadingOverlay />;

  return (
    <ThemeProvider theme={theme}>
      {/* ✅ ADDED: LocalizationProvider wrapper (required for DatePicker) */}
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Paper elevation={3} sx={{ maxWidth: 900, margin: '2rem auto', padding: 4 }}>
          <Box display="flex" justifyContent="center" mb={3}>
            <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
          </Box>

          <Typography variant="h5" fontWeight="bold" color="#6495ED" mb={3} textAlign="center">
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
                  ) : isDateField(field) ? (
                    // ✅ ADDED: Date picker for any field containing "date"
                    <DatePicker
                      label={field}
                      value={formValues[field] ? dayjs(formValues[field], 'DD/MM/YYYY') : null}
                      onChange={(newValue) => handleDateChange(field, newValue)}
                      format="DD/MM/YYYY"
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: "small"
                        }
                      }}
                    />
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
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default ManageTender;
