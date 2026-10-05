import React, { useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl,
  IconButton, InputLabel, MenuItem, Select, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import ContentCopy from '@mui/icons-material/ContentCopy';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ImageSearchOutlined from '@mui/icons-material/ImageSearchOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import QuotationRichTextEditor from './QuotationRichTextEditor';
import QuotationChargeField from './QuotationChargeField';
import {
  emptyQuotationSet, emptySetItem, itemQuantity, quotationSetTemplates,
  setQuoteTotals, setSubtotal, setsFromTemplate,
} from './quotationSets';
import { moveQuotationRow } from '../utils/quotationRowOrder';

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

function driveImageUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  const match = url.match(/[-\w]{25,}/);
  return match ? `https://drive.google.com/thumbnail?id=${match[0]}&sz=w320` : url;
}

export default function QuotationSetBuilder({ sets, onChange, gstPct, onGstChange, onDownloadExcel, catalog }) {
  const [templateId, setTemplateId] = useState('');
  const [editor, setEditor] = useState(null);
  const [imageSelector, setImageSelector] = useState(null);
  const totals = setQuoteTotals(sets, gstPct);

  const updateSet = (setIndex, changes) => {
    onChange(sets.map((set, index) => index === setIndex ? { ...set, ...changes } : set));
  };

  const updateItem = (setIndex, itemIndex, changes) => {
    updateSet(setIndex, {
      items: sets[setIndex].items.map((item, index) => index === itemIndex ? { ...item, ...changes } : item),
    });
  };

  const moveItem = (setIndex, itemIndex, direction) => {
    updateSet(setIndex, { items: moveQuotationRow(sets[setIndex].items, itemIndex, direction) });
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

  const subCategories = imageSelector?.category ? catalog?.subcategories?.[imageSelector.category] || [] : [];
  const imageItems = imageSelector?.category && imageSelector?.subCategory
    ? catalog?.items?.[`${imageSelector.category}|||${imageSelector.subCategory}`] || []
    : [];
  const updateImageSelector = (field, value) => setImageSelector(current => {
    const next = { ...current, [field]: value };
    if (field === 'category') { next.subCategory = ''; next.itemCode = ''; }
    if (field === 'subCategory') next.itemCode = '';
    return next;
  });
  const applyImage = () => {
    const selected = imageItems.find(item => item.code === imageSelector.itemCode);
    updateItem(imageSelector.setIndex, imageSelector.itemIndex, {
      imageUrl: selected?.imageUrl || '',
      imageCategory: selected ? imageSelector.category : '',
      imageSubCategory: selected ? imageSelector.subCategory : '',
      imageItemCode: selected ? imageSelector.itemCode : '',
    });
    setImageSelector(null);
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
        <Button startIcon={<DownloadOutlined />} disabled={!sets.length} onClick={onDownloadExcel}>Download Excel</Button>
      </Box>

      {!sets.length && <Box sx={{ p: 3, textAlign: 'center', color: '#64748b' }}>Add a standard or blank set to begin.</Box>}

      <Box sx={{ maxHeight: 650, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarGutter: 'stable' }}>
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
          <TableContainer sx={{ m: 1.5, width: 'auto', overflowX: 'auto', border: '1px solid #dbe3ef', borderRadius: 2 }}>
            <Table size="small" sx={{ minWidth: 1905, tableLayout: 'fixed', '& th': { bgcolor: '#f8fafc', color: '#475569', fontSize: '0.7rem', fontWeight: 800 }, '& td': { verticalAlign: 'top', p: 0.75 } }}>
              <TableHead><TableRow>
                <TableCell sx={{ width: 54 }}>S.No</TableCell><TableCell sx={{ width: 220 }}>Item</TableCell>
                <TableCell sx={{ width: 110 }}>Image</TableCell>
                <TableCell sx={{ width: 500 }}>Description</TableCell><TableCell sx={{ width: 130 }}>Freight</TableCell>
                <TableCell sx={{ width: 130 }}>Installation</TableCell><TableCell sx={{ width: 90 }}>Unit</TableCell>
                <TableCell sx={{ width: 135 }}>Quantity mode</TableCell><TableCell sx={{ width: 95 }}>Factor</TableCell>
                <TableCell sx={{ width: 110 }}>Quantity</TableCell><TableCell sx={{ width: 120 }}>Unit price</TableCell>
                <TableCell sx={{ width: 125 }}>Amount</TableCell><TableCell sx={{ width: 112 }}>Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {(set.items || []).map((item, itemIndex) => {
                  const quantity = itemQuantity(set, item);
                  return <TableRow key={item.id || itemIndex} hover>
                    <TableCell sx={{ fontSize: '0.76rem', fontWeight: 700, pt: 1.6 }}>{itemIndex + 1}</TableCell>
                    <TableCell><TextField fullWidth multiline minRows={2} maxRows={4} value={item.item} onChange={(event) => updateItem(setIndex, itemIndex, { item: event.target.value })} sx={cellInputSx} /></TableCell>
                    <TableCell>
                      <Box sx={{ minHeight: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.25 }}>
                        {item.imageUrl && <Box component="img" src={driveImageUrl(item.imageUrl)} alt={item.imageItemCode || item.item || 'Quotation item'} sx={{ width: 58, height: 52, objectFit: 'contain' }} />}
                        <Tooltip title="Choose image from Equipment BD"><IconButton size="small" onClick={() => setImageSelector({
                          setIndex, itemIndex, category: item.imageCategory || '', subCategory: item.imageSubCategory || '', itemCode: item.imageItemCode || '',
                        })}><ImageSearchOutlined fontSize="small" /></IconButton></Tooltip>
                        {item.imageUrl && <Tooltip title="Open image"><IconButton size="small" onClick={() => window.open(item.imageUrl, '_blank', 'noopener,noreferrer')}><OpenInNewOutlined fontSize="small" /></IconButton></Tooltip>}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box onClick={() => setEditor({ setIndex, itemIndex, value: item.descHtml || item.description })} sx={{
                        position: 'relative', minHeight: 82, maxHeight: 104, overflow: 'hidden', cursor: 'text',
                        border: '1px solid #cbd5e1', borderRadius: 1.5, bgcolor: '#fff', px: 1.25, py: 1,
                        pr: 5, '&:hover': { borderColor: '#64748b', bgcolor: '#fbfdff' }
                      }}>
                        <Typography sx={{ fontSize: '0.76rem', lineHeight: 1.45, color: item.description ? '#334155' : '#94a3b8', whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>
                          {item.description || 'Add description'}
                        </Typography>
                        <Tooltip title="Edit and format description"><IconButton size="small" sx={{ position: 'absolute', top: 6, right: 6, bgcolor: '#f8fafc' }}><EditOutlined fontSize="small" /></IconButton></Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell><QuotationChargeField label={`Freight for item ${itemIndex + 1}`} value={item.freight} onChange={value => updateItem(setIndex, itemIndex, { freight: value })} sx={cellInputSx} /></TableCell>
                    <TableCell><QuotationChargeField label={`Installation for item ${itemIndex + 1}`} value={item.installation} onChange={value => updateItem(setIndex, itemIndex, { installation: value })} sx={cellInputSx} /></TableCell>
                    <TableCell><TextField value={item.unit} onChange={(event) => updateItem(setIndex, itemIndex, { unit: event.target.value })} sx={cellInputSx} /></TableCell>
                    <TableCell><Select fullWidth size="small" value={item.qtyMode || 'manual'} onChange={(event) => updateItem(setIndex, itemIndex, { qtyMode: event.target.value })} sx={{ fontSize: '0.76rem', bgcolor: '#fff' }}><MenuItem value="manual">Manual</MenuItem><MenuItem value="factor">Base × factor</MenuItem></Select></TableCell>
                    <TableCell><TextField type="number" value={item.factor} disabled={item.qtyMode !== 'factor'} inputProps={{ step: 'any' }} onChange={(event) => updateItem(setIndex, itemIndex, { factor: event.target.value })} sx={cellInputSx} /></TableCell>
                    <TableCell><TextField type="number" value={item.qtyMode === 'factor' ? quantity : item.qty} disabled={item.qtyMode === 'factor'} inputProps={{ min: 0, step: 'any' }} onChange={(event) => updateItem(setIndex, itemIndex, { qty: event.target.value })} sx={cellInputSx} /></TableCell>
                    <TableCell><TextField type="number" value={item.rate} inputProps={{ min: 0, step: 'any' }} onChange={(event) => updateItem(setIndex, itemIndex, { rate: event.target.value })} sx={cellInputSx} /></TableCell>
                    <TableCell sx={{ pt: 1.6, fontSize: '0.76rem', fontWeight: 800, whiteSpace: 'nowrap' }}>₹{money(quantity * (Number(item.rate) || 0))}</TableCell>
                    <TableCell><Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Tooltip title="Move line up"><span><IconButton size="small" disabled={itemIndex === 0} onClick={() => moveItem(setIndex, itemIndex, -1)}><ArrowUpward fontSize="small" /></IconButton></span></Tooltip>
                      <Tooltip title="Move line down"><span><IconButton size="small" disabled={itemIndex === set.items.length - 1} onClick={() => moveItem(setIndex, itemIndex, 1)}><ArrowDownward fontSize="small" /></IconButton></span></Tooltip>
                      <Tooltip title="Remove line"><IconButton size="small" onClick={() => updateSet(setIndex, { items: set.items.filter((_, index) => index !== itemIndex) })}><DeleteOutline fontSize="small" /></IconButton></Tooltip>
                    </Box></TableCell>
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
      </Box>

      <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'flex-end', gap: 2, alignItems: 'center', bgcolor: '#f8fafc', borderTop: '1px solid #dbe3ef' }}>
        <Typography sx={{ fontSize: '0.82rem' }}>Subtotal <strong>₹{money(totals.subtotal)}</strong></Typography>
        <TextField size="small" type="number" label="GST %" value={gstPct} inputProps={{ min: 0, step: 'any' }} onChange={(event) => onGstChange(event.target.value)} sx={{ width: 105, ...cellInputSx }} />
        <Typography sx={{ px: 1.5, py: 0.8, bgcolor: '#0f172a', color: '#fff', borderRadius: 1, fontSize: '0.82rem', fontWeight: 800 }}>Grand Total ₹{money(totals.grand)}</Typography>
      </Box>

      <Dialog open={Boolean(editor)} onClose={(event, reason) => { if (reason !== 'backdropClick') setEditor(null); }} maxWidth="md" fullWidth disableEscapeKeyDown>
        <DialogTitle>Format Description</DialogTitle>
        <DialogContent dividers><QuotationRichTextEditor value={editor?.value || ''} onChange={(value) => setEditor((current) => ({ ...current, value }))} /></DialogContent>
        <DialogActions>
          <Button onClick={() => setEditor(null)}>Cancel</Button>
          <Button type="button" variant="contained" onClick={() => {
            const edit = editor;
            setEditor(null);
            if (edit) updateItem(edit.setIndex, edit.itemIndex, { descHtml: edit.value, description: stripHtml(edit.value) });
          }}>Apply</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(imageSelector)} onClose={(event, reason) => { if (reason !== 'backdropClick') setImageSelector(null); }} maxWidth="sm" fullWidth disableEscapeKeyDown>
        <DialogTitle>Choose Standard Set Item Image</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ mb: 2, fontSize: '0.78rem', color: '#64748b' }}>This changes only the image reference. The set item, description, quantity calculation, unit and rate remain unchanged.</Typography>
          <Box sx={{ display: 'grid', gap: 2 }}>
            <FormControl fullWidth><InputLabel>Category</InputLabel><Select label="Category" value={imageSelector?.category || ''} onChange={event => updateImageSelector('category', event.target.value)}>{(catalog?.categories || []).map(category => <MenuItem key={category} value={category}>{category}</MenuItem>)}</Select></FormControl>
            <FormControl fullWidth disabled={!imageSelector?.category}><InputLabel>Sub Category</InputLabel><Select label="Sub Category" value={imageSelector?.subCategory || ''} onChange={event => updateImageSelector('subCategory', event.target.value)}>{subCategories.map(subCategory => <MenuItem key={subCategory} value={subCategory}>{subCategory}</MenuItem>)}</Select></FormControl>
            <FormControl fullWidth disabled={!imageSelector?.subCategory}><InputLabel>Item Code / Image</InputLabel><Select label="Item Code / Image" value={imageSelector?.itemCode || ''} onChange={event => updateImageSelector('itemCode', event.target.value)}>{imageItems.map(item => <MenuItem key={item.code} value={item.code}>{item.name && item.name !== item.code ? `${item.code} — ${item.name}` : item.code}</MenuItem>)}</Select></FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageSelector(null)}>Cancel</Button>
          <Button variant="outlined" color="inherit" onClick={() => setImageSelector(current => ({ ...current, category: '', subCategory: '', itemCode: '' }))}>Clear Image</Button>
          <Button variant="contained" onClick={applyImage}>Apply Image</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
