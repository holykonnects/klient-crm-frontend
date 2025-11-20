import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  Typography,
  MenuItem,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useAuth } from "../AuthContext";

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzPNVeqRlTRcb_sCa_PU_EGW_EW8uZ9ClevCQRcKfa5KYR5-OpGyzp1Wsw4Sxb_x2vfqg/exec";

const cornflowerBlue = "#6495ED";

export default function SendEmailModal({ open, onClose }) {
  const { user } = useAuth();

  // -------------------------
  // STATE
  // -------------------------
  const [loading, setLoading] = useState(false);

  const [recipientType, setRecipientType] = useState("Lead");
  const [recipientList, setRecipientList] = useState([]);

  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState(null);

  const [templates, setTemplates] = useState([]);

  // Form Fields - New Lead or Override
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    company: "",
    leadSource: "",
    leadStatus: "",
    remarks: "",
  });

  // Dropdowns
  const [leadSources, setLeadSources] = useState([]);
  const [leadStatuses, setLeadStatuses] = useState([]);

  // HTML preview
  const [previewHtml, setPreviewHtml] = useState("");

  // -------------------------
  // LOAD TEMPLATES + VALIDATION OPTIONS
  // -------------------------
  useEffect(() => {
    if (open) {
      loadTemplates();
      loadValidationData();
      loadRecipients();
    }
  }, [open, recipientType]);

  const loadTemplates = async () => {
    try {
      const res = await fetch(`${GAS_URL}?action=getTemplates`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.data)) {
        setTemplates(data.data);
      } else {
        setTemplates([]);
      }
    } catch (err) {
      console.error("Template load error:", err);
      setTemplates([]);
    }
  };

  // Load LeadSource + LeadStatus from Validation Sheet
  const loadValidationData = async () => {
    try {
      const res = await fetch(
        `${GAS_URL}?action=getEmailValidationTables`
      );
      const data = await res.json();

      setLeadSources(
        Array.isArray(data.leadSources) ? data.leadSources : []
      );
      setLeadStatuses(
        Array.isArray(data.leadStatuses) ? data.leadStatuses : []
      );
    } catch (err) {
      console.error("Validation load error:", err);
    }
  };

  // Load recipient list (Lead / Account / Deal)
  const loadRecipients = async () => {
    let action = "getLeads";

    if (recipientType === "Account") action = "getAccounts";
    if (recipientType === "Deal") action = "getDeals";

    try {
      const res = await fetch(`${GAS_URL}?action=${action}`);
      const data = await res.json();

      setRecipientList(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error("Recipient load error:", err);
      setRecipientList([]);
    }
  };

  // -------------------------
  // HANDLE SELECT RECIPIENT
  // -------------------------
  const handleSelectRecipient = (id) => {
    const match = recipientList.find((r) => r.id === id);
    if (match) {
      setSelectedRecipient(match);

      setForm((f) => ({
        ...f,
        firstName: match.firstName || "",
        lastName: match.lastName || "",
        email: match.email || "",
        mobile: match.mobile || "",
        company: match.company || "",
      }));
    }
  };

  // -------------------------
  // TEMPLATE PREVIEW + PLACEHOLDER REPLACE
  // -------------------------
  const applyPlaceholders = (html) => {
    if (!html) return "";

    let result = html;

    const placeholders = {
      "First Name": form.firstName,
      "Last Name": form.lastName,
      Email: form.email,
      Mobile: form.mobile,
      Company: form.company,
      "Lead Source": form.leadSource,
      "Lead Status": form.leadStatus,
      Remarks: form.remarks,
      "Lead Owner": user?.username || "",
    };

    Object.entries(placeholders).forEach(([key, value]) => {
      const token = `{{${key}}}`;
      result = result.replaceAll(token, value || "");
    });

    return result;
  };

  const handleTemplateSelect = async (templateId) => {
    try {
      const url = `${GAS_URL}?action=previewTemplate&id=${templateId}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.ok) {
        const html = applyPlaceholders(data.html);
        setPreviewHtml(html);
      }
    } catch (err) {
      console.error("Preview load error:", err);
      setPreviewHtml("");
    }
  };

  // -------------------------
  // SUBMIT (NO-CORS SAFE)
  // -------------------------
  const handleSend = async () => {
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("action", "sendEmail");

      Object.entries(form).forEach(([k, v]) => fd.append(k, v || ""));
      fd.append("html", previewHtml);
      fd.append("recipientType", recipientType);
      fd.append("owner", user?.username || "");

      await fetch(GAS_URL, {
        method: "POST",
        mode: "no-cors",
        body: fd,
      });

      alert("Email sent successfully!");
      onClose();
    } catch (err) {
      console.error("Send error:", err);
      alert("Error sending email.");
    }

    setLoading(false);
  };

  // -------------------------
  // RENDERING
  // -------------------------
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle
        sx={{
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 700,
          color: cornflowerBlue,
        }}
      >
        Send Email
      </DialogTitle>

      <DialogContent>
        {/* Recipient Type */}
        <Typography sx={{ mt: 1, fontWeight: 600 }}>
          Select Recipient Type
        </Typography>
        <TextField
          select
          fullWidth
          value={recipientType}
          onChange={(e) => setRecipientType(e.target.value)}
          sx={{ mt: 1 }}
        >
          <MenuItem value="Lead">Lead</MenuItem>
          <MenuItem value="Account">Account</MenuItem>
          <MenuItem value="Deal">Deal</MenuItem>
          <MenuItem value="New Lead">New Lead</MenuItem>
        </TextField>

        {/* EXISTING RECIPIENT SEARCH */}
        {recipientType !== "New Lead" && (
          <>
            <Typography sx={{ mt: 2, fontWeight: 600 }}>
              Search Recipient
            </Typography>
            <TextField
              fullWidth
              placeholder="Search by name, company or mobile..."
              value={recipientSearch}
              onChange={(e) => setRecipientSearch(e.target.value)}
              sx={{ mt: 1 }}
            />

            <TextField
              select
              fullWidth
              sx={{ mt: 2 }}
              value={selectedRecipient?.id || ""}
              onChange={(e) => handleSelectRecipient(e.target.value)}
            >
              {(Array.isArray(recipientList) ? recipientList : []).map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.company} | {r.firstName} {r.lastName} | {r.mobile}
                </MenuItem>
              ))}
            </TextField>
          </>
        )}

        {/* ---------------------------------------------- */}
        {/* NEW LEAD FORM (Option A) */}
        {/* ---------------------------------------------- */}
        {recipientType === "New Lead" && (
          <Box sx={{ mt: 3 }}>
            {/* BASIC DETAILS */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={600}>Basic Details</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <TextField
                    label="First Name"
                    fullWidth
                    required
                    value={form.firstName}
                    onChange={(e) =>
                      setForm({ ...form, firstName: e.target.value })
                    }
                  />
                  <TextField
                    label="Last Name"
                    fullWidth
                    required
                    value={form.lastName}
                    onChange={(e) =>
                      setForm({ ...form, lastName: e.target.value })
                    }
                  />
                  <TextField
                    label="Email"
                    fullWidth
                    required
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* CLASSIFICATION */}
            <Accordion defaultExpanded sx={{ mt: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={600}>Lead Classification</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {/* Lead Source */}
                  <TextField
                    select
                    label="Lead Source"
                    fullWidth
                    required
                    value={form.leadSource}
                    onChange={(e) =>
                      setForm({ ...form, leadSource: e.target.value })
                    }
                  >
                    {(Array.isArray(leadSources) ? leadSources : []).map(
                      (s) => (
                        <MenuItem key={s} value={s}>
                          {s}
                        </MenuItem>
                      )
                    )}
                  </TextField>

                  {/* Lead Status */}
                  <TextField
                    select
                    label="Lead Status"
                    fullWidth
                    required
                    value={form.leadStatus}
                    onChange={(e) =>
                      setForm({ ...form, leadStatus: e.target.value })
                    }
                  >
                    {(Array.isArray(leadStatuses) ? leadStatuses : []).map(
                      (s) => (
                        <MenuItem key={s} value={s}>
                          {s}
                        </MenuItem>
                      )
                    )}
                  </TextField>

                  <TextField
                    label="Remarks"
                    fullWidth
                    multiline
                    rows={2}
                    value={form.remarks}
                    onChange={(e) =>
                      setForm({ ...form, remarks: e.target.value })
                    }
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Box>
        )}

        {/* ---------------------------------------------- */}
        {/* TEMPLATE SELECTION */}
        {/* ---------------------------------------------- */}
        <Typography sx={{ mt: 3, fontWeight: 600 }}>
          Choose Template
        </Typography>
        <TextField
          select
          fullWidth
          sx={{ mt: 1 }}
          onChange={(e) => handleTemplateSelect(e.target.value)}
        >
          {(Array.isArray(templates) ? templates : []).map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.name}
            </MenuItem>
          ))}
        </TextField>

        {/* PREVIEW */}
        <Typography sx={{ mt: 3, fontWeight: 600 }}>Preview</Typography>
        <Box
          sx={{
            mt: 1,
            border: "1px solid #ddd",
            padding: 2,
            height: 250,
            overflowY: "auto",
            background: "#fff",
          }}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} sx={{ fontWeight: 600 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          sx={{
            background: cornflowerBlue,
            fontWeight: 600,
            "&:hover": { background: "#567cd2" },
          }}
          onClick={handleSend}
          disabled={loading}
        >
          {loading ? (
            <CircularProgress size={22} sx={{ color: "#fff" }} />
          ) : (
            "Send Email"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
