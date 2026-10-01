import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, InputLabel, MenuItem, Paper, Select, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography
} from '@mui/material';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import EditOutlined from '@mui/icons-material/EditOutlined';

const API = '/api/quotations';
const TABLES = [
  { key: 'equipment', label: 'Equipment BD', description: 'Standard quotation courts, items, prices, descriptions and images' },
  { key: 'terms', label: 'Terms & Conditions', description: 'Equipment, flooring and athletic clause sets' },
  { key: 'rates', label: 'Athletic Rate Library', description: 'Scopes, systems, quantity drivers, factors and rates' },
  { key: 'presets', label: 'Athletic Presets', description: 'Benchmark geometry and surface areas' },
  { key: 'lists', label: 'Dropdown Lists', description: 'Athletic systems, methods, units and controlled values' },
];

async function jsonRequest(url, init) {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

const text = value => String(value ?? '');

const wideHeader = header => /description|notes|comment|equipment|flooring|source/i.test(header);

const adminTableScrollSx = {
  width: '100%',
  maxWidth: '100%',
  maxHeight: { xs: '58vh', md: '62vh' },
  overflowX: 'auto !important',
  overflowY: 'auto !important',
  overscrollBehavior: 'contain',
  scrollbarGutter: 'stable',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'auto',
  scrollbarColor: '#94a3b8 #eef2f7',
  '&::-webkit-scrollbar': { width: 12, height: 12 },
  '&::-webkit-scrollbar-track': { backgroundColor: '#eef2f7' },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#94a3b8',
    border: '3px solid #eef2f7',
    borderRadius: 8,
  },
};

