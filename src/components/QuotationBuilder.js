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

const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwcV0I1JGLqmDTT_vPgrVOdDbpy4XUbUEi7CD5cujdLydfS9uybkMJ_DCCJRMNDWKbo3g/exec';

const cellStyle = { fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem' };

const emptyRow = {
  category: '', subCategory: '', itemCode: '',
  qty: 1, rateOverride: '', // client overridable
  unit: '', rate: '', desc: '', imageUrl: ''
};

export default function QuotationBuilder() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState(null);
  const [rows, setRows] = useState([{ ...emptyRow }]);
  const [meta, setMeta] = useState({
    clientName: '', projectName: '', quotationNo: '',
    dateISO: new Date().toISOString().slice(0,10), preparedBy: '', notes: '',
    layout: 'portrait'
  });
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState(null);

  // Lead attach
  const [leadOptions, setLeadOptions] = useState([]);
  const [attachLead, setAttachLead] = useState('');

  // Frontend access guard (mirrors backend)
  const canUseQuotation = (user?.role === 'Admin')
    || (Array.isArray(user?.pageAccess) && user.pageAccess.includes('Quotation'));

  useEffect(() => {
    // Load catalog
    (async () => {
      const r = await fetch(`${WEB_APP_URL}?action=getCatalog`);
      const j = await r.json();
      if (j.ok) setCatalog(j.data);
    })();
  }, []);

  useEffect(() => {
    if (!user?.username) return;
    // Load leads for dropdown
    (async () => {
      const url = `${WEB_APP_URL}?action=getLeadsForUser&user=${encodeURIComponent(user.username)}`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.ok && Array.isArray(j.entries)) setLeadOptions(j.entries);
    })();
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
        row.unit=''; row.rate=''; row.rateOverride=''; row.desc=''; row.imageUrl='';
      }
      if (field === 'subCategory') {
        row.itemCode = '';
        row.unit=''; row.rate=''; row.rateOverride=''; row.desc=''; row.imageUrl='';
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
          row.unit=''; row.rate=''; row.desc=''; row.imageUrl='';
        }
      }

      next[i] = row;
      return next;
    });
  };

  const addRow = () => setRows(prev => [...prev, { ...emptyRow }]);
  const removeRow = (i) => setRows(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

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
            // optional override; if blank, backend uses master rate
            rateOverride: r.rateOverride !== '' ? Number(r.rateOverride) : undefined
          })),
        attach: attachLead ? { leadDisplay: attachLead } : null
      };

      const url = `${WEB_APP_URL}?action=buildQuotationAndExport&user=${encodeURIComponent(user?.username || '')}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.ok) {
        setLastExport({ url: json.pdfUrl, name: json.pdfFileName });
        window.open(json.pdfUrl, '_blank');
      } else {
        alert(`Export failed: ${json.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Export failed. Check console/logs.');
    } finally {
      setExporting(false);
    }
  };

  const subCatsFor = (cat) => catalog?.subcategories?.[cat] || [];
  const itemsFor   = (cat, sub) => (catalog?.items?.[`${cat}|||${sub}`]) || [];

  if (!canUseQuotation) {
    return (
      <Box sx={{ p: 3, fontFamily: 'Montserrat, sans-serif' }}>
        <Typography variant="h6" fontWeight={600}>You don’t have access to Quotation Builder.</Typography>
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
              onChange={e => setMeta(m => ({...m, clientName: e.target.value}))} inputProps={{style: cellStyle}} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="Project Name" value={meta.projectName}
              onChange={e => setMeta(m => ({...m, projectName: e.target.value}))} inputProps={{style: cellStyle}} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="Quotation No." value={meta.quotationNo}
              onChange={e => setMeta(m => ({...m, quotationNo: e.target.value}))} inputProps={{style: cellStyle}} />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth type="date" label="Date" InputLabelProps={{ shrink: true }}
              value={meta.dateISO} onChange={e => setMeta(m => ({...m, dateISO: e.target.value}))}
              inputProps={{style: cellStyle}} />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth label="Prepared By" value={meta.preparedBy}
              onChange={e => setMeta(m => ({...m, preparedBy: e.target.value}))} inputProps={{style: cellStyle}} />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Layout</InputLabel>
              <Select value={meta.layout} label="Layout"
                onChange={e => setMeta(m => ({...m, layout: e.target.value}))}
                sx={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem' }}>
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
              value={meta.notes} onChange={e => setMeta(m => ({...m, notes: e.target.value}))}
              inputProps={{style: cellStyle}} />
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
                  <Select value={r.category} displayEmpty
                    onChange={e => handleRowChange(i, 'category', e.target.value)}
                    sx={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem' }}>
                    <MenuItem value=""><em>Select</em></MenuItem>
                    {(catalog?.categories || []).map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <Select value={r.subCategory} displayEmpty disabled={!r.category}
                    onChange={e => handleRowChange(i, 'subCategory', e.target.value)}
                    sx={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem' }}>
                    <MenuItem value=""><em>Select</em></MenuItem>
                    {subcats.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <Select value={r.itemCode} displayEmpty disabled={!r.category || !r.subCategory}
                    onChange={e => handleRowChange(i, 'itemCode', e.target.value)}
                    sx={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem' }}>
                    <MenuItem value=""><em>Select</em></MenuItem>
                    {items.map(it => <MenuItem key={it.code} value={it.code}>{it.code}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={1}>
                <TextField fullWidth value={r.unit || ''} label="Unit" InputLabelProps={{shrink: true}} inputProps={{readOnly:true, style:cellStyle}} />
              </Grid>
              <Grid item xs={12} md={1}>
                <TextField fullWidth type="number" label="Qty" value={r.qty}
                  onChange={e => handleRowChange(i, 'qty', e.target.value)} inputProps={{style: cellStyle}} />
              </Grid>
              <Grid item xs={12} md={1.5}>
                <TextField fullWidth type="number" label="Rate"
                  value={r.rateOverride !== '' ? r.rateOverride : (r.rate ?? '')}
                  onChange={e => handleRowChange(i, 'rateOverride', e.target.value)}
                  helperText="Leave blank to use item rate"
                  FormHelperTextProps={{ sx: { m: 0 } }}
                  inputProps={{style: cellStyle}} />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth label="Description" value={r.desc || ''} onChange={e => handleRowChange(i, 'desc', e.target.value)} inputProps={{style: cellStyle}} />
              </Grid>
              <Grid item xs={12} md={0.5} sx={{ display: 'flex', gap: 1 }}>
                {r.imageUrl ? (
                  <IconButton onClick={() => window.open(r.imageUrl, '_blank')} title="Open image">
                    <PictureInPictureAlt />
                  </IconButton>
                ) : null}
                <IconButton onClick={() => removeRow(i)} title="Remove">
                  <DeleteOutline />
                </IconButton>
              </Grid>

              {/* Optional live preview card */}
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
          {lastExport && (
            <Button variant="outlined" onClick={() => window.open(lastExport.url, '_blank')}>
              Open Last PDF
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
