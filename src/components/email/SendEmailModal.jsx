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

  // Load leads and templates when the modal opens
  useEffect(() => {
    if (!open) return;

    (async () => {
      const fetchedLeads = await EmailService.getLeads();
      const fetchedTemplates = await EmailService.getTemplates();

      setLeads(Array.isArray(fetchedLeads) ? fetchedLeads : []);
      setTemplates(Array.isArray(fetchedTemplates) ? fetchedTemplates : []);
    })();
  }, [open]);

  // ⭐ NEW WORKFLOW — no wait for GAS sync
  const handleLeadCreated = (leadFromForm) => {
    // 1️⃣ Create a temporary lead entry
    const tempLead = {
      firstName: leadFromForm.firstName || "",
      lastName: leadFromForm.lastName || "",
      email: leadFromForm.email || "",
      leadSource: leadFromForm.leadSource || "",
      remarks: leadFromForm.remarks || "",
      isNew: true
    };

    // 2️⃣ Insert at top of list
    setLeads(prev => [tempLead, ...prev]);

    // 3️⃣ Auto-select the newly added lead
    setSelectedLead(tempLead);

    // 4️⃣ Force back to Existing Lead view
    setMode("existing");

    // 5️⃣ Close the Add Lead modal
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
      {/* ───────── SEND EMAIL MODAL ───────── */}
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <Box p={3} sx={{ fontFamily: "Montserrat, sans-serif" }}>

          <Typography variant="h6" fontWeight="bold">
            Send Email
          </Typography>

          {/* Mode Switch */}
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
                {leads.map((l, i) => (
                  <MenuItem key={i} value={l.email}>
                    {l.firstName} {l.lastName} — {l.email}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          )}

          {/* Template Selector */}
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
              <Button size="small" sx={{ mt: 1 }} onClick={() => setPreviewOpen(true)}>
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

        {/* Template Preview Modal */}
        {selectedTemplate && (
          <TemplatePreviewModal
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
            templateId={selectedTemplate.id}
          />
        )}
      </Dialog>

      {/* ───────── LEAD FORM MODAL ───────── */}
      <LeadFormModalWrapper
        open={leadFormOpen}
        onClose={() => setLeadFormOpen(false)}
        onLeadCreated={handleLeadCreated}
      />
    </>
  );
}
