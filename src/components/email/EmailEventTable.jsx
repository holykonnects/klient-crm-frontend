import { useEffect, useState } from "react";
import { Box, Dialog, Typography, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import EmailService from "./EmailService";

export default function EmailEventTable({ open, onClose }) {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (open) {
      EmailService.getEvents().then(setLogs);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <Box p={3}>
        <Typography variant="h6" fontWeight="bold">Email Logs</Typography>

        <Table sx={{ mt: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Recipient</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Template</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((l,i)=>(
              <TableRow key={i}>
                <TableCell>{l.timestamp}</TableCell>
                <TableCell>{l.to}</TableCell>
                <TableCell>{l.subject}</TableCell>
                <TableCell>{l.templateId}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Dialog>
  );
}
