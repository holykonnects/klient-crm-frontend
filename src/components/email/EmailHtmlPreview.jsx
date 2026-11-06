import { useEffect, useRef, useState } from 'react';
import { Alert, Box, LinearProgress } from '@mui/material';
import { hydrateEmailPreviewImages } from '../../utils/emailPreviewImages';

export default function EmailHtmlPreview({ html = '', onReady }) {
  const [document, setDocument] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const callback = useRef(onReady);
  callback.current = onReady;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setDocument(''); callback.current?.(false);
    hydrateEmailPreviewImages(html, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      setDocument(value); callback.current?.(true);
    }).catch(err => {
      if (!controller.signal.aborted) { setError(err.message); callback.current?.(false); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [html]);
  const policy = `default-src 'none'; img-src https: data: ${window.location.origin}; style-src 'unsafe-inline' https:; font-src https: data:; base-uri 'none'; form-action 'none'`;
  return <Box>
    {loading && <LinearProgress aria-label="Loading template images" />}
    {error && <Alert severity="error">{error}</Alert>}
    <Box component="iframe" title="Email template preview" sandbox="" referrerPolicy="no-referrer"
      srcDoc={`<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}">${document}`}
      sx={{ display: error ? 'none' : 'block', width: '100%', height: { xs: '52vh', sm: '60vh', lg: '65vh' }, minHeight: { xs: 360, sm: 420 }, border: '1px solid #dbe3ef', bgcolor: '#fff' }} />
  </Box>;
}
