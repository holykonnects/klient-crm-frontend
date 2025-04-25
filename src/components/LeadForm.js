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
    leadOwner: '', company: '', firstName: '', lastName: '', 
    mobile: '', email: '', fax: '', website: '', leadSource: '',
    leadStatus: '', industry: '', employees: '', revenue: '',
    social: '', description: '', street: '', city: '', state: '',
    country: '', pincode: '', additionalDescription: ''
  });

  const handleChange = (e) => {
    setLead({ ...lead, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Submitting lead:\n' + JSON.stringify(lead, null, 2));
    // TODO: Connect to Apps Script endpoint via fetch
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ maxWidth: 1000, margin: '2rem auto' }}>
        {/* Logo + Title Header */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} px={2}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 80 }} />
          <Typography variant="h5" fontWeight="bold" color="#6495ED">
            Add New Lead
          </Typography>
        </Box>

        <Paper elevation={3} sx={{ padding: 4 }}>
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              {[
                ['Lead Owner', 'leadOwner'],
                ['Company', 'company'],
                ['First Name', 'firstName'],
                ['Last Name', 'lastName'],
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
                  {['New', 'Contacted', 'Qualified'].map(option => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              {/* Description TextArea */}
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

              {/* Additional Description */}
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
      </Box>
    </ThemeProvider>
  );
}

export default LeadForm;
