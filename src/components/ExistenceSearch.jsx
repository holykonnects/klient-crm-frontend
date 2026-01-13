// ExistenceSearch.jsx
import React, { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Checkbox,
  Button,
  CircularProgress
} from "@mui/material";

const cornflowerBlue = "#6495ED";

// ✅ Dedicated backend URL (your deployed search GAS)
const EXISTENCE_SEARCH_BACKEND_URL =
  "https://script.google.com/macros/s/AKfycbzlQehb3L1sGPfJY0llUf-24bu8PjiGAJtEGXvh6mQJkbfDJLTU2o4g_HLxinBX_q6B4g/exec";

const makeRow = (id) => ({
  id,
  firstName: "",
  lastName: "",
  company: "",
  mobile: "",
  email: "",
  gst: "",
  lead: true,
  account: true,
  deal: true,
  ownerFound: "",
  status: "idle", // idle | searching | found | notfound | error
  error: ""
});

function hasAnyField(r) {
  return (
    String(r.firstName).trim() ||
    String(r.lastName).trim() ||
    String(r.company).trim() ||
    String(r.mobile).trim() ||
    String(r.email).trim() ||
    String(r.gst).trim()
  );
}

export default function ExistenceSearch() {
  const [rows, setRows] = useState([
    makeRow(1),
    makeRow(2),
    makeRow(3),
    makeRow(4),
    makeRow(5)
  ]);
  const [loadingAll, setLoadingAll] = useState(false);

  const payload = useMemo(() => {
    const reqRows = rows
      .filter((r) => hasAnyField(r) && (r.lead || r.account || r.deal))
      .map((r) => ({
        rowId: String(r.id),
        tables: [
          ...(r.lead ? ["leads"] : []),
          ...(r.account ? ["accounts"] : []),
          ...(r.deal ? ["deals"] : [])
        ],
        criteria: {
          firstName: r.firstName,
          lastName: r.lastName,
          company: r.company,
          mobile: r.mobile,
          email: r.email, // maps to "Email ID" in backend
          gst: r.gst
        }
      }));

    return { rows: reqRows };
  }, [rows]);

  function updateCell(id, key, value) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow(prev.length + 1)]);
  }

  function clearAll() {
    setRows((prev) => prev.map((r) => makeRow(r.id)));
  }

  async function searchAll() {
    // mark eligible rows as searching
    setRows((prev) =>
      prev.map((r) => {
        const eligible = hasAnyField(r) && (r.lead || r.account || r.deal);
        return eligible
          ? { ...r, status: "searching", error: "", ownerFound: "" }
          : r;
      })
    );

    setLoadingAll(true);

    try {
      const res = await fetch(`${EXISTENCE_SEARCH_BACKEND_URL}?action=multiExistenceSearch`, {
        method: "POST",
        // ✅ IMPORTANT: avoid preflight (OPTIONS) => no 405
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Search failed");

      const byRowId = new Map((data.rows || []).map((x) => [String(x.rowId), x]));

      setRows((prev) =>
        prev.map((r) => {
          const rr = byRowId.get(String(r.id));
          if (!rr) return r; // row wasn't sent (no fields/tables)

          if (rr.error) {
            return { ...r, status: "error", error: rr.error, ownerFound: "" };
          }

          const results = rr.results || [];
          if (!results.length) {
            return { ...r, status: "notfound", ownerFound: "" };
          }

          // show distinct owners across matches
          const owners = [...new Set(results.map((x) => String(x.owner || "").trim()).filter(Boolean))];
          const ownerText = owners.length ? owners.join(", ") : "Owner not found";

          return { ...r, status: "found", ownerFound: ownerText };
        })
      );
    } catch (e) {
      setRows((prev) =>
        prev.map((r) =>
          r.status === "searching"
            ? { ...r, status: "error", error: e.message || "Search failed", ownerFound: "" }
            : r
        )
      );
    } finally {
      setLoadingAll(false);
    }
  }

  return (
    <Box sx={{ fontFamily: "Montserrat, sans-serif" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: cornflowerBlue }}>
          Search Inputs
        </Typography>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            onClick={addRow}
            sx={{ textTransform: "none", fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}
          >
            + Add Row
          </Button>

          <Button
            variant="outlined"
            onClick={clearAll}
            sx={{ textTransform: "none", fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}
          >
            Clear
          </Button>

          <Button
            variant="contained"
            onClick={searchAll}
            disabled={loadingAll}
            sx={{
              textTransform: "none",
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 900,
              backgroundColor: cornflowerBlue
            }}
          >
            {loadingAll ? <CircularProgress size={18} /> : "Search"}
          </Button>
        </Box>
      </Box>

      <Paper sx={{ borderRadius: 2, border: "1px solid #eaeaea", overflow: "hidden" }} elevation={0}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: "#f6f9ff" }}>
            <TableRow>
              {[
                "First Name",
                "Last Name",
                "Company",
                "Mobile Number",
                "Email ID",
                "GST Number",
                "Lead",
                "Account",
                "Deals",
                "Account Owner / Status"
              ].map((h) => (
                <TableCell key={h}>
                  <Typography sx={{ fontSize: 12, fontWeight: 900, color: cornflowerBlue }}>
                    {h}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <TextField
                    value={r.firstName}
                    onChange={(e) => updateCell(r.id, "firstName", e.target.value)}
                    size="small"
                    variant="standard"
                    placeholder="First"
                    InputProps={{ sx: { fontFamily: "Montserrat, sans-serif", fontSize: 12 } }}
                  />
                </TableCell>

                <TableCell>
                  <TextField
                    value={r.lastName}
                    onChange={(e) => updateCell(r.id, "lastName", e.target.value)}
                    size="small"
                    variant="standard"
                    placeholder="Last"
                    InputProps={{ sx: { fontFamily: "Montserrat, sans-serif", fontSize: 12 } }}
                  />
                </TableCell>

                <TableCell>
                  <TextField
                    value={r.company}
                    onChange={(e) => updateCell(r.id, "company", e.target.value)}
                    size="small"
                    variant="standard"
                    placeholder="Company"
                    InputProps={{ sx: { fontFamily: "Montserrat, sans-serif", fontSize: 12 } }}
                  />
                </TableCell>

                <TableCell>
                  <TextField
                    value={r.mobile}
                    onChange={(e) => updateCell(r.id, "mobile", e.target.value)}
                    size="small"
                    variant="standard"
                    placeholder="Mobile"
                    InputProps={{ sx: { fontFamily: "Montserrat, sans-serif", fontSize: 12 } }}
                  />
                </TableCell>

                <TableCell>
                  <TextField
                    value={r.email}
                    onChange={(e) => updateCell(r.id, "email", e.target.value)}
                    size="small"
                    variant="standard"
                    placeholder="Email ID"
                    InputProps={{ sx: { fontFamily: "Montserrat, sans-serif", fontSize: 12 } }}
                  />
                </TableCell>

                <TableCell>
                  <TextField
                    value={r.gst}
                    onChange={(e) => updateCell(r.id, "gst", e.target.value)}
                    size="small"
                    variant="standard"
                    placeholder="GST"
                    InputProps={{ sx: { fontFamily: "Montserrat, sans-serif", fontSize: 12 } }}
                  />
                </TableCell>

                <TableCell align="center">
                  <Checkbox
                    checked={r.lead}
                    onChange={(e) => updateCell(r.id, "lead", e.target.checked)}
                  />
                </TableCell>

                <TableCell align="center">
                  <Checkbox
                    checked={r.account}
                    onChange={(e) => updateCell(r.id, "account", e.target.checked)}
                  />
                </TableCell>

                <TableCell align="center">
                  <Checkbox
                    checked={r.deal}
                    onChange={(e) => updateCell(r.id, "deal", e.target.checked)}
                  />
                </TableCell>

                <TableCell>
                  <Typography sx={{ fontFamily: "Montserrat, sans-serif", fontSize: 12, fontWeight: 800 }}>
                    {r.status === "searching" ? "Searching..." : ""}
                    {r.status === "found" ? r.ownerFound : ""}
                    {r.status === "notfound" ? "Not Found" : ""}
                    {r.status === "error" ? `Error: ${r.error}` : ""}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
