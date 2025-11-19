// /components/email/EmailDashboard.js
import React, { useState } from "react";
import { Box, Typography, Button, Stack, Card, CardContent } from "@mui/material";
import SendEmailModal from "./SendEmailModal";
import EmailEventTable from "./EmailEventTable";

function EmailDashboard() {
  const [sendOpen, setSendOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);

  return (
    <Box sx={{ fontFamily: "Montserrat, sans-serif" }}>
      
      {/* Page Title */}
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3, color: "#6495ED" }}>
        Email Dashboard
      </Typography>

      {/* ACTION CARDS */}
      <Stack direction="row" spacing={3} flexWrap="wrap">

        <Card sx={{ width: 260, cursor: "pointer", background: "#f0f4ff" }} onClick={() => setSendOpen(true)}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold">✉️ Send Email</Typography>
            <Typography sx={{ mt: 1, fontSize: 14 }}>
              Send a single email to a lead, account, or deal.
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ width: 260, cursor: "pointer", background: "#f0f4ff" }} onClick={() => setLogsOpen(true)}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold">📑 Email Logs</Typography>
            <Typography sx={{ mt: 1, fontSize: 14 }}>
              View sent email history.
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ width: 260, cursor: "pointer", background: "#f0f4ff" }}
          onClick={() => window.location.href = "/email-templates"}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold">📄 Template Manager</Typography>
            <Typography sx={{ mt: 1, fontSize: 14 }}>
              View templates available for email.
            </Typography>
          </CardContent>
        </Card>

      </Stack>

      {/* Email Modals */}
      <SendEmailModal open={sendOpen} onClose={() => setSendOpen(false)} />
      <EmailEventTable open={logsOpen} onClose={() => setLogsOpen(false)} />

    </Box>
  );
}

export default EmailDashboard;
