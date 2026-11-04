import { useEffect, useState } from "react";
import { Alert, Box, CircularProgress, Dialog, Typography } from "@mui/material";
import EmailService from "./EmailService";
import EmailHtmlPreview from './EmailHtmlPreview';

export default function TemplatePreviewModal({ open, onClose, templateId, userEmail = "" }) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (open && templateId) {
      setHtml('');
      setError('');
      setLoading(true);
      EmailService.previewTemplate(templateId, userEmail).then((res) => {
        if (!active) return;
        if (!res?.ok) throw new Error(res?.error || 'Unable to load the template preview.');
        setHtml(res.html || "");
      }).catch(err => { if (active) setError(err.message); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [open, templateId, userEmail]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <Box p={3}>
        <Typography variant="h6" fontWeight="bold">
          Template Preview
        </Typography>

        <Box mt={2}>{loading ? <CircularProgress aria-label="Loading template preview" /> : error ? <Alert severity="error">{error}</Alert> : <EmailHtmlPreview html={html} />}</Box>
      </Box>
    </Dialog>
  );
}
