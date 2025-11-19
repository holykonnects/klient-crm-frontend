import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Button,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Stack,
  CircularProgress,
  IconButton,
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzPNVeqRlTRcb_sCa_PU_EGW_EW8uZ9ClevCQRcKfa5KYR5-OpGyzp1Wsw4Sxb_x2vfqg/exec";

export default function SendEmailModal({ open, onClose, user = {} }) {
  const [mode, setMode] = useState("existing"); // "existing" or "new"
  const [leadOwner, setLeadOwner] = useState(""); // correct owner fetched from CRM Login
  const [templates, setTemplates] = useState([]);
  const [leads, setLeads] = useState([]);
  const [validation, setValidation] = useState({ leadSources: [], leadStatuses: [] });

  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [previewHtml, setPreviewHtml] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  /*********************************************************
   * ✅ STEP 1 — FETCH LEAD OWNER (from CRM Login sheet)
   *********************************************************/
  useEffect(() => {
    if (!open) return;

    async function fetchOwner() {
      try {
        const res = await fetch(
          `${WEBAPP_URL}?action=getLeadOwnerByEmail&email=${encodeURIComponent(
            user.email
          )}`
        );
        const json = await res.json();
        if (json.ok) {
          setLeadOwner(json.leadOwner);
        } else {
          setLeadOwner(user.email); // fallback
        }
      } catch (err) {
        console.error("Lead owner fetch error", err);
        setLeadOwner(user.email);
      }
    }

    fetchOwner();
  }, [open, user.email]);

  /*********************************************************
   * ✅ STEP 2 — LOAD EXISTING LEADS (filtered by Lead Owner)
   *********************************************************/
  async function loadExistingLeads(ownerName) {
    if (!ownerName) return;

    try {
      const res = await fetch(
        `${WEBAPP_URL}?action=getExistingLeads&owner=${encodeURIComponent(
          ownerName
        )}`
      );
      const json = await res.json();

      if (json.ok) {
        setLeads(json.data || []);
      } else {
        setLeads([]);
      }
    } catch (err) {
      console.error("Lead load error", err);
      setLeads([]);
    }
  }

  /*********************************************************
   * ✅ STEP 3 — LOAD TEMPLATES FROM GOOGLE DOCS FOLDER
   *********************************************************/
  async function loadTemplates() {
    try {
      const res = await fetch(`${WEBAPP_URL}?action=listTemplates`);
      const json = await res.json();
      if (json.ok) setTemplates(json.data || []);
    } catch (err) {
      console.error("Template load error:", err);
    }
  }

  /*********************************************************
   * ✅ STEP 4 — LOAD LEAD VALIDATION TABLES
   *********************************************************/
  async function loadValidation() {
    try {
      const res = await fetch(`${WEBAPP_URL}?action=getLeadValidation`);
      const json = await res.json();
      if (json.ok) setValidation(json.data);
    } catch (err) {
      console.error("Validation load error:", err);
    }
  }

  /*********************************************************
   * Load everything when modal opens
   *********************************************************/
  useEffect(() => {
    if (!open) return;

    loadTemplates();
    loadValidation();
    if (leadOwner) loadExistingLeads(leadOwner);
  }, [open, leadOwner]);

  /*********************************************************
   * NEW LEAD FORM STATE
   *********************************************************/
  const [newLead, setNewLead] = useState({
    "Lead Owner": "",
    "First Name": "",
    "Last Name": "",
    Company: "",
    "Mobile Number": "",
    "Email ID": "",
    Fax: "",
    Website: "",
    "Lead Source": "",
    "Lead Status": "",
    Industry: "",
    "Number of Employees": "",
    Requirement: "",
    "Social Media": "",
    Description: "",
    Street: "",
    City: "",
    State: "",
    Country: "",
    PinCode: "",
    "Additional Description/Remarks": "",
  });

  // Update new lead when owner is fetched
  useEffect(() => {
    if (leadOwner) {
      setNewLead((prev) => ({ ...prev, "Lead Owner": leadOwner }));
    }
  }, [leadOwner]);

  const updateNewLead = (key, val) => {
    setNewLead((prev) => ({ ...prev, [key]: val }));
  };

  /*********************************************************
   * PREVIEW TEMPLATE
   *********************************************************/
  const handlePreview = async () => {
    if (!selectedTemplateId) return alert("Select a template.");

    try {
      const res = await fetch(
        `${WEBAPP_URL}?action=previewTemplate`,
        {
          method: "POST",
          body: JSON.stringify({
            templateId: selectedTemplateId,
            lead:
              mode === "existing"
                ? leads.find((l) => l.id === selectedLeadId) || {}
                : newLead,
          }),
        }
      );

      const json = await res.json();
      setPreviewHtml(json.html || "<p>No preview available</p>");
      setPreviewOpen(true);
    } catch (err) {
      console.error("Preview error:", err);
      alert("Failed to preview template.");
    }
  };

  /*********************************************************
   * CREATE NEW LEAD
   *********************************************************/
  const submitNewLead = async () => {
    if (!newLead["Lead Source"])
      return alert("Lead Source is mandatory.");
    if (!newLead["Lead Status"])
      return alert("Lead Status is mandatory.");

    setLoading(true);

    try {
      const res = await fetch(WEBAPP_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "createLead",
          data: newLead,
        }),
      });

      const json = await res.json();
      setLoading(false);

      if (!json.ok) {
        alert("Lead creation failed.");
        return;
      }

      alert("Lead created!");
      setSelectedLeadId(json.lead["Lead ID"]);
      setMode("existing");

      loadExistingLeads(leadOwner);
    } catch (err) {
      setLoading(false);
      alert("Error creating lead.");
    }
  };

  /*********************************************************
   * SEND EMAIL
   *********************************************************/
  const sendEmail = async () => {
    if (!selectedLeadId) return alert("Select a lead.");
    if (!selectedTemplateId) return alert("Select a template.");

    setLoading(true);

    try {
      const res = await fetch(WEBAPP_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "sendEmail",
          templateId: selectedTemplateId,
          leadId: selectedLeadId,
          sender: user.email,
        }),
      });

      const json = await res.json();
      setLoading(false);

      if (!json.ok) {
        alert("Email sending failed.");
        return;
      }

      alert("Email sent!");
      onClose();
    } catch (err) {
      setLoading(false);
      alert("Email failed.");
    }
  };

  /*********************************************************
   * UI STARTS HERE
   *********************************************************/
  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle
          sx={{
            fontFamily: "Montserrat",
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 600,
          }}
        >
          Send Email
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ fontFamily: "Montserrat" }}>
          {/* MODE SWITCH */}
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Button
              variant={mode === "existing" ? "contained" : "outlined"}
              onClick={() => setMode("existing")}
              sx={{ textTransform: "none" }}
            >
              Existing Lead
            </Button>
            <Button
              variant={mode === "new" ? "contained" : "outlined"}
              onClick={() => setMode("new")}
              sx={{ textTransform: "none" }}
            >
              New Lead
            </Button>
          </Stack>

          {/* EXISTING LEAD */}
          {mode === "existing" && (
            <TextField
              select
              fullWidth
              label="Select Lead"
              value={selectedLeadId}
              sx={{ mb: 2 }}
              onChange={(e) => setSelectedLeadId(e.target.value)}
            >
              {leads.map((l) => (
                <MenuItem key={l.id} value={l.id}>
                  {l.firstName} {l.lastName} — {l.company}
                </MenuItem>
              ))}
            </TextField>
          )}

          {/* NEW LEAD ACCORDIONS */}
          {mode === "new" && (
            <>
              {/* CONTACT */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={600}>Contact Details</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <TextField
                      label="Lead Owner"
                      value={newLead["Lead Owner"]}
                      InputProps={{ readOnly: true }}
                    />
                    <Stack direction="row" spacing={2}>
                      <TextField
                        label="First Name"
                        fullWidth
                        value={newLead["First Name"]}
                        onChange={(e) =>
                          updateNewLead("First Name", e.target.value)
                        }
                      />
                      <TextField
                        label="Last Name"
                        fullWidth
                        value={newLead["Last Name"]}
                        onChange={(e) =>
                          updateNewLead("Last Name", e.target.value)
                        }
                      />
                    </Stack>
                    <Stack direction="row" spacing={2}>
                      <TextField
                        label="Mobile Number"
                        fullWidth
                        value={newLead["Mobile Number"]}
                        onChange={(e) =>
                          updateNewLead("Mobile Number", e.target.value)
                        }
                      />
                      <TextField
                        label="Email ID"
                        fullWidth
                        value={newLead["Email ID"]}
                        onChange={(e) =>
                          updateNewLead("Email ID", e.target.value)
                        }
                      />
                    </Stack>
                  </Stack>
                </AccordionDetails>
              </Accordion>

              {/* BUSINESS */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={600}>Business Details</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <TextField
                      label="Company"
                      fullWidth
                      value={newLead.Company}
                      onChange={(e) =>
                        updateNewLead("Company", e.target.value)
                      }
                    />
                    <Stack direction="row" spacing={2}>
                      <TextField
                        label="Industry"
                        fullWidth
                        value={newLead.Industry}
                        onChange={(e) =>
                          updateNewLead("Industry", e.target.value)
                        }
                      />
                      <TextField
                        label="Number of Employees"
                        fullWidth
                        value={newLead["Number of Employees"]}
                        onChange={(e) =>
                          updateNewLead(
                            "Number of Employees",
                            e.target.value
                          )
                        }
                      />
                    </Stack>
                    <TextField
                      label="Website"
                      fullWidth
                      value={newLead.Website}
                      onChange={(e) =>
                        updateNewLead("Website", e.target.value)
                      }
                    />
                  </Stack>
                </AccordionDetails>
              </Accordion>

              {/* LEAD DETAILS */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={600}>Lead Details</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={2}>
                      <TextField
                        select
                        fullWidth
                        label="Lead Source"
                        value={newLead["Lead Source"]}
                        onChange={(e) =>
                          updateNewLead("Lead Source", e.target.value)
                        }
                      >
                        {validation.leadSources.map((src) => (
                          <MenuItem key={src} value={src}>
                            {src}
                          </MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        select
                        fullWidth
                        label="Lead Status"
                        value={newLead["Lead Status"]}
                        onChange={(e) =>
                          updateNewLead("Lead Status", e.target.value)
                        }
                      >
                        {validation.leadStatuses.map((st) => (
                          <MenuItem key={st} value={st}>
                            {st}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>

                    <TextField
                      label="Description"
                      fullWidth
                      multiline
                      rows={3}
                      value={newLead.Description}
                      onChange={(e) =>
                        updateNewLead("Description", e.target.value)
                      }
                    />
                  </Stack>
                </AccordionDetails>
              </Accordion>

              {/* ADDRESS */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={600}>Address Details</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <TextField
                      label="Street"
                      fullWidth
                      value={newLead.Street}
                      onChange={(e) =>
                        updateNewLead("Street", e.target.value)
                      }
                    />

                    <Stack direction="row" spacing={2}>
                      <TextField
                        label="City"
                        fullWidth
                        value={newLead.City}
                        onChange={(e) =>
                          updateNewLead("City", e.target.value)
                        }
                      />
                      <TextField
                        label="State"
                        fullWidth
                        value={newLead.State}
                        onChange={(e) =>
                          updateNewLead("State", e.target.value)
                        }
                      />
                    </Stack>

                    <Stack direction="row" spacing={2}>
                      <TextField
                        label="Country"
                        fullWidth
                        value={newLead.Country}
                        onChange={(e) =>
                          updateNewLead("Country", e.target.value)
                        }
                      />
                      <TextField
                        label="PinCode"
                        fullWidth
                        value={newLead.PinCode}
                        onChange={(e) =>
                          updateNewLead("PinCode", e.target.value)
                        }
                      />
                    </Stack>
                  </Stack>
                </AccordionDetails>
              </Accordion>

              <Box textAlign="right" sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={submitNewLead}
                  disabled={loading}
                  sx={{ background: "#6495ED", textTransform: "none" }}
                >
                  {loading ? <CircularProgress size={22} /> : "Create Lead"}
                </Button>
              </Box>
            </>
          )}

          {/* TEMPLATE SELECT */}
          <TextField
            select
            fullWidth
            sx={{ mt: 3 }}
            label="Select Template"
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
          >
            {templates.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>

          {/* ACTIONS */}
          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button variant="outlined" onClick={handlePreview}>
              Preview
            </Button>

            <Button
              variant="contained"
              sx={{ background: "#6495ED" }}
              disabled={!selectedLeadId || !selectedTemplateId}
              onClick={sendEmail}
            >
              Send Email
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* PREVIEW MODAL */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Template Preview</DialogTitle>
        <DialogContent>
          <Box
            dangerouslySetInnerHTML={{ __html: previewHtml }}
            sx={{
              p: 2,
              border: "1px solid #ccc",
              borderRadius: "6px",
              fontFamily: "Montserrat",
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
