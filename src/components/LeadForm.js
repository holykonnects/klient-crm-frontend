function doGet() {
  const sheet = SpreadsheetApp.openById('1vJbB0fmBQhd6XGTNbjUAi7Bt71lHNyau2TBMXTCdoM0').getSheetByName('Form responses 1');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const jsonData = data.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
  return ContentService.createTextOutput(JSON.stringify(jsonData)).setMimeType(ContentService.MimeType.JSON);
}

function sanitizeLeadMobile_(value) {
  const raw = String(value || '').trim();
  let digits = raw.replace(/\D/g, '');

  if (raw.indexOf('+91') === 0) {
    digits = digits.slice(2);
  } else if (digits.length > 10 && digits.indexOf('91') === 0) {
    digits = digits.slice(2);
  }

  if (digits.length > 10) {
    digits = digits.slice(-10);
  }

  return digits;
}

function doPost(e) {
  try {
    Logger.log('✅ doPost triggered');
    Logger.log('📦 Payload received: ' + e.postData.contents);

    const sheetId = '1vJbB0fmBQhd6XGTNbjUAi7Bt71lHNyau2TBMXTCdoM0';
    const sheetName = 'Form Responses 1';
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      Logger.log('❌ Sheet not found');
      return ContentService.createTextOutput('Sheet not found').setMimeType(ContentService.MimeType.TEXT);
    }

    const body = JSON.parse(e.postData.contents);
    const fields = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const newRow = [];

    const now = new Date();
    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss.SSS");

    fields.forEach(field => {
      if (field === 'Timestamp') {
        newRow.push(timestamp);
      } else if (String(field).trim().toLowerCase() === 'mobile number') {
        const mobile = sanitizeLeadMobile_(body[field]);
        newRow.push(mobile ? "'" + mobile : '');
      } else {
        newRow.push(body[field] || '');
      }
    });

    Logger.log('✅ New row prepared: ' + JSON.stringify(newRow));
    sheet.appendRow(newRow);
    Logger.log('✅ Row appended successfully');

    return ContentService.createTextOutput('Success').setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    Logger.log('❌ Error in doPost: ' + error);
    return ContentService.createTextOutput('Error').setMimeType(ContentService.MimeType.TEXT);
  }
}

import React, { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, Grid, MenuItem,
  createTheme, ThemeProvider, Paper, Select, InputLabel, FormControl,
  InputAdornment
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

  const formSubmitUrl = 'https://script.google.com/macros/s/AKfycbwCmyJEEbAy4h3SY630yJSaB8Odd2wL_nfAmxvbKKU0oC4jrdWwgHab-KUpPzGzKBaEUA/exec';
  const dropdownUrl = 'https://script.google.com/macros/s/AKfycbzDZPePrzWhMv2t_lAeAEkVa-5J4my7xBonm4zIFOne-wtJ-EGKr0zXvBlmNtfuYaFhiQ/exec';

  useEffect(() => {
    const fetchFields = async () => {
      try {
        const response = await fetch(formSubmitUrl);
        const data = await response.json();
        const fieldNames = Object.keys(data[0] || {});
        setFields(fieldNames);
        initializeForm(fieldNames);
      } catch (error) {
        console.error('Error fetching fields:', error);
      }
    };

    const fetchDropdowns = async () => {
      try {
        const response = await fetch(dropdownUrl);
        const data = await response.json();
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
    await fetch(formSubmitUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

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
      <Paper elevation={3} sx={{ maxWidth: 900, margin: '2rem auto', padding: 4 }}>
        {/* Klient Konnect Logo */}
        <Box display="flex" justifyContent="center" mb={3}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
        </Box>

        <Typography variant="h5" fontWeight="bold" color="#6495ED" mb={3} textAlign="center">
          Add New Lead
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

          <Box mt={3} display="flex" justifyContent="flex-end">
            <Button type="submit" variant="contained" sx={{ backgroundColor: '#6495ED' }} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Lead'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </ThemeProvider>
  );
}

export default LeadForm;
