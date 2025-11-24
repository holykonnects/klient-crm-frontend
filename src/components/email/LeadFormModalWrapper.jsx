import { Dialog, Box } from "@mui/material";
import LeadForm from "../LeadForm";

export default function LeadFormModalWrapper({
  open,
  onClose,
  onLeadCreated
}) {
  const handleSuccess = (lead) => {
    // 1. Immediately close the modal BEFORE LeadForm resets itself
    onClose();

    // 2. Push the lead back to SendEmailModal
    onLeadCreated(lead);

    // 3. DO NOT LET LeadForm reopen itself
    // (we do NOT call any reset or allow ref mounts)
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
