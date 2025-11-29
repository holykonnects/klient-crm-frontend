import { Dialog, Box, TextField, Button, Typography, Stack } from "@mui/material";
import { useState, useEffect } from "react";

export default function MinimalLeadModal({ open, onClose, onSave }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [company, setCompany] = useState("");

  // Reset form when modal re-opens
  useEffect(() => {
    if (open) {
      setEmail("");
      setFirstName("");
      setCompany("");
    }
  }, [open]);

  const handleSubmit = () => {
    if (!email) return alert("Email is required.");

    onSave({
      email,
      firstName,
      company
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Box p={3} sx={{ fontFamily: "Montserrat" }}>
        <Typography fontWeight={600} mb={2}>
          Quick Lead Entry
        </Typography>

        <Stack spacing={2}>
          {/* Email */}
          <TextField
            label="Email *"
            required
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {/* First Name */}
          <TextField
            label="First Name"
            fullWidth
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />

          {/* Company */}
          <TextField
            label="Company"
            fullWidth
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />

          <Button variant="contained" fullWidth onClick={handleSubmit}>
            Continue
          </Button>
        </Stack>
      </Box>
    </Dialog>
  );
}
