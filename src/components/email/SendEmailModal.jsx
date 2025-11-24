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

  // Load data when modal opens
  useEffect(() => {
    if (!open) return;

    (async () => {
      try {
        const [leadData, templateData] = await Promise.all([
          EmailService.getLeads(),
          EmailService.getTemplates(),
        ]);

        setLeads(Array.isArray(leadData) ? leadData : []);
        setTemplates(Array.isArray(templateData) ? templateData : []);
      } catch (err) {
        console.error("Error loading email modal data", err);
        setLeads([]);
        setTemplates([]);
      }
    })();
  }, [open]);

  // 🔥 Called by LeadFormModalWrapper once lead is created
  const handleLeadCreated = async (newLead) => {
    try {
      const updatedLeads = await EmailService.getLeads();
      setLeads(Array.isArray(updatedLeads) ? updatedLeads : []);

      // Try to match by email (or any unique key your lead has)
      const matched =
        (Array.isArray(updatedLeads) &&
          updatedLeads.find((l) => l.email === newLead.email)) ||
        newLead;

      setSelectedLead(matched);
      setMode("existing"); // stay in existing lead mode (buttons still visible)
      setLeadFormOpen(false);
    } catch (err) {
      console.error("Error refreshing leads after new lead", err);
      setLeadFormOpen(false);
    }
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

          {/* Mode toggle – always visible */}
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

          {/* Existing Lead selector */}
          {mode === "existing" && (
            <Box mt={3}>
              <Typography>Select Lead</Typography>

              <Select
                fullWidth
                value={selectedLead?.email || ""}
                onChange={(e) => {
                  const lead = Array.isArray(leads)
                    ? leads.find((l) => l.email === e.target.value)
                    : null;
                  setSelectedLead(lead || null);
                }}
              >
                {Array.isArray(leads) &&
                  leads.map((l, index) => (
                    <MenuItem key={index} value={l.email}>
                      {l.firstName} {l.lastName} — {l.email}
                    </MenuItem>
                  ))}
              </Select>
            </Box>
          )}

          {/* Template selector */}
          <Box mt={3}>
            <Typography>Template</Typography>

            <Select
              fullWidth
              value={selectedTemplate?.id || ""}
              onChange={(e) => {
                const t = Array.isArray(templates)
                  ? templates.find((temp) => temp.id === e.target.value)
                  : null;
                setSelectedTemplate(t || null);
              }}
            >
              {Array.isArray(templates) &&
                templates.map((t) => (
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

          {/* Send */}
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

      {/* Lead Form modal (add lead) */}
      <LeadFormModalWrapper
        open={leadFormOpen}
        onClose={() => setLeadFormOpen(false)}
        onLeadCreated={handleLeadCreated}
      />
    </>
  );
}
