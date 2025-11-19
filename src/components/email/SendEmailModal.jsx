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

// --- YOUR APPS SCRIPT ENDPOINT ---
const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzPNVeqRlTRcb_sCa_PU_EGW_EW8uZ9ClevCQRcKfa5KYR5-OpGyzp1Wsw4Sxb_x2vfqg/exec";

export default function SendEmailModal({ open, onClose, user }) {
  const [mode, setMode] = useState("existing"); // existing | new
  const [templates, setTemplates] = useState([]);
  const [leads, setLeads] = useState([]);
  const [validation, setValidation] = useState({
    leadSources: [],
    leadStatuses: [],
  });

  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [previewHtml, setPreviewHtml] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const [loading, setLoading] = useState(false);

  // --- NEW LEAD FORM STATE (Option A – ACCORDIONS) ---
  const [newLead, setNewLead] = useState({
    "Lead Owner": user?.username || "",
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

  const updateNewLead = (key, value) => {
    setNewLead((prev) => ({ ...prev, [key]: value }));
  };

  // --- FETCH TEMPLATES ---
  const loadTemplates = async () => {
    try {
      const res = await fetch(`${WEBAPP_URL}?action=getTemplates`);
      const json = await res.json();
      if (json.ok) setTemplates(json.data || []);
    } catch (e) {
      console.error("Template load error:", e);
    }
  };

  // --- FETCH EXISTING LEADS ---
  const loadLeads = async () => {
    try {
      const res = await fetch(`${WEBAPP_URL}?action=getLeads&user=${user.username}`);
      const json = await res.json();
      if (json.ok) setLeads(json.data || []);
    } catch (e) {
      console.error("Lead load error:", e);
    }
  };

  // --- FETCH VALIDATION (Lead Source + Lead Status) ---
  const loadValidation = async () => {
    try {
      const res = await fetch(`${WEBAPP_URL}?action=getLeadValidation`);
      const json = await res.json();
      if (json.ok) setValidation(json.data);
    } catch (e) {
      console.error("Validation load error:", e);
    }
  };

  useEffect(() => {
    if (open) {
      loadTemplates();
      loadLeads();
      loadValidation();
    }
  }, [open]);

  // --- LOAD TEMPLATE PREVIEW ---
  const handlePreview = async () => {
    if (!selectedTemplateId) return alert("Select a template first.");

    const res = await fetch(
      `${WEBAPP_URL}?action=getTemplateHtml&templateId=${selectedTemplateId}`
    );

    const json = await res.json();
    if (!json.ok) return alert("Template load failed.");

    let html = json.html;

    // --- Placeholder fill ---
    let dataObj =
      mode === "existing"
        ? leads.find((l) => l["Lead ID"] === selectedLeadId)
        : newLead;

    if (!dataObj) return alert("Lead data missing.");

    Object.keys(dataObj).forEach((key) => {
      const placeholder = `{{${key}}}`;
      html = html.replaceAll(placeholder, dataObj[key] || "");
    });

    setPreviewHtml(html);
    setPreviewOpen(true);
  };

  // --- CREATE NEW LEAD ---
  const submitNewLead = async () => {
    if (!newLead["Lead Source"]) return alert("Lead Source is mandatory.");
    if (!newLead["Lead Status"]) return alert("Lead Status is mandatory.");

    setLoading(true);

    const res = await fetch(WEBAPP_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "createLead",
        data: newLead,
      }),
    });

    const json = await res.json();
    setLoading(false);

    if (!json.ok) return alert("Failed to create lead.");

    alert("Lead created successfully!");

    // Insert new created lead ID into flow
    setSelectedLeadId(json.lead["Lead ID"]);
    setMode("existing");

    loadLeads();
  };

  // --- SEND EMAIL ---
  const sendEmail = async () => {
    if (!selectedTemplateId) return alert("Select a template.");
    if (!selectedLeadId) return alert("Select a lead.");

    setLoading(true);

    const res = await fetch(WEBAPP_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "sendEmail",
        templateId: selectedTemplateId,
        leadId: selectedLeadId,
        userEmail: user.email,
      }),
    });

    const json = await res.json();
    setLoading(false);

    if (!json.ok) return alert("Email failed.");

    alert("Email sent successfully!");
    onClose();
  };

  // --- UI ---
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
          {/* Mode Switch */}
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

          {/* ---------------------------- */}
          {/* EXISTING LEAD MODE           */}
          {/* ---------------------------- */}
          {mode === "existing" && (
            <>
              <TextField
                select
                fullWidth
                label="Select Lead"
                sx={{ mb: 2 }}
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
              >
                {leads.map((l) => (
                  <MenuItem key={l["Lead ID"]} value={l["Lead ID"]}>
                    {l["First Name"]} {l["Last Name"]} — {l.Company}
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}

          {/* ---------------------------- */}
          {/* NEW LEAD MODE                */}
          {/* ---------------------------- */}
          {mode === "new" && (
            <Box>
              {/* === SECTION 1: Personal / Contact === */}
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

                    <Stack direction="row" spacing={2}>
                      <TextField
                        label="Fax"
                        fullWidth
                        value={newLead.Fax}
                        onChange={(e) => updateNewLead("Fax", e.target.value)}
                      />
                      <TextField
                        label="Social Media"
                        fullWidth
                        value={newLead["Social Media"]}
                        onChange={(e) =>
                          updateNewLead("Social Media", e.target.value)
                        }
                      />
                    </Stack>
                  </Stack>
                </AccordionDetails>
              </Accordion>

              {/* === SECTION 2: Business Details === */}
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
                      onChange={(e) => updateNewLead("Company", e.target.value)}
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
                          updateNewLead("Number of Employees", e.target.value)
                        }
                      />
                    </Stack>
                    <TextField
                      label="Requirement"
                      fullWidth
                      value={newLead.Requirement}
                      onChange={(e) =>
                        updateNewLead("Requirement", e.target.value)
                      }
                    />
                    <TextField
                      label="Website"
                      fullWidth
                      value={newLead.Website}
                      onChange={(e) => updateNewLead("Website", e.target.value)}
                    />
                  </Stack>
                </AccordionDetails>
              </Accordion>

              {/* === SECTION 3: Lead Metadata === */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={600}>Lead Details</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={2}>
                      <TextField
                        select
                        label="Lead Source"
                        fullWidth
                        required
                        value={newLead["Lead Source"]}
                        onChange={(e) =>
                          updateNewLead("Lead Source", e.target.value)
                        }
                      >
                        {validation.leadSources.map((s) => (
                          <MenuItem key={s} value={s}>
                            {s}
                          </MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        select
                        label="Lead Status"
                        fullWidth
                        required
                        value={newLead["Lead Status"]}
                        onChange={(e) =>
                          updateNewLead("Lead Status", e.target.value)
                        }
                      >
                        {validation.leadStatuses.map((s) => (
                          <MenuItem key={s} value={s}>
                            {s}
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
                    <TextField
                      label="Additional Description/Remarks"
                      fullWidth
                      multiline
                      rows={3}
                      value={newLead["Additional Description/Remarks"]}
                      onChange={(e) =>
                        updateNewLead(
                          "Additional Description/Remarks",
                          e.target.value
                        )
                      }
                    />
                  </Stack>
                </AccordionDetails>
              </Accordion>

              {/* === SECTION 4: Address === */}
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
                      onChange={(e) => updateNewLead("Street", e.target.value)}
                    />
                    <Stack direction="row" spacing={2}>
                      <TextField
                        label="City"
                        fullWidth
                        value={newLead.City}
                        onChange={(e) => updateNewLead("City", e.target.value)}
                      />
                      <TextField
                        label="State"
                        fullWidth
                        value={newLead.State}
                        onChange={(e) => updateNewLead("State", e.target.value)}
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

              {/* --- SAVE NEW LEAD BUTTON --- */}
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
            </Box>
          )}

          {/* ---------------------------- */}
          {/* TEMPLATE SELECT + ACTIONS    */}
          {/* ---------------------------- */}
          <TextField
            select
            label="Select Template"
            fullWidth
            sx={{ mt: 3 }}
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
          >
            {templates.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>

          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button variant="outlined" onClick={handlePreview}>
              Preview Template
            </Button>
            <Button
              variant="contained"
              sx={{ background: "#6495ED" }}
              onClick={sendEmail}
              disabled={loading}
            >
              {loading ? <CircularProgress size={22} /> : "Send Email"}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* =============================== */}
      {/* PREVIEW MODAL                  */}
      {/* =============================== */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontFamily: "Montserrat", fontWeight: 600 }}>
          Template Preview
        </DialogTitle>
        <DialogContent>
          <Box
            dangerouslySetInnerHTML={{ __html: previewHtml }}
            sx={{
              p: 2,
              fontFamily: "Montserrat",
              border: "1px solid #ccc",
              borderRadius: "6px",
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
