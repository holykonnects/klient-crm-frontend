// src/components/ManageTravel.js
import React, { useState } from 'react';
import {
  Box, Button, Grid, TextField, Select, MenuItem,
  Accordion, AccordionSummary, AccordionDetails, Typography,
  FormControl, InputLabel
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import '@fontsource/montserrat';

const inputStyle = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: '10pt'
};

const labelStyle = {
  fontFamily: 'Montserrat, sans-serif',
  fontWeight: 600
};

const ManageTravel = ({ travelData = {}, validationOptions = {}, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ ...travelData });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const payload = {
      ...formData,
      Timestamp: new Date().toLocaleString()
    };

    try {
      const response = await fetch('https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec', {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        alert('Travel entry submitted successfully!');
        onSuccess && onSuccess();
        onClose();
      } else {
        alert('Submission failed. Please try again.');
      }
    } catch (err) {
      console.error('❌ Submission error:', err);
      alert('Error submitting form. Please check console for details.');
    }
  };

  const renderSelect = (label, field, options = []) => (
    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
      <InputLabel sx={labelStyle}>{label}</InputLabel>
      <Select
        value={formData[field] || ''}
        onChange={e => handleChange(field, e.target.value)}
        sx={inputStyle}
      >
        <MenuItem value="">Select</MenuItem>
        {options.map(opt => (
          <MenuItem key={opt} value={opt}>{opt}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  const renderTextField = (label, field, multiline = false) => (
    <TextField
      fullWidth
      size="small"
      label={label}
      value={formData[field] || ''}
      onChange={e => handleChange(field, e.target.value)}
      sx={{ mb: 2, ...inputStyle }}
      multiline={multiline}
    />
  );

  return (
    <Box sx={{ fontFamily: 'Montserrat, sans-serif' }}>
      <Box sx={{ mb: 2, textAlign: 'center' }}>
        <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 40 }} />
        <Typography variant="h6" sx={{ mt: 1, fontWeight: 600 }}>
          Travel Request Form
        </Typography>
      </Box>

      {/* Section: Traveler Info */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#f0f4ff' }}>
          <Typography sx={labelStyle}>Traveler Info</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={6}>{renderTextField('Requested By', 'Requested By')}</Grid>
            <Grid item xs={6}>{renderSelect('Department', 'Department', validationOptions.department || [])}</Grid>
            <Grid item xs={6}>{renderSelect('Designation', 'Designation', validationOptions.designation || [])}</Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Travel Details */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#f0f4ff' }}>
          <Typography sx={labelStyle}>Travel Details</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={6}>{renderSelect('Travel Type', 'Travel Type', validationOptions.travelType || [])}</Grid>
            <Grid item xs={6}>{renderTextField('Travel Purpose', 'Travel Purpose')}</Grid>
            <Grid item xs={6}>{renderTextField('Destination', 'Destination')}</Grid>
            <Grid item xs={3}>{renderTextField('Start Date', 'Start Date')}</Grid>
            <Grid item xs={3}>{renderTextField('End Date', 'End Date')}</Grid>
            <Grid item xs={6}>{renderSelect('Mode of Travel', 'Mode of Travel', validationOptions.modeOfTravel || [])}</Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Booking & Budget */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#f0f4ff' }}>
          <Typography sx={labelStyle}>Booking & Budget</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={6}>{renderTextField('Preferred Airline / Train / Service', 'Preferred Airline / Train / Service')}</Grid>
            <Grid item xs={6}>{renderSelect('Accommodation Required', 'Accommodation Required', ['Yes', 'No'])}</Grid>
            <Grid item xs={6}>{renderTextField('Hotel Preference', 'Hotel Preference')}</Grid>
            <Grid item xs={6}>{renderTextField('Expected Budget (₹)', 'Expected Budget (₹)')}</Grid>
            <Grid item xs={12}>{renderTextField('Remarks / Justification', 'Remarks / Justification', true)}</Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Approval & Status */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#f0f4ff' }}>
          <Typography sx={labelStyle}>Approval & Status</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={6}>{renderSelect('Approval Status', 'Approval Status', validationOptions.approvalStatus || [])}</Grid>
            <Grid item xs={6}>{renderTextField('Approved By', 'Approved By')}</Grid>
            <Grid item xs={6}>{renderSelect('Travel Status', 'Travel Status', validationOptions.travelStatus || [])}</Grid>
            <Grid item xs={6}>{renderSelect('Expense Settlement Status', 'Expense Settlement Status', validationOptions.expenseSettlementStatus || [])}</Grid>
            <Grid item xs={6}>{renderTextField('Final Amount Spent (₹)', 'Final Amount Spent (₹)')}</Grid>
            <Grid item xs={6}>{renderTextField('Booking Confirmation Details', 'Booking Confirmation Details')}</Grid>
            <Grid item xs={12}>{renderTextField('Supporting Documents (Link)', 'Supporting Documents (Link)')}</Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Box sx={{ mt: 2, textAlign: 'right' }}>
        <Button variant="contained" onClick={handleSubmit} sx={{ fontFamily: 'Montserrat' }}>
          Submit
        </Button>
      </Box>
    </Box>
  );
};

export default ManageTravel;
