import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, Grid, IconButton, InputLabel, LinearProgress, MenuItem, Paper, Select,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddTask from '@mui/icons-material/AddTask';
import EditOutlined from '@mui/icons-material/EditOutlined';
import History from '@mui/icons-material/History';
import PlaylistAdd from '@mui/icons-material/PlaylistAdd';
import Refresh from '@mui/icons-material/Refresh';
import { projectTaskSummary, quotationTaskCandidates } from './projectTasks';

const PROJECTS_API = '/api/projects';
const QUOTATIONS_API = '/api/quotations';
const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Blocked', 'Completed', 'Cancelled'];
const emptyTask = {
  'Task Name': '', Description: '', 'Task Owner': '', 'Assigned Team': '', 'Start Date': '', 'Due Date': '',
  Status: 'Not Started', 'Progress %': 0, 'Completion Date': '', Notes: '', 'Source Type': 'Manual',
};

async function jsonRequest(url, init) {
  const response = await fetch(url, init);
  const result = await response.json();
  if (!response.ok || result.ok === false) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

const sourceLabel = task => task['Source Type'] === 'Quotation'
  ? `Quote ${task['Quote ID'] || ''}${task['Quote Revision'] ? ` v${task['Quote Revision']}` : ''}`
  : task['Source Type'] || 'Manual';

export default function ProjectTasksDialog({ open, project, user, onClose }) {
  const projectId = project?.['Project ID (unique, auto-generated)'] || '';
  const projectName = project?.['Project Name'] || '';
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [quotes, setQuotes] = useState([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [quoteLines, setQuoteLines] = useState([]);
  const [selectedLineIds, setSelectedLineIds] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [historyTask, setHistoryTask] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);

  const identity = useMemo(() => ({
    updatedByName: user?.username || user?.email || '',
    updatedByEmail: user?.email || user?.username || '',
  }), [user?.email, user?.username]);

  const loadTasks = useCallback(async () => {
    if (!open || !projectId) return;
    setLoading(true); setError('');
    try {
      const result = await jsonRequest(`${PROJECTS_API}?action=getProjectTasks&projectId=${encodeURIComponent(projectId)}`);
      setTasks(result.rows || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [open, projectId]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const summary = useMemo(() => projectTaskSummary(tasks), [tasks]);

  const saveTask = async (task, closeEditor = true) => {
    setSaving(true); setError('');
    try {
      await jsonRequest(PROJECTS_API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveProjectTask', data: {
          ...task, 'Project ID': projectId, 'Project Name': projectName, ...identity,
        } }),
      });
      if (closeEditor) setEditing(null);
      await loadTasks();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const openImport = async () => {
    setImportOpen(true); setImportLoading(true); setError(''); setSelectedQuoteId(''); setQuoteLines([]); setSelectedLineIds([]);
    try {
      const result = await jsonRequest(`${QUOTATIONS_API}?action=listQuotes&user=${encodeURIComponent(user?.username || '')}`);
      const next = [...(result.quotes || [])].sort((a, b) => {
        const aMatch = String(a.projectName || '').trim().toLowerCase() === String(projectName).trim().toLowerCase();
        const bMatch = String(b.projectName || '').trim().toLowerCase() === String(projectName).trim().toLowerCase();
        return Number(bMatch) - Number(aMatch);
      });
      setQuotes(next);
    } catch (err) { setError(`Quotation list unavailable: ${err.message}`); }
    finally { setImportLoading(false); }
  };

  const selectQuote = async (quoteId) => {
    setSelectedQuoteId(quoteId); setQuoteLines([]); setSelectedLineIds([]);
    if (!quoteId) return;
    setImportLoading(true); setError('');
    try {
      const result = await jsonRequest(`${QUOTATIONS_API}?action=getQuote&user=${encodeURIComponent(user?.username || '')}&quoteId=${encodeURIComponent(quoteId)}`);
      const lines = quotationTaskCandidates(result.quote || {}, result.quote?.payload || {});
      setQuoteLines(lines); setSelectedLineIds(lines.map(line => line.quotationLineId));
    } catch (err) { setError(`Quotation could not be opened: ${err.message}`); }
    finally { setImportLoading(false); }
  };

  const importTasks = async () => {
    const selected = quoteLines.filter(line => selectedLineIds.includes(line.quotationLineId));
    if (!selected.length) { setError('Select at least one quotation line.'); return; }
    const quote = quotes.find(item => item.quoteId === selectedQuoteId) || {};
    setSaving(true); setError('');
    try {
      const result = await jsonRequest(PROJECTS_API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'importQuotationTasks', data: {
          projectId, projectName, quoteId: selectedQuoteId, quoteRevision: quote.revision || 1,
          lines: selected, ...identity,
        } }),
      });
      setImportOpen(false); setSelectedQuoteId(''); setQuoteLines([]); setSelectedLineIds([]);
      await loadTasks();
      if (result.skipped) setError(`${result.skipped} quotation line${result.skipped === 1 ? ' was' : 's were'} already linked and skipped.`);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const openHistory = async (task) => {
    setHistoryTask(task); setHistoryRows([]); setError('');
    try {
      const result = await jsonRequest(`${PROJECTS_API}?action=getProjectTaskHistory&taskId=${encodeURIComponent(task['Task ID'])}`);
      setHistoryRows(result.rows || []);
    } catch (err) { setError(err.message); }
  };

  return <>
    <Dialog open={open} onClose={(event, reason) => { if (!saving && reason !== 'backdropClick') onClose(); }} maxWidth="xl" fullWidth disableEscapeKeyDown={saving}>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" fontWeight={800}>Project Tasks</Typography>
        <Typography variant="body2" color="text.secondary">{projectName || 'Project'} · {projectId}</Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 2 }}>
        {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, minmax(0, 1fr))' }, gap: 1, mb: 2 }}>
          {[['Total', summary.total], ['Active', summary.active], ['Completed', summary.completed], ['Overdue', summary.overdue]].map(([label, value]) => <Paper key={label} variant="outlined" sx={{ p: 1.25, borderRadius: 1.5 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h6" fontWeight={800}>{value}</Typography></Paper>)}
          <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.5 }}><Typography variant="caption" color="text.secondary">Progress</Typography><Typography fontWeight={800}>{summary.progress}%</Typography><LinearProgress variant="determinate" value={summary.progress} sx={{ mt: 0.75 }} /></Paper>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<AddTask />} onClick={() => setEditing({ ...emptyTask })}>Add Task</Button>
            <Button variant="outlined" startIcon={<PlaylistAdd />} onClick={openImport}>Import from Quotation</Button>
          </Box>
          <Tooltip title="Refresh tasks"><span><IconButton onClick={loadTasks} disabled={loading || saving}><Refresh /></IconButton></span></Tooltip>
        </Box>
        {loading ? <Box sx={{ py: 7, textAlign: 'center' }}><CircularProgress size={28} /></Box> : <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500, borderRadius: 1.5 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1100, '& th': { fontWeight: 800, bgcolor: '#eef4ff' }, '& td': { verticalAlign: 'top' } }}>
            <TableHead><TableRow><TableCell>Task</TableCell><TableCell>Owner</TableCell><TableCell>Due Date</TableCell><TableCell>Status</TableCell><TableCell>Progress</TableCell><TableCell>Source</TableCell><TableCell>Updated By</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
            <TableBody>{tasks.map(task => <TableRow key={task['Task ID']} hover>
              <TableCell sx={{ minWidth: 260 }}><Typography fontWeight={700} fontSize="0.78rem">{task['Task Name']}</Typography><Typography variant="caption" color="text.secondary">{task.Description || task.Notes || ''}</Typography></TableCell>
              <TableCell>{task['Task Owner'] || task['Assigned Team'] || '-'}</TableCell><TableCell sx={{ whiteSpace: 'nowrap' }}>{task['Due Date'] || '-'}</TableCell>
              <TableCell sx={{ minWidth: 155 }}><Select size="small" fullWidth value={task.Status || 'Not Started'} disabled={saving} onChange={event => saveTask({ ...task, Status: event.target.value }, false)}>{STATUS_OPTIONS.map(status => <MenuItem key={status} value={status}>{status}</MenuItem>)}</Select></TableCell>
              <TableCell sx={{ minWidth: 120 }}><Typography variant="caption">{Number(task['Progress %']) || 0}%</Typography><LinearProgress variant="determinate" value={Number(task['Progress %']) || 0} /></TableCell>
              <TableCell><Chip size="small" variant="outlined" label={sourceLabel(task)} /></TableCell><TableCell>{task['Updated By'] || '-'}</TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}><Tooltip title="Task history"><IconButton size="small" onClick={() => openHistory(task)}><History fontSize="small" /></IconButton></Tooltip><Tooltip title="Edit task"><IconButton size="small" onClick={() => setEditing({ ...task })}><EditOutlined fontSize="small" /></IconButton></Tooltip></TableCell>
            </TableRow>)}{!tasks.length && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5 }}>No tasks yet. Add one manually or import selected quotation lines.</TableCell></TableRow>}</TableBody>
          </Table>
        </TableContainer>}
      </DialogContent>
      <DialogActions><Button onClick={onClose} disabled={saving}>Close</Button></DialogActions>
    </Dialog>

    <Dialog open={Boolean(editing)} onClose={(event, reason) => { if (!saving && reason !== 'backdropClick') setEditing(null); }} maxWidth="md" fullWidth disableEscapeKeyDown={saving}>
      <DialogTitle>{editing?.['Task ID'] ? 'Edit Task' : 'Add Task'}</DialogTitle>
      <DialogContent dividers><Grid container spacing={2} sx={{ pt: 0.5 }}>
        <Grid item xs={12}><TextField fullWidth required label="Task Name" value={editing?.['Task Name'] || ''} onChange={event => setEditing(current => ({ ...current, 'Task Name': event.target.value }))} /></Grid>
        <Grid item xs={12}><TextField fullWidth multiline minRows={3} label="Description" value={editing?.Description || ''} onChange={event => setEditing(current => ({ ...current, Description: event.target.value }))} /></Grid>
        {[['Task Owner', 'Task Owner'], ['Assigned Team', 'Assigned Team']].map(([key, label]) => <Grid item xs={12} md={6} key={key}><TextField fullWidth label={label} value={editing?.[key] || ''} onChange={event => setEditing(current => ({ ...current, [key]: event.target.value }))} /></Grid>)}
        {[['Start Date', 'Start Date'], ['Due Date', 'Due Date']].map(([key, label]) => <Grid item xs={12} md={6} key={key}><TextField fullWidth type="date" label={label} InputLabelProps={{ shrink: true }} value={editing?.[key] || ''} onChange={event => setEditing(current => ({ ...current, [key]: event.target.value }))} /></Grid>)}
        <Grid item xs={12} md={6}><FormControl fullWidth><InputLabel>Status</InputLabel><Select label="Status" value={editing?.Status || 'Not Started'} onChange={event => setEditing(current => ({ ...current, Status: event.target.value }))}>{STATUS_OPTIONS.map(status => <MenuItem key={status} value={status}>{status}</MenuItem>)}</Select></FormControl></Grid>
        <Grid item xs={12} md={6}><TextField fullWidth type="number" label="Progress %" value={editing?.['Progress %'] ?? 0} inputProps={{ min: 0, max: 100 }} onChange={event => setEditing(current => ({ ...current, 'Progress %': event.target.value }))} /></Grid>
        <Grid item xs={12}><TextField fullWidth multiline minRows={2} label="Notes / Completion Update" value={editing?.Notes || ''} onChange={event => setEditing(current => ({ ...current, Notes: event.target.value }))} /></Grid>
      </Grid></DialogContent>
      <DialogActions><Button onClick={() => setEditing(null)} disabled={saving}>Cancel</Button><Button variant="contained" onClick={() => saveTask(editing)} disabled={saving || !String(editing?.['Task Name'] || '').trim()}>{saving ? 'Saving…' : 'Save Task'}</Button></DialogActions>
    </Dialog>

    <Dialog open={importOpen} onClose={(event, reason) => { if (!saving && reason !== 'backdropClick') setImportOpen(false); }} maxWidth="lg" fullWidth disableEscapeKeyDown={saving}>
      <DialogTitle>Import Tasks from Quotation</DialogTitle>
      <DialogContent dividers>
        {importLoading && <LinearProgress sx={{ mb: 2 }} />}
        <FormControl fullWidth size="small" sx={{ mb: 2 }}><InputLabel>Saved Quotation</InputLabel><Select label="Saved Quotation" value={selectedQuoteId} onChange={event => selectQuote(event.target.value)}>{quotes.map(quote => <MenuItem key={quote.quoteId} value={quote.quoteId}>{[quote.quotationNo, quote.title, quote.clientName, `v${quote.revision || 1}`].filter(Boolean).join(' · ')}</MenuItem>)}</Select></FormControl>
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 460 }}><Table stickyHeader size="small" sx={{ minWidth: 850, '& th': { fontWeight: 800, bgcolor: '#eef4ff' } }}><TableHead><TableRow><TableCell padding="checkbox"><Checkbox checked={quoteLines.length > 0 && selectedLineIds.length === quoteLines.length} indeterminate={selectedLineIds.length > 0 && selectedLineIds.length < quoteLines.length} onChange={event => setSelectedLineIds(event.target.checked ? quoteLines.map(line => line.quotationLineId) : [])} /></TableCell><TableCell>Task / Quotation Item</TableCell><TableCell>Description</TableCell><TableCell>Quantity</TableCell><TableCell>Unit</TableCell></TableRow></TableHead><TableBody>{quoteLines.map(line => <TableRow key={line.quotationLineId} hover><TableCell padding="checkbox"><Checkbox checked={selectedLineIds.includes(line.quotationLineId)} onChange={() => setSelectedLineIds(current => current.includes(line.quotationLineId) ? current.filter(id => id !== line.quotationLineId) : [...current, line.quotationLineId])} /></TableCell><TableCell sx={{ minWidth: 260 }}><TextField fullWidth size="small" value={line.taskName} onChange={event => setQuoteLines(current => current.map(item => item.quotationLineId === line.quotationLineId ? { ...item, taskName: event.target.value } : item))} /></TableCell><TableCell>{line.description}</TableCell><TableCell>{line.quantity}</TableCell><TableCell>{line.unit}</TableCell></TableRow>)}{selectedQuoteId && !importLoading && !quoteLines.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>This quotation does not contain importable item rows.</TableCell></TableRow>}</TableBody></Table></TableContainer>
      </DialogContent>
      <DialogActions><Button onClick={() => setImportOpen(false)} disabled={saving}>Cancel</Button><Button variant="contained" startIcon={<PlaylistAdd />} onClick={importTasks} disabled={saving || !selectedLineIds.length}>{saving ? 'Importing…' : `Import ${selectedLineIds.length} Task${selectedLineIds.length === 1 ? '' : 's'}`}</Button></DialogActions>
    </Dialog>

    <Dialog open={Boolean(historyTask)} onClose={() => setHistoryTask(null)} maxWidth="lg" fullWidth>
      <DialogTitle>Task History · {historyTask?.['Task Name']}</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}><TableContainer sx={{ maxHeight: 480 }}><Table stickyHeader size="small" sx={{ minWidth: 900, '& th': { fontWeight: 800, bgcolor: '#eef4ff' } }}><TableHead><TableRow><TableCell>Updated At</TableCell><TableCell>Status</TableCell><TableCell>Progress</TableCell><TableCell>Owner</TableCell><TableCell>Completion Date</TableCell><TableCell>Notes</TableCell><TableCell>Updated By</TableCell></TableRow></TableHead><TableBody>{historyRows.map((row, index) => <TableRow key={`${row['Updated At']}-${index}`}><TableCell sx={{ whiteSpace: 'nowrap' }}>{row['Updated At']}</TableCell><TableCell>{row.Status}</TableCell><TableCell>{row['Progress %']}%</TableCell><TableCell>{row['Task Owner'] || row['Assigned Team']}</TableCell><TableCell>{row['Completion Date']}</TableCell><TableCell>{row.Notes}</TableCell><TableCell>{row['Updated By']}</TableCell></TableRow>)}{!historyRows.length && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>{historyTask?.['Source Type'] === 'Legacy Project Task' ? 'This legacy task will begin task-specific history after its first update.' : 'No task history found.'}</TableCell></TableRow>}</TableBody></Table></TableContainer></DialogContent>
      <DialogActions><Button onClick={() => setHistoryTask(null)}>Close</Button></DialogActions>
    </Dialog>
  </>;
}
