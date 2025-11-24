import { Dialog, Box } from "@mui/material";

// ⭐ Correct path to LeadForm.jsx
import LeadForm from "../LeadForm";

export default function LeadFormModalWrapper({ open, onClose, onLeadCreated }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <Box sx={{ p: 2 }}>
        <LeadForm
          mode="add"
          onSuccess={(lead) => {
            onLeadCreated(lead);
          }}
          onCancel={onClose}
        />
      </Box>
    </Dialog>
  );
}
