import React, { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { athleticSpecificationDetails, QUOTATION_SPECIFICATION_REFERENCE } from './athleticSpecificationReference';

export default function QuotationSpecificationReference({ rows, onClose }) {
  const [tab, setTab] = useState(0);
  return <Dialog open fullWidth maxWidth="lg" onClose={onClose}>
    <DialogTitle>Quotation Specification Reference</DialogTitle>
    <DialogContent dividers>
      <Alert severity="info" sx={{ mb: 2 }}>Historical quotation benchmarks, not universal engineering standards. The approved project specification governs each layer and element.</Alert>
      <Tabs value={tab} onChange={(event, value) => setTab(value)} sx={{ mb: 2 }}>
        <Tab label="Reference chart" /><Tab label="Current athletic items" />
      </Tabs>
      <TableContainer sx={{ maxHeight: '55vh', overflow: 'auto' }}>
        <Table stickyHeader size="small" sx={{ minWidth: 740, '& td': { verticalAlign: 'top' }, '& th': { fontWeight: 700 } }}>
          <TableHead><TableRow>{(tab === 0 ? ['Quotation type', 'Element', 'Observed specification', 'Quotation basis'] : ['Item', 'Library reference thickness', 'Current thickness', 'Calculation basis / review']).map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
          <TableBody>{tab === 0 ? QUOTATION_SPECIFICATION_REFERENCE.map((row, index) => <TableRow key={index}>{row.slice(0, 4).map((value, column) => <TableCell key={column}>{value}</TableCell>)}</TableRow>)
            : rows.map((row, index) => {
              const details = athleticSpecificationDetails(row);
              return <TableRow key={index}>
                <TableCell>{index + 1}. {row.libraryItem || row.itemCode || row.desc || 'Manual item'}</TableCell>
                <TableCell>{details.referenceThickness}</TableCell><TableCell>{details.currentThickness}</TableCell>
                <TableCell>{details.basis}{details.warning && <Alert severity="warning" sx={{ mt: 1 }}>{details.warning}</Alert>}</TableCell>
              </TableRow>;
            })}</TableBody>
        </Table>
      </TableContainer>
      {tab === 0 && <Typography variant="caption" component="p" sx={{ mt: 2 }}>Based on previous quotations. Conflicting values are flagged rather than adopted as defaults.</Typography>}
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
  </Dialog>;
}
