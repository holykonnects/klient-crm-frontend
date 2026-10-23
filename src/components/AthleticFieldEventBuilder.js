import React from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, Link, TextField, Typography } from '@mui/material';
import { FIELD_EVENTS, fieldEventConfig } from './fieldEventPackages';

export function FieldEventDiagram({ event, config }) {
  const circle = ['shot', 'discus'].includes(event.id);
  return <svg viewBox="0 0 600 180" role="img" aria-label={`${event.label} dimension schematic`} style={{ display: 'block', width: '100%', maxHeight: 200 }}>
    <title>{event.label} - separate event schematic, not site placement</title>
    <rect width="600" height="180" fill="#f7f9fa" />
    {event.id === 'longJump' ? <>
      <rect x="30" y="70" width="340" height="30" fill="#c8495a" /><rect x="410" y="52" width="150" height="65" fill="#e2d5ae" stroke="#6b6b57" />
      <path d="M370 70 H410 M370 100 H410" stroke="#c8495a" strokeWidth="2" /><path d="M350 65 V105" stroke="#fff" strokeWidth="4" />
      <text x="190" y="48" textAnchor="middle" fontSize="14">Runway to take-off: {config.length} m x {config.width} m</text>
      <text x="485" y="40" textAnchor="middle" fontSize="13">Pit {config.pitLength} x {config.pitWidth} m</text>
      <text x="390" y="140" textAnchor="middle" fontSize="13">Take-off line to pit: {config.boardOffset} m</text>
    </> : <>
      {circle ? <><circle cx="85" cy="90" r="27" fill="#d9dfe3" stroke="#455a64" strokeWidth="2" /><text x="85" y="40" textAnchor="middle" fontSize="14">Circle {config.diameter} m</text>
        {event.id === 'discus' && <path d="M115 50 A50 50 0 1 0 115 130" fill="none" stroke="#287da8" strokeWidth="4" />}
        {event.id === 'shot' && <path d="M110 78 V102" stroke="#7b5746" strokeWidth="5" />}
      </> : <><rect x="30" y="75" width="210" height="30" fill="#c8495a" /><path d="M238 67 Q253 90 238 113" stroke="#455a64" fill="none" strokeWidth="3" /><text x="140" y="48" textAnchor="middle" fontSize="14">Runway {config.length} x {config.width} m</text></>}
      <path d={`M${circle ? 112 : 250} 90 L540 25 Q570 90 540 155 Z`} fill="#deecdf" stroke="#4d805a" strokeDasharray="6 4" />
      <text x="395" y="86" textAnchor="middle" fontSize="14">Landing sector</text>
      <text x="395" y="108" textAnchor="middle" fontSize="13">Reviewed length: {config.sectorLength || '--'} m</text>
      <text x="300" y="172" textAnchor="middle" fontSize="12">{circle ? '34.92 degree sector' : '8 m throwing-arc radius'} | Schematic, not to scale</text>
    </>}
  </svg>;
}

export default function AthleticFieldEvents({ selections = {}, onChange, issues = [] }) {
  const update = (event, patch) => onChange({ ...selections, [event.id]: { ...fieldEventConfig(event, selections), ...patch } });
  return <Box component="section" aria-label="Field event packages" sx={{ py: 2, mb: 2.5, borderTop: '1px solid #dbe3ef' }}>
    <Typography variant="subtitle2" sx={{ mb: 1 }}>Field Event Packages</Typography>
    <Alert severity="warning" sx={{ mb: 1.5 }}>Event sketches are separate from the track plan. Throwing sectors, cages, clearances and shared-use conflicts require an approved site layout. Reference dimensions do not establish certification.</Alert>
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>{FIELD_EVENTS.map(event => <FormControlLabel key={event.id} label={event.label} control={<Checkbox checked={Boolean(selections[event.id]?.enabled)} onChange={e => update(event, { enabled: e.target.checked })} />} />)}</Box>
    {FIELD_EVENTS.filter(event => selections[event.id]?.enabled).map(event => {
      const config = fieldEventConfig(event, selections);
      return <Box key={event.id} sx={{ py: 2, borderBottom: '1px solid #dbe3ef' }}>
        <Typography variant="subtitle2">{event.label}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>{event.reference} <Link href={event.url} target="_blank" rel="noopener noreferrer">Reference</Link></Typography>
        {event.id === 'javelin' && <Button size="small" onClick={() => update(event, { length: 36.5, width: 4 })}>Use Supplied Drawing Runway: 36.50 m x 4 m</Button>}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 2, my: 2 }}>
          <TextField label="Number of facilities" type="number" size="small" value={config.count} inputProps={{ min: 1, step: 1 }} onChange={e => update(event, { count: e.target.value })} />
          {event.fields.map(([field, label]) => <TextField key={field} label={label} type="number" size="small" value={config[field]} inputProps={{ min: 0, step: 'any' }} onChange={e => update(event, { [field]: e.target.value })} />)}</Box>
        <FieldEventDiagram event={event} config={config} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <FormControlLabel label="Site layout / safety provisions reviewed" control={<Checkbox checked={Boolean(config.layoutReviewed)} onChange={e => update(event, { layoutReviewed: e.target.checked })} />} />
          <FormControlLabel label="Project-specific dimension deviations approved" control={<Checkbox checked={Boolean(config.referenceOverrideAccepted)} onChange={e => update(event, { referenceOverrideAccepted: e.target.checked })} />} />
        </Box>
      </Box>;
    })}
    {issues.length > 0 && <Alert severity="warning" sx={{ mt: 2 }}><Typography variant="body2" fontWeight={700}>Field-event details required before export</Typography><Box component="ul" sx={{ pl: 2, my: 0.5 }}>{issues.slice(0, 8).map((issue, index) => <li key={index}>{issue}</li>)}</Box>{issues.length > 8 && <Typography variant="caption">{issues.length - 8} additional items require attention.</Typography>}</Alert>}
  </Box>;
}
