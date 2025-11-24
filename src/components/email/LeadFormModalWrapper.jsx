import { Dialog, Box } from "@mui/material";
import LeadForm from "../components/LeadForm";   // adjust path based on your folder structure

export default function LeadFormModalWrapper({ open, onClose, onLeadCreated }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <Box sx={{ p: 2 }}>
        <LeadForm
          mode="add"
          onSuccess={(newLead) => {
            onLeadCreated(newLead);  // return new lead to SendEmailModal
          }}
          onCancel={onClose}
        />
      </Box>
    </Dialog>
  );
}
