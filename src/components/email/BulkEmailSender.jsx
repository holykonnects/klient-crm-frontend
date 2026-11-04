import React, { useEffect, useRef, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, MenuItem, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
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

const emptyForm = { campaign: '', sheet: '', templateId: '', subject: '', replyTo: '', quotationLink: '', mode: 0, email: '', firstName: '', company: '' };

export default function BulkEmailSender({ open, onClose }) {
  const { user } = useAuth();
  const username = String(user?.username || user?.email || '').trim();
  const draftKey = `crm-email-campaign:${username}`;
  const [form, setForm] = useState(emptyForm);
  const [templates, setTemplates] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [recipients, setRecipients] = useState([]);
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
  const pause = useRef(false);
  const previewRequest = useRef(0);
  const campaignRequest = useRef(0);
  const template = templates.find(item => item.id === form.templateId) || null;
  const targets = form.mode === 0 ? recipients.filter(row => selected.includes(row.rowNumber) && row.valid)
    : [{ email: form.email.trim(), firstName: form.firstName, company: form.company }];
  const previewRecipient = targets[0];
  const filteredRecipients = recipients.filter(row => `${row.firstName} ${row.company} ${row.email}`.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    let active = true;
    setError(''); setNotice(''); setPreview(null); setSelected([]); setOutcomes({});
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null');
      setForm({ ...emptyForm, replyTo: user?.email || (/^[^@]+@/.test(username) ? username : ''), ...(saved || {}) });
    } catch { setForm({ ...emptyForm, replyTo: user?.email || '' }); }
    setLoading(true);
    Promise.all([EmailService.campaign('getCampaignSheets'), EmailService.campaign('getTemplates', { user: username })]).then(([sheetResult, templateResult]) => {
      if (active) { setSheets(sheetResult.data || []); setTemplates(templateResult.data || []); }
    }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; previewRequest.current += 1; campaignRequest.current += 1; };
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
    const queue = [...targets];
    const settings = { ...form, version: preview.version };
    setProgress({ done: 0, total: queue.length });
    let done = 0;
    try {
      for (const recipient of queue) {
        if (pause.current) break;
        const id = recipient.rowNumber || recipient.email;
        setOutcomes(current => ({ ...current, [id]: 'Sending' }));
        try {
          const result = await EmailService.campaign('sendCampaignEmail', { campaign: settings.campaign, subject: settings.subject,
            templateId: settings.templateId, version: settings.version, replyTo: settings.replyTo, quotationLink: settings.quotationLink,
            ...(settings.mode === 0 ? { sheet: settings.sheet, rowNumber: recipient.rowNumber, expectedEmail: recipient.email } : { recipient }) }, 'POST');
          setOutcomes(current => ({ ...current, [id]: result.skipped ? `${result.status} (already recorded)` : result.status }));
          done += 1; setProgress({ done, total: queue.length });
          if (result.warning || (result.skipped && result.status !== 'Sent')) {
            setError(result.warning || 'A prior send is unconfirmed. Check Gmail Sent before continuing.');
            break;
          }
        } catch (err) {
          setOutcomes(current => ({ ...current, [id]: 'Needs review' }));
          setError(err.message); break;
        }
      }
      setNotice(`${done} of ${queue.length} recipients processed${pause.current ? ' (paused)' : ''}.`);
    } finally { running.current = false; setSending(false); }
  };

  const canSend = !loading && !sending && preview && previewReady && !preview.missing?.length && form.campaign.trim() && form.subject.trim() && form.replyTo.trim() && targets.length && targets.every(target => target.email);
  return <Dialog open={open} onClose={() => { if (!running.current) onClose(); }} maxWidth="xl" fullWidth disableEscapeKeyDown={sending}>
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>Email Sender
      <Tooltip title="Close"><span><IconButton aria-label="Close email sender" disabled={sending} onClick={onClose}><CloseIcon /></IconButton></span></Tooltip>
    </DialogTitle>
    <DialogContent dividers sx={{ height: '78vh', p: 2 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="info" sx={{ mb: 2 }}>{notice}</Alert>}
      {(loading || previewLoading) && <LinearProgress sx={{ mb: 2 }} />}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(300px, 0.8fr) minmax(0, 1.2fr)' }, gap: 2 }}>
        <Box component="fieldset" disabled={sending} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
          <Stack spacing={2}>
            <TextField required label="Campaign name" size="small" value={form.campaign} onChange={e => change('campaign', e.target.value)} inputProps={{ maxLength: 160 }} />
            <Autocomplete disabled={sending} options={templates} value={template} getOptionLabel={item => item.name} isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, item) => change('templateId', item?.id || '')} renderInput={params => <TextField {...params} label="Template" size="small" />} />
            {template?.url && <Button component="a" href={template.url} target="_blank" rel="noopener noreferrer" size="small">Open template</Button>}
            <TextField label="Subject" size="small" value={form.subject} onChange={e => change('subject', e.target.value)} />
            <TextField label="Reply-to email" type="email" size="small" value={form.replyTo} onChange={e => change('replyTo', e.target.value)} />
            <TextField label="Quotation link" type="url" size="small" value={form.quotationLink} onChange={e => change('quotationLink', e.target.value)} />
            <Tabs value={form.mode} onChange={(_, mode) => { change('mode', mode); setSelected([]); }} variant="fullWidth"><Tab label="Campaign sheet" /><Tab label="Single recipient" /></Tabs>
            {form.mode === 0 ? <TextField disabled={loading || sending} select label="Campaign sheet" size="small" value={sheets.includes(form.sheet) ? form.sheet : ''} onChange={e => {
              campaignRequest.current += 1; change('sheet', e.target.value); setRecipients([]); setSelected([]); setOutcomes({});
            }}>{sheets.map(sheet => <MenuItem key={sheet} value={sheet}>{sheet}</MenuItem>)}</TextField> : <>
              <TextField label="Recipient email" type="email" size="small" value={form.email} onChange={e => change('email', e.target.value)} />
              <TextField label="First name" size="small" value={form.firstName} onChange={e => change('firstName', e.target.value)} />
              <TextField label="Company" size="small" value={form.company} onChange={e => change('company', e.target.value)} />
            </>}
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {form.mode === 0 && <Button startIcon={<RefreshIcon />} disabled={loading || !form.sheet || sending} onClick={loadRecipients}>Load recipients</Button>}
              <Button startIcon={<VisibilityIcon />} disabled={!form.templateId || previewLoading || sending} onClick={makePreview}>Preview</Button>
              <Button startIcon={<SaveIcon />} disabled={sending} onClick={() => {
                try { localStorage.setItem(draftKey, JSON.stringify(form)); setNotice('Draft saved on this browser.'); }
                catch { setError('This browser could not save the draft.'); }
              }}>Save draft</Button>
            </Stack>
          </Stack>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          {preview ? <>
            <Stack direction="row" spacing={1} mb={1} flexWrap="wrap"><Chip size="small" label={`HTML: ${Math.ceil(preview.htmlBytes / 1024)} KB`} /><Chip size="small" label={`Images: ${Math.ceil(preview.imageBytes / 1024)} KB`} />{previewRecipient?.email && <Chip size="small" label={previewRecipient.email} />}</Stack>
            {!!preview.missing?.length && <Alert severity="warning" sx={{ mb: 1 }}>Unfilled placeholders: {preview.missing.join(', ')}</Alert>}
            <EmailHtmlPreview html={preview.html} onReady={setPreviewReady} />
          </> : <Box sx={{ minHeight: 300, height: '100%', border: '1px solid #dbe3ef', display: 'grid', placeItems: 'center', color: 'text.secondary' }}><VisibilityIcon fontSize="large" /></Box>}
        </Box>
      </Box>
      {form.mode === 0 && <Box sx={{ mt: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} mb={1}><Typography variant="subtitle2">Recipients ({recipients.length})</Typography><TextField label="Search recipients" size="small" value={search} disabled={sending} onChange={e => setSearch(e.target.value)} /></Stack>
        <Box sx={{ height: 380, width: '100%' }}><DataGrid rows={filteredRecipients} getRowId={row => row.rowNumber} checkboxSelection disableRowSelectionOnClick loading={loading}
          rowSelectionModel={selected} onRowSelectionModelChange={ids => { if (!sending) setSelected(ids); }} keepNonExistentRowsSelected
          isRowSelectable={params => !sending && params.row.valid} pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          columns={[{ field: 'firstName', headerName: 'First name', minWidth: 130, flex: 1 }, { field: 'company', headerName: 'Company', minWidth: 150, flex: 1 },
            { field: 'email', headerName: 'Email', minWidth: 220, flex: 1.3 }, { field: 'status', headerName: 'Status', minWidth: 170,
              valueGetter: params => !params.row.valid ? 'Invalid email' : outcomes[params.row.rowNumber] || params.row.status || 'Ready' },
            { field: 'sentAt', headerName: 'Last sent', minWidth: 150 }, { field: 'template', headerName: 'Template sent', minWidth: 160 }]} /></Box>
      </Box>}
      {(sending || progress.total > 0) && <Box sx={{ mt: 2 }}><LinearProgress variant="determinate" value={progress.total ? 100 * progress.done / progress.total : 0} /><Typography variant="caption">{progress.done} / {progress.total}</Typography></Box>}
    </DialogContent>
    <DialogActions sx={{ px: 2 }}>
      {sending ? <Button startIcon={<PauseIcon />} onClick={() => { pause.current = true; setNotice('Pausing after the current recipient.'); }}>Pause</Button> : <Button onClick={onClose}>Close</Button>}
      <Button variant="contained" startIcon={<SendIcon />} disabled={!canSend} onClick={() => setConfirmOpen(true)}>Send {form.mode === 0 ? `selected (${targets.length})` : 'email'}</Button>
    </DialogActions>
    <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth><DialogTitle>Confirm email send</DialogTitle><DialogContent>
      <Typography>{targets.length} recipient(s)</Typography><Typography>Campaign: {form.campaign}</Typography><Typography>Subject: {form.subject}</Typography><Typography>Template: {template?.name}</Typography>
      <Alert severity="info" sx={{ mt: 2 }}>Recipients already recorded for this campaign and template will not be sent another email. Unconfirmed deliveries require review.</Alert>
    </DialogContent><DialogActions><Button onClick={() => setConfirmOpen(false)}>Cancel</Button><Button variant="contained" startIcon={<SendIcon />} onClick={send}>Confirm send</Button></DialogActions></Dialog>
  </Dialog>;
}
