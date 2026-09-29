import React, { useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl,
  IconButton, InputLabel, MenuItem, Select, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import ContentCopy from '@mui/icons-material/ContentCopy';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import EditOutlined from '@mui/icons-material/EditOutlined';
import QuotationRichTextEditor from './QuotationRichTextEditor';
import {
  emptyQuotationSet, emptySetItem, itemQuantity, quotationSetTemplates,
  setQuoteTotals, setSubtotal, setsFromTemplate,
} from './quotationSets';

const cellInputSx = {
  '& .MuiInputBase-root': { borderRadius: 1, bgcolor: '#fff', fontSize: '0.78rem' },
  '& .MuiInputBase-input': { py: 1, fontSize: '0.78rem' },
};

function money(value) {
  return (Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function stripHtml(value) {
  if (!value) return '';
  const node = document.createElement('div');
  node.innerHTML = value;
  return (node.innerText || node.textContent || '').trim();
}

export default function QuotationSetBuilder({ sets, onChange, gstPct, onGstChange }) {
  const [templateId, setTemplateId] = useState('');
  const [editor, setEditor] = useState(null);
  const totals = setQuoteTotals(sets, gstPct);

  const updateSet = (setIndex, changes) => {
    onChange(sets.map((set, index) => index === setIndex ? { ...set, ...changes } : set));
  };

  const updateItem = (setIndex, itemIndex, changes) => {
    updateSet(setIndex, {
      items: sets[setIndex].items.map((item, index) => index === itemIndex ? { ...item, ...changes } : item),
    });
  };

  const applyTemplate = () => {
    const next = setsFromTemplate(templateId);
    if (next.length) onChange([...sets, ...next]);
    setTemplateId('');
  };

  const removeSet = (setIndex) => onChange(sets.filter((_, index) => index !== setIndex));
  const duplicateSet = (setIndex) => {
    const clone = JSON.parse(JSON.stringify(sets[setIndex]));
    clone.id = `${clone.id || 'set'}-copy-${Date.now()}`;
    clone.title = `${clone.title} copy`;
    clone.items = clone.items.map((item, index) => ({ ...item, id: `${clone.id}-item-${index}` }));
    const next = [...sets];
    next.splice(setIndex + 1, 0, clone);
    onChange(next);
  };

  return (
    <Box sx={{ border: '1px solid #dbe3ef', borderRadius: 2, overflow: 'hidden', bgcolor: '#fff' }}>
      <Box sx={{ px: 2, py: 1.5, display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap', bgcolor: '#f8fafc', borderBottom: '1px solid #dbe3ef' }}>
        <Box sx={{ mr: 'auto' }}>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Project BOQ Sets</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: '#64748b', mt: 0.25 }}>Use a workbook set, then adjust every quantity, factor, description and rate.</Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 245, bgcolor: '#fff' }}>
          <InputLabel>Standard set</InputLabel>
          <Select value={templateId} label="Standard set" onChange={(event) => setTemplateId(event.target.value)}>
            {quotationSetTemplates.map((template) => <MenuItem key={template.id} value={template.id}>{template.name}</MenuItem>)}
          </Select>
        </FormControl>
        <Button variant="outlined" disabled={!templateId} onClick={applyTemplate}>Add Standard Set</Button>
        <Button startIcon={<AddCircleOutline />} onClick={() => onChange([...sets, emptyQuotationSet()])}>Add Blank Set</Button>
      </Box>

      {!sets.length && <Box sx={{ p: 3, textAlign: 'center', color: '#64748b' }}>Add a standard or blank set to begin.</Box>}

      {sets.map((set, setIndex) => (
        <Box key={set.id || setIndex} sx={{ borderBottom: '1px solid #cbd5e1', '&:last-of-type': { borderBottom: 0 } }}>
          <Box sx={{ px: 2, py: 1.25, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 1fr) 170px auto auto' }, gap: 1, alignItems: 'center', bgcolor: '#eef4fb' }}>
            <TextField size="small" label="Set name" value={set.title} onChange={(event) => updateSet(setIndex, { title: event.target.value })} sx={cellInputSx} />
            <TextField size="small" type="number" label="Set base quantity" value={set.baseQuantity} inputProps={{ min: 0, step: 'any' }} onChange={(event) => updateSet(setIndex, { baseQuantity: event.target.value })} sx={cellInputSx} />
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, textAlign: { md: 'right' }, whiteSpace: 'nowrap' }}>Subtotal ₹{money(setSubtotal(set))}</Typography>
            <Box sx={{ display: 'flex' }}>
              <Tooltip title="Duplicate set"><IconButton size="small" onClick={() => duplicateSet(setIndex)}><ContentCopy fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Remove set"><IconButton size="small" onClick={() => removeSet(setIndex)}><DeleteOutline fontSize="small" /></IconButton></Tooltip>
            </Box>
          </Box>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 1120, '& th': { bgcolor: '#f8fafc', color: '#475569', fontSize: '0.7rem', fontWeight: 800 }, '& td': { verticalAlign: 'top', p: 0.75 } }}>
              <TableHead><TableRow>
                <TableCell sx={{ width: 44 }}>S.No</TableCell><TableCell sx={{ minWidth: 190 }}>Item</TableCell>
                <TableCell sx={{ minWidth: 300 }}>Description</TableCell><TableCell sx={{ width: 85 }}>Unit</TableCell>
                <TableCell sx={{ width: 120 }}>Quantity mode</TableCell><TableCell sx={{ width: 95 }}>Factor</TableCell>
                <TableCell sx={{ width: 105 }}>Quantity</TableCell><TableCell sx={{ width: 115 }}>Unit price</TableCell>
                <TableCell sx={{ width: 125 }}>Amount</TableCell><TableCell sx={{ width: 44 }} />
              </TableRow></TableHead>
              <TableBody>
                {(set.items || []).map((item, itemIndex) => {
                  const quantity = itemQuantity(set, item);
                  return <TableRow key={item.id || itemIndex} hover>
                    <TableCell sx={{ fontSize: '0.76rem', fontWeight: 700, pt: 1.6 }}>{itemIndex + 1}</TableCell>
                    <TableCell><TextField fullWidth multiline minRows={2} value={item.item} onChange={(event) => updateItem(setIndex, itemIndex, { item: event.target.value })} sx={cellInputSx} /></TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
                        <TextField fullWidth multiline minRows={2} value={item.description} onChange={(event) => updateItem(setIndex, itemIndex, { description: event.target.value, descHtml: '' })} sx={cellInputSx} />
                        <Tooltip title="Format description"><IconButton size="small" onClick={() => setEditor({ setIndex, itemIndex, value: item.descHtml || item.description })}><EditOutlined fontSize="small" /></IconButton></Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell><TextField value={item.unit} onChange={(event) => updateItem(setIndex, itemIndex, { unit: event.target.value })} sx={cellInputSx} /></TableCell>
                    <TableCell><Select fullWidth size="small" value={item.qtyMode || 'manual'} onChange={(event) => updateItem(setIndex, itemIndex, { qtyMode: event.target.value })} sx={{ fontSize: '0.76rem', bgcolor: '#fff' }}><MenuItem value="manual">Manual</MenuItem><MenuItem value="factor">Base × factor</MenuItem></Select></TableCell>
                    <TableCell><TextField type="number" value={item.factor} disabled={item.qtyMode !== 'factor'} inputProps={{ step: 'any' }} onChange={(event) => updateItem(setIndex, itemIndex, { factor: event.target.value })} sx={cellInputSx} /></TableCell>
                    <TableCell><TextField type="number" value={item.qtyMode === 'factor' ? quantity : item.qty} disabled={item.qtyMode === 'factor'} inputProps={{ min: 0, step: 'any' }} onChange={(event) => updateItem(setIndex, itemIndex, { qty: event.target.value })} sx={cellInputSx} /></TableCell>
                    <TableCell><TextField type="number" value={item.rate} inputProps={{ min: 0, step: 'any' }} onChange={(event) => updateItem(setIndex, itemIndex, { rate: event.target.value })} sx={cellInputSx} /></TableCell>
                    <TableCell sx={{ pt: 1.6, fontSize: '0.76rem', fontWeight: 800, whiteSpace: 'nowrap' }}>₹{money(quantity * (Number(item.rate) || 0))}</TableCell>
                    <TableCell><Tooltip title="Remove line"><IconButton size="small" onClick={() => updateSet(setIndex, { items: set.items.filter((_, index) => index !== itemIndex) })}><DeleteOutline fontSize="small" /></IconButton></Tooltip></TableCell>
                  </TableRow>;
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', bgcolor: '#fbfdff' }}>
            <Button size="small" startIcon={<AddCircleOutline />} onClick={() => updateSet(setIndex, { items: [...set.items, emptySetItem()] })}>Add Line</Button>
            <Typography sx={{ fontSize: '0.76rem', color: '#64748b' }}>{set.items.length} items</Typography>
          </Box>
        </Box>
      ))}

      <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'flex-end', gap: 2, alignItems: 'center', bgcolor: '#f8fafc', borderTop: '1px solid #dbe3ef' }}>
        <Typography sx={{ fontSize: '0.82rem' }}>Subtotal <strong>₹{money(totals.subtotal)}</strong></Typography>
        <TextField size="small" type="number" label="GST %" value={gstPct} inputProps={{ min: 0, step: 'any' }} onChange={(event) => onGstChange(event.target.value)} sx={{ width: 105, ...cellInputSx }} />
        <Typography sx={{ px: 1.5, py: 0.8, bgcolor: '#0f172a', color: '#fff', borderRadius: 1, fontSize: '0.82rem', fontWeight: 800 }}>Grand Total ₹{money(totals.grand)}</Typography>
      </Box>

      <Dialog open={Boolean(editor)} onClose={() => setEditor(null)} maxWidth="md" fullWidth disableEscapeKeyDown>
        <DialogTitle>Format Description</DialogTitle>
        <DialogContent dividers><QuotationRichTextEditor value={editor?.value || ''} onChange={(value) => setEditor((current) => ({ ...current, value }))} /></DialogContent>
        <DialogActions>
          <Button onClick={() => setEditor(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => {
            updateItem(editor.setIndex, editor.itemIndex, { descHtml: editor.value, description: stripHtml(editor.value) });
            setEditor(null);
          }}>Apply</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

