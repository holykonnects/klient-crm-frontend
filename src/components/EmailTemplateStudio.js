// src/components/EmailTemplateStudio.js
import { useEffect, useRef } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import 'grapesjs-preset-newsletter';
import 'grapesjs-mjml';

export default function EmailTemplateStudio() {
  const editorRef = useRef(null);
  const gjsRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current || gjsRef.current) return;

    gjsRef.current = grapesjs.init({
      container: editorRef.current,
      height: '100vh',
      fromElement: false,
      storageManager: false,
      plugins: ['grapesjs-preset-newsletter', 'grapesjs-mjml'],
      pluginsOpts: {
        'grapesjs-preset-newsletter': {
          modalLabelImport: 'Paste your HTML here',
          modalLabelExport: 'Copy the email HTML',
          codeViewOptions: 'htmlmixed',
          panels: { defaults: [] },
        },
        'grapesjs-mjml': {},
      },
      canvas: {
        styles: [
          'https://cdnjs.cloudflare.com/ajax/libs/meyer-reset/2.0/reset.min.css',
          'https://fonts.googleapis.com/css?family=Montserrat:400,500,700',
        ],
      },
    });

    // Add save button
    gjsRef.current.Panels.addButton('options', [{
      id: 'save-template',
      className: 'fa fa-save',
      command: 'save-template',
      attributes: { title: 'Save Template' },
    }]);

    // Define save command
    gjsRef.current.Commands.add('save-template', {
      run: () => {
        const html = gjsRef.current.getHtml();
        const css = gjsRef.current.getCss();
        const fullHTML = `<style>${css}</style>${html}`;
        localStorage.setItem('email_template_draft', fullHTML);
        alert('Template saved locally. Integrate POST save next.');
      },
    });
  }, []);

  return (
    <Box sx={{ height: '100vh', fontFamily: 'Montserrat, sans-serif' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" p={2} sx={{ background: '#f0f4ff' }}>
        <Typography variant="h6" fontWeight={600}>Email Template Studio</Typography>
        <Button variant="contained" onClick={() => {
          const html = localStorage.getItem('email_template_draft');
          console.log('Saved draft HTML:', html);
        }} sx={{ background: '#6495ED' }}>
          Save & Preview
        </Button>
      </Stack>
      <div ref={editorRef} style={{ height: 'calc(100vh - 64px)' }} />
    </Box>
  );
}
