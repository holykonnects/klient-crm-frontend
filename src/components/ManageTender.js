import React, { useEffect, useState } from 'react';
import {
  Box, Button, TextField, MenuItem, Typography, Grid, CircularProgress
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import '@fontsource/montserrat';
import logo from '../assets/kk-logo.png'; // adjust path if needed

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 10.5
  }
});

const ManageTender = () => {
  const [fields, setFields] = useState({});
  const [formData, setFormData] = useState({});
  const [loadingFields, setLoadingFields] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fieldEndpoint = 'https://script.google.com/macros/s/AKfycbyJqBc20hrZLKiPuKanwxDhqqbeqWW7-8x57Kvwjuep0bzRzRbDtD2wnuA1-VjaP1QfHQ/exec?action=fields';
  const submitEndpoint = 'https://script.google.com/macros/s/AKfycbyJqBc20hrZLKiPuKanwxDhqqbeqWW7-8x57Kvwjuep0bzRzRbDtD2wnuA1-VjaP1QfHQ/exec';

  useEffect(() => {
    fetch(fieldEndpoint)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setFields(data.fields);
          const initialForm = {};
          Object.keys(data.fields).forEach(label => {
            initialForm[label] = '';
          });
          setFormData(initialForm);
        }
      })
      .catch(err => console.error('Field load error:', err))
      .finally(() => setLoadingFields(false));
  }, []);

  const handleChange = (label, value) => {
    setFormData(prev => ({ ...prev, [label]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(submitEndpoint, {
        method: 'POST',
        body: JSON.stringify(formData),
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      alert(result.message);
    } catch (err) {
      console.error('Submit error:', err);
      alert('Error submitting tender.');
    }
    setSubmitting(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <Box p={3}>
        {/* Header with Logo */}
        <Box display="flex" alignItems="center" mb={3}>
          <img src={logo} alt="Klient Konnect" style={{ height: 40, marginRight: 10 }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Manage Tender
          </Typography>
        </Box>

        {/* Loader or Form */}
        {loadingFields ? (
          <CircularProgress />
        ) : (
          <Grid container spacing={2}>
            {Object.entries(fields).map(([label, options]) => (
              <Grid item xs={12} sm={6} key={label}>
                {options.length > 0 ? (
                  <TextField
                    select
                    label={label}
                    value={formData[label] || ''}
                    onChange={(e) => handleChange(label, e.target.value)}
                    fullWidth
                    size="small"
                  >
                    {options.map((opt, idx) => (
                      <MenuItem key={idx} value={opt}>{opt}</MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <TextField
                    label={label}
                    value={formData[label] || ''}
                    onChange={(e) => handleChange(label, e.target.value)}
                    fullWidth
                    size="small"
                  />
                )}
              </Grid>
            ))}

            {/* Submit Button */}
            <Grid item xs={12}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit}
                disabled={submitting}
                sx={{ fontWeight: 600 }}
              >
                {submitting ? 'Submitting...' : 'Submit Tender'}
              </Button>
            </Grid>
          </Grid>
        )}
      </Box>
    </ThemeProvider>
  );
};

export default ManageTender;
