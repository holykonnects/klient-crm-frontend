import React from 'react';
import { Box } from '@mui/material';

function Dashboard() {
  return (
    <Box
      sx={{
        padding: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      <img
        src="/assets/kk-logo.png"
        alt="Klient Konnect"
        style={{ height: 100, marginBottom: '1rem' }}
      />

      <iframe
        title="Looker Studio Dashboard"
        width="100%"
        height="800"
        src="https://lookerstudio.google.com/embed/reporting/c8ad3485-a785-4a92-bf75-091cb97c3ff0/page/cbSFE"
        frameBorder="0"
        style={{ border: '1px solid #ccc', borderRadius: 8 }}
        allowFullScreen
      />
    </Box>
  );
}

export default Dashboard;
