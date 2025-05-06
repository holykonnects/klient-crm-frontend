// CreateDealModal.js
import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Grid, TextField, Select, MenuItem, InputLabel, FormControl
} from '@mui/material';

const CreateDealModal = ({ open, onClose, dealData, onChange, onSubmit, validationOptions }) => {
  if (!dealData) return null;

  const renderField = (key, label) => (
    validationOptions[key] ? (
      <FormControl fullWidth size="small" key={key}>
        <InputLabel>{label}</InputLabel>
        <Select
          name={key}
          value={dealData[key] || ''}
          onChange={onChange}
          label={label}
        >
          {validationOptions[key].map((option, idx) => (
            <MenuItem key={idx} value={option}>{option}</MenuItem>
          ))}
        </Select>
      </FormControl>
    ) : (
      <TextField
        fullWidth
        name={key}
        label={label}
        value={dealData[key] || ''}
        onChange={onChange}
        size="small"
        key={key}
      />
    )
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Create Deal</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          {Object.keys(dealData).map((key, i) => (
            <Grid item xs={6} key={i}>
              {renderField(key, key)}
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button onClick={onSubmit} variant="contained" sx={{ backgroundColor: '#6495ED' }}>
          Submit Deal
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateDealModal;
