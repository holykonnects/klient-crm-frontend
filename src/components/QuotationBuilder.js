// src/components/QuotationBuilder.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Grid, Typography, Button, TextField, IconButton,
  MenuItem, Select, FormControl, InputLabel, Paper, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip
} from '@mui/material';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import PictureInPictureAlt from '@mui/icons-material/PictureInPictureAlt';
import '@fontsource/montserrat';
import { useAuth } from './AuthContext';

const QUOTATION_API_URL = '/api/quotations';
const QUOTATION_EXPORT_URL = '/api/gas';
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

  const [quoteType, setQuoteType] = useState('standard');
  const [catalog, setCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
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
  const [athletic, setAthletic] = useState({
    preset: '400m - 8 lane benchmark', surfaceSystem: 'Sandwich System',
    areaMethod: 'Preset benchmark area', civilWorks: 'Yes', drainageWorks: 'Yes',
    trackEquipment: 'No', installation: 'Inclusive', lengthPerimeter: '', breadth: '',
    laneWidth: 1.22, laneQuantity: '', manualArea: '', drainPerimeter: '',
    gstPct: 18, discountPct: 0, freightAmount: 0, certificationAmount: 0,
    validityDays: 30, paymentTerms: '50% advance; balance as agreed'
  });

  const [leadOptions, setLeadOptions] = useState([]);
  const [attachLead, setAttachLead] = useState('');
  const [leadLookupError, setLeadLookupError] = useState('');

  const canUseQuotation =
    user?.role === 'Admin' ||
    (Array.isArray(user?.pageAccess) && user.pageAccess.includes('Quotation'));

  // Load catalog
  useEffect(() => {
    (async () => {
      setCatalogLoading(true);
      setCatalogError('');
      setCatalog(null);
      const j = await fetchJSON(`${QUOTATION_API_URL}?action=getCatalog&type=${quoteType}`);
      if (!j.ok) throw new Error(j.error || 'Quotation catalogue could not be loaded');
      setCatalog(j.data);
    })().catch(err => {
      console.error(err);
      setCatalogError(err.message || 'Quotation catalogue could not be loaded');
    }).finally(() => setCatalogLoading(false));
  }, [quoteType]);

  // Load leads
  useEffect(() => {
    if (!user?.username) return;
    (async () => {
      const j = await fetchJSON(`${QUOTATION_API_URL}?action=getLeadsForUser&user=${encodeURIComponent(user.username)}`);
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
        quoteType,
        meta,
        pricing,
        athletic: quoteType === 'athletic' ? athletic : undefined,
        items: rows
          .filter(r => quoteType === 'standard' && r.category && r.subCategory && r.itemCode)
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
        `${QUOTATION_EXPORT_URL}?action=buildQuotationAndExport&user=${encodeURIComponent(user?.username || '')}`,
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
      setLastExport({ url, name: j.pdfFileName, workingCopyUrl: j.workingCopyUrl });
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
            {quoteType === 'athletic'
              ? 'Configuration-driven athletic track estimate and automatic BOQ'
              : `${rows.filter(r => r.category && r.subCategory && r.itemCode).length} line items ready for export`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 230, ...fieldSx }}>
            <InputLabel>Quotation Type</InputLabel>
            <Select value={quoteType} label="Quotation Type" onChange={e => setQuoteType(e.target.value)} sx={selectSx}>
              <MenuItem value="standard">Standard Sports / Equipment</MenuItem>
              <MenuItem value="athletic">Athletic Track / Automatic BOQ</MenuItem>
            </Select>
          </FormControl>
          {lastExport && isHttpUrl(lastExport.url) && (
            <Button variant="outlined" onClick={() => safeOpen(lastExport.url)} sx={{ borderRadius: 1.5 }}>
              Open Last PDF
            </Button>
          )}
          {lastExport && isHttpUrl(lastExport.workingCopyUrl) && (
            <Button variant="outlined" onClick={() => safeOpen(lastExport.workingCopyUrl)} sx={{ borderRadius: 1.5 }}>
              Open Working Quote
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

          {quoteType === 'standard' && <Paper sx={{ ...panelSx, mb: 2.5 }}>
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
          </Paper>}

          {quoteType === 'athletic' && (
            <Paper sx={{ ...panelSx, mb: 2.5 }}>
              <Typography sx={sectionTitleSx}>Athletic Track Configuration</Typography>
              <Grid container spacing={1.5}>
                {[
                  ['preset', 'Preset / Benchmark', catalog?.lists?.['Preset / Benchmark'] || []],
                  ['surfaceSystem', 'Surface System', catalog?.lists?.['Track Systems'] || []],
                  ['areaMethod', 'Area Calculation Method', catalog?.lists?.['Area Calculation Methods'] || []],
                  ['civilWorks', 'Civil Base Works', catalog?.lists?.['Yes / No'] || ['Yes', 'No']],
                  ['drainageWorks', 'Drainage Works', catalog?.lists?.['Yes / No'] || ['Yes', 'No']],
                  ['trackEquipment', 'Track Equipment', catalog?.lists?.['Yes / No'] || ['Yes', 'No']],
                  ['installation', 'Installation', catalog?.lists?.Installation || ['Inclusive', 'Extra']],
                ].map(([key, label, options]) => (
                  <Grid item xs={12} md={4} key={key}>
                    <FormControl fullWidth size="small" sx={fieldSx}>
                      <InputLabel>{label}</InputLabel>
                      <Select value={athletic[key]} label={label} onChange={e => setAthletic(a => ({ ...a, [key]: e.target.value }))} sx={selectSx}>
                        {options.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                ))}
                {[
                  ['lengthPerimeter', 'Length / Perimeter (m)'], ['breadth', 'Breadth (m)'],
                  ['laneWidth', 'Lane Width (m)'], ['laneQuantity', 'Lane Quantity'],
                  ['manualArea', 'Manual Surveyed Area (sqm)'], ['drainPerimeter', 'Drain / Edge Perimeter (rmt)'],
                  ['gstPct', 'GST %'], ['discountPct', 'Discount %'],
                  ['freightAmount', 'Freight / Mobilisation'], ['certificationAmount', 'Certification / Testing'],
                  ['validityDays', 'Validity (days)'],
                ].map(([key, label]) => (
                  <Grid item xs={6} md={4} key={key}>
                    <TextField fullWidth size="small" type="number" label={label} value={athletic[key]}
                      onChange={e => setAthletic(a => ({ ...a, [key]: e.target.value }))} sx={fieldSx} />
                  </Grid>
                ))}
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Payment Terms" value={athletic.paymentTerms}
                    onChange={e => setAthletic(a => ({ ...a, paymentTerms: e.target.value }))} sx={fieldSx} />
                </Grid>
              </Grid>
            </Paper>
          )}

          {quoteType === 'standard' && <Paper sx={{ ...panelSx, p: 0, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, gap: 1 }}>
              <Box sx={{ px: 2, pt: 2 }}>
                <Typography sx={{ ...sectionTitleSx, mb: 0 }}>Quotation Items</Typography>
                <Typography sx={{ mt: 0.5, fontSize: '0.75rem', color: '#64748b' }}>
                  Dropdowns and item details are supplied by Equipment BD.
                </Typography>
              </Box>
              <Button size="small" startIcon={<AddCircleOutline />} onClick={addRow} sx={{ borderRadius: 1.5, mr: 2, mt: 2 }}>
                Add Line
              </Button>
            </Box>
            {catalogLoading && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pb: 2 }}><CircularProgress size={16} /><Typography variant="body2">Loading Equipment BD…</Typography></Box>}
            {catalogError && <Alert severity="error" sx={{ mx: 2, mb: 2 }}>{catalogError}</Alert>}
            {!catalogLoading && !catalogError && !(catalog?.categories || []).length && (
              <Alert severity="warning" sx={{ mx: 2, mb: 2 }}>Equipment BD loaded, but no Category, Sub Category and Item Code records were found.</Alert>
            )}
            <TableContainer sx={{ overflowX: 'auto', borderTop: '1px solid #e2e8f0' }}>
              <Table size="small" sx={{ minWidth: 1320, '& th': { bgcolor: '#f8fafc', color: '#475569', fontWeight: 800, whiteSpace: 'nowrap' }, '& td': { verticalAlign: 'top' } }}>
                <TableHead><TableRow>
                  <TableCell sx={{ width: 46 }}>S.No</TableCell><TableCell sx={{ minWidth: 155 }}>Category</TableCell>
                  <TableCell sx={{ minWidth: 165 }}>Sub Category</TableCell><TableCell sx={{ minWidth: 190 }}>Item Code</TableCell>
                  <TableCell sx={{ width: 60 }}>Image</TableCell><TableCell sx={{ minWidth: 270 }}>Description</TableCell>
                  <TableCell sx={{ width: 90 }}>Unit</TableCell><TableCell sx={{ width: 95 }}>Quantity</TableCell>
                  <TableCell sx={{ width: 115 }}>Unit Price</TableCell><TableCell sx={{ width: 135 }}>Total Amount</TableCell>
                  <TableCell sx={{ minWidth: 145 }}>Type</TableCell><TableCell sx={{ width: 45 }} />
                </TableRow></TableHead>
                <TableBody>
                  {rows.map((r, i) => {
                    const subcats = subCatsFor(r.category);
                    const items = itemsFor(r.category, r.subCategory);
                    const lineRate = toNumber(r.rateOverride !== '' ? r.rateOverride : r.rate);
                    const lineTotal = toNumber(r.qty) * lineRate;
                    return <TableRow key={i} hover>
                      <TableCell sx={{ fontWeight: 700, pt: 2 }}>{i + 1}</TableCell>
                      <TableCell><FormControl fullWidth size="small"><Select value={r.category} displayEmpty disabled={catalogLoading} onChange={e => handleRowChange(i, 'category', e.target.value)} sx={selectSx}><MenuItem value=""><em>Choose</em></MenuItem>{(catalog?.categories || []).map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}</Select></FormControl></TableCell>
                      <TableCell><FormControl fullWidth size="small"><Select value={r.subCategory} displayEmpty disabled={!r.category} onChange={e => handleRowChange(i, 'subCategory', e.target.value)} sx={selectSx}><MenuItem value=""><em>Choose</em></MenuItem>{subcats.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}</Select></FormControl></TableCell>
                      <TableCell><FormControl fullWidth size="small"><Select value={r.itemCode} displayEmpty disabled={!r.subCategory} onChange={e => handleRowChange(i, 'itemCode', e.target.value)} sx={selectSx}><MenuItem value=""><em>Choose</em></MenuItem>{items.map(it => <MenuItem key={it.code} value={it.code}>{it.name && it.name !== it.code ? `${it.code} — ${it.name}` : it.code}</MenuItem>)}</Select></FormControl></TableCell>
                      <TableCell>{r.imageUrl ? <Tooltip title="Open item image"><IconButton size="small" onClick={() => safeOpen(r.imageUrl)}><PictureInPictureAlt fontSize="small" /></IconButton></Tooltip> : <Typography sx={{ color: '#94a3b8', pt: 1 }}>—</Typography>}</TableCell>
                      <TableCell><TextField fullWidth size="small" multiline minRows={2} value={r.desc || ''} placeholder="Populated from Equipment BD" onChange={e => handleRowChange(i, 'desc', e.target.value)} sx={fieldSx} inputProps={{ style: { ...cellStyle, lineHeight: 1.3 } }} /></TableCell>
                      <TableCell><TextField fullWidth size="small" value={r.unit || ''} inputProps={{ readOnly: true }} sx={fieldSx} /></TableCell>
                      <TableCell><TextField fullWidth size="small" type="number" value={r.qty} inputProps={{ min: 0, step: 'any' }} onChange={e => handleRowChange(i, 'qty', e.target.value)} sx={fieldSx} /></TableCell>
                      <TableCell><TextField fullWidth size="small" type="number" value={r.rateOverride !== '' ? r.rateOverride : (r.rate ?? '')} inputProps={{ min: 0, step: 'any' }} onChange={e => handleRowChange(i, 'rateOverride', e.target.value)} sx={fieldSx} /></TableCell>
                      <TableCell sx={{ pt: 2, fontWeight: 800, whiteSpace: 'nowrap' }}>₹{money(lineTotal)}</TableCell>
                      <TableCell><FormControl fullWidth size="small"><Select value={r.itemType || 'Equipment'} onChange={e => handleRowChange(i, 'itemType', e.target.value)} sx={selectSx}>{ITEM_TYPE_OPTIONS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl></TableCell>
                      <TableCell><Tooltip title="Remove line"><span><IconButton size="small" disabled={rows.length === 1} onClick={() => removeRow(i)}><DeleteOutline fontSize="small" /></IconButton></span></Tooltip></TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <Typography sx={{ fontSize: '0.78rem', color: '#64748b' }}>Select Category, then Sub Category, then Item Code—matching the New Template sheet.</Typography>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 800 }}>Subtotal ₹{money(totals.subTotal)}</Typography>
            </Box>
          </Paper>}
        </Grid>

        <Grid item xs={12} lg={3.5}>
          <Paper sx={{ ...panelSx, position: { lg: 'sticky' }, top: { lg: 24 } }}>
            <Typography sx={sectionTitleSx}>Quote Summary</Typography>
            {quoteType === 'standard' ? [
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
            )) : (
              <>
                {[
                  ['Preset', athletic.preset], ['Surface System', athletic.surfaceSystem],
                  ['Area Method', athletic.areaMethod], ['Civil Works', athletic.civilWorks],
                  ['Drainage', athletic.drainageWorks], ['Track Equipment', athletic.trackEquipment],
                  ['GST', `${athletic.gstPct || 0}%`], ['Discount', `${athletic.discountPct || 0}%`],
                ].map(([label, value]) => (
                  <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.85, borderBottom: '1px solid #e2e8f0' }}>
                    <Typography sx={{ fontSize: '0.82rem', color: '#64748b' }}>{label}</Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, textAlign: 'right' }}>{value}</Typography>
                  </Box>
                ))}
                <Typography sx={{ mt: 1.5, fontSize: '0.78rem', color: '#64748b' }}>
                  Exact quantities and totals are calculated by the Athletic workbook’s preserved formulas during export.
                </Typography>
              </>
            )}
            {quoteType === 'standard' && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: '#0f172a', borderRadius: 1.5, color: '#fff' }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0 }}>
                Grand Total
              </Typography>
              <Typography sx={{ mt: 0.5, fontSize: '1.45rem', fontWeight: 800 }}>
                ₹{money(totals.grand)}
              </Typography>
            </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
