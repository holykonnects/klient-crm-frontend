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

const WEB_APP_URL = '/api/gas';
const cellStyle = { fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem' };
const fieldSx = {
  '& .MuiInputBase-root': { borderRadius: 1.5, backgroundColor: '#fff' },
  '& .MuiInputBase-input': { fontFamily: 'Montserrat, sans-serif', fontSize: '0.88rem' },
  '& .MuiInputLabel-root': { fontFamily: 'Montserrat, sans-serif' }
};
const selectSx = { fontFamily: 'Montserrat, sans-serif', fontSize: '0.88rem', borderRadius: 1.5, backgroundColor: '#fff' };
const panelSx = {
  p: 2,
  border: '1px solid #dbe3ef',
  borderRadius: 2,
  boxShadow: '0 8px 22px rgba(15, 23, 42, 0.05)'
};
const sectionTitleSx = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: 0,
  mb: 1.5
};
const TC_FALLBACK_OPTIONS = ['Equipment', 'Flooring'];
const ITEM_TYPE_OPTIONS = ['Equipment', 'Non Equipment'];
const GST_RATE_OPTIONS = [0, 5, 12, 18, 28];

const emptyRow = {
  category: '', subCategory: '', itemCode: '',
  qty: 1, rateOverride: '',
  unit: '', rate: '', desc: '', imageUrl: '', itemType: 'Equipment'
};

