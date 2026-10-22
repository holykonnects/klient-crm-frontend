import React, { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material';
import { athleticVolume, convertAthleticUnit } from './athleticRateLibrary';

export default function AthleticUnitField({ row, onChange, sx }) {
  const [value, setValue] = useState(row.unit || '');
  const [pending, setPending] = useState(null);
  const [depth, setDepth] = useState('');
  const [depthUnit, setDepthUnit] = useState('mm');
  useEffect(() => setValue(row.unit || ''), [row.unit]);
  const commit = () => {
    if (value === (row.unit || '')) return;
    const converted = convertAthleticUnit(row, value);
    if (converted) onChange(converted);
    else { setPending(value); setDepth(''); }
  };
  const thickness = athleticVolume(1, depth, depthUnit)?.depthMetres;
  const converted = thickness ? convertAthleticUnit(row, pending, thickness) : null;
  const cancel = () => { setPending(null); setValue(row.unit || ''); };

  return <>
    <TextField fullWidth size="small" label="Unit" value={value} sx={sx}
      helperText={row.unitEdited ? 'Rate unchanged' : undefined}
      onChange={event => setValue(event.target.value)} onBlur={commit}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.querySelector('input')?.blur(); } }} />
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
