import React from 'react';
import { Autocomplete, TextField } from '@mui/material';

export default function QuotationChargeField({ label, value, onChange, sx }) {
  return <Autocomplete freeSolo options={['Included', 'Excluded', 'Extra']} value={String(value ?? '')}
    inputValue={String(value ?? '')} onInputChange={(event, text) => onChange(text)}
    renderInput={params => <TextField {...params} fullWidth size="small" placeholder="Included / Excluded / Value"
      inputProps={{ ...params.inputProps, 'aria-label': label }} sx={sx} />} />;
}
