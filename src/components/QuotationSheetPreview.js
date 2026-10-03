import React, { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Select, Tooltip, Typography } from '@mui/material';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import EditOutlined from '@mui/icons-material/EditOutlined';
import RestartAlt from '@mui/icons-material/RestartAlt';
import QuotationRichTextEditor from './QuotationRichTextEditor';
import { itemQuantity, setQuoteTotals, setSubtotal } from './quotationSets';
import { isExportableQuotationRow } from './athleticRateLibrary';

function driveImageUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  const match = url.match(/[-\w]{25,}/);
  return match ? `https://drive.google.com/thumbnail?id=${match[0]}&sz=w320` : url;
}

function displayDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function money(value) {
  const number = Number(value) || 0;
  return number.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function safeRichHtml(value, fallback) {
  const html = String(value || '').trim();
  if (!html) return String(fallback || '-').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  return html
    .replace(/<(?!\/?(?:p|br|strong|b|em|i|u|ul|ol|li)\b)[^>]*>/gi, '')
    .replace(/<(\/?(?:p|br|strong|b|em|i|u|ul|ol|li))\b[^>]*>/gi, '<$1>');
}

function richEditorValue(value) {
  const text = String(value || '');
  if (/<\/?(?:p|br|strong|b|em|i|u|ul|ol|li)\b/i.test(text)) return text;
  return text.split(/\r?\n/).map(line => `<p>${line.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character])) || '<br>'}</p>`).join('');
}

const cell = {
  borderRight: '1px solid #b8c4d4',
  borderBottom: '1px solid #b8c4d4',
  px: 1,
  py: 0.75,
  minHeight: 34,
  fontSize: '0.72rem',
  color: '#172033',
  overflowWrap: 'anywhere',
};

function TermsPreview({
  terms = [],
  termsType,
  termTypes = [],
  onTermsTypeChange,
  onTermChange,
  onTermAdd,
  onTermRemove,
  onTermsReset,
}) {
  const [editor, setEditor] = useState(null);
  return <Box sx={{ borderTop: '1px solid #9aa9bc' }}>
    <Box sx={{
      ...cell,
      bgcolor: '#dce9f8',
      color: '#163f76',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 1,
      flexWrap: 'wrap',
    }}>
      <Typography sx={{ fontWeight: 800, fontSize: '0.78rem' }}>Terms &amp; Conditions</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Select
          size="small"
          value={termsType || ''}
          onChange={event => onTermsTypeChange?.(event.target.value)}
          aria-label="Terms and conditions type"
          sx={{ minWidth: 140, height: 32, bgcolor: '#fff', fontSize: '0.72rem' }}
        >
          {termTypes.map(type => <MenuItem key={type} value={type}>{type}</MenuItem>)}
        </Select>
        <Tooltip title="Restore master terms">
          <span><IconButton size="small" onClick={onTermsReset} disabled={!onTermsReset} aria-label="Restore master terms"><RestartAlt fontSize="small" /></IconButton></span>
        </Tooltip>
        <Button size="small" startIcon={<AddCircleOutline />} onClick={onTermAdd} disabled={!onTermAdd}>Add term</Button>
      </Box>
    </Box>
    {terms.map((term, index) => <Box key={index} sx={{ display: 'grid', gridTemplateColumns: '46px 1fr 42px', alignItems: 'stretch' }}>
      <Box sx={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{index + 1}</Box>
      <Box sx={{ ...cell, p: 0.5 }}>
        <Box
          role="button"
          tabIndex={0}
          onClick={() => setEditor({ index, value: richEditorValue(term) })}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setEditor({ index, value: richEditorValue(term) }); }}
          sx={{
            position: 'relative', minHeight: 58, cursor: 'text', border: '1px solid #cbd5e1',
            borderRadius: 1, bgcolor: '#fff', px: 1, py: 0.75, pr: 4,
            '&:hover': { borderColor: '#64748b', bgcolor: '#fbfdff' },
          }}
        >
          <Box className="quotation-preview-rich-text" sx={{ fontSize: '0.72rem', lineHeight: 1.5, color: term ? '#172033' : '#94a3b8' }}
            dangerouslySetInnerHTML={{ __html: term ? safeRichHtml(term, term) : 'Add term text' }} />
          <Tooltip title="Edit and format term"><IconButton size="small" sx={{ position: 'absolute', top: 4, right: 4 }}><EditOutlined fontSize="small" /></IconButton></Tooltip>
        </Box>
      </Box>
      <Box sx={{ ...cell, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.25 }}>
        <Tooltip title="Remove term">
          <span><IconButton size="small" color="error" onClick={() => onTermRemove?.(index)} disabled={!onTermRemove} aria-label={`Remove term ${index + 1}`}><DeleteOutline fontSize="small" /></IconButton></span>
        </Tooltip>
      </Box>
    </Box>)}
    {!terms.length && <Box sx={{ ...cell, py: 2, textAlign: 'center', color: '#64748b' }}>
      No {termsType || 'selected'} terms. Use Add term to create one for this quotation.
    </Box>}
    <Dialog open={Boolean(editor)} onClose={(event, reason) => { if (reason !== 'backdropClick') setEditor(null); }} maxWidth="md" fullWidth disableEscapeKeyDown>
      <DialogTitle>Format Term &amp; Condition</DialogTitle>
      <DialogContent dividers>
        <QuotationRichTextEditor value={editor?.value || ''} onChange={value => setEditor(current => ({ ...current, value }))} placeholder="Enter the term or condition" />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setEditor(null)}>Cancel</Button>
        <Button variant="contained" onClick={() => {
          onTermChange?.(editor.index, editor.value);
          setEditor(null);
        }}>Apply</Button>
      </DialogActions>
    </Dialog>
  </Box>;
}

