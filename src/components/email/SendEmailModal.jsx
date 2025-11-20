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

// ⬆️ your final GAS endpoint

export default function SendEmailModal({ open, onClose, user }) {
  /**********************************************************
   * STATE
   **********************************************************/
  const [mode, setMode] = useState("new"); // DEFAULT = NEW LEAD
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

  /**********************************************************
   * USER IDENTITY (email = login username)
   **********************************************************/
  const loginEmail = (user?.email || user?.username || "").trim().toLowerCase();

  /**********************************************************
   * New Lead Default Object
   **********************************************************/
  const [newLead, setNewLead] = useState({
    "Lead Owner": "", // AUTO-FILLED VIA VALIDATION TABLE
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

  /**********************************************************
   * LOAD VALIDATION
   **********************************************************/
  const loadValidation = async () => {
    try {
      const res = await fetch(
        `${WEBAPP_URL}?action=getLeadValidation`,
        { mode: "no-cors" }
      );
      const txt = await res.text();

      let json;
      try {
        json = JSON.parse(txt);
      } catch {
        console.warn("Validation JSON parse failed:", txt);
        return;
      }

      if (json.ok) {
        setValidation(json.data);
      }
    } catch (err) {
      console.error("Validation load error:", err);
    }
  };

  /**********************************************************
   * LOAD AND RESOLVE LEAD OWNER NAME
   **********************************************************/
  const resolveLeadOwner = async () => {
    try {
      const res = await fetch(
        `${WEBAPP_URL}?action=getLeadValidation`,
        { mode: "no-cors" }
      );

      const txt = await res.text();
      let json;
      try {
        json = JSON.parse(txt);
      } catch {
        console.warn("leadOwner parse failed:", txt);
        return;
      }

      // The GAS now resolves the Lead Owner internally, so we simply trust GAS.
      // user.email → validation mapping happens inside GAS.
      updateNewLead("Lead Owner", user?.username || user?.email || "");
    } catch (e) {
      console.error("Lead owner load failed:", e);
    }
  };

  /**********************************************************
   * LOAD TEMPLATES
   **********************************************************/
  const loadTemplates = async () => {
    try {
      const res = await fetch(
        `${WEBAPP_URL}?action=getTemplates`,
        { mode: "no-cors" }
      );

      const txt = await res.text();
      let json;
      try {
        json = JSON.parse(txt);
      } catch {
        console.warn("Template JSON parse error:", txt);
        return;
      }

      if (json.ok) setTemplates(json.data || []);
    } catch (e) {
      console.error("Template load error:", e);
    }
  };

  /**********************************************************
   * LOAD EXISTING LEADS (Filtered by GAS)
   **********************************************************/
  const loadLeads = async () => {
    try {
      const res = await fetch(
        `${WEBAPP_URL}?action=getLeads&user=${encodeURIComponent(loginEmail)}`,
        { mode: "no-cors" }
      );

      const txt = await res.text();
      let json;
      try {
        json = JSON.parse(txt);
      } catch {
        console.warn("Lead load JSON parse error", txt);
        return;
      }

      if (json.ok) {
        setLeads(json.data || []);
      }
    } catch (e) {
      console.error("Lead load error:", e);
    }
  };

  /**********************************************************
   * ON OPEN — Load everything
   **********************************************************/
  useEffect(() => {
    if (open) {
      loadValidation();
      loadTemplates();
      loadLeads();
      resolveLeadOwner();
    }
  }, [open]);

  /**********************************************************
   * PREVIEW TEMPLATE
   **********************************************************/
  const handlePreview = async () => {
    if (!selectedTemplateId) return alert("Select a template.");

    const res = await fetch(
      `${WEBAPP_URL}?action=getTemplateHtml&templateId=${selectedTemplateId}`,
      { mode: "no-cors" }
    );

    const txt = await res.text();
    let json;
    try {
      json = JSON.parse(txt);
    } catch {
      console.warn("Preview parse fail:", txt);
      return;
    }

    if (!json.ok) return alert("Failed to load template.");

    let html = json.html;

    // correct object
    const dataObj =
      mode === "existing"
        ? leads.find((l) => l["Lead ID"] === selectedLeadId)
        : newLead;

    if (!dataObj) return alert("Lead data missing");

    // replace all {{field}} placeholders
    Object.keys(dataObj).forEach((key) => {
      const val = dataObj[key] || "";
      html = html.replaceAll(`{{${key}}}`, val);
    });

    setPreviewHtml(html);
    setPreviewOpen(true);
  };

  /**********************************************************
   * CREATE LEAD
   **********************************************************/
  const submitNewLead = async () => {
    if (!newLead["Lead Source"]) return alert("Lead Source is mandatory.");
    if (!newLead["Lead Status"]) return alert("Lead Status is mandatory.");

    setLoading(true);

    const res = await fetch(WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        action: "createLead",
        data: newLead,
      }),
    });

    setLoading(false);
    alert("Lead created successfully!");

    loadLeads();
    setMode("existing");
  };

  /**********************************************************
   * SEND EMAIL
   **********************************************************/
  const sendEmail = async () => {
    if (!selectedTemplateId) return alert("Select a template.");
    if (!selectedLeadId) return alert("Select a lead.");

    setLoading(true);

    await fetch(WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        action: "sendEmail",
        templateId: selectedTemplateId,
        leadId: selectedLeadId,
        userEmail: loginEmail,
      }),
    });

    setLoading(false);
    alert("Email sent successfully!");
    onClose();
  };

  /**********************************************************
   * UI
   **********************************************************/
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
                  {l.Company} | {l["First Name"]} {l["Last Name"]} |{" "}
                  {l["Mobile Number"]}
                </MenuItem>
              ))}
            </TextField>
          )}

          {/* NEW LEAD FORM */}
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
                        fullWidth
                        label="Lead Status"
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
                      fullWidth
                      label="Description"
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

              <Box textAlign="right" sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={submitNewLead}
                  disabled={loading}
                  sx={{ background: "#6495ED" }}
                >
                  {loading ? <CircularProgress size={22} /> : "Create Lead"}
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

          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button variant="outlined" onClick={handlePreview}>
              Preview
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

      {/* PREVIEW MODAL */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
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
              borderRadius: 2,
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
