import React, { useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, TextField, Typography,
} from '@mui/material';
import { athleticUnitDepth, athleticVolume } from './athleticRateLibrary';

export default function AthleticVolumeCalculator({ rows, quotedArea, onApply, onClose }) {
  const defaultIndex = rows.findIndex(row => athleticUnitDepth(row));
  const [rowIndex, setRowIndex] = useState(defaultIndex >= 0 ? defaultIndex : '');
  const [linkedArea, setLinkedArea] = useState(true);
  const [customArea, setCustomArea] = useState(quotedArea || '');
  const [depth, setDepth] = useState(defaultIndex >= 0 ? athleticUnitDepth(rows[defaultIndex]) * 1000 : '');
  const [depthUnit, setDepthUnit] = useState('mm');
  const area = linkedArea ? quotedArea : customArea;
  const result = athleticVolume(area, depth, depthUnit);
  const format = value => value.toLocaleString('en-IN', { maximumFractionDigits: 6 });

  return <Dialog open fullWidth maxWidth="sm" disableEscapeKeyDown
    onClose={(event, reason) => { if (reason !== 'backdropClick') onClose(); }}>
    <DialogTitle>SQM to CUM</DialogTitle>
    <DialogContent dividers sx={{ display: 'grid', gap: 2, pt: 2 }}>
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
      <TextField select fullWidth label="Apply to quotation item" value={rowIndex}
        onChange={event => {
          const index = event.target.value;
          setRowIndex(index);
          const libraryDepth = athleticUnitDepth(rows[index]);
          setDepth(libraryDepth ? libraryDepth * 1000 : '');
          setDepthUnit('mm');
        }}>
        {rows.map((row, index) => <MenuItem key={index} value={index} sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
          {index + 1}. {row.libraryItem || row.itemCode || row.desc || 'Unnamed item'}
        </MenuItem>)}
      </TextField>
      <Alert severity="warning">The item unit will become CUM. Its unit price remains unchanged and must be checked for CUM pricing.</Alert>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="contained" disabled={!result || rowIndex === '' || !rows[rowIndex]}
        onClick={() => { onApply(Number(rowIndex), { area, depth, depthUnit, linkedArea }); onClose(); }}>Apply to Item</Button>
    </DialogActions>
  </Dialog>;
}
