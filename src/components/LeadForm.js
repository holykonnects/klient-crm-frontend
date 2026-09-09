import React, { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, Grid, MenuItem,
  createTheme, ThemeProvider, Paper, Select, InputLabel, FormControl,
  InputAdornment, Alert
} from '@mui/material';
import LoadingOverlay from './LoadingOverlay'; // Adjust path if needed

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 9
  }
});

const isMobileField = (field = '') =>
  String(field).trim().toLowerCase() === 'mobile number';

const normalizeLeadMobile = (value = '') => {
  const raw = String(value || '').trim();
  let digits = raw.replace(/\D/g, '');

  if (raw.startsWith('+91')) {
    digits = digits.slice(2);
  } else if (digits.length > 10 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }

  if (digits.length > 10) {
    digits = digits.slice(-10);
  }

  return digits.slice(0, 10);
};

const sanitizeMobileFields = (values = {}) => {
  const cleaned = { ...values };
  Object.keys(cleaned).forEach((key) => {
    if (isMobileField(key)) {
      cleaned[key] = normalizeLeadMobile(cleaned[key]);
    }
  });
  return cleaned;
};

function LeadForm() {
  const [fields, setFields] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [formValues, setFormValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');

  const formSubmitUrl = '/api/leads';
  const dropdownUrl = '/api/leads?action=validation';

  useEffect(() => {
    const fetchFields = async () => {
      try {
        const response = await fetch(formSubmitUrl);
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || `Leads failed with status ${response.status}`);
        if (!Array.isArray(data)) throw new Error(data?.error || 'Leads did not return a row array');
        const fieldNames = Object.keys(data[0] || {});
        setLoadError('');
        setFields(fieldNames);
        initializeForm(fieldNames);
      } catch (error) {
        console.error('Error fetching fields:', error);
        setLoadError(error.message || 'Error fetching fields');
        setLoading(false);
      }
    };

    const fetchDropdowns = async () => {
      try {
        const response = await fetch(dropdownUrl);
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || `Validation failed with status ${response.status}`);
        const dropdowns = {};
        for (let field in data) {
          if (data[field].length > 0) {
            dropdowns[field] = data[field];
          }
        }
        setDropdownOptions(dropdowns);
      } catch (error) {
        console.error('Error fetching dropdown options:', error);
      }
    };

    const initializeForm = (fieldNames) => {
      const initialForm = {};
      fieldNames.forEach(field => {
        initialForm[field] = '';
      });
      setFormValues(initialForm);
      setLoading(false);
    };

    fetchFields();
    fetchDropdowns();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: isMobileField(name) ? normalizeLeadMobile(value) : value
    }));
  };

 const handleSubmit = async (e) => {
  e.preventDefault();
  if (submitting) return; // prevent double submits
  setSubmitting(true);

  const isBlank = (v) => v == null || String(v).trim() === '';

  // Trim everything first
  const trimmedValues = sanitizeMobileFields(Object.fromEntries(
    Object.entries(formValues).map(([k, v]) => [k, isBlank(v) ? '' : String(v).trim()])
  ));

  // 1) Block completely empty submissions (ignores "Timestamp" if present)
  const keysExclTimestamp = Object.keys(trimmedValues).filter(
    (k) => k.toLowerCase() !== 'timestamp'
  );
  const isCompletelyBlank = keysExclTimestamp.every((k) => isBlank(trimmedValues[k]));
  if (isCompletelyBlank) {
    alert('⚠️ Cannot submit a blank form. Please fill in the required fields.');
    setSubmitting(false);
    return;
  }

  // 2) Require Lead Owner (match header from sheet if it varies)
  const leadOwnerKey =
    fields.find((h) => String(h).trim().toLowerCase() === 'lead owner') || 'Lead Owner';
  const leadOwnerVal = trimmedValues[leadOwnerKey];
  if (isBlank(leadOwnerVal)) {
    alert('⚠️ Lead Owner is required.');
    setSubmitting(false);
    return;
  }

  const mobileKey = fields.find((h) => isMobileField(h));
  if (mobileKey && !isBlank(trimmedValues[mobileKey]) && trimmedValues[mobileKey].length !== 10) {
    alert('⚠️ Please enter a valid 10 digit mobile number. Do not include +91.');
    setSubmitting(false);
    return;
  }

  // 3) Build payload after validation
  const now = new Date();
  const timestamp = now.toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });

  const payload = { ...trimmedValues, Timestamp: timestamp };

  try {
    const res = await fetch(formSubmitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());

    alert('✅ Lead submitted successfully!');
    // Reset the form
    const reset = {};
    Object.keys(formValues).forEach((k) => (reset[k] = ''));
    setFormValues(reset);
  } catch (error) {
    console.error('❌ Error submitting lead:', error);
    alert('❌ Submission failed. Please try again.');
  } finally {
    setSubmitting(false);
  }
};


  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <ThemeProvider theme={theme}>
      <Paper
        elevation={3}
        sx={{
          width: '100%',
          maxWidth: 900,
          margin: { xs: 0, sm: '1rem auto', md: '2rem auto' },
          padding: { xs: 2, sm: 3, md: 4 },
          borderRadius: { xs: 2, md: 3 }
        }}
      >
        {/* Klient Konnect Logo */}
        <Box display="flex" justifyContent="center" mb={{ xs: 2, md: 3 }}>
          <img className="crm-primary-logo" src="/assets/rido-sports-logo.png" alt="Rido Sports" />
        </Box>

        <Typography
          variant="h5"
          fontWeight="bold"
          color="#6495ED"
          mb={{ xs: 2, md: 3 }}
          textAlign="center"
          sx={{ fontSize: { xs: 24, sm: 28 }, lineHeight: 1.2 }}
        >
          Add New Lead
        </Typography>

        {loadError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {loadError}
          </Alert>
        )}

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
                      {dropdownOptions[field].map((option, idx) => (
                        <MenuItem key={idx} value={option}>{option}</MenuItem>
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
                    type={isMobileField(field) ? 'tel' : 'text'}
                    helperText={isMobileField(field) ? 'Enter 10 digit mobile number. +91 is removed automatically.' : ''}
                    InputProps={isMobileField(field) ? {
                      startAdornment: <InputAdornment position="start">+91</InputAdornment>
                    } : undefined}
                    inputProps={isMobileField(field) ? {
                      maxLength: 10,
                      inputMode: 'numeric',
                      pattern: '[0-9]*'
                    } : undefined}
                  />
                )}
              </Grid>
            ))}
          </Grid>

          <Box mt={3} display="flex" justifyContent={{ xs: 'stretch', sm: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              fullWidth={false}
              sx={{ backgroundColor: '#6495ED', width: { xs: '100%', sm: 'auto' } }}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Lead'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </ThemeProvider>
  );
}

export default LeadForm;
