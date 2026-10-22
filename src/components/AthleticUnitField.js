import React, { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material';
import { athleticVolume, convertAthleticUnit } from './athleticRateLibrary';

export default function AthleticUnitField({ row, options = [], onChange, sx }) {
  const [pending, setPending] = useState(null);
  const [depth, setDepth] = useState('');
  const [depthUnit, setDepthUnit] = useState('mm');
  const unitNames = { SQM: 'Square metres', CUM: 'Cubic metres', RMT: 'Running metres', SQFT: 'Square feet', CFT: 'Cubic feet', Nos: 'Number', Set: 'Set', Job: 'Job', LS: 'Lump sum' };
  const units = [...new Set(['SQM', 'CUM', 'RMT', 'SQFT', 'CFT', 'Nos', 'Set', 'Job', 'LS', ...options, row.unit].filter(Boolean))];
  const commit = value => {
    if (value === (row.unit || '')) return;
    const converted = convertAthleticUnit(row, value);
    if (converted) onChange(converted);
    else { setPending(value); setDepth(''); }
  };
  const thickness = athleticVolume(1, depth, depthUnit)?.depthMetres;
  const converted = thickness ? convertAthleticUnit(row, pending, thickness) : null;
  const cancel = () => setPending(null);

  return <>
    <TextField select fullWidth size="small" label="Unit" value={row.unit || ''} sx={sx}
      SelectProps={{ renderValue: selected => selected }}
      helperText={row.unitEdited ? 'Rate unchanged' : undefined}
      onChange={event => commit(event.target.value)}>
      <MenuItem value="" disabled>Select unit</MenuItem>
      {units.map(unit => <MenuItem key={unit} value={unit}>{unitNames[unit] ? `${unit} - ${unitNames[unit]}` : unit}</MenuItem>)}
    </TextField>
    <Dialog open={pending !== null} fullWidth maxWidth="xs" disableEscapeKeyDown
      onClose={(event, reason) => { if (reason !== 'backdropClick') cancel(); }}>
      <DialogTitle>Convert {row.unit} to {pending}</DialogTitle>
      <DialogContent dividers sx={{ display: 'grid', gap: 2 }}>
        <TextField autoFocus type="number" label="Depth / thickness" value={depth}
          inputProps={{ min: 0, step: 'any' }} onChange={event => setDepth(event.target.value)} />
        <TextField select label="Depth unit" value={depthUnit} onChange={event => setDepthUnit(event.target.value)}>
          {['mm', 'cm', 'm'].map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
        </TextField>
        <Typography role="status" aria-live="polite">{converted ? `${converted.qty.toLocaleString('en-IN', { maximumFractionDigits: 6 })} ${pending}` : 'Depth required'}</Typography>
        <Alert severity="warning">Unit price remains unchanged. Check the price for the new unit.</Alert>
      </DialogContent>
      <DialogActions><Button onClick={cancel}>Cancel</Button><Button variant="contained" disabled={!converted}
        onClick={() => { onChange(converted); setPending(null); }}>Apply</Button></DialogActions>
    </Dialog>
  </>;
}
