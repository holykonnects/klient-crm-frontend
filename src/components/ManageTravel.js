// Updated ManageTravel.js with Add/Edit mode support and prefilled data
import React, { useEffect, useState } from 'react';
import {
  Box, Button, Grid, TextField, Select, MenuItem,
  Accordion, AccordionSummary, AccordionDetails, Typography,
  FormControl, InputLabel
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import '@fontsource/montserrat';
import { useAuth } from './AuthContext'; // Adjust path if needed


const inputStyle = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: '0.9rem',
  width: '100%'
};

const ManageTravel = ({ validationOptions, onClose, onSuccess, selectedRow = {}, isEdit = false }) => {
  const { user } = useAuth(); // Step 3: This is where you add the hook
  const [formData, setFormData] = useState({}); 

  useEffect(() => {
    if (isEdit && selectedRow) {
      setFormData({ ...selectedRow });
    } else {
      setFormData(prev => ({
        ...prev,
        'Requested By': user.username || ''
      }));
    }
  }, [selectedRow,isEdit,user.username]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      const res = await fetch('https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec', {
        method: 'POST',
        body: JSON.stringify(formData),
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await res.json();
      if (result.success) {
        onSuccess();
        onClose();
      } else {
        alert('Error submitting data');
      }
    } catch (err) {
      console.error('Submission error:', err);
      alert('Submission failed');
    }
  };

  const renderField = (label) => {
    const key = label.trim();
    const isDropdown = Object.keys(validationOptions).includes(key);

    return (
      <Grid item xs={12} sm={6} key={key}>
        {isDropdown ? (
          <FormControl fullWidth>
            <InputLabel>{key}</InputLabel>
            <Select
              value={formData[key] || ''}
              label={key}
              onChange={(e) => handleChange(key, e.target.value)}
            >
              {validationOptions[key].map(option => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <TextField
            label={key}
            value={formData[key] || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            fullWidth
            sx={inputStyle}
          />
        )}
      </Grid>
    );
  };

  const groupedSections = {
    'Traveler Info': ["Requested By", "Department", "Designation"],
    'Travel Details': ["Travel Type", "Travel Purpose", "Destination", "Start Date", "End Date", "Mode of Travel"],
    'Booking & Budget': ["Preferred Airline / Train / Service", "Accommodation Required", "Hotel Preference", "Expected Budget (₹)", "Final Amount Spent (₹)", "Supporting Documents (Link)"],
    'Approval & Status': ["Approval Status", "Approved By", "Travel Status", "Remarks / Justification", "Booking Confirmation Details", "Expense Settlement Status"]
  };

  return (
    <Box sx={{ p: 2, fontFamily: 'Montserrat, sans-serif' }}>
      <Typography variant="h6" gutterBottom>{isEdit ? 'Edit Travel' : 'Add Travel'}</Typography>
      {Object.entries(groupedSections).map(([section, fields]) => (
        <Accordion key={section} defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#f0f4ff', fontWeight: 'Medium' }}>
            <Typography sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>{section}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {fields.map(field => renderField(field))}
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}
      <Box mt={2} textAlign="right">
        <Button variant="contained" onClick={handleSubmit}>{isEdit ? 'Update' : 'Submit'}</Button>
      </Box>
    </Box>
  );
};

export default ManageTravel;