export const QuotationTermsPreview = TermsPreview;

function PreviewHeader({ meta }) {
  return <>
    <Box sx={{ display: 'grid', gridTemplateColumns: '170px 1fr 220px', borderBottom: '1px solid #9aa9bc' }}>
      <Box sx={{ ...cell, minHeight: 86, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box component="img" src="/assets/rido-sports-logo.png" alt="Rido Sports" sx={{ maxWidth: 130, maxHeight: 58, objectFit: 'contain' }} />
      </Box>
      <Box sx={{ ...cell, minHeight: 86, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#172033' }}>QUOTATION</Typography>
        <Typography sx={{ mt: 0.4, fontSize: '0.76rem', fontWeight: 600 }}>{meta.quotationTitle || meta.projectName || 'New quotation'}</Typography>
      </Box>
      <Box sx={{ minHeight: 86 }}>
        {[['Quotation No.', meta.quotationNo], ['Date', displayDate(meta.dateISO)], ['Prepared By', meta.preparedBy]].map(([label, value]) => (
          <Box key={label} sx={{ display: 'grid', gridTemplateColumns: '92px 1fr', borderBottom: '1px solid #b8c4d4' }}>
            <Box sx={{ ...cell, bgcolor: '#edf3fa', fontWeight: 700 }}>{label}</Box>
            <Box sx={cell}>{value || '-'}</Box>
          </Box>
        ))}
      </Box>
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: '150px 1fr 150px 1fr' }}>
      {[
        ['Client', meta.clientName], ['Project', meta.projectName],
        ['Billing Address', meta.clientBillingAddress], ['GST Number', meta.clientGstNumber],
      ].map(([label, value]) => <React.Fragment key={label}>
        <Box sx={{ ...cell, bgcolor: '#edf3fa', fontWeight: 700 }}>{label}</Box>
        <Box sx={cell}>{value || '-'}</Box>
      </React.Fragment>)}
    </Box>
  </>;
}

function SetQuotationPreview({ meta, sets, gstPct, terms, termsType, termTypes, onTermsTypeChange, onTermChange, onTermAdd, onTermRemove, onTermsReset }) {
  const totals = setQuoteTotals(sets, gstPct);
  let serial = 1;
  return (
    <Box sx={{ border: '1px solid #9aa9bc', borderRadius: 2, bgcolor: '#fff', overflowX: 'auto', overflowY: 'hidden' }}>
      <Box sx={{ minWidth: 1060, fontFamily: 'Montserrat, sans-serif' }}>
        <PreviewHeader meta={meta} />
        {sets.length ? sets.map((set, setIndex) => (
          <Box key={set.id || setIndex}>
            <Box sx={{ ...cell, bgcolor: '#dce9f8', color: '#163f76', fontWeight: 800, fontSize: '0.78rem' }}>
              {setIndex + 1}. {set.title || 'Untitled set'}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '48px 170px minmax(300px,1fr) 85px 85px 70px 82px 102px 115px', bgcolor: '#244f87' }}>
              {['S.No', 'Item', 'Description', 'Freight', 'Installation', 'Unit', 'Quantity', 'Unit Price', 'Amount'].map(label => (
                <Box key={label} sx={{ ...cell, color: '#fff', fontWeight: 800, textAlign: label === 'Description' || label === 'Item' ? 'left' : 'center', borderColor: '#7894b8' }}>{label}</Box>
              ))}
            </Box>
            {(set.items || []).map((item, itemIndex) => {
              const quantity = itemQuantity(set, item);
              const rate = Number(item.rate) || 0;
              const currentSerial = serial++;
              return <Box key={item.id || itemIndex} sx={{ display: 'grid', gridTemplateColumns: '48px 170px minmax(300px,1fr) 85px 85px 70px 82px 102px 115px' }}>
                <Box sx={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{currentSerial}</Box>
                <Box sx={cell}>{item.item || '-'}</Box>
                <Box className="quotation-preview-rich-text" sx={{ ...cell, minHeight: 72 }} dangerouslySetInnerHTML={{ __html: safeRichHtml(item.descHtml, item.description) }} />
                <Box sx={cell}>{item.freight || '-'}</Box>
                <Box sx={cell}>{item.installation || '-'}</Box>
                <Box sx={{ ...cell, textAlign: 'center' }}>{item.unit || '-'}</Box>
                <Box sx={{ ...cell, textAlign: 'right' }}>{quantity}</Box>
                <Box sx={{ ...cell, textAlign: 'right' }}>₹{money(rate)}</Box>
                <Box sx={{ ...cell, textAlign: 'right', fontWeight: 700 }}>₹{money(quantity * rate)}</Box>
              </Box>;
            })}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 237px' }}>
              <Box sx={{ ...cell, textAlign: 'right', fontWeight: 700 }}>Set Subtotal</Box>
              <Box sx={{ ...cell, textAlign: 'right', fontWeight: 800 }}>₹{money(setSubtotal(set))}</Box>
            </Box>
          </Box>
        )) : <Box sx={{ ...cell, py: 4, textAlign: 'center', color: '#64748b' }}>Add a standard or blank set to populate the quotation output.</Box>}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 260px' }}>
          <Box sx={{ ...cell, minHeight: 100 }}><strong>Notes:</strong> {meta.notes || '-'}</Box>
          <Box>
            {[['Subtotal', totals.subtotal], [`GST @ ${Number(gstPct) || 0}%`, totals.gst], ['Grand Total', totals.grand]].map(([label, value]) => (
              <Box key={label} sx={{ display: 'grid', gridTemplateColumns: '130px 130px', bgcolor: label === 'Grand Total' ? '#dce9f8' : '#fff' }}>
                <Box sx={{ ...cell, fontWeight: label === 'Grand Total' ? 800 : 600 }}>{label}</Box>
                <Box sx={{ ...cell, textAlign: 'right', fontWeight: label === 'Grand Total' ? 800 : 600 }}>₹{money(value)}</Box>
              </Box>
            ))}
          </Box>
        </Box>
        <TermsPreview terms={terms} termsType={termsType} termTypes={termTypes} onTermsTypeChange={onTermsTypeChange} onTermChange={onTermChange} onTermAdd={onTermAdd} onTermRemove={onTermRemove} onTermsReset={onTermsReset} />
      </Box>
    </Box>
  );
}

export default function QuotationSheetPreview({ quoteType = 'standard', meta, rows = [], totals, pricing, sets, gstPct, terms = [], termsType, termTypes = [], onTermsTypeChange, onTermChange, onTermAdd, onTermRemove, onTermsReset }) {
  if (Array.isArray(sets)) return <SetQuotationPreview meta={meta} sets={sets} gstPct={gstPct} terms={terms} termsType={termsType} termTypes={termTypes} onTermsTypeChange={onTermsTypeChange} onTermChange={onTermChange} onTermAdd={onTermAdd} onTermRemove={onTermRemove} onTermsReset={onTermsReset} />;
  const quoteRows = rows.filter((row) => isExportableQuotationRow(row, quoteType));
  const gst = totals.equipmentGst + totals.nonEquipmentGst + totals.freightInstallGst;

  return (
    <Box sx={{ border: '1px solid #9aa9bc', borderRadius: 2, bgcolor: '#fff', overflowX: 'auto', overflowY: 'hidden' }}>
      <Box sx={{ minWidth: 1195, fontFamily: 'Montserrat, sans-serif' }}>
        <PreviewHeader meta={meta} />

        <Box sx={{ display: 'grid', gridTemplateColumns: '44px 110px 115px 105px 90px minmax(240px,1fr) 78px 82px 62px 65px 92px 108px', bgcolor: '#244f87', color: '#fff' }}>
          {['S.No', 'Category', 'Sub Category', 'Item Code', 'Image', 'Description', 'Freight', 'Installation', 'Unit', 'Qty', 'Unit Price', 'Amount'].map((label) => (
            <Box key={label} sx={{ ...cell, color: '#fff', fontWeight: 800, textAlign: label === 'Description' ? 'left' : 'center', borderColor: '#7894b8' }}>{label}</Box>
          ))}
        </Box>

        {quoteRows.length ? quoteRows.map((row, index) => {
          const rate = Number(row.rateOverride !== '' ? row.rateOverride : row.rate) || 0;
          const amount = (Number(row.qty) || 0) * rate;
          return (
            <Box key={`${row.itemCode}-${index}`} sx={{ display: 'grid', gridTemplateColumns: '44px 110px 115px 105px 90px minmax(240px,1fr) 78px 82px 62px 65px 92px 108px' }}>
              <Box sx={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{index + 1}</Box>
              <Box sx={cell}>{row.category}</Box>
              <Box sx={cell}>{row.subCategory}</Box>
              <Box sx={cell}>{row.libraryItem || row.itemCode || (quoteType === 'athletic' ? 'Manual athletic item' : '-')}</Box>
              <Box sx={{ ...cell, minHeight: 92, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {row.imageUrl ? <Box component="img" src={driveImageUrl(row.imageUrl)} alt={row.itemCode} sx={{ width: 86, height: 74, objectFit: 'contain' }} /> : '-'}
              </Box>
              <Box className="quotation-preview-rich-text" sx={{ ...cell, minHeight: 92 }} dangerouslySetInnerHTML={{ __html: safeRichHtml(row.descHtml, row.desc) }} />
              <Box sx={cell}>{row.freight || '-'}</Box>
              <Box sx={cell}>{row.installation || '-'}</Box>
              <Box sx={{ ...cell, textAlign: 'center' }}>{row.unit || '-'}</Box>
              <Box sx={{ ...cell, textAlign: 'right' }}>{row.qty || 0}</Box>
              <Box sx={{ ...cell, textAlign: 'right' }}>₹{money(rate)}</Box>
              <Box sx={{ ...cell, textAlign: 'right', fontWeight: 700 }}>₹{money(amount)}</Box>
            </Box>
          );
        }) : (
          <Box sx={{ ...cell, py: 4, textAlign: 'center', color: '#64748b' }}>Select an item to populate the quotation output.</Box>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 260px' }}>
          <Box sx={{ ...cell, minHeight: 116 }}>
            <strong>Notes:</strong> {meta.notes || '-'}
          </Box>
          <Box>
            {[
              ['Subtotal', totals.subTotal],
              ['Discount', -(totals.equipmentDiscount + totals.nonEquipmentDiscount)],
              ['Freight', Number(pricing.freightAmount) || 0],
              ['Installation', Number(pricing.installationAmount) || 0],
              ['GST', gst],
              ['Grand Total', totals.grand],
            ].map(([label, value]) => (
              <Box key={label} sx={{ display: 'grid', gridTemplateColumns: '130px 130px', bgcolor: label === 'Grand Total' ? '#dce9f8' : '#fff' }}>
                <Box sx={{ ...cell, fontWeight: label === 'Grand Total' ? 800 : 600 }}>{label}</Box>
                <Box sx={{ ...cell, textAlign: 'right', fontWeight: label === 'Grand Total' ? 800 : 600 }}>₹{money(value)}</Box>
              </Box>
            ))}
          </Box>
        </Box>
        <TermsPreview terms={terms} termsType={termsType} termTypes={termTypes} onTermsTypeChange={onTermsTypeChange} onTermChange={onTermChange} onTermAdd={onTermAdd} onTermRemove={onTermRemove} onTermsReset={onTermsReset} />
      </Box>
    </Box>
  );
}
