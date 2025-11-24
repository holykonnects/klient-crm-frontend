import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Dialog,
  TextField,
  Typography,
  Select,
  MenuItem,
  Stack
} from "@mui/material";

import EmailService from "./EmailService";
import TemplatePreviewModal from "./TemplatePreviewModal";

// ⭐ Correct wrapper import (same folder)
import LeadFormModalWrapper from "./LeadFormModalWrapper";

export default function SendEmailModal({ open, onClose }) {

  const [mode, setMode] = useState("existing");
  const [leads, setLeads] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [subject, setSubject] = useState("");

  const [leadFormOpen, setLeadFormOpen] = useState(false);

  useEffect(() => {
    EmailService.getLeads().then(setLeads);
    EmailService.getTemplates().then(setTemplates);
  }, []);

  const handleLeadCreated = async (lead) => {
    const updated = await EmailService.getLeads();
    setLeads(updated);
    setSelectedLead(lead);
    setMode("existing");
    setLeadFormOpen(false);
  };

  const sendEmail = async () => {
    if (!selectedLead) return alert("Please select a lead.");
    if (!selectedTemplate) return alert("Please select a template.");

    await EmailService.sendEmail({
      to: selectedLead.email,
      subject,
      templateId: selectedTemplate.id,
      placeholders: selectedLead
    });

    alert("Email Sent Successfully!");
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <Box p={3} sx={{ fontFamily: "Montserrat, sans-serif" }}>

          <Typography variant="h6" fontWeight="bold">
            Send Email
          </Typography>

          <Stack direction="row" spacing={2} mt={2}>
            <Button
              variant={mode === "existing" ? "contained" : "outlined"}
              onClick={() => setMode("existing")}
            >
              Existing Lead
            </Button>

            <Button
              variant={mode === "new" ? "contained" : "outlined"}
              onClick={() => {
                setMode("new");
                setLeadFormOpen(true);
              }}
            >
              New Lead
            </Button>
          </Stack>

          {mode === "existing" && (
            <Box mt={3}>
              <Typography>Select Lead</Typography>

              <Select
                fullWidth
                value={selectedLead?.email || ""}
                onChange={(e) => {
                  const lead = leads.find((l) => l.email === e.target.value);
                  setSelectedLead(lead);
                }}
              >
                {leads.map((l, index) => (
                  <MenuItem key={index} value={l.email}>
                    {l.firstName} {l.lastName} — {l.email}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          )}

          <Box mt={3}>
            <Typography>Template</Typography>

            <Select
              fullWidth
              value={selectedTemplate?.id || ""}
              onChange={(e) => {
                const t = templates.find((temp) => temp.id === e.target.value);
                setSelectedTemplate(t);
              }}
            >
              {templates.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>

            {selectedTemplate && (
              <Button size="small" sx={{ mt: 1 }} onClick={() => setPreviewOpen(true)}>
                Preview Template
              </Button>
            )}
          </Box>

          <TextField
            fullWidth
            label="Subject"
            sx={{ mt: 3 }}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          <Button
            fullWidth
            variant="contained"
            sx={{ mt: 3 }}
            onClick={sendEmail}
            disabled={!selectedLead || !selectedTemplate}
          >
            Send Email
          </Button>

        </Box>

        {selectedTemplate && (
          <TemplatePreviewModal
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
            templateId={selectedTemplate.id}
          />
        )}
      </Dialog>

      {/* LeadForm.js modal */}
      <LeadFormModalWrapper
        open={leadFormOpen}
        onClose={() => setLeadFormOpen(false)}
        onLeadCreated={handleLeadCreated}
      />
    </>
  );
}
