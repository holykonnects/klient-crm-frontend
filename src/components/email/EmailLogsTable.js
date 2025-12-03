import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Chip,
  CircularProgress,
} from "@mui/material";

const cornflowerBlue = "#6495ED";

// Same Web App as bulk sender, but using ?action=getEmailEvents
const EMAIL_LOGS_URL =
  "https://script.google.com/macros/s/AKfycbyHKwZhtRyVNYtECD3LZ_whE4q1Me29Xgv4CLjnpW3N1M0_iXV0d55ZuiJgpViCBJZ_zQ/exec?action=getEmailEvents";


export default function EmailLogsTable() {
  const [logs, setLogs] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setErrorMsg("");
        const res = await fetch(EMAIL_LOGS_URL);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        const data = Array.isArray(json.data) ? json.data : [];
        // Sort: latest first by timestamp if possible
        const sorted = [...data].sort((a, b) => {
          const da = new Date(a.timestamp).getTime() || 0;
          const db = new Date(b.timestamp).getTime() || 0;
          return db - da;
        });
        setLogs(sorted);
        setFiltered(sorted);
      } catch (err) {
        console.error("Error fetching email logs:", err);
        setErrorMsg("Unable to load email logs. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  // Simple text filter across key fields
  useEffect(() => {
    if (!search) {
      setFiltered(logs);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(
      logs.filter((log) => {
        const haystack = [
          log.to,
          log.cc,
          log.subject,
          log.firstName,
          log.companyName,
          log.mode,
          log.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
    );
  }, [search, logs]);

  const renderStatusChip = (status) => {
    if (!status) return null;
    const s = status.toUpperCase();
    let color = "default";
    if (s === "SENT") color = "success";
    else if (s === "ERROR") color = "error";
    return (
      <Chip
        label={s}
        color={color}
        size="small"
        sx={{
          fontFamily: "Montserrat, sans-serif",
          fontSize: 10,
        }}
      />
    );
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Box
        sx={{
          mb: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Typography
          sx={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 600,
            color: cornflowerBlue,
          }}
        >
          Email Logs
        </Typography>

        <TextField
          size="small"
          placeholder="Search by email, subject, company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            minWidth: 260,
            "& .MuiInputBase-root": {
              fontFamily: "Montserrat, sans-serif",
              fontSize: 11,
            },
          }}
        />
      </Box>

      {loading && (
        <Box
          sx={{
            py: 4,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 1,
          }}
        >
          <CircularProgress size={20} />
          <Typography sx={{ fontSize: 12 }}>Loading email logs...</Typography>
        </Box>
      )}

      {!loading && errorMsg && (
        <Typography
          sx={{ fontSize: 12, color: "#c62828", fontFamily: "Montserrat" }}
        >
          {errorMsg}
        </Typography>
      )}

      {!loading && !errorMsg && filtered.length === 0 && (
        <Typography
          sx={{ fontSize: 12, color: "#666", fontFamily: "Montserrat" }}
        >
          No email logs found yet.
        </Typography>
      )}

      {!loading && !errorMsg && filtered.length > 0 && (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow
                sx={{
                  "& th": {
                    fontFamily: "Montserrat, sans-serif",
                    fontSize: 10,
                    fontWeight: 600,
                    backgroundColor: "#f0f4ff",
                  },
                }}
              >
                <TableCell>Timestamp</TableCell>
                <TableCell>Mode</TableCell>
                <TableCell>To</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Error</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((log, idx) => (
                <TableRow
                  key={idx}
                  sx={{
                    "& td": {
                      fontFamily: "Montserrat, sans-serif",
                      fontSize: 10,
                    },
                  }}
                >
                  <TableCell>
                    {log.timestamp
                      ? new Date(log.timestamp).toLocaleString()
                      : ""}
                  </TableCell>
                  <TableCell>{log.mode}</TableCell>
                  <TableCell>{log.to}</TableCell>
                  <TableCell>{log.subject}</TableCell>
                  <TableCell>{log.companyName}</TableCell>
                  <TableCell>{renderStatusChip(log.status)}</TableCell>
                  <TableCell>
                    {log.error && (
                      <Typography
                        component="span"
                        sx={{ fontSize: 9, color: "#c62828" }}
                      >
                        {log.error}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
