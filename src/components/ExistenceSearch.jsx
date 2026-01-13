// src/components/ExistenceSearch.jsx
import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  Divider,
  CircularProgress,
  Chip,
  IconButton
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

const cornflowerBlue = "#6495ED";

const makeRow = (id) => ({
  rowId: id,
  criteria: {
    firstName: "",
    lastName: "",
    mobile: "",
    company: "",
    email: "", // maps to "Email ID" in GAS
    gst: ""
  },
  tables: { leads: true, accounts: true, deals: true },
  loading: false,
  error: "",
  results: []
});

function hasAnyCriteria(criteria) {
  return Object.values(criteria).some((v) => String(v || "").trim());
}

function selectedTablesArray(tablesObj) {
  return Object.entries(tablesObj)
    .filter(([_, v]) => v)
    .map(([k]) => k);
}

export default function ExistenceSearch({ backendUrl, open }) {
  const [rows, setRows] = useState([makeRow("r1"), makeRow("r2"), makeRow("r3")]);
  const [globalLoading, setGlobalLoading] = useState(false);

  function updateRow(rowId, updater) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? updater(r) : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow(`r${prev.length + 1}`)]);
  }

  function removeRow(rowId) {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  }

  function clearRow(rowId) {
    updateRow(rowId, (r) => ({ ...r, error: "", results: [], criteria: makeRow(rowId).criteria }));
  }

  async function runSearch(rowIds = null) {
    if (!backendUrl) return;

    const targets = rowIds ? rows.filter((r) => rowIds.includes(r.rowId)) : rows;

    // only search rows that have any criteria and at least one table selected
    const validTargets = targets.filter(
      (r) => hasAnyCriteria(r.criteria) && selectedTablesArray(r.tables).length > 0
    );

    // mark loading
    validTargets.forEach((t) => {
      updateRow(t.rowId, (r) => ({ ...r, loading: true, error: "", results: [] }));
    });

    const payload = {
      rows: validTargets.map((r) => ({
        rowId: r.rowId,
        tables: selectedTablesArray(r.tables),
        criteria: r.criteria
      }))
    };

    try {
      const res = await fetch(`${backendUrl}?action=multiExistenceSearch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Search failed");

      const respRows = data.rows || [];
      respRows.forEach((rr) => {
        updateRow(rr.rowId, (r) => ({
          ...r,
          loading: false,
          error: rr.error || "",
          results: rr.results || []
        }));
      });

      // for rows not returned (rare)
      validTargets.forEach((t) => {
        if (!respRows.some((x) => x.rowId === t.rowId)) {
          updateRow(t.rowId, (r) => ({
            ...r,
            loading: false,
            error: "No response for this row",
            results: []
          }));
        }
      });
    } catch (e) {
      validTargets.forEach((t) => {
        updateRow(t.rowId, (r) => ({
          ...r,
          loading: false,
          error: e.message || "Search failed",
          results: []
        }));
      });
    }
  }

  async function searchAll() {
    setGlobalLoading(true);
    await runSearch(rows.map((r) => r.rowId));
    setGlobalLoading(false);
  }

  // when sidebar collapsed, keep it minimal (optional)
  if (!open) {
    return (
      <Box sx={{ px: 1, pb: 1 }}>
        <TooltipIconOnly backendUrl={backendUrl} />
      </Box>
    );
  }

  return (
    <Box sx={{ px: 1.5, pb: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 12, color: cornflowerBlue }}>
          CRM Existence Check
        </Typography>
        <IconButton size="small" onClick={addRow}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>

      <Button
        fullWidth
        variant="contained"
        startIcon={globalLoading ? <CircularProgress size={14} /> : <SearchIcon />}
        onClick={searchAll}
        sx={{
          mt: 1,
          textTransform: "none",
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 800,
          fontSize: 11,
          borderRadius: 2,
          backgroundColor: cornflowerBlue
        }}
      >
        Search All Rows
      </Button>

      <Divider sx={{ my: 1, borderColor: "#6495ED", borderBottomWidth: 2 }} />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, maxHeight: 360, overflowY: "auto" }}>
        {rows.map((row) => {
          const anyCriteria = hasAnyCriteria(row.criteria);
          const anyTables = selectedTablesArray(row.tables).length > 0;

          return (
            <Box key={row.rowId} sx={{ border: "1px solid #e6e6e6", borderRadius: 2, p: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 11 }}>
                  Row {row.rowId.replace("r", "")}
                </Typography>

                <Box>
                  <IconButton size="small" onClick={() => clearRow(row.rowId)}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => removeRow(row.rowId)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>

              <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
                <TextField
                  size="small"
                  placeholder="First Name"
                  value={row.criteria.firstName}
                  onChange={(e) => updateRow(row.rowId, (r) => ({ ...r, criteria: { ...r.criteria, firstName: e.target.value } }))}
                  sx={{ "& input": { fontFamily: "Montserrat, sans-serif", fontSize: 11 } }}
                />
                <TextField
                  size="small"
                  placeholder="Last Name"
                  value={row.criteria.lastName}
                  onChange={(e) => updateRow(row.rowId, (r) => ({ ...r, criteria: { ...r.criteria, lastName: e.target.value } }))}
                  sx={{ "& input": { fontFamily: "Montserrat, sans-serif", fontSize: 11 } }}
                />
                <TextField
                  size="small"
                  placeholder="Mobile"
                  value={row.criteria.mobile}
                  onChange={(e) => updateRow(row.rowId, (r) => ({ ...r, criteria: { ...r.criteria, mobile: e.target.value } }))}
                  sx={{ "& input": { fontFamily: "Montserrat, sans-serif", fontSize: 11 } }}
                />
                <TextField
                  size="small"
                  placeholder="Company"
                  value={row.criteria.company}
                  onChange={(e) => updateRow(row.rowId, (r) => ({ ...r, criteria: { ...r.criteria, company: e.target.value } }))}
                  sx={{ "& input": { fontFamily: "Montserrat, sans-serif", fontSize: 11 } }}
                />
                <TextField
                  size="small"
                  placeholder="Email ID"
                  value={row.criteria.email}
                  onChange={(e) => updateRow(row.rowId, (r) => ({ ...r, criteria: { ...r.criteria, email: e.target.value } }))}
                  sx={{ "& input": { fontFamily: "Montserrat, sans-serif", fontSize: 11 } }}
                />
                <TextField
                  size="small"
                  placeholder="GST"
                  value={row.criteria.gst}
                  onChange={(e) => updateRow(row.rowId, (r) => ({ ...r, criteria: { ...r.criteria, gst: e.target.value } }))}
                  sx={{ "& input": { fontFamily: "Montserrat, sans-serif", fontSize: 11 } }}
                />
              </Box>

              <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                {["leads", "accounts", "deals"].map((t) => (
                  <FormControlLabel
                    key={t}
                    control={
                      <Checkbox
                        size="small"
                        checked={row.tables[t]}
                        onChange={(e) => updateRow(row.rowId, (r) => ({ ...r, tables: { ...r.tables, [t]: e.target.checked } }))}
                      />
                    }
                    label={
                      <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontSize: 10.5 }}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Typography>
                    }
                  />
                ))}
              </Box>

              <Button
                fullWidth
                variant="outlined"
                startIcon={row.loading ? <CircularProgress size={14} /> : <SearchIcon />}
                disabled={row.loading || !anyCriteria || !anyTables}
                onClick={() => runSearch([row.rowId])}
                sx={{
                  mt: 0.75,
                  textTransform: "none",
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  fontSize: 11,
                  borderRadius: 2,
                  borderColor: cornflowerBlue,
                  color: cornflowerBlue
                }}
              >
                Search This Row
              </Button>

              {row.error ? (
                <Typography sx={{ mt: 0.75, color: "error.main", fontFamily: "Montserrat, sans-serif", fontSize: 10.5 }}>
                  {row.error}
                </Typography>
              ) : null}

              {!row.loading && anyCriteria && !row.error && row.results.length === 0 ? (
                <Typography sx={{ mt: 0.75, fontFamily: "Montserrat, sans-serif", fontSize: 10.5, opacity: 0.7 }}>
                  No results found.
                </Typography>
              ) : null}

              {row.results.length > 0 ? (
                <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 0.75 }}>
                  {row.results.map((r, i) => (
                    <Box key={i} sx={{ p: 0.8, border: "1px solid #efefef", borderRadius: 2 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Chip size="small" label={r.table} />
                        <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontSize: 10.5, fontWeight: 900 }}>
                          {r.owner || "-"}
                        </Typography>
                      </Box>
                      <Typography sx={{ mt: 0.5, fontFamily: "Montserrat, sans-serif", fontSize: 10.5 }}>
                        {(r.company || "-")} | {(r.firstName || "") + " " + (r.lastName || "")}
                      </Typography>
                      <Typography sx={{ mt: 0.25, fontFamily: "Montserrat, sans-serif", fontSize: 10.2, opacity: 0.85 }}>
                        {r.mobile ? `📱 ${r.mobile}` : ""}
                        {r.email ? ` • ✉️ ${r.email}` : ""}
                        {r.gst ? ` • GST: ${r.gst}` : ""}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : null}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// Optional: if you want a tiny icon-only when sidebar collapsed.
// If you don't care, you can delete this and the open check above.
function TooltipIconOnly() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center" }}>
      <SearchIcon sx={{ color: cornflowerBlue }} />
    </Box>
  );
}
