import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TextField, Typography
} from '@mui/material';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import EditOutlined from '@mui/icons-material/EditOutlined';

const API = '/api/quotations';
const TABLES = [
  { key: 'equipment', label: 'Equipment BD', description: 'Standard quotation courts, items, prices, descriptions and images' },
  { key: 'terms', label: 'Terms & Conditions', description: 'Equipment and flooring clause sets' },
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

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const next = await jsonRequest(`${API}?action=getAdminTable&table=${encodeURIComponent(table)}&user=${encodeURIComponent(user?.username || '')}`);
      setData(next); setPage(0);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [table, user?.username]);

  useEffect(() => { load(); }, [load]);

  const editableHeaders = useMemo(() => data.headers.filter(header => header && !data.readOnly.includes(header)), [data]);
  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data.rows;
    return data.rows.filter(row => data.headers.some(header => text(row[header]).toLowerCase().includes(needle)));
  }, [data, search]);
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

  return <Box sx={{ minHeight: '100vh', bgcolor: '#f6f8fb', p: { xs: 1.5, md: 3 } }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
      <Box><Typography variant="h5" fontWeight={800}>Quotation Administration</Typography>
        <Typography variant="body2" color="text.secondary">Manage the source data used by every quotation type.</Typography></Box>
      <Button variant="outlined" onClick={onClose}>Back to Builder</Button>
    </Box>

    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
      {TABLES.map(item => <Button key={item.key} variant={table === item.key ? 'contained' : 'outlined'} onClick={() => setTable(item.key)}>{item.label}</Button>)}
    </Box>

    <Paper sx={{ border: '1px solid #dbe3ef', overflow: 'hidden' }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
        <Box><Typography fontWeight={800}>{TABLES.find(item => item.key === table)?.label}</Typography>
          <Typography variant="caption" color="text.secondary">{TABLES.find(item => item.key === table)?.description}</Typography></Box>
        <Box sx={{ display: 'flex', gap: 1 }}><TextField size="small" label="Search" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
          <Button variant="contained" startIcon={<AddCircleOutline />} onClick={() => setEditing(Object.fromEntries(editableHeaders.map(header => [header, ''])))}>Add Row</Button></Box>
      </Box>
      {error && <Alert severity="error" sx={{ mx: 2, mb: 2 }}>{error}</Alert>}
      {loading ? <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress size={26} /></Box> : <>
        <TableContainer sx={{ maxHeight: '62vh' }}><Table stickyHeader size="small" sx={{ minWidth: 900 }}>
          <TableHead><TableRow><TableCell sx={{ width: 55 }}>Row</TableCell>{data.headers.map(header => <TableCell key={header} sx={{ minWidth: header.match(/description|notes|comment/i) ? 300 : 140, fontWeight: 800 }}>{header}</TableCell>)}<TableCell /></TableRow></TableHead>
          <TableBody>{pageRows.map(row => <TableRow key={row.__rowNumber} hover>
            <TableCell>{row.__rowNumber}</TableCell>{data.headers.map(header => <TableCell key={header} sx={{ maxWidth: 340, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text(row[header])}</TableCell>)}
            <TableCell><Button size="small" startIcon={<EditOutlined />} onClick={() => setEditing({ ...row })}>Edit</Button></TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>
        <TablePagination component="div" count={visibleRows.length} page={page} onPageChange={(_, value) => setPage(value)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }} rowsPerPageOptions={[10, 20, 50]} />
      </>}
    </Paper>

    <Dialog open={Boolean(editing)} onClose={() => !saving && setEditing(null)} fullWidth maxWidth="md">
      <DialogTitle>{editing?.__rowNumber ? `Edit row ${editing.__rowNumber}` : `Add ${TABLES.find(item => item.key === table)?.label} row`}</DialogTitle>
      <DialogContent dividers><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, pt: 1 }}>
        {editableHeaders.map(header => <TextField key={header} label={header} value={text(editing?.[header])} onChange={e => setEditing(current => ({ ...current, [header]: e.target.value }))} multiline={/description|notes|comment|terms|equipment|flooring/i.test(header)} minRows={/description|notes|comment|terms|equipment|flooring/i.test(header) ? 3 : 1} fullWidth />)}
      </Box></DialogContent>
      <DialogActions><Button onClick={() => setEditing(null)} disabled={saving}>Cancel</Button><Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></DialogActions>
    </Dialog>
  </Box>;
}
