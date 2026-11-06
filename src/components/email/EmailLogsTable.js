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
  Link,
  Alert,
  Button,
  Stack,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useAuth } from "../AuthContext";
import { readEmailResponse } from './emailApiResponse';
import { normalizeEmailEvents } from '../../utils/emailEvents';

const cornflowerBlue = "#6495ED";

export default function EmailLogsTable() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const userEmail = String(user?.username || "").trim().toLowerCase();
  const [logs, setLogs] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [reload, setReload] = useState(0);

  // 🔹 Read role from localStorage (adjust key if needed)
  const [role, setRole] = useState("End User");
  useEffect(() => {
    try {
      const storedRole =
        localStorage.getItem("crmRole") ||
        localStorage.getItem("role") ||
        "End User";
      setRole(storedRole);
    } catch (e) {
      // ignore if localStorage not available
    }
  }, []);
  const isAdmin = String(user?.role || role).toLowerCase() === "admin";

  useEffect(() => {
    let active = true;
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setErrorMsg("");
        const params = new URLSearchParams({ action: "getEmailEvents", user: userEmail });
        const res = await fetch(`/api/email?${params.toString()}`);
        const json = await readEmailResponse(res);
        if (!active) return;
        const data = Array.isArray(json.data) ? json.data : [];
        // Sort: latest first
        const sorted = normalizeEmailEvents(data);
        setLogs(sorted);
        setFiltered(sorted);
      } catch (err) {
        console.error("Error fetching email logs:", err);
        if (active) { setLogs([]); setErrorMsg(err.message || 'Unable to load email logs.'); }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchLogs();
    return () => { active = false; };
  }, [userEmail, reload]);

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
          log.templateText,
          log.messageId,
          log.quotationLink, // 🔍 include quotation link in search
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
    else if (s === "ACCEPTED_BY_GMAIL") color = "info";
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
    <Box sx={{ mt: { xs: 1, sm: 2 } }}>
      <Box
        sx={{
          mb: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: 'stretch', sm: "center" },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 2 },
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
          placeholder="Search by email, subject, company, template..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            minWidth: { xs: 0, sm: 260 },
            width: { xs: '100%', sm: 'auto' },
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
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setReload(value => value + 1)}>Retry</Button>}>{errorMsg}</Alert>
      )}

      {!loading && !errorMsg && filtered.length === 0 && (
        <Typography
          sx={{ fontSize: 12, color: "#666", fontFamily: "Montserrat" }}
        >
          No email logs found yet.
        </Typography>
      )}

      {!loading && !errorMsg && filtered.length > 0 && isMobile && (
        <Stack spacing={1}>
          {filtered.map((log, idx) => <Paper key={`${log.timestamp}-${log.messageId}-${idx}`} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, overflowWrap: 'anywhere' }}>{log.subject || 'Email event'}</Typography>
                <Typography sx={{ mt: 0.25, fontSize: 10, color: 'text.secondary' }}>{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Timestamp unavailable'}</Typography>
              </Box>
              {renderStatusChip(log.status)}
            </Stack>
            {isAdmin && log.to && <Typography sx={{ mt: 1, fontSize: 10, overflowWrap: 'anywhere' }}><strong>To:</strong> {log.to}</Typography>}
            {(log.companyName || log.templateText) && <Typography sx={{ mt: 0.5, fontSize: 10, color: 'text.secondary' }}>{[log.companyName, log.templateText].filter(Boolean).join(' · ')}</Typography>}
            {log.messageId && <Typography sx={{ mt: 0.5, fontSize: 9, fontFamily: 'monospace', overflowWrap: 'anywhere' }}>Gmail ID: {log.messageId}</Typography>}
            <Stack direction="row" spacing={1.5} mt={1}>
              {log.templateUrl && <Link href={log.templateUrl} target="_blank" rel="noopener noreferrer" sx={{ fontSize: 10 }}>Template</Link>}
              {log.quotationLink && <Link href={log.quotationLink} target="_blank" rel="noopener noreferrer" sx={{ fontSize: 10 }}>Quotation</Link>}
            </Stack>
            {log.error && <Alert severity="error" sx={{ mt: 1, py: 0, '& .MuiAlert-message': { fontSize: 10 } }}>{log.error}</Alert>}
          </Paper>)}
        </Stack>
      )}

      {!loading && !errorMsg && filtered.length > 0 && !isMobile && (
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
                {isAdmin && <TableCell>To</TableCell>}
                <TableCell>Subject</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Template</TableCell>
                <TableCell>Quotation</TableCell> {/* 🔹 new visible column */}
                <TableCell>Status</TableCell>
                <TableCell>Gmail Message ID</TableCell>
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

                  {isAdmin && <TableCell>{log.to}</TableCell>}

                  <TableCell>{log.subject}</TableCell>
                  <TableCell>{log.companyName}</TableCell>

                  {/* Template link */}
                  <TableCell>
                    {log.templateUrl ? (
                      <Link
                        href={log.templateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          fontSize: 10,
                          textDecoration: "underline",
                        }}
                      >
                        {log.templateText || "Open Template"}
                      </Link>
                    ) : (
                      <Typography sx={{ fontSize: 10 }}>
                        {log.templateText || "—"}
                      </Typography>
                    )}
                  </TableCell>

                  {/* Quotation link */}
                  <TableCell>
                    {log.quotationLink ? (
                      <Link
                        href={log.quotationLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          fontSize: 10,
                          textDecoration: "underline",
                        }}
                      >
                        {`Quotation for ${
                          log.companyName || "client"
                        }`}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>

                  <TableCell>{renderStatusChip(log.status)}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{log.messageId || '—'}</TableCell>
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
