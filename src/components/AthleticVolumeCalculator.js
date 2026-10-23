import React, { useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, TextField, Typography,
} from '@mui/material';
import { athleticUnitDepth, athleticVolume } from './athleticRateLibrary';
import AthleticItemContext from './AthleticItemContext';

export default function AthleticVolumeCalculator({ rows, rowIndex, quotedArea, onApply, onClose }) {
  const row = rows[rowIndex];
  const defaultDepth = athleticUnitDepth(row);
  const useQuotedArea = !row.qtyEdited && ['AREA', 'AREA_X_FACTOR'].includes(row.qtyDriver);
  const [linkedArea, setLinkedArea] = useState(useQuotedArea);
  const [customArea, setCustomArea] = useState(String(row.unit).toUpperCase() === 'SQM' ? row.qty : defaultDepth && String(row.unit).toUpperCase() === 'CUM' ? Number(row.qty) / defaultDepth : quotedArea || '');
  const [depth, setDepth] = useState(defaultDepth ? defaultDepth * 1000 : '');
  const [depthUnit, setDepthUnit] = useState('mm');
  const area = linkedArea ? quotedArea : customArea;
  const result = athleticVolume(area, depth, depthUnit);
  const format = value => value.toLocaleString('en-IN', { maximumFractionDigits: 6 });

  return <Dialog open fullWidth maxWidth="sm" disableEscapeKeyDown
    onClose={(event, reason) => { if (reason !== 'backdropClick') onClose(); }}>
    <DialogTitle>SQM to CUM</DialogTitle>
    <DialogContent dividers sx={{ display: 'grid', gap: 2, pt: 2 }}>
      <AthleticItemContext row={row} quotedArea={quotedArea} />
      <FormControlLabel label="Use quoted surface area" control={<Checkbox checked={linkedArea}
        onChange={event => setLinkedArea(event.target.checked)} />} />
      <TextField fullWidth type="number" label="Area (SQM)" value={area || ''}
        InputProps={{ readOnly: linkedArea }} inputProps={{ min: 0, step: 'any' }}
        onChange={event => setCustomArea(event.target.value)} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 100px', gap: 2 }}>
        <TextField type="number" label="Depth / thickness" value={depth}
          inputProps={{ min: 0, step: 'any' }} onChange={event => setDepth(event.target.value)} />
        <TextField select label="Unit" value={depthUnit} onChange={event => setDepthUnit(event.target.value)}>
          {['mm', 'cm', 'm'].map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
        </TextField>
      </Box>
      <Box role="status" aria-live="polite" sx={{ py: 1 }}>
        <Typography variant="h6">{result ? `${format(result.volume)} CUM` : 'Volume: --'}</Typography>
        {result && <Typography variant="body2" color="text.secondary">
          {format(Number(String(area).replace(/,/g, '')))} SQM x {format(result.depthMetres)} m
        </Typography>}
      </Box>
      <Alert severity="warning">The item unit will become CUM. Its unit price remains unchanged and must be checked for CUM pricing.</Alert>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="contained" disabled={!result || rowIndex === '' || !rows[rowIndex]}
        onClick={() => { onApply(Number(rowIndex), { area, depth, depthUnit, linkedArea }); onClose(); }}>Apply to Item</Button>
    </DialogActions>
  </Dialog>;
}
