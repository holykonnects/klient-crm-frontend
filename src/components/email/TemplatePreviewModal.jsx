import { useEffect, useState } from "react";
import { Box, Dialog, Typography } from "@mui/material";
import EmailService from "./EmailService";

export default function TemplatePreviewModal({ open, onClose, templateId, userEmail = "" }) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    if (open) {
      EmailService.previewTemplate(templateId, userEmail).then((res) => {
        setHtml(res.html || "");
      });
    }
  }, [open, templateId, userEmail]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <Box p={3}>
        <Typography variant="h6" fontWeight="bold">
          Template Preview
        </Typography>

        <Box
          mt={2}
          sx={{
            border: "1px solid #ddd",
            padding: 2,
            maxHeight: "70vh",
            overflowY: "auto",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Box>
    </Dialog>
  );
}