export default function QuotationAdmin({ user, onClose }) {
  const [table, setTable] = useState('equipment');
  const [data, setData] = useState({ headers: [], rows: [], readOnly: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [termsType, setTermsType] = useState('Equipment');
  const [rateCatalog, setRateCatalog] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const next = await jsonRequest(`${API}?action=getAdminTable&table=${encodeURIComponent(table)}&user=${encodeURIComponent(user?.username || '')}`);
      setData(next); setPage(0);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [table, user?.username]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (table !== 'rates') return;
    jsonRequest(`${API}?action=getCatalog&type=athletic`)
      .then(result => setRateCatalog(result.data || null))
      .catch(() => setRateCatalog(null));
  }, [table]);

  const termsTypes = useMemo(() => data.headers.filter(Boolean), [data.headers]);
  useEffect(() => {
    if (table === 'terms' && termsTypes.length && !termsTypes.includes(termsType)) setTermsType(termsTypes[0]);
  }, [table, termsType, termsTypes]);

  const displayHeaders = useMemo(
    () => table === 'terms' ? data.headers.filter(header => header === termsType) : data.headers,
    [data.headers, table, termsType]
  );
  const editableHeaders = useMemo(
    () => displayHeaders.filter(header => header && !data.readOnly.includes(header)),
    [data.readOnly, displayHeaders]
  );
  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = table === 'terms'
      ? data.rows.filter(row => text(row[termsType]).trim())
      : data.rows;
    if (!needle) return rows;
    return rows.filter(row => displayHeaders.some(header => text(row[header]).toLowerCase().includes(needle)));
  }, [data.rows, displayHeaders, search, table, termsType]);
  const pageRows = visibleRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const save = async () => {
    setSaving(true); setError('');
    try {
      await jsonRequest(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveAdminRow', table, user: user?.username || '', row: editing }),
      });
      setEditing(null); await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const editorOptions = (header) => {
    if (table !== 'rates') return null;
    if (header === 'Include Default') return ['Yes', 'No'];
    if (header === 'Scope') return ['Civil', 'Drainage', 'Surface', 'Equipment', 'Installation'];
    if (header === 'System') return ['ALL', ...(rateCatalog?.lists?.['Track Systems'] || [])];
    if (header === 'Qty Driver') return ['AREA', 'AREA_X_FACTOR', 'PERIMETER', 'PERIMETER_X_FACTOR', 'MANUAL'];
    if (header === 'Category') return rateCatalog?.categories || [];
    if (header === 'Sub Category') return rateCatalog?.subcategories?.[text(editing?.Category)] || [];
    if (header === 'Item Code') {
      const key = `${text(editing?.Category)}|||${text(editing?.['Sub Category'])}`;
      return (rateCatalog?.items?.[key] || []).map(item => item.code);
    }
    return null;
  };

  const updateEditorField = (header, value) => setEditing(current => {
    const next = { ...current, [header]: value };
    if (header === 'Category') {
      next['Sub Category'] = '';
      next['Item Code'] = '';
    }
    if (header === 'Sub Category') next['Item Code'] = '';
    return next;
  });

  const renderEditor = (header) => {
    const options = editorOptions(header);
    if (options) return <FormControl key={header} fullWidth>
      <InputLabel>{header}</InputLabel>
      <Select label={header} value={text(editing?.[header])} onChange={event => updateEditorField(header, event.target.value)}>
        <MenuItem value=""><em>None</em></MenuItem>
        {[...new Set([text(editing?.[header]), ...options].filter(Boolean))].map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
      </Select>
    </FormControl>;
    return <TextField key={header} label={header} value={text(editing?.[header])} onChange={event => updateEditorField(header, event.target.value)} multiline={/description|notes|comment|terms|equipment|flooring/i.test(header)} minRows={/description|notes|comment|terms|equipment|flooring/i.test(header) ? 3 : 1} fullWidth />;
  };

  return <Box sx={{ minHeight: '100vh', width: '100%', minWidth: 0, bgcolor: '#f6f8fb', p: { xs: 1.5, md: 3 } }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
      <Box><Typography variant="h5" fontWeight={800}>Quotation Administration</Typography>
        <Typography variant="body2" color="text.secondary">Manage the source data used by every quotation type.</Typography></Box>
      <Button variant="outlined" onClick={onClose}>Back to Builder</Button>
    </Box>

    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
      {TABLES.map(item => <Button key={item.key} variant={table === item.key ? 'contained' : 'outlined'} onClick={() => setTable(item.key)}>{item.label}</Button>)}
    </Box>

    <Paper sx={{ width: '100%', minWidth: 0, border: '1px solid #dbe3ef', overflow: 'hidden' }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
        <Box><Typography fontWeight={800}>{TABLES.find(item => item.key === table)?.label}</Typography>
          <Typography variant="caption" color="text.secondary">{TABLES.find(item => item.key === table)?.description}</Typography></Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {table === 'terms' && <FormControl size="small" sx={{ minWidth: 160, bgcolor: '#fff' }}>
            <InputLabel>Terms Type</InputLabel>
            <Select value={termsType} label="Terms Type" onChange={e => { setTermsType(e.target.value); setPage(0); }}>
              {termsTypes.map(type => <MenuItem key={type} value={type}>{type}</MenuItem>)}
            </Select>
          </FormControl>}
          <TextField size="small" label="Search" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
          <Button variant="contained" startIcon={<AddCircleOutline />} onClick={() => setEditing(Object.fromEntries(editableHeaders.map(header => [header, ''])))}>Add Row</Button></Box>
      </Box>
      {error && <Alert severity="error" sx={{ mx: 2, mb: 2 }}>{error}</Alert>}
      {loading ? <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress size={26} /></Box> : <>
        <TableContainer className="quotation-admin-table-scroll" sx={adminTableScrollSx}><Table stickyHeader size="small" sx={{ width: 'max-content', minWidth: '100%', tableLayout: 'auto' }}>
          <TableHead><TableRow>{displayHeaders.map(header => <TableCell key={header} sx={{ minWidth: wideHeader(header) ? 420 : 140, fontWeight: 800, bgcolor: '#eef4ff' }}>{header}</TableCell>)}<TableCell sx={{ minWidth: 100, bgcolor: '#eef4ff' }} /></TableRow></TableHead>
          <TableBody>{pageRows.map(row => <TableRow key={row.__rowNumber} hover>
            {displayHeaders.map(header => <TableCell key={header} sx={{ minWidth: wideHeader(header) ? 420 : 140, maxWidth: 720, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.45 }}>{text(row[header])}</TableCell>)}
            <TableCell sx={{ minWidth: 100 }}><Button size="small" startIcon={<EditOutlined />} onClick={() => setEditing({ ...row })}>Edit</Button></TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>
        <TablePagination component="div" count={visibleRows.length} page={page} onPageChange={(_, value) => setPage(value)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }} rowsPerPageOptions={[10, 20, 50]} />
      </>}
    </Paper>

    <Dialog open={Boolean(editing)} onClose={() => !saving && setEditing(null)} fullWidth maxWidth="md">
      <DialogTitle>{editing?.__rowNumber ? `Edit ${TABLES.find(item => item.key === table)?.label}` : `Add ${TABLES.find(item => item.key === table)?.label} row`}</DialogTitle>
      <DialogContent dividers sx={{ maxHeight: '70vh', overflowY: 'auto' }}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, pt: 1 }}>
        {editableHeaders.map(renderEditor)}
      </Box></DialogContent>
      <DialogActions><Button onClick={() => setEditing(null)} disabled={saving}>Cancel</Button><Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></DialogActions>
    </Dialog>
  </Box>;
}
