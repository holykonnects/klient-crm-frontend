// src/components/QuotationBuilder.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Grid, Typography, Button, TextField, IconButton,
  MenuItem, Select, FormControl, InputLabel, Paper
} from '@mui/material';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import PictureInPictureAlt from '@mui/icons-material/PictureInPictureAlt';
import '@fontsource/montserrat';
import { useAuth } from './AuthContext';

// ✅ Use the same-origin proxy (no CORS)
const WEB_APP_URL = '/api/gas';

const cellStyle = { fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem' };

const emptyRow = {
  category: '', subCategory: '', itemCode: '',
  qty: 1, rateOverride: '',
  unit: '', rate: '', desc: '', imageUrl: ''
};

// --- helpers: URL safety + JSON fetch ---
function isHttpUrl(s) {
  if (!s) return false;
  const t = String(s).trim();
  return /^https?:\/\/\S+$/i.test(t);
}
function safeOpen(url) {
  const t = String(url || '').trim();
  if (!isHttpUrl(t)) return false;
  window.open(t, '_blank', 'noopener,noreferrer');
  return true;
}
async function fetchJSON(url, init) {
  const r = await fetch(url, init);
  const text = await r.text();      // read as text first for clearer diagnostics
  try { return JSON.parse(text); }
  catch (e) {
    console.error('Non-JSON from server:', text);
    throw new Error('Invalid JSON from server');
  }
}

export default function QuotationBuilder() {
  const { user } = useAuth();

  const [catalog, setCatalog] = useState(null);
  const [rows, setRows] = useState([{ ...emptyRow }]);
  const [meta, setMeta] = useState({
    clientName: '', projectName: '', quotationNo: '',
    dateISO: new Date().toISOString().slice(0, 10),
    preparedBy: '', notes: '', layout: 'portrait'
  });
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState(null);

  // Lead attach
  const [leadOptions, setLeadOptions] = useState([]);
  const [attachLead, setAttachLead] = useState('');

  // Access guard (mirrors backend)
  const canUseQuotation =
    user?.role === 'Admin' ||
    (Array.isArray(user?.pageAccess) && user.pageAccess.includes('Quotation'));

  // Load catalog
  useEffect(() => {
    (async () => {
      const j = await fetchJSON(`${WEB_APP_URL}?action=getCatalog`);
      if (j.ok) setCatalog(j.data);
      else console.error('getCatalog error:', j.error);
    })().catch(console.error);
  }, []);

  // Load leads for the user
  useEffect(() => {
    if (!user?.username) return;
    (async () => {
      const j = await fetchJSON(`${WEB_APP_URL}?action=getLeadsForUser&user=${encodeURIComponent(user.username)}`);
      if (j.ok && Array.isArray(j.entries)) setLeadOptions(j.entries);
      else console.error('getLeadsForUser error:', j.error);
    })().catch(console.error);
  }, [user?.username]);

  const totals = useMemo(() => {
    let sub = 0;
    rows.forEach(r => {
      const qty = Number(r.qty || 0);
      const rate = Number(r.rateOverride !== '' ? r.rateOverride : r.rate || 0);
      sub += qty * rate;
    });
    const tax = 0;
    return { subTotal: sub, tax, grand: sub + tax };
  }, [rows]);

  const handleRowChange = (i, field, value) => {
    setRows(prev => {
      const next = [...prev];
      const row = { ...next[i], [field]: value };

      if (field === 'category') {
        row.subCategory = ''; row.itemCode = '';
        row.unit = ''; row.rate = ''; row.rateOverride = '';
        row.desc = ''; row.imageUrl = '';
      }
      if (field === 'subCategory') {
        row.itemCode = '';
        row.unit = ''; row.rate = ''; row.rateOverride = '';
        row.desc = ''; row.imageUrl = '';
      }
      if (field === 'itemCode' && catalog) {
        const key = `${row.category}|||${row.subCategory}`;
        const pool = (catalog.items && catalog.items[key]) || [];
        const found = pool.find(p => p.code === value);
        if (found) {
          row.unit = found.unit || '';
          row.rate = Number(found.rate || 0);
          row.desc = found.desc || found.name || '';
          row.imageUrl = found.imageUrl || '';
        } else {
          row.unit = ''; row.rate = ''; row.desc = ''; row.imageUrl = '';
        }
      }

      next[i] = row;
      return next;
    });
  };

  const addRow = () => setRows(prev => [...prev, { ...emptyRow }]);
  const removeRow = (i) => setRows(prev => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const subCatsFor = (cat) => catalog?.subcategories?.[cat] || [];
  const itemsFor = (cat, sub) => (catalog?.items?.[`${cat}|||${sub}`]) || [];

  const exportPdf = async () => {
    if (!canUseQuotation) {
      alert('You do not have access to Quotation Builder.');
      return;
    }
    setExporting(true);
    try {
      const payload = {
        meta,
        items: rows
          .filter(r => r.category && r.subCategory && r.itemCode)
          .map(r => ({
            category: r.category,
            subCategory: r.subCategory,
            itemCode: r.itemCode,
            qty: Number(r.qty || 0),
            rateOverride: r.rateOverride !== '' ? Number(r.rateOverride) : undefined
          })),
        attach: attachLead ? { leadDisplay: attachLead } : null
      };

      const j = await fetchJSON(
        `${WEB_APP_URL}?action=buildQuotationAndExport&user=${encodeURIComponent(user?.username || '')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      console.log('Export response:', j);

      if (!j.ok) {
        alert(j.error || 'Export failed');
        return;
      }
      const url = String(j.pdfUrl || '').trim();
      if (!isHttpUrl(url)) {
        console.warn('Invalid pdfUrl from backend:', j.pdfUrl);
        alert('Exported, but the PDF link looked invalid. Check the Drive folder or the Lead’s “Quotation Link”.');
        return;
      }
      safeOpen(url);
      setLastExport({ url, name: j.pdfFileName });
    } catch (e) {
      console.error(e);
      alert('Export failed. See console for details.');
    } finally {
      setExporting(false);
    }
  };

  if (!canUseQuotation) {
    return (
      <Box sx={{ p: 3, fontFamily: 'Montserrat, sans-serif' }}>
        <Typography variant="h6" fontWeight={600}>
          You don’t have access to Quotation Builder.
        </Typography>
        <Typography variant="body2">Please contact your admin.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, fontFamily: 'Montserrat, sans-serif' }}>
      <Typography variant="h6" sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, mb: 2 }}>
        Quotation Builder
      </Typography>

      {/* Meta */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="Client Name" value={meta.clientName}
              onChange={e => setMeta(m => ({ ...m, clientName: e.target.value }))}
              inputProps={{ style: cellStyle }} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="Project Name" value={meta.projectName}
              onChange={e => setMeta(m => ({ ...m, projectName: e.target.value }))}
              inputProps={{ style: cellStyle }} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="Quotation No." value={meta.quotationNo}
              onChange={e => setMeta(m => ({ ...m, quotationNo: e.target.value }))}
              inputProps={{ style: cellStyle }} />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth type="date" label="Date" InputLabelProps={{ shrink: true }}
              value={meta.dateISO}
              onChange={e => setMeta(m => ({ ...m, dateISO: e.target.value }))}
              inputProps={{ style: cellStyle }} />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth label="Prepared By" value={meta.preparedBy}
              onChange={e => setMeta(m => ({ ...m, preparedBy: e.target.value }))}
              inputProps={{ style: cellStyle }} />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Layout</InputLabel>
              <Select
                value={meta.layout}
                label="Layout"
                onChange={e => setMeta(m => ({ ...m, layout: e.target.value }))}
                sx={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem' }}
              >
                <MenuItem value="portrait">Portrait</MenuItem>
                <MenuItem value="landscape">Landscape</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Attach to Lead (optional)</InputLabel>
              <Select
                value={attachLead}
                label="Attach to Lead (optional)"
                onChange={e => setAttachLead(e.target.value)}
                sx={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem' }}
              >
                <MenuItem value=""><em>Skip</em></MenuItem>
                {leadOptions.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth multiline minRows={2} label="Notes"
              value={meta.notes}
              onChange={e => setMeta(m => ({ ...m, notes: e.target.value }))}
              inputProps={{ style: cellStyle }} />
          </Grid>
        </Grid>
      </Paper>

      {/* Lines */}
      <Paper sx={{ p: 2 }}>
        <Grid container spacing={1} sx={{ mb: 1 }}>
          <Grid item xs={12} md={2}><Typography fontWeight={600}>Category</Typography></Grid>
          <Grid item xs={12} md={2}><Typography fontWeight={600}>Sub-Category</Typography></Grid>
          <Grid item xs={12} md={2}><Typography fontWeight={600}>Item Code</Typography></Grid>
          <Grid item xs={12} md={1}><Typography fontWeight={600}>Unit</Typography></Grid>
          <Grid item xs={12} md={1}><Typography fontWeight={600}>Qty</Typography></Grid>
          <Grid item xs={12} md={1.5}><Typography fontWeight={600}>Rate</Typography></Grid>
          <Grid item xs={12} md={2}><Typography fontWeight={600}>Description</Typography></Grid>
          <Grid item xs={12} md={0.5}></Grid>
        </Grid>

        {rows.map((r, i) => {
          const subcats = subCatsFor(r.category);
          const items = itemsFor(r.category, r.subCategory);
          return (
            <Grid container spacing={1} key={i} alignItems="center" sx={{ mb: 0.5 }}>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <Select
                    value={r.category}
                    displayEmpty
                    onChange={e => handleRowChange(i, 'category', e.target.value)}
                    sx={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem' }}
                  >
                    <MenuItem value=""><em>Select</em></MenuItem>
                    {(catalog?.categories || []).map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <Select
                    value={r.subCategory}
                    displayEmpty
                    disabled={!r.category}
                    onChange={e => handleRowChange(i, 'subCategory', e.target.value)}
                    sx={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem' }}
                  >
                    <MenuItem value=""><em>Select</em></MenuItem>
                    {subcats.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <Select
                    value={r.itemCode}
                    displayEmpty
                    disabled={!r.category || !r.subCategory}
                    onChange={e => handleRowChange(i, 'itemCode', e.target.value)}
                    sx={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem' }}
                  >
                    <MenuItem value=""><em>Select</em></MenuItem>
                    {items.map(it => <MenuItem key={it.code} value={it.code}>{it.code}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={1}>
                <TextField
                  fullWidth
                  value={r.unit || ''}
                  label="Unit"
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ readOnly: true, style: cellStyle }}
                />
              </Grid>
              <Grid item xs={12} md={1}>
                <TextField
                  fullWidth
                  type="number"
                  label="Qty"
                  value={r.qty}
                  onChange={e => handleRowChange(i, 'qty', e.target.value)}
                  inputProps={{ style: cellStyle }}
                />
              </Grid>
              <Grid item xs={12} md={1.5}>
                <TextField
                  fullWidth
                  type="number"
                  label="Rate"
                  value={r.rateOverride !== '' ? r.rateOverride : (r.rate ?? '')}
                  onChange={e => handleRowChange(i, 'rateOverride', e.target.value)}
                  helperText="Leave blank to use item rate"
                  FormHelperTextProps={{ sx: { m: 0 } }}
                  inputProps={{ style: cellStyle }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  label="Description"
                  value={r.desc || ''}
                  onChange={e => handleRowChange(i, 'desc', e.target.value)}
                  inputProps={{ style: cellStyle }}
                />
              </Grid>
              <Grid item xs={12} md={0.5} sx={{ display: 'flex', gap: 1 }}>
                {r.imageUrl ? (
                  <IconButton onClick={() => safeOpen(r.imageUrl)} title="Open image">
                    <PictureInPictureAlt />
                  </IconButton>
                ) : null}
                <IconButton onClick={() => removeRow(i)} title="Remove">
                  <DeleteOutline />
                </IconButton>
              </Grid>

              {/* Optional live description preview */}
              {r.desc ? (
                <Grid item xs={12}>
                  <Paper style={{ padding: 8, fontFamily: 'Montserrat, sans-serif' }}>
                    <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>{r.desc}</Typography>
                  </Paper>
                </Grid>
              ) : null}
            </Grid>
          );
        })}

        <Box sx={{ mt: 1 }}>
          <Button startIcon={<AddCircleOutline />} onClick={addRow}>
            Add Line
          </Button>
        </Box>
      </Paper>

      {/* Totals & Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography>Subtotal: ₹{totals.subTotal.toLocaleString('en-IN')}</Typography>
          <Typography>Tax: ₹{totals.tax.toLocaleString('en-IN')}</Typography>
          <Typography fontWeight={700}>Grand Total: ₹{totals.grand.toLocaleString('en-IN')}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" onClick={exportPdf} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export to PDF + Link Lead'}
          </Button>
          {lastExport && isHttpUrl(lastExport.url) && (
            <Button variant="outlined" onClick={() => safeOpen(lastExport.url)}>
              Open Last PDF
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
