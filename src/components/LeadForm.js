// LeadForm.js
import React, { useState, useEffect } from 'react';
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

  const [validations, setValidations] = useState({
    leadOwners: [],
    leadSources: [],
    leadStatuses: []
  });

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbzDZPePrzWhMv2t_lAeAEkVa-5J4my7xBonm4zIFOne-wtJ-EGKr0zXvBlmNtfuYaFhiQ/exec')
      .then(res => res.json())
      .then(data => {
        setValidations({
          leadOwners: data.LeadOwner || [],
          leadSources: data.LeadSource || [],
          leadStatuses: data.LeadStatus || []
        });
      })
      .catch(err => console.error('Validation fetch error', err));
  }, []);

  const handleChange = (e) => {
    setLead({ ...lead, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Submitting lead:\n' + JSON.stringify(lead, null, 2));
    // TODO: Later connect to your Google Sheet API to post
  };

  return (
    <ThemeProvider theme={theme}>
      <Paper elevation={3} sx={{ maxWidth: 900, margin: '2rem auto', padding: 4 }}>
        <Typography variant="h5" fontWeight="bold" color="#6495ED" mb={3}>
          Add New Lead
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>

            {/* Fields with Dynamic Dropdowns */}
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Lead Owner"
                name="leadOwner"
                value={lead.leadOwner}
                onChange={handleChange}
                size="small"
              >
                {validations.leadOwners.map(owner => (
                  <MenuItem key={owner} value={owner}>{owner}</MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                name="firstName"
                value={lead.firstName}
                onChange={handleChange}
                size="small"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                name="lastName"
                value={lead.lastName}
                onChange={handleChange}
                size="small"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company"
                name="company"
                value={lead.company}
                onChange={handleChange}
                size="small"
              />
            </Grid>

            {/* More Standard Fields */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Mobile"
                name="mobile"
                value={lead.mobile}
                onChange={handleChange}
                size="small"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                value={lead.email}
                onChange={handleChange}
                size="small"
              />
            </Grid>

            {/* Lead Source Dropdown */}
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Lead Source"
                name="leadSource"
                value={lead.leadSource}
                onChange={handleChange}
                size="small"
              >
                {validations.leadSources.map(source => (
                  <MenuItem key={source} value={source}>{source}</MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Lead Status Dropdown */}
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
                {validations.leadStatuses.map(status => (
                  <MenuItem key={status} value={status}>{status}</MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Remaining Standard Inputs */}
            {[
              ['Website', 'website'],
              ['Fax', 'fax'],
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

            {/* Textareas */}
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

          {/* Submit Button */}
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
