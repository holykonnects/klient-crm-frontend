export default function AddLeadModalForEmail({ open, onClose, onLeadCreated }) {
  return (
    <AddLeadModal
      open={open}
      onClose={onClose}
      // 🚀 When Lead is successfully created
      onSubmitSuccess={(lead) => {
        onLeadCreated(lead);
      }}
    />
  );
}
