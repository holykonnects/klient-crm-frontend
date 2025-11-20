import { useState, useEffect } from "react";
import {
  Box, Button, Dialog, TextField, Typography,
  Select, MenuItem, Divider, Stack
} from "@mui/material";
import EmailService from "./EmailService";
import TemplatePreviewModal from "./TemplatePreviewModal";

export default function SendEmailModal({ open, onClose }) {

  const [mode, setMode] = useState("existing");
  const [leads, setLeads] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [subject, setSubject] = useState("");

  const [newLead, setNewLead] = useState({
    firstName: "",
    lastName: "",
    email: "",
    leadSource: "",
    remarks: ""
  });

  useEffect(() => {
    EmailService.getLeads().then(setLeads);
    EmailService.getTemplates().then(setTemplates);
  }, []);

  const sendEmail = async () => {
    const payload =
      mode === "existing"
        ? selectedLead
        : newLead;

    if (mode === "new") {
      await EmailService.createLead(newLead);
    }

    await EmailService.sendEmail({
      to: payload.email,
      subject,
      templateId: selectedTemplate.id,
      placeholders: payload
    });

    alert("Email Sent!");
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box p={3} sx={{ fontFamily: "Montserrat, sans-serif" }}>

        <Typography variant="h6" fontWeight="bold">Send Email</Typography>

        <Stack direction="row" spacing={2} mt={2}>
          <Button
            variant={mode === "existing" ? "contained" : "outlined"}
            onClick={() => setMode("existing")}
          >
            Existing Lead
          </Button>

          <Button
            variant={mode === "new" ? "contained" : "outlined"}
            onClick={() => setMode("new")}
          >
            New Lead
          </Button>
        </Stack>

        {/* Existing Lead */}
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

        {/* New Lead */}
        {mode === "new" && (
          <Box mt={3}>
            <TextField
              fullWidth
              label="First Name"
              sx={{ mb: 2 }}
              value={newLead.firstName}
              onChange={(e) => setNewLead({ ...newLead, firstName: e.target.value })}
            />

            <TextField
              fullWidth
              label="Last Name"
              sx={{ mb: 2 }}
              value={newLead.lastName}
              onChange={(e) => setNewLead({ ...newLead, lastName: e.target.value })}
            />

            <TextField
              fullWidth
              label="Email"
              sx={{ mb: 2 }}
              value={newLead.email}
              onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
            />

            <TextField
              fullWidth
              label="Lead Source"
              sx={{ mb: 2 }}
              value={newLead.leadSource}
              onChange={(e) => setNewLead({ ...newLead, leadSource: e.target.value })}
            />

            <TextField
              fullWidth
              multiline
              rows={2}
              label="Remarks"
              value={newLead.remarks}
              onChange={(e) => setNewLead({ ...newLead, remarks: e.target.value })}
            />
          </Box>
        )}

        {/* Template Selector */}
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

        {/* Subject */}
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
        >
          Send Email
        </Button>

      </Box>

      {/* Preview Modal */}
      {selectedTemplate && (
        <TemplatePreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          templateId={selectedTemplate.id}
        />
      )}
    </Dialog>
  );
}
