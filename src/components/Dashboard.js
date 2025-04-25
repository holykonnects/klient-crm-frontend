// src/components/Dashboard.js
import React from 'react';
import { Box, Typography } from '@mui/material';

function Dashboard() {
  return (
    <Box padding={4}>
      <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100, marginBottom: 20 }} />
      <Typography variant="h5" fontWeight="bold" mb={2}>Your Dashboard</Typography>
      <iframe
        title="Looker Studio Report"
        width="100%"
        height="800"
        frameBorder="0"
        style={{ border: 0 }}
        src="https://lookerstudio.google.com/embed/reporting/c8ad3485-a785-4a92-bf75-091cb97c3ff0/page/cbSFE"
        allowFullScreen
      ></iframe>
    </Box>
  );
}

export default Dashboard;
