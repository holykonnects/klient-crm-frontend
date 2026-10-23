import React, { useState } from 'react';
import { Alert, Box, Dialog, DialogActions, DialogContent, DialogTitle, Button, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import OpenInFull from '@mui/icons-material/OpenInFull';
import Tune from '@mui/icons-material/Tune';
import { athleticLayout, TRACK_DRAWING_REFERENCE } from '../utils/athleticLayout';

const format = value => Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function Plan({ model, drainage }) {
  if (model.kind === 'empty') return <Alert severity="info">{model.message}</Alert>;
  const scale = Math.min(640 / model.width, 260 / model.height);
  const w = model.width * scale;
  const h = model.height * scale;
  const x = (840 - w) / 2;
  const y = (390 - h) / 2;
  const oval = model.kind === 'oval';
  const lengthLabel = model.scaled ? `${format(model.width)} m overall` : 'Schematic proportions';
  return <svg viewBox="0 0 840 420" role="img" aria-label={oval ? `${model.lanes}-lane athletic track ${model.scaled ? 'proportional plan' : 'schematic'}` : 'Rectangular facility proportional plan'} style={{ display: 'block', width: '100%', height: '100%' }}>
    <title>{oval ? 'Athletic track layout' : 'Rectangular facility layout'}</title>
    <desc>{model.scaled ? 'Dimensions are based on the entered geometry.' : 'Illustrative oval; bend radius and straight dimensions are not supplied.'} Not a construction drawing.</desc>
    <rect width="840" height="420" fill="#f8fafb" />
    {drainage && <rect x={x - 8} y={y - 8} width={w + 16} height={h + 16} rx={oval ? (h + 16) / 2 : 0} fill="none" stroke="#287da8" strokeWidth="2" strokeDasharray="6 5"><title>Drainage enabled: indicative edge only, not pipe routing</title></rect>}
    {oval ? <>
      {Array.from({ length: model.lanes }, (_, lane) => {
        const inset = lane * model.laneWidth * scale;
        return <rect key={lane} x={x + inset} y={y + inset} width={w - 2 * inset} height={h - 2 * inset}
          rx={(h - 2 * inset) / 2} fill={lane % 2 ? '#bc3445' : '#cf4657'} stroke="#fff" strokeWidth="1.1" />;
      })}
      <rect x={x + model.bandWidth * scale} y={y + model.bandWidth * scale} width={w - 2 * model.bandWidth * scale} height={h - 2 * model.bandWidth * scale} rx={model.innerRadius * scale} fill="#d8eadb" stroke="#fff" strokeWidth="1.1" />
      {Array.from({ length: model.lanes }, (_, lane) => <text key={lane} x={420} y={y + (lane + 0.65) * model.laneWidth * scale} fill="#fff" fontSize={Math.min(12, model.laneWidth * scale * 0.8)} textAnchor="middle">{model.lanes - lane}</text>)}
      <text x="420" y="194" textAnchor="middle" fill="#264d36" fontSize="16">Infield</text>
      <text x="420" y="218" textAnchor="middle" fill="#4d6657" fontSize="13">{model.lanes} lanes x {format(model.laneWidth)} m</text>
      {model.scaled && <text x="420" y="242" textAnchor="middle" fill="#4d6657" fontSize="12">Straight {format(model.straightLength)} m | Inner radius {format(model.innerRadius)} m</text>}
    </> : <>
      <rect x={x} y={y} width={w} height={h} fill="#d8eadb" stroke="#327a53" strokeWidth="2" />
      <text x="420" y="194" textAnchor="middle" fill="#264d36" fontSize="16">Rectangular facility</text>
      <text x="420" y="218" textAnchor="middle" fill="#4d6657" fontSize="13">{format(model.footprintArea)} SQM footprint</text>
    </>}
    <path d={`M ${x} ${y - 26} H ${x + w} M ${x} ${y - 32} V ${y - 20} M ${x + w} ${y - 32} V ${y - 20}`} stroke="#63717c" fill="none" />
    <text x="420" y={y - 38} textAnchor="middle" fill="#364550" fontSize="13">{lengthLabel}</text>
    {model.scaled && <><path d={`M ${x + w + 25} ${y} V ${y + h} M ${x + w + 19} ${y} H ${x + w + 31} M ${x + w + 19} ${y + h} H ${x + w + 31}`} stroke="#63717c" fill="none" /><text x={x + w + 43} y="195" textAnchor="middle" transform={`rotate(90 ${x + w + 43} 195)`} fill="#364550" fontSize="13">{format(model.height)} m overall</text></>}
    {drainage && <text x="420" y="395" textAnchor="middle" fill="#287da8" fontSize="12">Dashed blue edge: drainage scope, indicative only</text>}
  </svg>;
}

export default function AthleticLayoutPreview({ config, presets = [], quotedArea, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [geometryOpen, setGeometryOpen] = useState(false);
  const preset = presets.find(row => row.Preset === config.preset) || {};
  const model = athleticLayout(config, preset);
  const diagram = <Plan model={model} drainage={String(config.drainageWorks).toLowerCase() === 'yes'} />;
  return <Box component="section" aria-label="Athletic layout preview" sx={{ mb: 2.5, py: 2, borderTop: '1px solid #dbe3ef', borderBottom: '1px solid #dbe3ef' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
      <Box><Typography variant="subtitle2">Layout Preview</Typography><Typography variant="caption" color="text.secondary">Indicative plan only. Not a construction or certification drawing.</Typography></Box>
      <Box sx={{ display: 'flex' }}>
        {model.kind !== 'rectangle' && <Tooltip title="Oval geometry"><IconButton aria-label="Edit diagram geometry" onClick={() => setGeometryOpen(value => !value)}><Tune /></IconButton></Tooltip>}
        <Tooltip title="Enlarge diagram"><IconButton aria-label="Enlarge diagram" onClick={() => setExpanded(true)}><OpenInFull /></IconButton></Tooltip>
      </Box>
    </Box>
    {model.kind !== 'rectangle' && <Box sx={{ mt: 1.5 }}>
      <Typography variant="caption" component="p">Drawing reference: 400 m / 8 lanes; 84.39 m straight; 36.50 m inner radius; 1.22 m lanes. Stated track / green areas: 6,600 / 8,087 SQM. N.T.S.; issued for approval.</Typography>
      <Button size="small" disabled={model.kind === 'oval' && (model.lanes !== 8 || Math.abs(model.laneWidth - 1.22) > 0.0001)} onClick={() => onChange({ diagramStraightLength: TRACK_DRAWING_REFERENCE.diagramStraightLength, diagramInnerRadius: TRACK_DRAWING_REFERENCE.diagramInnerRadius })}>Use Drawing Geometry</Button>
    </Box>}
    {geometryOpen && model.kind !== 'rectangle' && <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 2, my: 2 }}>
      <TextField size="small" type="number" label="Diagram straight length (m)" value={config.diagramStraightLength || ''} inputProps={{ min: 0, step: 'any' }} onChange={event => onChange({ diagramStraightLength: event.target.value })} />
      <TextField size="small" type="number" label="Diagram inner bend radius (m)" value={config.diagramInnerRadius || ''} inputProps={{ min: 0, step: 'any' }} onChange={event => onChange({ diagramInnerRadius: event.target.value })} />
    </Box>}
    <Box sx={{ aspectRatio: '2 / 1', maxHeight: 360, width: '100%', overflow: 'hidden', display: 'grid', alignItems: 'center' }}>{diagram}</Box>
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
      <Typography variant="caption">Quoted area: {format(quotedArea || 0)} SQM</Typography>
      {model.kind === 'oval' && <Typography variant="caption">{model.lanes} lanes x {format(model.laneWidth)} m</Typography>}
      {model.kind === 'oval' && <Typography variant="caption">Track length / perimeter input: {config.lengthPerimeter || preset['Track Length'] || 'Not supplied'} m</Typography>}
      {model.kind === 'oval' && model.scaled && <Typography variant="caption">Geometric lane-band area: {format(model.trackArea)} SQM</Typography>}
    </Box>
    {model.kind === 'oval' && !model.scaled && <Typography variant="caption" color="text.secondary">Straight length and bend radius are not supplied; the oval proportions are schematic.</Typography>}
    <Dialog open={expanded} onClose={() => setExpanded(false)} fullWidth maxWidth="lg"><DialogTitle>Layout Preview</DialogTitle><DialogContent><Box sx={{ height: { xs: 300, sm: 500 } }}>{diagram}</Box><Typography variant="caption">Indicative only. Diagram geometry does not change quotation quantities.</Typography></DialogContent><DialogActions><Button onClick={() => setExpanded(false)}>Close</Button></DialogActions></Dialog>
  </Box>;
}
