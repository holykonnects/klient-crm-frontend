import React from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { athleticSpecificationDetails, athleticItemReferences } from './athleticSpecificationReference';

export default function AthleticItemContext({ row, quotedArea }) {
  const details = athleticSpecificationDetails(row);
  const references = athleticItemReferences(row);
  return <Box sx={{ display: 'grid', gap: 0.75, overflowWrap: 'anywhere' }}>
    <Typography fontWeight={700}>{row.libraryItem || row.itemCode || row.desc || 'Manual item'}</Typography>
    <Typography variant="body2">Current quantity: {row.qty} {row.unit} | Quoted area: {quotedArea} SQM</Typography>
    <Typography variant="body2">Library thickness: {details.referenceThickness} | Current: {details.currentThickness}</Typography>
    <Typography variant="body2">Calculation: {details.basis}{row.libraryFactor !== undefined ? ` | Library factor: ${row.libraryFactor}` : ''}</Typography>
    {references.map(reference => <Typography key={reference[1]} variant="body2" color="text.secondary">
      Reference - {reference[1]}: {reference[2]}. {reference[3]}.
    </Typography>)}
    {details.warning && <Alert severity="warning">{details.warning}</Alert>}
  </Box>;
}
