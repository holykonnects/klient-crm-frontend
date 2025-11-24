import { Dialog, Box } from "@mui/material";
import LeadForm from "../LeadForm";

export default function LeadFormModalWrapper({
  open,
  onClose,
  onLeadCreated
}) {

  const handleSuccess = (lead) => {
    // Pass the lead straight back to the parent
    onLeadCreated(lead);
    // Parent handles closing the modal
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <Box sx={{ p: 2 }}>
        <LeadForm
          mode="add"
          onSuccess={handleSuccess}
          onCancel={onClose}
        />
      </Box>
    </Dialog>
  );
}
