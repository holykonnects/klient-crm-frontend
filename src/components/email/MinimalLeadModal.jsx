import { Dialog, Box, TextField, Button, Typography, Stack } from "@mui/material";
import { useState } from "react";

export default function MinimalLeadModal({ open, onClose, onSave }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [Company, setCompany] = useState("");

  const handleSubmit = () => {
    if (!email) return alert("Email is required.");

    onSave({
      email,
      firstName,
      Company
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Box p={3} sx={{ fontFamily: "Montserrat" }}>
        <Typography fontWeight={600} mb={2}>
          Quick Lead Entry
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Email (Required)"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <TextField
            label="First Name (Optional)"
            fullWidth
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />

          <TextField
            label="Last Name (Optional)"
            fullWidth
            value={Company}
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
