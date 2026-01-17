// src/components/AccountsTable.js
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Grid,
  Checkbox,
  Button,
  Popover,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EventIcon from "@mui/icons-material/Event";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import { useAuth } from "./AuthContext"; // adjust path if needed
import "@fontsource/montserrat";
import LoadingOverlay from "./LoadingOverlay"; // Adjust path if needed
import CalendarView from "./CalendarView"; // adjust path if needed

const theme = createTheme({
  typography: {
    fontFamily: "Montserrat, sans-serif",
    fontSize: 10.5,
  },
});

const selectorStyle = {
  fontFamily: "Montserrat, sans-serif",
  fontSize: 8,
};

/**
 * ✅ Memoized table grid so it doesn't re-render while typing in modal
 */
const AccountsGrid = React.memo(function AccountsGrid({
  rows,
  visibleColumns,
  sortConfig,
  onSort,
  onOpenDeal,
  onOpenMeeting,
}) {
  return (
    <Table>
      <TableHead>
        <TableRow style={{ backgroundColor: "#6495ED" }}>
          {visibleColumns.map((header) => (
            <TableCell
              key={header}
              onClick={() => onSort(header)}
              style={{ color: "white", cursor: "pointer", fontWeight: "bold" }}
            >
              {header}{" "}
              {sortConfig.key === header
                ? sortConfig.direction === "asc"
                  ? "↑"
                  : "↓"
                : ""}
            </TableCell>
          ))}
          <TableCell style={{ color: "white", fontWeight: "bold" }}>
            Actions
          </TableCell>
        </TableRow>
      </TableHead>

      <TableBody>
        {rows.map((acc, index) => (
          <TableRow key={index}>
            {visibleColumns.map((col, i) => (
              <TableCell key={i}>{acc[col]}</TableCell>
            ))}

            <TableCell>
              <IconButton onClick={() => onOpenDeal(acc)}>
                <EditIcon />
              </IconButton>
              <IconButton onClick={() => onOpenMeeting(acc, "Account")}>
                <EventIcon />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
});

/**
 * ✅ Deal modal with LOCAL state → typing won't re-render the table
 */
const DealModal = React.memo(function DealModal({
  open,
  row,
  validationData,
  onClose,
  onSubmit,
  submittingDeal,
}) {
  const [form, setForm] = React.useState({});

  // init form whenever a new row opens the modal
  React.useEffect(() => {
    if (!row) return;

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${String(
      now.getFullYear()
    ).slice(-2)} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
      now.getSeconds()
    )}`;

    const accountOwner = row["Lead Owner"] || row["Account Owner"] || "";

    setForm({
      ...row,
      "Account Owner": accountOwner,
      Timestamp: timestamp,
    });
  }, [row]);

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const sections = React.useMemo(
    () => [
      {
        title: "Deal Details",
        fields: [
          "Deal Name",
          "Type",
          "Deal Amount",
          "Next Step",
          "Product Required",
          "Remarks",
          "Stage",
        ],
      },
      {
        title: "Customer Details",
        fields: [
          "Timestamp",
          "Account Owner",
          "First Name",
          "Last Name",
          "Company",
          "Mobile Number",
          "Email ID",
          "Fax",
          "Website",
          "Lead Source",
          "Lead Status",
          "Industry",
          "Number of Employees",
          "Annual Revenue",
          "Social Media",
          "Description",
        ],
      },
      {
        title: "Address Details",
        fields: [
          "Street",
          "City",
          "State",
          "Country",
          "PinCode",
          "Additional Description",
          "Account ID",
        ],
      },
      {
        title: "Customer Banking Details",
        fields: [
          "GST Number",
          "Bank Account Number",
          "IFSC Code",
          "Bank Name",
          "Bank Account Name",
          "Banking Remarks",
        ],
      },
    ],
    []
  );

  return (
    <Dialog
      open={open}
      onClose={submittingDeal ? null : onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>
        Create Deal
      </DialogTitle>

      <DialogContent dividers>
        {sections.map((section) => (
          <Accordion key={section.title} defaultExpanded>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: "#f0f4ff",
                fontFamily: "Montserrat, sans-serif",
                fontWeight: "bold",
              }}
            >
              <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>
                {section.title}
              </Typography>
            </AccordionSummary>

            <AccordionDetails>
              <Grid container spacing={2}>
                {section.fields.map((field) => (
                  <Grid item xs={6} key={field}>
                    {field === "Account Owner" ? (
                      <TextField
                        fullWidth
                        label={field}
                        name={field}
                        value={form["Account Owner"] || form["Lead Owner"] || ""}
                        InputProps={{ readOnly: true }}
                        size="small"
                      />
                    ) : validationData[field] ? (
                      <FormControl fullWidth size="small">
                        <InputLabel>{field}</InputLabel>
                        <Select
                          label={field}
                          name={field}
                          value={form[field] || ""}
                          onChange={handleFieldChange}
                        >
                          {validationData[field].map((opt, idx) => (
                            <MenuItem key={idx} value={opt}>
                              {opt}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <TextField
                        fullWidth
                        label={field}
                        name={field}
                        value={form[field] || ""}
                        onChange={handleFieldChange}
                        size="small"
                      />
                    )}
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>
        ))}

        <Box mt={2} display="flex" justifyContent="flex-end" gap={1}>
          <Button variant="outlined" onClick={onClose} disabled={submittingDeal}>
            Cancel
          </Button>

          <Button
            variant="contained"
            sx={{ backgroundColor: "#6495ED" }}
            onClick={() => onSubmit(form)}
            disabled={submittingDeal}
          >
            {submittingDeal ? "Submitting..." : "Submit Deal"}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
});

function AccountsTable() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterOwner, setFilterOwner] = useState("");

  const [validationData, setValidationData] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "asc" });

  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);

  const [createDealRow, setCreateDealRow] = useState(null);
  const [submittingDeal, setSubmittingDeal] = useState(false);

  const [selectedEntryRow, setSelectedEntryRow] = useState(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [entryType, setEntryType] = useState("");

  const { user } = useAuth();
  const username = user?.username;
  const role = user?.role;

  const dataUrl =
    "https://script.google.com/macros/s/AKfycbyh1_hms_eAcY40DZi6BXJAQe2tnD65nUTxtC6bX9S7s4TAh-Yh3psBZmhiPm_OAe6w/exec";
  const validationUrl =
    "https://script.google.com/macros/s/AKfycbyaSwpMpH0RCTQkgwzme0N5WYgNP9aERhQs7mQCFX3CvBBFARne_jsM5YW6L705TdET/exec";
  const submitUrl =
    "https://script.google.com/macros/s/AKfycbxZ87qfE6u-2jT8xgSlYJu5dG6WduY0lG4LmlXSOk2EGkWBH4CbZIwEJxEHI-Bmduoh/exec";

  useEffect(() => {
    fetch(dataUrl)
      .then((res) => res.json())
      .then((data) => {
        let filtered = data;

        if (role === "End User") {
          filtered = data.filter(
            (acc) =>
              acc["Account Owner"] === username ||
              acc["Lead Owner"] === username ||
              acc["Owner"] === username
          );
        }

        setAccounts(filtered);

        setVisibleColumns(
          JSON.parse(localStorage.getItem(`visibleColumns-${username}-accounts`)) ||
            (filtered.length ? Object.keys(filtered[0]) : [])
        );

        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch(validationUrl)
      .then((res) => res.json())
      .then(setValidationData)
      .catch(() => {});
  }, [username, role]);

  const handleSort = useCallback(
    (key) => {
      const direction =
        sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
      setSortConfig({ key, direction });
    },
    [sortConfig]
  );

  const handleColumnToggle = (col) => {
    setVisibleColumns((prev) => {
      const updated = prev.includes(col)
        ? prev.filter((c) => c !== col)
        : [...prev, col];
      localStorage.setItem(
        `visibleColumns-${username}-accounts`,
        JSON.stringify(updated)
      );
      return updated;
    });
  };

  const handleSelectAll = () => {
    const all = Object.keys(accounts[0] || {});
    setVisibleColumns(all);
    localStorage.setItem(`visibleColumns-${username}-accounts`, JSON.stringify(all));
  };

  const handleDeselectAll = () => {
    setVisibleColumns([]);
    localStorage.setItem(`visibleColumns-${username}-accounts`, JSON.stringify([]));
  };

  const filteredAccounts = useMemo(() => {
    return [...accounts]
      .sort((a, b) => {
        if (!sortConfig.key) return 0;
        const aVal = a[sortConfig.key] || "";
        const bVal = b[sortConfig.key] || "";
        return sortConfig.direction === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      })
      .filter((acc) => {
        try {
          return (
            ["First Name", "Last Name", "Company", "Mobile Number"].some((field) =>
              (acc[field] || "").toLowerCase().includes(searchTerm.toLowerCase())
            ) &&
            (!filterSource || acc["Lead Source"] === filterSource) &&
            (!filterOwner || acc["Lead Owner"] === filterOwner)
          );
        } catch {
          return false;
        }
      });
  }, [accounts, sortConfig, searchTerm, filterSource, filterOwner]);

  const openDealModal = useCallback((acc) => {
    setCreateDealRow(acc);
  }, []);

  const handleSubmitDeal = useCallback(
    async (form) => {
      if (submittingDeal) return;
      setSubmittingDeal(true);

      const payload = {
        ...form,
        "Account Owner": form["Account Owner"] || form["Lead Owner"] || "",
        "Lead Owner": form["Lead Owner"] || form["Account Owner"] || "",
        Timestamp: form["Timestamp"],
      };

      try {
        await fetch(submitUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        alert("✅ Deal submitted successfully");
        setCreateDealRow(null);
      } catch (err) {
        alert("❌ Error submitting deal");
      } finally {
        setSubmittingDeal(false);
      }
    },
    [submittingDeal, submitUrl]
  );

  const handleOpenMeetingFromRow = useCallback((row, type) => {
    setSelectedEntryRow(row);
    setEntryType(type);
    setShowCalendarModal(true);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      {loading && <LoadingOverlay />}

      <Box padding={4}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
          <Typography variant="h5" fontWeight="bold">
            Accounts Records
          </Typography>
        </Box>

        <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
          <TextField
            label="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Lead Source</InputLabel>
            <Select
              value={filterSource}
              label="Lead Source"
              onChange={(e) => setFilterSource(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {(validationData["Lead Source"] || []).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Account Owner</InputLabel>
            <Select
              value={filterOwner}
              label="Account Owner"
              onChange={(e) => setFilterOwner(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {(validationData["Account Owner"] || []).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <ViewColumnIcon />
          </IconButton>

          <Popover
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={() => setAnchorEl(null)}
          >
            <Box p={2} sx={selectorStyle}>
              <Button size="small" onClick={handleSelectAll}>
                Select All
              </Button>
              <Button size="small" onClick={handleDeselectAll}>
                Deselect All
              </Button>

              {Object.keys(accounts[0] || {}).map((col) => (
                <Box key={col}>
                  <Checkbox
                    size="small"
                    checked={visibleColumns.includes(col)}
                    onChange={() => handleColumnToggle(col)}
                  />{" "}
                  {col}
                </Box>
              ))}
            </Box>
          </Popover>
        </Box>

        <AccountsGrid
          rows={filteredAccounts}
          visibleColumns={visibleColumns}
          sortConfig={sortConfig}
          onSort={handleSort}
          onOpenDeal={openDealModal}
          onOpenMeeting={handleOpenMeetingFromRow}
        />

        <DealModal
          open={!!createDealRow}
          row={createDealRow}
          validationData={validationData}
          onClose={() => setCreateDealRow(null)}
          onSubmit={handleSubmitDeal}
          submittingDeal={submittingDeal}
        />

        {showCalendarModal && (
          <CalendarView
            open={showCalendarModal}
            onClose={() => setShowCalendarModal(false)}
            entryType={entryType}
            selectedEntryRow={selectedEntryRow}
            mode="existing"
          />
        )}
      </Box>
    </ThemeProvider>
  );
}

export default AccountsTable;
