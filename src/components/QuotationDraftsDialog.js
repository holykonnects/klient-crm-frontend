import React, { useMemo, useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip,
} from '@mui/material';
import ContentCopy from '@mui/icons-material/ContentCopy';
import EditOutlined from '@mui/icons-material/EditOutlined';
import OpenInNew from '@mui/icons-material/OpenInNew';

function safeOpen(url) {
  if (/^https?:\/\//i.test(String(url || ''))) window.open(url, '_blank', 'noopener,noreferrer');
}

export default function QuotationDraftsDialog({ open, drafts, onClose, onOpen, onDuplicate }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return !term ? drafts : drafts.filter((draft) => [draft.title, draft.quotationNo, draft.clientName, draft.projectName]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [drafts, search]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>My Saved Quotes</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <TextField fullWidth size="small" label="Search quotation number, client or project" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ m: 2, width: 'calc(100% - 32px)' }} />
        <TableContainer sx={{ maxHeight: 480 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 980, '& th': { fontSize: '0.72rem', fontWeight: 800 }, '& td': { fontSize: '0.76rem' } }}>
            <TableHead><TableRow><TableCell>Updated</TableCell><TableCell>Quotation No.</TableCell><TableCell>Title</TableCell><TableCell>Client</TableCell><TableCell>Project</TableCell><TableCell>Status</TableCell><TableCell>Revision</TableCell><TableCell>Updated By</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
            <TableBody>{filtered.map((draft) => <TableRow key={draft.quoteId} hover>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{draft.updatedAt}</TableCell><TableCell>{draft.quotationNo || '-'}</TableCell>
              <TableCell>{draft.title || '-'}</TableCell><TableCell>{draft.clientName || '-'}</TableCell>
              <TableCell>{draft.projectName || '-'}</TableCell><TableCell>{draft.status || 'Draft'}</TableCell>
              <TableCell>{draft.revision ? `v${draft.revision}` : '-'}</TableCell><TableCell>{draft.updatedBy || draft.owner || '-'}</TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                <Tooltip title="Open for editing"><IconButton size="small" onClick={() => onOpen(draft)}><EditOutlined fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Duplicate"><IconButton size="small" onClick={() => onDuplicate(draft)}><ContentCopy fontSize="small" /></IconButton></Tooltip>
                {draft.pdfUrl && <Tooltip title="Open PDF"><IconButton size="small" onClick={() => safeOpen(draft.pdfUrl)}><OpenInNew fontSize="small" /></IconButton></Tooltip>}
                {draft.workingCopyUrl && <Tooltip title="Open editable quote"><IconButton size="small" onClick={() => safeOpen(draft.workingCopyUrl)}><OpenInNew fontSize="small" /></IconButton></Tooltip>}
              </TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}
