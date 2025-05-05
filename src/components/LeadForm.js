// LeadForm.js
import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Grid, MenuItem,
  createTheme, ThemeProvider, Paper
} from '@mui/material';

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 9
  }
});

function LeadForm() {
  const [lead, setLead] = useState({
    leadOwner: '', firstName: '', lastName: '', company: '',
    mobile: '', email: '', fax: '', website: '', leadSource: '',
    leadStatus: '', industry: '', employees: '', revenue: '',
    social: '', description: '', street: '', city: '', state: '',
    country: '', pincode: '', additionalDescription: ''
  });

  const handleChange = (e) => {
    setLead({ ...lead, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

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

    const payload = { ...lead, Timestamp: timestamp };

    try {
      const response = await fetch("https://script.google.com/macros/s/AKfycbzDZPePrzWhMv2t_lAeAEkVa-5J4my7xBonm4zIFOne-wtJ-EGKr0zXvBlmNtfuYaFhiQ/exec", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        }
      });

      if (!response.ok) throw new Error("Network response was not ok");

      alert("✅ Lead submitted successfully!");

      setLead({
        leadOwner: '', firstName: '', lastName: '', company: '',
        mobile: '', email: '', fax: '', website: '', leadSource: '',
        leadStatus: '', industry: '', employees: '', revenue: '',
        social: '', description: '', street: '', city: '', state: '',
        country: '', pincode: '', additionalDescription: ''
      });
    } catch (err) {
      console.error("Submission error:", err);
      alert("❌ Failed to submit lead.");
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Paper elevation={3} sx={{ maxWidth: 900, margin: '2rem auto', padding: 4 }}>
        <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 60 }} />
          <Typography variant="h5" fontWeight="bold" color="#6495ED">Add New Lead</Typography>
        </Box>

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            {[
              ['Lead Owner', 'leadOwner'],
              ['First Name', 'firstName'],
              ['Last Name', 'lastName'],
              ['Company', 'company'],
              ['Mobile', 'mobile'],
              ['Email', 'email'],
              ['Fax', 'fax'],
              ['Website', 'website'],
              ['Lead Source', 'leadSource'],
              ['Industry', 'industry'],
              ['No. of Employees', 'employees'],
              ['Annual Revenue', 'revenue'],
              ['Social Media', 'social'],
              ['Street', 'street'],
              ['City', 'city'],
              ['State', 'state'],
              ['Country', 'country'],
              ['Pincode', 'pincode']
            ].map(([label, name]) => (
              <Grid item xs={12} sm={6} key={name}>
                <TextField
                  fullWidth
                  label={label}
                  name={name}
                  value={lead[name]}
                  onChange={handleChange}
                  size="small"
                />
              </Grid>
            ))}

            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Lead Status"
                name="leadStatus"
                value={lead.leadStatus}
                onChange={handleChange}
                size="small"
              >
                {['New', 'Contacted', 'Qualified'].map(option => (
                  <MenuItem key={option} value={option}>{option}</MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Description"
                name="description"
                value={lead.description}
                onChange={handleChange}
                size="small"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Additional Description"
                name="additionalDescription"
                value={lead.additionalDescription}
                onChange={handleChange}
                size="small"
              />
            </Grid>
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
