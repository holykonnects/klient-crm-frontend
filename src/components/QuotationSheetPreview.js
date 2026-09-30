import React from 'react';
import { Box, Typography } from '@mui/material';
import { itemQuantity, setQuoteTotals, setSubtotal } from './quotationSets';

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

function TermsPreview({ terms = [], termsType }) {
  if (!terms.length) return null;
  return <Box sx={{ borderTop: '1px solid #9aa9bc' }}>
    <Box sx={{ ...cell, bgcolor: '#dce9f8', color: '#163f76', fontWeight: 800, fontSize: '0.78rem' }}>
      Terms &amp; Conditions: {termsType || 'Selected terms'}
    </Box>
    {terms.map((term, index) => <Box key={`${index}-${term}`} sx={{ display: 'grid', gridTemplateColumns: '46px 1fr' }}>
      <Box sx={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{index + 1}</Box>
      <Box sx={{ ...cell, lineHeight: 1.5 }}>{term}</Box>
    </Box>)}
  </Box>;
}

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

function SetQuotationPreview({ meta, sets, gstPct, terms, termsType }) {
  const totals = setQuoteTotals(sets, gstPct);
  let serial = 1;
  return (
    <Box sx={{ border: '1px solid #9aa9bc', borderRadius: 2, bgcolor: '#fff', overflowX: 'auto', overflowY: 'hidden' }}>
      <Box sx={{ minWidth: 980, fontFamily: 'Montserrat, sans-serif' }}>
        <PreviewHeader meta={meta} />
        {sets.length ? sets.map((set, setIndex) => (
          <Box key={set.id || setIndex}>
            <Box sx={{ ...cell, bgcolor: '#dce9f8', color: '#163f76', fontWeight: 800, fontSize: '0.78rem' }}>
              {setIndex + 1}. {set.title || 'Untitled set'}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '48px 190px minmax(330px,1fr) 80px 92px 112px 125px', bgcolor: '#244f87' }}>
              {['S.No', 'Item', 'Description', 'Unit', 'Quantity', 'Unit Price', 'Amount'].map(label => (
                <Box key={label} sx={{ ...cell, color: '#fff', fontWeight: 800, textAlign: label === 'Description' || label === 'Item' ? 'left' : 'center', borderColor: '#7894b8' }}>{label}</Box>
              ))}
            </Box>
            {(set.items || []).map((item, itemIndex) => {
              const quantity = itemQuantity(set, item);
              const rate = Number(item.rate) || 0;
              const currentSerial = serial++;
              return <Box key={item.id || itemIndex} sx={{ display: 'grid', gridTemplateColumns: '48px 190px minmax(330px,1fr) 80px 92px 112px 125px' }}>
                <Box sx={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{currentSerial}</Box>
                <Box sx={cell}>{item.item || '-'}</Box>
                <Box className="quotation-preview-rich-text" sx={{ ...cell, minHeight: 72 }} dangerouslySetInnerHTML={{ __html: safeRichHtml(item.descHtml, item.description) }} />
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
        <TermsPreview terms={terms} termsType={termsType} />
      </Box>
    </Box>
  );
}

export default function QuotationSheetPreview({ meta, rows = [], totals, pricing, sets, gstPct, terms = [], termsType }) {
  if (Array.isArray(sets)) return <SetQuotationPreview meta={meta} sets={sets} gstPct={gstPct} terms={terms} termsType={termsType} />;
  const quoteRows = rows.filter((row) => row.category && row.subCategory && row.itemCode);
  const gst = totals.equipmentGst + totals.nonEquipmentGst + totals.freightInstallGst;

  return (
    <Box sx={{ border: '1px solid #9aa9bc', borderRadius: 2, bgcolor: '#fff', overflowX: 'auto', overflowY: 'hidden' }}>
      <Box sx={{ minWidth: 980, fontFamily: 'Montserrat, sans-serif' }}>
        <PreviewHeader meta={meta} />

        <Box sx={{ display: 'grid', gridTemplateColumns: '44px 125px 130px 115px 104px minmax(260px,1fr) 72px 72px 105px 118px', bgcolor: '#244f87', color: '#fff' }}>
          {['S.No', 'Category', 'Sub Category', 'Item Code', 'Image', 'Description', 'Unit', 'Qty', 'Unit Price', 'Amount'].map((label) => (
            <Box key={label} sx={{ ...cell, color: '#fff', fontWeight: 800, textAlign: label === 'Description' ? 'left' : 'center', borderColor: '#7894b8' }}>{label}</Box>
          ))}
        </Box>

        {quoteRows.length ? quoteRows.map((row, index) => {
          const rate = Number(row.rateOverride !== '' ? row.rateOverride : row.rate) || 0;
          const amount = (Number(row.qty) || 0) * rate;
          return (
            <Box key={`${row.itemCode}-${index}`} sx={{ display: 'grid', gridTemplateColumns: '44px 125px 130px 115px 104px minmax(260px,1fr) 72px 72px 105px 118px' }}>
              <Box sx={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{index + 1}</Box>
              <Box sx={cell}>{row.category}</Box>
              <Box sx={cell}>{row.subCategory}</Box>
              <Box sx={cell}>{row.itemCode}</Box>
              <Box sx={{ ...cell, minHeight: 92, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {row.imageUrl ? <Box component="img" src={driveImageUrl(row.imageUrl)} alt={row.itemCode} sx={{ width: 86, height: 74, objectFit: 'contain' }} /> : '-'}
              </Box>
              <Box className="quotation-preview-rich-text" sx={{ ...cell, minHeight: 92 }} dangerouslySetInnerHTML={{ __html: safeRichHtml(row.descHtml, row.desc) }} />
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
        <TermsPreview terms={terms} termsType={termsType} />
      </Box>
    </Box>
  );
}
