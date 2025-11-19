import { useState } from "react";
import { Box, Button, Typography, Stack } from "@mui/material";
import SendEmailModal from "./SendEmailModal";
import EmailEventTable from "./EmailEventTable";
import TemplatePreviewModal from "./TemplatePreviewModal";

export default function EmailDashboard() {
  const [sendOpen, setSendOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);

  return (
    <Box p={3} sx={{ fontFamily: "Montserrat, sans-serif" }}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        Email Management
      </Typography>

      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={() => setSendOpen(true)}>
          Send Email
        </Button>

        <Button variant="outlined" onClick={() => setLogsOpen(true)}>
          View Email Logs
        </Button>
      </Stack>

      <SendEmailModal open={sendOpen} onClose={() => setSendOpen(false)} />
      <EmailEventTable open={logsOpen} onClose={() => setLogsOpen(false)} />
    </Box>
  );
}
