import React, { useState } from 'react';
import {
  Box, TextField, Typography, Button, MenuItem, Grid
} from '@mui/material';
import DashboardLayout from '../components/DashboardLayout';

const initialState = {
  leadOwner: '', firstName: '', lastName: '', company: '', mobile: '', email: '',
  fax: '', website: '', leadSource: '', leadStatus: '', industry: '',
  employees: '', revenue: '', social: '', description: '', street: '', city: '',
  state: '', country: '', pincode: '', additionalDescription: ''
};

function LeadForm() {
  const [lead, setLead] = useState(initialState);

  const handleChange = (e) => {
    setLead({ ...lead, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Submitting lead:\n' + JSON.stringify(lead, null, 2));
    // TODO: connect to backend or Google Apps Script
  };

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: '900px', margin: '0 auto', padding: 4 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 80 }} />
          <Typography variant="h5" fontWeight="bold" sx={{ fontFamily: 'Montserrat' }}>
            Add New Lead
          </Typography>
        </Box>

        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            {[
              { label: 'Lead Owner', name: 'leadOwner' },
              { label: 'First Name', name: 'firstName' },
              { label: 'Last Name', name: 'lastName' },
              { label: 'Company', name: 'company' },
              { label: 'Mobile', name: 'mobile' },
              { label: 'Email', name: 'email', type: 'email' },
              { label: 'Fax', name: 'fax' },
              { label: 'Website', name: 'website' },
              { label: 'Lead Source', name: 'leadSource' },
              {
                label: 'Lead Status', name: 'leadStatus', type: 'select', options: ['New', 'Contacted', 'Qualified']
              },
              { label: 'Industry', name: 'industry' },
              { label: 'No. of Employees', name: 'employees', type: 'number' },
              { label: 'Annual Revenue', name: 'revenue' },
              { label: 'Social Media', name: 'social' },
              { label: 'Street', name: 'street' },
              { label: 'City', name: 'city' },
              { label: 'State', name: 'state' },
              { label: 'Country', name: 'country' },
              { label: 'Pincode', name: 'pincode' },
            ].map(({ label, name, type = 'text', options }, idx) => (
              <Grid item xs={12} sm={6} key={idx}>
                {type === 'select' ? (
                  <TextField
                    fullWidth select label={label} name={name} value={lead[name]} onChange={handleChange}
                    size="small" variant="outlined"
                  >
                    <MenuItem value="">Select</MenuItem>
                    {options.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                  </TextField>
                ) : (
                  <TextField
                    fullWidth label={label} name={name} type={type} value={lead[name]}
                    onChange={handleChange} size="small" variant="outlined"
                  />
                )}
              </Grid>
            ))}

            <Grid item xs={12}>
              <TextField
                fullWidth multiline rows={3}
                label="Description" name="description" value={lead.description}
                onChange={handleChange} size="small" variant="outlined"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth multiline rows={3}
                label="Additional Description" name="additionalDescription" value={lead.additionalDescription}
                onChange={handleChange} size="small" variant="outlined"
              />
            </Grid>

            <Grid item xs={12}>
              <Button variant="contained" type="submit" sx={{ backgroundColor: '#6495ED' }}>
                Submit Lead
              </Button>
            </Grid>
          </Grid>
        </form>
      </Box>
    </DashboardLayout>
  );
}

export default LeadForm;
