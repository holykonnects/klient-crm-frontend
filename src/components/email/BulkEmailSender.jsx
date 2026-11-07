import React, { useEffect, useRef, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, MenuItem, Paper, Stack, Tab, Tabs, TextField, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';
import PauseIcon from '@mui/icons-material/Pause';
import { useAuth } from '../AuthContext';
import EmailService from './EmailService';
import EmailHtmlPreview from './EmailHtmlPreview';
import { EMAIL_INTERVAL_MS, sendWithQuotaRetry, waitForCampaign } from './campaignPacing';

const emptyForm = { campaign: '', sheet: '', templateId: '', subject: '', replyTo: '', quotationLink: '', mode: 0, email: '', firstName: '', company: '' };

export default function BulkEmailSender({ open, onClose }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const username = String(user?.username || user?.email || '').trim();
  const draftKey = `crm-email-campaign:${username}`;
  const [form, setForm] = useState(emptyForm);
  const [templates, setTemplates] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [leadRecipients, setLeadRecipients] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [outcomes, setOutcomes] = useState({});
  const running = useRef(false);
  const completed = useRef(new Set());
  const pause = useRef(false);
  const previewRequest = useRef(0);
  const campaignRequest = useRef(0);
  const leadRequest = useRef(0);
  const template = templates.find(item => item.id === form.templateId) || null;
  const selectableRecipients = form.mode === 2 ? leadRecipients : recipients;
  const targets = form.mode === 1 ? [{ email: form.email.trim(), firstName: form.firstName, company: form.company }]
    : selectableRecipients.filter(row => selected.includes(row.rowNumber) && row.valid);
  const previewRecipient = targets[0];
  const filteredRecipients = selectableRecipients.filter(row => `${row.firstName} ${row.lastName || ''} ${row.company} ${row.email} ${row.owner || ''} ${row.status || ''}`.toLowerCase().includes(search.toLowerCase()));
  const toggleRecipient = (rowNumber) => setSelected(current => current.includes(rowNumber)
    ? current.filter(id => id !== rowNumber)
    : [...current, rowNumber]);

  useEffect(() => () => { pause.current = true; }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setError(''); setNotice(''); setPreview(null); setSelected([]); setOutcomes({});
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null');
      setForm({ ...emptyForm, replyTo: user?.email || (/^[^@]+@/.test(username) ? username : ''), ...(saved || {}) });
    } catch { setForm({ ...emptyForm, replyTo: user?.email || '' }); }
    setLoading(true);
    Promise.all([EmailService.campaign('getCampaignSheets'), EmailService.campaign('getTemplates', { user: username }), EmailService.campaign('getLeadRecipients')]).then(([sheetResult, templateResult, leadResult]) => {
      if (active) { setSheets(sheetResult.data || []); setTemplates(templateResult.data || []); setLeadRecipients(leadResult.data || []); }
    }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; previewRequest.current += 1; campaignRequest.current += 1; leadRequest.current += 1; };
  }, [open, draftKey, username, user?.email]);

  useEffect(() => {
    setPreview(null); setPreviewReady(false); previewRequest.current += 1;
  }, [form, selected]);

  const change = (field, value) => { setForm(current => ({ ...current, [field]: value })); setError(''); };
  const loadRecipients = async () => {
    const request = ++campaignRequest.current;
    setLoading(true); setError(''); setRecipients([]); setSelected([]); setOutcomes({});
    try {
      const result = await EmailService.campaign('getCampaignRecipients', { sheet: form.sheet });
      if (request === campaignRequest.current) setRecipients(result.data || []);
    } catch (err) { if (request === campaignRequest.current) setError(err.message); }
    finally { if (request === campaignRequest.current) setLoading(false); }
  };

  const loadLeadRecipients = async () => {
    const request = ++leadRequest.current;
    setLoading(true); setError(''); setSelected([]); setOutcomes({});
    try {
      const result = await EmailService.campaign('getLeadRecipients');
      if (request === leadRequest.current) setLeadRecipients(result.data || []);
    } catch (err) { if (request === leadRequest.current) setError(err.message); }
    finally { if (request === leadRequest.current) setLoading(false); }
  };

  const makePreview = async () => {
    const request = ++previewRequest.current;
    setPreviewLoading(true); setError('');
    try {
      const result = await EmailService.campaign('previewCampaignEmail', { templateId: form.templateId, recipient: previewRecipient || {}, quotationLink: form.quotationLink }, 'POST');
      if (request === previewRequest.current) setPreview(result);
    } catch (err) { if (request === previewRequest.current) setError(err.message); }
    finally { setPreviewLoading(false); }
  };

  const send = async () => {
    if (running.current) return;
    running.current = true; pause.current = false;
    setSending(true); setConfirmOpen(false); setError(''); setNotice('');
    const dispatchId = recipient => JSON.stringify([form.campaign.trim().toLowerCase(), form.mode === 0 ? form.sheet : 'single', recipient.email.toLowerCase(), form.templateId]);
    const queue = targets.filter(recipient => !completed.current.has(dispatchId(recipient)));
    const settings = { ...form, version: preview.version };
    setProgress({ done: 0, total: queue.length });
    let done = 0;
    let processed = 0;
    try {
      for (const recipient of queue) {
        if (pause.current) break;
        if (processed > 0) {
          setNotice('Waiting 20 seconds before the next recipient. Keep this window open.');
          if (!await waitForCampaign(EMAIL_INTERVAL_MS, () => pause.current)) break;
        }
        const id = recipient.rowNumber || recipient.email;
        setOutcomes(current => ({ ...current, [id]: 'Sending' }));
        try {
          const result = await sendWithQuotaRetry(() => EmailService.campaign('sendCampaignEmail', { campaign: settings.campaign, subject: settings.subject,
            templateId: settings.templateId, version: settings.version, replyTo: settings.replyTo, quotationLink: settings.quotationLink,
            ...(settings.mode === 0 ? { sheet: settings.sheet, rowNumber: recipient.rowNumber, expectedEmail: recipient.email } : { recipient }) }, 'POST'), {
            paused: () => pause.current,
            onRetry: (delay, attempt) => {
              setOutcomes(current => ({ ...current, [id]: 'Waiting for Google quota' }));
              setNotice(`Google read quota reached. Retrying in ${delay / 1000} seconds (attempt ${attempt}/3). Keep this window open.`);
            },
          });
          if (!result) {
            setOutcomes(current => ({ ...current, [id]: 'Queued' }));
            break;
          }
          processed += 1;
          const deliveryLabel = result.messageId ? `${result.status} (${result.messageId})` : result.status;
          setOutcomes(current => ({ ...current, [id]: result.skipped ? `${result.status} (not sent again; already recorded)` : deliveryLabel }));
          if (['Sent', 'Accepted by Gmail'].includes(result.status)) {
            completed.current.add(dispatchId(recipient));
            done += 1;
          }
          setProgress({ done, total: queue.length });
          if (result.warning || (result.skipped && !['Sent', 'Accepted by Gmail'].includes(result.status))) {
            setError(result.warning || 'A prior send is unconfirmed. Check Gmail Sent before continuing.');
            break;
          }
        } catch (err) {
          setOutcomes(current => ({ ...current, [id]: 'Needs review' }));
          setError(err.retryable ? `${err.message} Automatic retries exhausted. Resume this campaign later with the same campaign name and template.` : err.message); break;
        }
      }
      setNotice(`${done} of ${queue.length} recipients submitted to Gmail${pause.current ? ' (paused)' : ''}. Resume with the same campaign name and template to skip already recorded recipients. Inbox delivery can still be delayed, filtered or rejected.`);
    } finally { running.current = false; setSending(false); }
  };

  const canSend = !loading && !sending && preview && previewReady && !preview.missing?.length && form.campaign.trim() && form.subject.trim() && form.replyTo.trim() && targets.length && targets.every(target => target.email);
  return <Dialog open={open} onClose={() => { if (!running.current) onClose(); }} maxWidth="xl" fullWidth fullScreen={isMobile} disableEscapeKeyDown={sending}
    PaperProps={{ sx: { m: { xs: 0, sm: 2 }, maxHeight: { xs: '100dvh', sm: 'calc(100% - 32px)' } } }}>
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 1.5, sm: 3 }, py: { xs: 1, sm: 2 } }}>Email Sender
      <Tooltip title="Close"><span><IconButton aria-label="Close email sender" disabled={sending} onClick={onClose}><CloseIcon /></IconButton></span></Tooltip>
    </DialogTitle>
    <DialogContent dividers sx={{ height: { xs: 'auto', sm: '78vh' }, flex: 1, p: { xs: 1.25, sm: 2 }, overflowX: 'hidden' }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="info" sx={{ mb: 2 }}>{notice}</Alert>}
      <Alert severity="info" sx={{ mb: 2 }}>Bulk emails are staggered with a 20-second pause between recipients. Keep this window open and your device awake while sending. Use Pause to stop safely, then send the same campaign to resume.</Alert>
      {(loading || previewLoading) && <LinearProgress sx={{ mb: 2 }} />}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(300px, 0.8fr) minmax(0, 1.2fr)' }, gap: { xs: 1.5, sm: 2 } }}>
        <Box component="fieldset" disabled={sending} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
          <Stack spacing={{ xs: 1.25, sm: 2 }}>
            <TextField required label="Campaign name" size="small" value={form.campaign} onChange={e => change('campaign', e.target.value)} inputProps={{ maxLength: 160 }} />
            <Autocomplete disabled={sending} options={templates} value={template} getOptionLabel={item => item.name} isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, item) => change('templateId', item?.id || '')} renderInput={params => <TextField {...params} label="Template" size="small" />} />
            {template?.url && <Button component="a" href={template.url} target="_blank" rel="noopener noreferrer" size="small">Open template</Button>}
            <TextField label="Subject" size="small" value={form.subject} onChange={e => change('subject', e.target.value)} />
            <TextField label="Reply-to email" type="email" size="small" value={form.replyTo} onChange={e => change('replyTo', e.target.value)} />
            <TextField label="Quotation link" type="url" size="small" value={form.quotationLink} onChange={e => change('quotationLink', e.target.value)} />
            <Tabs value={form.mode} onChange={(_, mode) => { change('mode', mode); setSelected([]); setSearch(''); }} variant="fullWidth"
              sx={{ '& .MuiTab-root': { minWidth: 0, px: { xs: 0.5, sm: 1.5 }, fontSize: { xs: 10, sm: 12 } } }}><Tab label="Campaign sheet" /><Tab label="Single recipient" /><Tab label="Leads" /></Tabs>
            {form.mode === 0 ? <TextField disabled={loading || sending} select label="Campaign sheet" size="small" value={sheets.includes(form.sheet) ? form.sheet : ''} onChange={e => {
              campaignRequest.current += 1; change('sheet', e.target.value); setRecipients([]); setSelected([]); setOutcomes({});
            }}>{sheets.map(sheet => <MenuItem key={sheet} value={sheet}>{sheet}</MenuItem>)}</TextField> : form.mode === 1 ? <>
              <TextField label="Recipient email" type="email" size="small" value={form.email} onChange={e => change('email', e.target.value)} />
              <TextField label="First name" size="small" value={form.firstName} onChange={e => change('firstName', e.target.value)} />
              <TextField label="Company" size="small" value={form.company} onChange={e => change('company', e.target.value)} />
            </> : <Alert severity="info">Only leads with valid email addresses are listed. Select one or more rows below.</Alert>}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, max-content)' }, gap: 1, '& .MuiButton-root': { minWidth: 0 } }}>
              {form.mode === 0 && <Button startIcon={<RefreshIcon />} disabled={loading || !form.sheet || sending} onClick={loadRecipients}>Load recipients</Button>}
              {form.mode === 2 && <Button startIcon={<RefreshIcon />} disabled={loading || sending} onClick={loadLeadRecipients}>Refresh leads</Button>}
              <Button startIcon={<VisibilityIcon />} disabled={!form.templateId || previewLoading || sending} onClick={makePreview}>Preview</Button>
              <Button startIcon={<SaveIcon />} disabled={sending} onClick={() => {
                try { localStorage.setItem(draftKey, JSON.stringify(form)); setNotice('Draft saved on this browser.'); }
                catch { setError('This browser could not save the draft.'); }
              }}>Save draft</Button>
            </Box>
          </Stack>
        </Box>
        <Box sx={{ minWidth: 0, mt: { xs: 0.5, lg: 0 } }}>
          {preview ? <>
            <Stack direction="row" spacing={1} mb={1} flexWrap="wrap"><Chip size="small" label={`HTML: ${Math.ceil(preview.htmlBytes / 1024)} KB`} /><Chip size="small" label={`Images: ${Math.ceil(preview.imageBytes / 1024)} KB`} />{previewRecipient?.email && <Chip size="small" label={previewRecipient.email} />}</Stack>
            {!!preview.missing?.length && <Alert severity="warning" sx={{ mb: 1 }}>Unfilled placeholders: {preview.missing.join(', ')}</Alert>}
            <EmailHtmlPreview html={preview.html} onReady={setPreviewReady} />
          </> : <Box sx={{ minHeight: 300, height: '100%', border: '1px solid #dbe3ef', display: 'grid', placeItems: 'center', color: 'text.secondary' }}><VisibilityIcon fontSize="large" /></Box>}
        </Box>
      </Box>
      {form.mode !== 1 && <Box sx={{ mt: { xs: 2, sm: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" gap={1} mb={1}><Typography variant="subtitle2">{form.mode === 2 ? 'Leads' : 'Recipients'} ({selectableRecipients.length})</Typography><TextField fullWidth={isMobile} label={`Search ${form.mode === 2 ? 'leads' : 'recipients'}`} size="small" value={search} disabled={sending} onChange={e => setSearch(e.target.value)} /></Stack>
        <Box sx={{ display: { xs: 'grid', sm: 'none' }, gap: 1, maxHeight: 440, overflowY: 'auto', pr: 0.25 }}>
          {filteredRecipients.map(row => <Paper key={row.rowNumber} variant="outlined" onClick={() => !sending && row.valid && toggleRecipient(row.rowNumber)}
            sx={{ p: 1.25, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 1, cursor: row.valid ? 'pointer' : 'default', opacity: row.valid ? 1 : 0.6, borderColor: selected.includes(row.rowNumber) ? 'primary.main' : 'divider', bgcolor: selected.includes(row.rowNumber) ? 'rgba(100,149,237,0.08)' : 'background.paper' }}>
            <Checkbox size="small" checked={selected.includes(row.rowNumber)} disabled={sending || !row.valid} onClick={event => event.stopPropagation()} onChange={() => toggleRecipient(row.rowNumber)} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, overflowWrap: 'anywhere' }}>{[row.firstName, row.lastName].filter(Boolean).join(' ') || row.company || 'Recipient'}</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', overflowWrap: 'anywhere' }}>{row.email}</Typography>
              {(row.company || row.owner) && <Typography sx={{ mt: 0.5, fontSize: 10, color: 'text.secondary' }}>{[row.company, row.owner].filter(Boolean).join(' · ')}</Typography>}
              <Chip size="small" sx={{ mt: 0.75, height: 20, fontSize: 9 }} label={!row.valid ? 'Invalid email' : outcomes[row.rowNumber] || row.status || 'Ready'} />
            </Box>
          </Paper>)}
          {!loading && !filteredRecipients.length && <Typography sx={{ py: 3, textAlign: 'center', color: 'text.secondary', fontSize: 12 }}>No matching recipients.</Typography>}
        </Box>
        <Box sx={{ display: { xs: 'none', sm: 'block' }, height: 380, width: '100%' }}><DataGrid rows={filteredRecipients} getRowId={row => row.rowNumber} checkboxSelection disableRowSelectionOnClick loading={loading}
          rowSelectionModel={selected} onRowSelectionModelChange={ids => { if (!sending) setSelected(ids); }} keepNonExistentRowsSelected
          isRowSelectable={params => !sending && params.row.valid} pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          columns={form.mode === 2 ? [
            { field: 'firstName', headerName: 'First name', minWidth: 120, flex: 0.8 }, { field: 'lastName', headerName: 'Last name', minWidth: 120, flex: 0.8 },
            { field: 'company', headerName: 'Company', minWidth: 150, flex: 1 }, { field: 'email', headerName: 'Email', minWidth: 220, flex: 1.3 },
            { field: 'owner', headerName: 'Lead owner', minWidth: 150, flex: 1 }, { field: 'status', headerName: 'Lead status', minWidth: 130,
              valueGetter: params => outcomes[params.row.rowNumber] || params.row.status || 'Ready' },
          ] : [{ field: 'firstName', headerName: 'First name', minWidth: 130, flex: 1 }, { field: 'company', headerName: 'Company', minWidth: 150, flex: 1 },
            { field: 'email', headerName: 'Email', minWidth: 220, flex: 1.3 }, { field: 'status', headerName: 'Status', minWidth: 170,
              valueGetter: params => !params.row.valid ? 'Invalid email' : outcomes[params.row.rowNumber] || params.row.status || 'Ready' },
            { field: 'sentAt', headerName: 'Last sent', minWidth: 150 }, { field: 'template', headerName: 'Template sent', minWidth: 160 }]} /></Box>
      </Box>}
      {(sending || progress.total > 0) && <Box sx={{ mt: 2 }}><LinearProgress variant="determinate" value={progress.total ? 100 * progress.done / progress.total : 0} /><Typography variant="caption">{progress.done} / {progress.total}</Typography></Box>}
    </DialogContent>
    <DialogActions sx={{ px: { xs: 1.25, sm: 2 }, py: { xs: 1, sm: 1.5 }, position: { xs: 'sticky', sm: 'static' }, bottom: 0, bgcolor: 'background.paper', borderTop: { xs: '1px solid', sm: 0 }, borderColor: 'divider', '& .MuiButton-root': { minWidth: 0 } }}>
      {sending ? <Button startIcon={<PauseIcon />} onClick={() => { pause.current = true; setNotice('Pausing after the current recipient.'); }}>Pause</Button> : <Button onClick={onClose}>Close</Button>}
      <Button variant="contained" startIcon={<SendIcon />} disabled={!canSend} onClick={() => setConfirmOpen(true)}>Send {form.mode === 1 ? 'email' : `selected (${targets.length})`}</Button>
    </DialogActions>
    <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth><DialogTitle>Confirm email send</DialogTitle><DialogContent>
      <Typography>{targets.length} recipient(s), with a 20-second pause between recipients.</Typography><Typography>Campaign: {form.campaign}</Typography><Typography>Subject: {form.subject}</Typography><Typography>Template: {template?.name}</Typography>
      <Alert severity="info" sx={{ mt: 2 }}>A successful result means Gmail accepted the message; it does not confirm inbox delivery. Recipients already recorded for this campaign and template will not be sent another email.</Alert>
    </DialogContent><DialogActions><Button onClick={() => setConfirmOpen(false)}>Cancel</Button><Button variant="contained" startIcon={<SendIcon />} onClick={send}>Confirm send</Button></DialogActions></Dialog>
  </Dialog>;
}
