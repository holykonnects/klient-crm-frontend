import { Box } from '@mui/material';

export default function EmailHtmlPreview({ html = '' }) {
  const policy = `default-src 'none'; img-src https: data: ${window.location.origin}; style-src 'unsafe-inline' https:; font-src https: data:; base-uri 'none'; form-action 'none'`;
  return <Box component="iframe" title="Email template preview" sandbox="" referrerPolicy="no-referrer"
    srcDoc={`<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}">${html}`}
    sx={{ display: 'block', width: '100%', height: '65vh', minHeight: 320, border: '1px solid #dbe3ef', bgcolor: '#fff' }} />;
}
