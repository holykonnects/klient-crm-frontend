import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Dialog,
  TextField,
  Typography,
  Select,
  MenuItem,
  Stack,
} from "@mui/material";

import EmailService from "./EmailService";
import TemplatePreviewModal from "./TemplatePreviewModal";
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

  // Load Leads + Templates on open
  useEffect(() => {
    if (!open) return;

    (async () => {
      const fetchedLeads = await EmailService.getLeads();
      setLeads(fetchedLeads);

      const fetchedTemplates = await EmailService.getTemplates();
      setTemplates(fetchedTemplates);
    })();
  }, [open]);

  // 🔥 When LeadForm submits a new lead successfully
  const handleLeadCreated = async (newLead) => {
    // Re-fetch leads so we have the same shape as EmailService.getLeads
    const updatedLeads = await EmailService.getLeads();
    setLeads(updatedLeads);

    // Try to match by email (or any unique key you use)
    const match =
      updatedLeads.find((l) => l.email === newLead.email) || newLead;

    setSelectedLead(match);

    // Stay in the same modal, with buttons visible; just ensure we're in "existing"
    setMode("existing");

    // Close the lead form
    setLeadFormOpen(false);
  };

  const sendEmail = async () => {
    if (!selectedLead) {
      alert("Please select a lead.");
      return;
    }
    if (!selectedTemplate) {
      alert("Please select a template.");
      return;
    }

    await EmailService.sendEmail({
      to: selectedLead.email,
      subject,
      templateId: selectedTemplate.id,
      placeholders: selectedLead,
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

          {/* Mode Toggle – stays visible always */}
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

          {/* Existing Lead Dropdown */}
          {mode === "existing" && (
            <Box mt={3}>
              <Typography>Select Lead</Typography>

              <Select
                fullWidth
                value={selectedLead?.email || ""}
                onChange={(e) => {
                  const lead = leads.find((l) => l.email === e.target.value);
                  setSelectedLead(lead || null);
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

          {/* Template Selection */}
          <Box mt={3}>
            <Typography>Template</Typography>

            <Select
              fullWidth
              value={selectedTemplate?.id || ""}
              onChange={(e) => {
                const t = templates.find((temp) => temp.id === e.target.value);
                setSelectedTemplate(t || null);
              }}
            >
              {templates.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>

            {selectedTemplate && (
              <Button
                size="small"
                sx={{ mt: 1 }}
                onClick={() => setPreviewOpen(true)}
              >
                Preview Template
              </Button>
            )}
          </Box>

          {/* Subject */}
          <TextField
            fullWidth
            label="Subject"
            sx={{ mt: 3 }}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          {/* Send Button */}
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

        {/* Template Preview */}
        {selectedTemplate && (
          <TemplatePreviewModal
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
            templateId={selectedTemplate.id}
          />
        )}
      </Dialog>

      {/* Lead Form Modal */}
      <LeadFormModalWrapper
        open={leadFormOpen}
        onClose={() => setLeadFormOpen(false)}
        onLeadCreated={handleLeadCreated}
      />
    </>
  );
}
