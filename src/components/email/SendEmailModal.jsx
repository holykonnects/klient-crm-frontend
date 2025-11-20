import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Typography,
  Box,
  CircularProgress,
} from "@mui/material";

const endpoint =
  "https://script.google.com/macros/s/AKfycbzPNVeqRlTRcb_sCa_PU_EGW_EW8uZ9ClevCQRcKfa5KYR5-OpGyzp1Wsw4Sxb_x2vfqg/exec";

/********************************************
 * SAFE JSON PARSER
 ********************************************/
async function safeJSON(res) {
  try {
    const text = await res.text();
    return JSON.parse(text);
  } catch (err) {
    console.warn("JSON parse failed:", err);
    return { ok: false, error: "parse_failed" };
  }
}

export default function SendEmailModal({ open, onClose }) {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [leads, setLeads] = useState([]);
  const [validation, setValidation] = useState({
    leadSources: [],
    leadStatuses: [],
  });

  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedLead, setSelectedLead] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const userEmail = localStorage.getItem("email") || ""; // real login email

  /********************************************
   * LOAD DASHBOARD ON OPEN
   ********************************************/
  useEffect(() => {
    if (!open) return;

    async function load() {
      setLoading(true);

      const url =
        endpoint +
        "?action=loadEmailDashboard&user=" +
        encodeURIComponent(userEmail);

      const res = await fetch(url, { method: "GET", mode: "no-cors" });
      const json = await safeJSON(res);

      if (json.ok && json.data) {
        setTemplates(json.data.templates || []);
        setLeads(json.data.leads || []);
        setValidation(json.data.validation || {});
      } else {
        console.warn("Dashboard load failed:", json.error);
      }

      setLoading(false);
    }

    load();
  }, [open]);

  /********************************************
   * LOAD TEMPLATE HTML FOR PREVIEW
   ********************************************/
  async function loadPreview() {
    if (!selectedTemplate) return;

    const url =
      endpoint +
      "?action=getTemplateHtml&templateId=" +
      encodeURIComponent(selectedTemplate);

    const res = await fetch(url, { method: "GET", mode: "no-cors" });
    const json = await safeJSON(res);

    if (json.ok) {
      setPreviewHtml(json.html || "");
      setPreviewOpen(true);
    } else {
      alert("Template preview failed: " + json.error);
    }
  }

  /********************************************
   * SEND EMAIL
   ********************************************/
  async function sendEmail() {
    if (!selectedTemplate || !selectedLead) {
      alert("Select template and lead!");
      return;
    }

    setSending(true);

    const payload = {
      action: "sendEmail",
      templateId: selectedTemplate,
      leadId: selectedLead,
      userEmail,
    };

    const res = await fetch(endpoint, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(payload),
    });

    const json = await safeJSON(res);

    setSending(false);

    if (json.ok) {
      alert("Email sent!");
      onClose();
    } else {
      alert("Send failed: " + json.error);
    }
  }

  /********************************************
   * UI
   ********************************************/
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}
      >
        Send Email
      </DialogTitle>

      <DialogContent sx={{ py: 2 }}>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 4 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              select
              label="Select Template"
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              fullWidth
            >
              {templates.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Select Lead"
              value={selectedLead}
              onChange={(e) => setSelectedLead(e.target.value)}
              fullWidth
            >
              {leads.map((l) => (
                <MenuItem key={l["Lead ID"]} value={l["Lead ID"]}>
                  {`${l.Company || ""} | ${l["First Name"] || ""} ${
                    l["Last Name"] || ""
                  } | ${l["Mobile Number"] || ""}`}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>

        <Button
          disabled={!selectedTemplate}
          onClick={loadPreview}
          sx={{ color: "#6495ED", fontWeight: 600 }}
        >
          Preview
        </Button>

        <Button
          disabled={!selectedTemplate || !selectedLead || sending}
          onClick={sendEmail}
          variant="contained"
          sx={{ background: "#6495ED", fontWeight: 600 }}
        >
          {sending ? "Sending..." : "Send"}
        </Button>
      </DialogActions>

      {/* PREVIEW MODAL */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Preview Email</DialogTitle>
        <DialogContent dividers>
          <Box
            sx={{ border: "1px solid #ddd", p: 2 }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
