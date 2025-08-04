// ManageTravel.js — Accordion-styled modal form for Travel Requests
import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, Box, Typography, Grid,
  TextField, Button, Accordion, AccordionSummary, AccordionDetails,
  Select, MenuItem, FormControl, InputLabel, createTheme, ThemeProvider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LoadingOverlay from './LoadingOverlay';
import '@fontsource/montserrat';

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 10.5
  }
});

const sectionStyle = {
  fontFamily: 'Montserrat, sans-serif',
  fontWeight: 600
};

const ManageTravel = ({ validationOptions, onClose, onSuccess }) => {
  const [fields, setFields] = useState([]);
  const [formValues, setFormValues] = useState({});
  const [requiredFields, setRequiredFields] = useState([]);
  const [readOnlyFields, setReadOnlyFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const dataUrl = 'https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec';

  useEffect(() => {
    fetch(`${dataUrl}?action=getTravelFields`)
      .then(res => res.json())
      .then((data) => {
        setFields(data.headers);
        setRequiredFields(data.required || []);
        setReadOnlyFields(data.readOnly || []);

        const initial = {};
        data.headers.forEach(field => (initial[field] = ''));
        setFormValues(initial);
        setLoading(false);
      });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const timestamp = new Date().toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });

    const payload = {
      ...formValues,
      Timestamp: timestamp
    };

    try {
      await fetch(dataUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      alert('✅ Travel request submitted successfully');
      onSuccess();
      onClose();
    } catch (err) {
      alert('❌ Error submitting travel request');
      console.error(err);
    }
    setSubmitting(false);
  };

  const groupedSections = {
    'Traveler Info': [
      'Requested By', 'Department', 'Designation'
    ],
    'Travel Details': [
      'Travel Type', 'Travel Purpose', 'Destination', 'Start Date', 'End Date', 'Mode of Travel'
    ],
    'Booking & Budget': [
      'Preferred Airline / Train / Service', 'Accommodation Required', 'Hotel Preference', 'Expected Budget (₹)'
    ],
    'Approval & Status': [
      'Approval Status', 'Approved By', 'Travel Status', 'Remarks / Justification', 'Booking Confirmation Details', 'Expense Settlement Status', 'Final Amount Spent (₹)', 'Supporting Documents (Link)'
    ]
  };

  if (loading) return <LoadingOverlay />;

  return (
    <ThemeProvider theme={theme}>
      <Dialog open fullWidth maxWidth="md" onClose={onClose}>
        <DialogTitle sx={{ fontWeight: 'bold', fontFamily: 'Montserrat, sans-serif' }}>Add Travel Request</DialogTitle>
        <DialogContent dividers>
          {Object.entries(groupedSections).map(([section, keys]) => (
            <Accordion key={section} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#f0f4ff' }}>
                <Typography sx={sectionStyle}>{section}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {keys.map((field) => (
                    <Grid item xs={12} sm={6} key={field}>
                      {validationOptions[field] ? (
                        <FormControl fullWidth size="small">
                          <InputLabel>{field}</InputLabel>
                          <Select
                            name={field}
                            label={field}
                            value={formValues[field] || ''}
                            onChange={handleChange}
                            disabled={readOnlyFields.includes(field)}
                          >
                            {validationOptions[field].map((opt, idx) => (
                              <MenuItem key={idx} value={opt}>{opt}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <TextField
                          fullWidth
                          label={field}
                          name={field}
                          value={formValues[field] || ''}
                          onChange={handleChange}
                          size="small"
                          required={requiredFields.includes(field)}
                          InputProps={{ readOnly: readOnlyFields.includes(field) }}
                        />
                      )}
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          ))}

          <Box mt={3} display="flex" justifyContent="flex-end">
            <Button variant="contained" sx={{ backgroundColor: '#6495ED' }} onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Travel Request'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </ThemeProvider>
  );
};

export default ManageTravel;