// helpers
function isHttpUrl(s) { if (!s) return false; const t = String(s).trim(); return /^https?:\/\/\S+$/i.test(t); }
function safeOpen(url) { const t = String(url || '').trim(); if (!isHttpUrl(t)) return false; window.open(t, '_blank', 'noopener,noreferrer'); return true; }
async function fetchJSON(url, init) {
  const r = await fetch(url, init);
  const text = await r.text();
  try {
    const parsed = JSON.parse(text);
    if (!r.ok && parsed && !parsed.error) parsed.error = `Request failed with status ${r.status}`;
    return parsed;
  } catch {
    const detail = text ? `: ${text.slice(0, 240)}` : '';
    throw new Error(`Invalid JSON from server${detail}`);
  }
}
function toNumber(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[₹,%\s,]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function money(value) {
  return toNumber(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function pctValue(value) {
  const n = toNumber(value);
  return n > 1 ? n / 100 : n;
}

export default function QuotationBuilder() {
  const { user } = useAuth();

  const [catalog, setCatalog] = useState(null);
  const [rows, setRows] = useState([{ ...emptyRow }]);
  const [meta, setMeta] = useState({
    clientName: '', projectName: '', quotationNo: '',
    dateISO: new Date().toISOString().slice(0, 10),
    preparedBy: '', notes: '', layout: 'portrait',
    quotationTitle: '', clientBillingAddress: '', clientGstNumber: '',
    tcType: 'Equipment'
  });
  const [pricing, setPricing] = useState({
    freightAmount: '',
    installationAmount: '',
    nonEquipmentDiscountPct: 0,
    equipmentDiscountPct: 0,
    nonEquipmentGstPct: 18,
    equipmentGstPct: 18,
    freightInstallGstPct: 18
  });
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState(null);

  const [leadOptions, setLeadOptions] = useState([]);
  const [attachLead, setAttachLead] = useState('');
  const [leadLookupError, setLeadLookupError] = useState('');

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

  // Load leads
  useEffect(() => {
    if (!user?.username) return;
    (async () => {
      const j = await fetchJSON(`${WEB_APP_URL}?action=getLeadsForUser&user=${encodeURIComponent(user.username)}`);
      if (j.ok && Array.isArray(j.entries)) {
        setLeadOptions(j.entries);
        setLeadLookupError('');
      } else {
        setLeadOptions([]);
        setLeadLookupError(j.error || 'Lead lookup unavailable');
      }
    })().catch(err => {
      setLeadOptions([]);
      setLeadLookupError(err.message || 'Lead lookup unavailable');
    });
  }, [user?.username]);

  const totals = useMemo(() => {
    let equipment = 0;
    let nonEquipment = 0;
    rows.forEach(r => {
      const qty = toNumber(r.qty);
      const rate = toNumber(r.rateOverride !== '' ? r.rateOverride : r.rate);
      const lineTotal = qty * rate;
      if (r.itemType === 'Non Equipment') nonEquipment += lineTotal;
      else equipment += lineTotal;
    });
    const freight = toNumber(pricing.freightAmount);
    const installation = toNumber(pricing.installationAmount);
    const equipmentDiscount = equipment * pctValue(pricing.equipmentDiscountPct);
    const nonEquipmentDiscount = nonEquipment * pctValue(pricing.nonEquipmentDiscountPct);
    const equipmentTaxable = Math.max(equipment - equipmentDiscount, 0);
    const nonEquipmentTaxable = Math.max(nonEquipment - nonEquipmentDiscount, 0);
    const freightInstall = freight + installation;
    const equipmentGst = equipmentTaxable * pctValue(pricing.equipmentGstPct);
    const nonEquipmentGst = nonEquipmentTaxable * pctValue(pricing.nonEquipmentGstPct);
    const freightInstallGst = freightInstall * pctValue(pricing.freightInstallGstPct);
    const grandRaw = equipmentTaxable + nonEquipmentTaxable + freightInstall + equipmentGst + nonEquipmentGst + freightInstallGst;
    return {
      equipment, nonEquipment,
      subTotal: equipment + nonEquipment,
      freight, installation,
      equipmentDiscount, nonEquipmentDiscount,
      equipmentGst, nonEquipmentGst, freightInstallGst,
      grand: Math.ceil(grandRaw)
    };
  }, [rows, pricing]);

  const subCatsFor = (cat) => catalog?.subcategories?.[cat] || [];
  const itemsFor = (cat, sub) => (catalog?.items?.[`${cat}|||${sub}`]) || [];
  const tcOptions = catalog?.tcOptions?.length ? catalog.tcOptions : TC_FALLBACK_OPTIONS;

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
          row.rate = toNumber(found.rate);
          row.itemType = found.itemType || row.itemType || 'Equipment';
          // Description from Equipment BD "Description" column
          // fallback to "Category : Sub-Category : Item Code" if not present
          row.desc = (found.desc && String(found.desc).trim())
            ? found.desc
            : `${row.category} : ${row.subCategory} : ${value}`;
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

  const exportPdf = async () => {
    if (!canUseQuotation) { alert('You do not have access to Quotation Builder.'); return; }
    setExporting(true);
    try {
      const payload = {
        meta,
        pricing,
        items: rows
          .filter(r => r.category && r.subCategory && r.itemCode)
          .map(r => ({
            category: r.category,
            subCategory: r.subCategory,
            itemCode: r.itemCode,
            qty: toNumber(r.qty),
            unit: r.unit || '',
            itemType: r.itemType || 'Equipment',
            rate: toNumber(r.rate),
            rateOverride: r.rateOverride !== '' ? toNumber(r.rateOverride) : undefined,
            // Send description override so backend writes this exact text.
            descOverride: (r.desc && String(r.desc).trim()) ? r.desc : undefined
          })),
        attach: attachLead ? { leadDisplay: attachLead } : null
      };

      const j = await fetchJSON(
        `${WEB_APP_URL}?action=buildQuotationAndExport&user=${encodeURIComponent(user?.username || '')}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      );

      if (!j.ok) { alert(j.error || 'Export failed'); return; }
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
        <Typography variant="h6" fontWeight={600}>You don’t have access to Quotation Builder.</Typography>
        <Typography variant="body2">Please contact your admin.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', p: { xs: 1.5, md: 3 }, bgcolor: '#f6f8fb', fontFamily: 'Montserrat, sans-serif' }}>
      <Box sx={{
        mb: 2.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', md: 'center' },
        gap: 2,
        flexDirection: { xs: 'column', md: 'row' }
      }}>
        <Box>
          <Typography variant="h5" sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: '#0f172a' }}>
            Build Quote
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
            {rows.filter(r => r.category && r.subCategory && r.itemCode).length} line item{rows.length === 1 ? '' : 's'} ready for export
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {lastExport && isHttpUrl(lastExport.url) && (
            <Button variant="outlined" onClick={() => safeOpen(lastExport.url)} sx={{ borderRadius: 1.5 }}>
              Open Last PDF
            </Button>
          )}
          <Button variant="contained" onClick={exportPdf} disabled={exporting}
            sx={{ borderRadius: 1.5, px: 2.5, bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}>
            {exporting ? 'Exporting...' : 'Export PDF'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2.5} alignItems="flex-start">
        <Grid item xs={12} lg={8.5}>
          <Paper sx={{ ...panelSx, mb: 2.5 }}>
            <Typography sx={sectionTitleSx}>Quote Details</Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={7}>
                <TextField fullWidth size="small" label="Quote Title / File Name" value={meta.quotationTitle}
                  onChange={e => setMeta(m => ({ ...m, quotationTitle: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={5}>
                <FormControl fullWidth size="small" sx={fieldSx} error={Boolean(leadLookupError)}>
                  <InputLabel>Attach to Lead</InputLabel>
                  <Select value={attachLead} label="Attach to Lead" onChange={e => setAttachLead(e.target.value)} sx={selectSx}>
                    <MenuItem value=""><em>Skip</em></MenuItem>
                    {leadLookupError && <MenuItem value="" disabled>Lead lookup unavailable</MenuItem>}
                    {leadOptions.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" label="Client Name" value={meta.clientName}
                  onChange={e => setMeta(m => ({ ...m, clientName: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" label="Project Name" value={meta.projectName}
                  onChange={e => setMeta(m => ({ ...m, projectName: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" label="Quotation No." value={meta.quotationNo}
                  onChange={e => setMeta(m => ({ ...m, quotationNo: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth size="small" type="date" label="Date" InputLabelProps={{ shrink: true }}
                  value={meta.dateISO} onChange={e => setMeta(m => ({ ...m, dateISO: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth size="small" label="Prepared By" value={meta.preparedBy}
                  onChange={e => setMeta(m => ({ ...m, preparedBy: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small" sx={fieldSx}>
                  <InputLabel>Terms Type</InputLabel>
                  <Select value={meta.tcType} label="Terms Type" onChange={e => setMeta(m => ({ ...m, tcType: e.target.value }))} sx={selectSx}>
                    {tcOptions.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth size="small" label="Client GST Number" value={meta.clientGstNumber}
                  onChange={e => setMeta(m => ({ ...m, clientGstNumber: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={7}>
                <TextField fullWidth size="small" label="Client Billing Address" value={meta.clientBillingAddress}
                  onChange={e => setMeta(m => ({ ...m, clientBillingAddress: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={5}>
                <TextField fullWidth size="small" label="Notes" value={meta.notes}
                  onChange={e => setMeta(m => ({ ...m, notes: e.target.value }))} sx={fieldSx} />
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ ...panelSx, mb: 2.5 }}>
            <Typography sx={sectionTitleSx}>Pricing Controls</Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={6} md={3}>
                <TextField fullWidth size="small" type="number" label="Freight" value={pricing.freightAmount}
                  onChange={e => setPricing(p => ({ ...p, freightAmount: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField fullWidth size="small" type="number" label="Installation" value={pricing.installationAmount}
                  onChange={e => setPricing(p => ({ ...p, installationAmount: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField fullWidth size="small" type="number" label="Equipment Discount %" value={pricing.equipmentDiscountPct}
                  onChange={e => setPricing(p => ({ ...p, equipmentDiscountPct: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField fullWidth size="small" type="number" label="Non Equipment Discount %" value={pricing.nonEquipmentDiscountPct}
                  onChange={e => setPricing(p => ({ ...p, nonEquipmentDiscountPct: e.target.value }))} sx={fieldSx} />
              </Grid>
              {[
                ['equipmentGstPct', 'GST Equipment'],
                ['nonEquipmentGstPct', 'GST Non Equipment'],
                ['freightInstallGstPct', 'GST Freight + Installation']
              ].map(([key, label]) => (
                <Grid item xs={12} md={4} key={key}>
                  <FormControl fullWidth size="small" sx={fieldSx}>
                    <InputLabel>{label}</InputLabel>
                    <Select value={pricing[key]} label={label}
                      onChange={e => setPricing(p => ({ ...p, [key]: e.target.value }))}
                      sx={selectSx}>
                      {GST_RATE_OPTIONS.map(rate => <MenuItem key={rate} value={rate}>{rate}%</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              ))}
            </Grid>
          </Paper>

          <Paper sx={panelSx}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, gap: 1 }}>
              <Typography sx={{ ...sectionTitleSx, mb: 0 }}>Line Items</Typography>
              <Button size="small" startIcon={<AddCircleOutline />} onClick={addRow} sx={{ borderRadius: 1.5 }}>
                Add Line
              </Button>
            </Box>

            {rows.map((r, i) => {
              const subcats = subCatsFor(r.category);
              const items = itemsFor(r.category, r.subCategory);
              const lineRate = toNumber(r.rateOverride !== '' ? r.rateOverride : r.rate);
              const lineTotal = toNumber(r.qty) * lineRate;
              return (
                <Box key={i} sx={{
                  mb: 1.5,
                  p: 1.5,
                  border: '1px solid #e2e8f0',
                  borderRadius: 1.5,
                  bgcolor: '#fbfdff'
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25, gap: 1 }}>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                      Line {i + 1}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                        ₹{money(lineTotal)}
                      </Typography>
                      {r.imageUrl && (
                        <IconButton size="small" onClick={() => safeOpen(r.imageUrl)} title="Open image"><PictureInPictureAlt fontSize="small" /></IconButton>
                      )}
                      <IconButton size="small" onClick={() => removeRow(i)} title="Remove">
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  <Grid container spacing={1.25}>
                    <Grid item xs={12} md={2.2}>
                      <FormControl fullWidth size="small" sx={fieldSx}>
                        <Select value={r.category} displayEmpty onChange={e => handleRowChange(i, 'category', e.target.value)} sx={selectSx}>
                          <MenuItem value=""><em>Category</em></MenuItem>
                          {(catalog?.categories || []).map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2.2}>
                      <FormControl fullWidth size="small" sx={fieldSx}>
                        <Select value={r.subCategory} displayEmpty disabled={!r.category}
                          onChange={e => handleRowChange(i, 'subCategory', e.target.value)} sx={selectSx}>
                          <MenuItem value=""><em>Sub-category</em></MenuItem>
                          {subcats.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2.4}>
                      <FormControl fullWidth size="small" sx={fieldSx}>
                        <Select value={r.itemCode} displayEmpty disabled={!r.category || !r.subCategory}
                          onChange={e => handleRowChange(i, 'itemCode', e.target.value)} sx={selectSx}>
                          <MenuItem value=""><em>Item</em></MenuItem>
                          {items.map(it => <MenuItem key={it.code} value={it.code}>{it.code}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={6} md={1.1}>
                      <TextField fullWidth size="small" value={r.unit || ''} label="Unit" InputLabelProps={{ shrink: true }}
                        inputProps={{ readOnly: true }} sx={fieldSx} />
                    </Grid>
                    <Grid item xs={6} md={1}>
                      <TextField fullWidth size="small" type="number" label="Qty" value={r.qty}
                        onChange={e => handleRowChange(i, 'qty', e.target.value)} sx={fieldSx} />
                    </Grid>
                    <Grid item xs={6} md={1.3}>
                      <TextField fullWidth size="small" type="number" label="Rate"
                        value={r.rateOverride !== '' ? r.rateOverride : (r.rate ?? '')}
                        onChange={e => handleRowChange(i, 'rateOverride', e.target.value)}
                        sx={fieldSx} />
                    </Grid>
                    <Grid item xs={6} md={1.8}>
                      <FormControl fullWidth size="small" sx={fieldSx}>
                        <Select value={r.itemType || 'Equipment'} onChange={e => handleRowChange(i, 'itemType', e.target.value)} sx={selectSx}>
                          {ITEM_TYPE_OPTIONS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth size="small" multiline minRows={2} label="Description"
                        value={r.desc || ''} onChange={e => handleRowChange(i, 'desc', e.target.value)}
                        sx={fieldSx} inputProps={{ style: { ...cellStyle, lineHeight: 1.35 } }} />
                    </Grid>
                  </Grid>
                </Box>
              );
            })}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={3.5}>
          <Paper sx={{ ...panelSx, position: { lg: 'sticky' }, top: { lg: 24 } }}>
            <Typography sx={sectionTitleSx}>Quote Summary</Typography>
            {[
              ['Equipment', totals.equipment],
              ['Non Equipment', totals.nonEquipment],
              ['Subtotal', totals.subTotal],
              ['Discounts', -(totals.equipmentDiscount + totals.nonEquipmentDiscount)],
              ['GST', totals.equipmentGst + totals.nonEquipmentGst + totals.freightInstallGst],
              ['Freight + Installation', totals.freight + totals.installation]
            ].map(([label, value]) => (
              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.85, borderBottom: '1px solid #e2e8f0' }}>
                <Typography sx={{ fontSize: '0.86rem', color: '#64748b' }}>{label}</Typography>
                <Typography sx={{ fontSize: '0.86rem', fontWeight: 700, color: value < 0 ? '#b91c1c' : '#0f172a' }}>
                  {value < 0 ? '-' : ''}₹{money(Math.abs(value))}
                </Typography>
              </Box>
            ))}
            <Box sx={{ mt: 2, p: 1.5, bgcolor: '#0f172a', borderRadius: 1.5, color: '#fff' }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0 }}>
                Grand Total
              </Typography>
              <Typography sx={{ mt: 0.5, fontSize: '1.45rem', fontWeight: 800 }}>
                ₹{money(totals.grand)}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
