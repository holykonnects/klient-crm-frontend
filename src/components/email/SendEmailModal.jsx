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
import LeadFormModalWrapper from "./LeadFormModalWrapper";  // ⭐ NEW WRAPPER

export default function SendEmailModal({ open, onClose }) {

  const [mode, setMode] = useState("existing");
  const [leads, setLeads] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [subject, setSubject] = useState("");

  // Lead Form (Add Lead)
  const [leadFormOpen, setLeadFormOpen] = useState(false);

  // Load Leads + Templates
  useEffect(() => {
    EmailService.getLeads().then(setLeads);
    EmailService.getTemplates().then(setTemplates);
  }, []);

  // When a new Lead is created from LeadForm.js
  const handleLeadCreated = async (lead) => {
    // Refresh leads from backend
    const updatedLeads = await EmailService.getLeads();
    setLeads(updatedLeads);

    // Auto-select new lead
    setSelectedLead(lead);

    // Switch back to existing mode
    setMode("existing");
    setLeadFormOpen(false);
  };

  // Send email
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
      {/* ─────────────────────────────── */}
      {/*   MAIN SEND EMAIL MODAL        */}
      {/* ─────────────────────────────── */}
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <Box p={3} sx={{ fontFamily: "Montserrat, sans-serif" }}>

          <Typography variant="h6" fontWeight="bold">
            Send Email
          </Typography>

          {/* ─── Switch between Existing / New Lead ─── */}
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
                setLeadFormOpen(true);   // 🔥 Open LeadForm.js modal
              }}
            >
              New Lead
            </Button>
          </Stack>

          {/* ─── Existing Lead Dropdown ─── */}
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
                {leads.map((l, i) => (
                  <MenuItem value={l.email} key={i}>
                    {l.firstName} {l.lastName} — {l.email}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          )}

          {/* ─── Template Selector ─── */}
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
                <MenuItem value={t.id} key={t.id}>
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

          {/* ─── Subject Field ─── */}
          <TextField
            fullWidth
            label="Subject"
            sx={{ mt: 3 }}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          {/* ─── Send Button ─── */}
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

      {/* ─────────────────────────────── */}
      {/*   LEAD FORM MODAL (LeadForm.js) */}
      {/* ─────────────────────────────── */}
      <LeadFormModalWrapper
        open={leadFormOpen}
        onClose={() => setLeadFormOpen(false)}
        onLeadCreated={handleLeadCreated}
      />
    </>
  );
}
