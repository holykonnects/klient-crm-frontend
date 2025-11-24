import { useState, useEffect } from "react";
import {
  Box, Button, Dialog, TextField, Typography,
  Select, MenuItem, Stack
} from "@mui/material";
import EmailService from "./EmailService";
import TemplatePreviewModal from "./TemplatePreviewModal";

// 🔥 wrapper around your existing AddLeadModal (from LeadsTable.js)
import AddLeadModalForEmail from "./AddLeadModalForEmail";

export default function SendEmailModal({ open, onClose }) {

  const [mode, setMode] = useState("existing");
  const [leads, setLeads] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [subject, setSubject] = useState("");

  // NEW: external Add Lead modal
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [newlyCreatedLead, setNewlyCreatedLead] = useState(null);

  useEffect(() => {
    EmailService.getLeads().then(setLeads);
    EmailService.getTemplates().then(setTemplates);
  }, []);

  // 🚀 When a new lead is created from AddLead modal
  const handleLeadCreated = async (lead) => {
    setNewlyCreatedLead(lead);

    // Refresh leads
    const updated = await EmailService.getLeads();
    setLeads(updated);

    // Auto-select new lead
    setSelectedLead(lead);
    setMode("existing");

    setLeadModalOpen(false);
  };

  const sendEmail = async () => {
    if (!selectedLead || !selectedTemplate) {
      alert("Please select Lead & Template");
      return;
    }

    await EmailService.sendEmail({
      to: selectedLead.email,
      subject,
      templateId: selectedTemplate.id,
      placeholders: selectedLead
    });

    alert("Email Sent!");
    onClose();
  };

  return (
    <>
      {/* MAIN SEND EMAIL MODAL */}
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <Box p={3} sx={{ fontFamily: "Montserrat, sans-serif" }}>

          <Typography variant="h6" fontWeight="bold">Send Email</Typography>

          {/* MODE SWITCH */}
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
                setLeadModalOpen(true);
              }}
            >
              New Lead
            </Button>
          </Stack>

          {/* EXISTING LEAD SELECTOR */}
          {mode === "existing" && (
            <Box mt={3}>
              <Typography>Choose Lead</Typography>
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

          {/* TEMPLATE SELECTOR */}
          <Box mt={3}>
            <Typography>Template</Typography>
            <Select
              fullWidth
              value={selectedTemplate?.id || ""}
              onChange={(e) => {
                const t = templates.find((t) => t.id === e.target.value);
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
              <Button
                size="small"
                sx={{ mt: 1 }}
                onClick={() => setPreviewOpen(true)}
              >
                Preview Template
              </Button>
            )}
          </Box>

          {/* SUBJECT */}
          <TextField
            fullWidth
            label="Subject"
            sx={{ mt: 3 }}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          {/* SEND */}
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

        {/* TEMPLATE PREVIEW */}
        {selectedTemplate && (
          <TemplatePreviewModal
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
            templateId={selectedTemplate.id}
          />
        )}
      </Dialog>

      {/* FULL ADD LEAD MODAL (from LeadsTable.js) */}
      <AddLeadModalForEmail
        open={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        onLeadCreated={handleLeadCreated}
      />
    </>
  );
}
