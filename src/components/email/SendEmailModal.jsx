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

// --- GAS ENDPOINT ---
const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzPNVeqRlTRcb_sCa_PU_EGW_EW8uZ9ClevCQRcKfa5KYR5-OpGyzp1Wsw4Sxb_x2vfqg/exec";

export default function SendEmailModal({ open, onClose, user = {} }) {
  /****************************************
   * DEFAULT MODE = NEW LEAD
   ****************************************/
  const [mode, setMode] = useState("new"); // NEW is default

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

  /****************************************
   * OWNER FIELD (CRITICAL FIX)
   ****************************************/
  const owner =
    user?.username ||
    user?.LoginUsername ||
    user?.UserName ||
    user?.email ||
    "Unknown";

  /****************************************
   * NEW LEAD STATE
   ****************************************/
  const [newLead, setNewLead] = useState({
    "Lead Owner": owner,
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

  const updateNewLead = (k, v) =>
    setNewLead((prev) => ({ ...prev, [k]: v }));

  /****************************************
   * LOAD TEMPLATES
   ****************************************/
  const loadTemplates = async () => {
    try {
      const res = await fetch(`${WEBAPP_URL}?action=getTemplates`);
      const json = await res.json();
      if (json.ok) setTemplates(json.data || []);
    } catch (err) {
      console.error("Template load error:", err);
    }
  };

  /****************************************
   * LOAD EXISTING LEADS
   ****************************************/
  const loadLeads = async () => {
    try {
      const res = await fetch(
        `${WEBAPP_URL}?action=getLeads&user=${encodeURIComponent(owner)}`
      );
      const json = await res.json();

      if (json.ok) {
        setLeads(json.data || []);
      }
    } catch (err) {
      console.error("Lead load error:", err);
    }
  };

  /****************************************
   * LOAD VALIDATION TABLES
   ****************************************/
  const loadValidation = async () => {
    try {
      const res = await fetch(`${WEBAPP_URL}?action=getLeadValidation`);
      const json = await res.json();

      if (json.ok) setValidation(json.data);
    } catch (err) {
      console.error("Validation load error:", err);
    }
  };

  /****************************************
   * LOAD EVERYTHING WHEN MODAL OPENS
   ****************************************/
  useEffect(() => {
    if (open) {
      loadTemplates();
      loadLeads();
      loadValidation();
    }
  }, [open]);

  /****************************************
   * TEMPLATE PREVIEW
   ****************************************/
  const handlePreview = async () => {
    if (!selectedTemplateId)
      return alert("Select a template first.");

    const res = await fetch(
      `${WEBAPP_URL}?action=getTemplateHtml&templateId=${selectedTemplateId}`
    );
    const json = await res.json();

    if (!json.ok) return alert("Failed to load template.");

    let html = json.html;

    const dataObj =
      mode === "existing"
        ? leads.find((l) => l["Lead ID"] === selectedLeadId)
        : newLead;

    if (!dataObj) return alert("Lead data missing.");

    Object.keys(dataObj).forEach((key) => {
      const ph = `{{${key}}}`;
      html = html.replaceAll(ph, dataObj[key] || "");
    });

    setPreviewHtml(html);
    setPreviewOpen(true);
  };

  /****************************************
   * CREATE NEW LEAD
   ****************************************/
  const submitNewLead = async () => {
    if (!newLead["Lead Source"])
      return alert("Lead Source is mandatory.");
    if (!newLead["Lead Status"])
      return alert("Lead Status is mandatory.");

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

    setSelectedLeadId(json.lead["Lead ID"]);

    // SWITCH MODE → existing
    setMode("existing");
    loadLeads();
  };

  /****************************************
   * SEND EMAIL
   ****************************************/
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
        userEmail: owner,
      }),
    });

    const json = await res.json();
    setLoading(false);

    if (!json.ok) return alert("Email failed.");

    alert("Email sent!");
    onClose();
  };

  /****************************************
   * UI START
   ****************************************/
  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle
          sx={{
            fontFamily: "Montserrat",
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          Send Email
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ fontFamily: "Montserrat" }}>
          {/* MODE BUTTONS */}
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
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

          {/* EXISTING LEAD */}
          {mode === "existing" && (
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
                  {l.Company || "No Company"} — {l["First Name"]}{" "}
                  {l["Last Name"]}
                </MenuItem>
              ))}
            </TextField>
          )}

          {/* NEW LEAD ACCORDIONS */}
          {mode === "new" && (
            <Box>
              {/* CONTACT DETAILS */}
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
                        onChange={(e) =>
                          updateNewLead("Fax", e.target.value)
                        }
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

              {/* BUSINESS DETAILS */}
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
                        required
                        label="Lead Source"
                        value={newLead["Lead Source"]}
                        onChange={(e) =>
                          updateNewLead("Lead Source", e.target.value)
                        }
                      >
                        {validation.leadSources.map((v) => (
                          <MenuItem key={v} value={v}>
                            {v}
                          </MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        select
                        fullWidth
                        required
                        label="Lead Status"
                        value={newLead["Lead Status"]}
                        onChange={(e) =>
                          updateNewLead("Lead Status", e.target.value)
                        }
                      >
                        {validation.leadStatuses.map((v) => (
                          <MenuItem key={v} value={v}>
                            {v}
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

              {/* ADDRESS DETAILS */}
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

              {/* CREATE LEAD BUTTON */}
              <Box textAlign="right" sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  disabled={loading}
                  onClick={submitNewLead}
                  sx={{ background: "#6495ED" }}
                >
                  {loading ? (
                    <CircularProgress size={22} />
                  ) : (
                    "Create Lead"
                  )}
                </Button>
              </Box>
            </Box>
          )}

          {/* TEMPLATE SELECT */}
          <TextField
            select
            fullWidth
            label="Select Template"
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

          {/* SEND + PREVIEW */}
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
              {loading ? (
                <CircularProgress size={22} />
              ) : (
                "Send Email"
              )}
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
        <DialogTitle
          sx={{ fontFamily: "Montserrat", fontWeight: 600 }}
        >
          Template Preview
        </DialogTitle>
        <DialogContent>
          <Box
            dangerouslySetInnerHTML={{ __html: previewHtml }}
            sx={{
              p: 2,
              fontFamily: "Montserrat",
              border: "1px solid #ccc",
              borderRadius: "8px",
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
