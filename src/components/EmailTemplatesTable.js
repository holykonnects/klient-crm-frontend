import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Typography,
  IconButton,
  Stack,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbxE6byG1FUHiBPg902xADIJwOIQ8IlwCx4riqkQ2fLG_2TxuxYsseUPqG9SR0ePhXBf/exec";

export default function EmailTemplatesTable() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    templateId: "",
    name: "",
    subject: "",
    fromName: "",
    fromEmail: "",
    html: "",
    status: "Active",
  });

  // Fetch templates on load
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${WEBAPP_URL}?action=getTemplates`);
      const data = await res.json();
      if (data.ok) setRows(data.data || []);
    } catch (err) {
      console.error("Error fetching templates:", err);
      alert("Failed to load templates. Please try again later.");
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch(WEBAPP_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "saveTemplate",
          ...form,
          status: form.status || "Active",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const d = await res.json();
      if (d.ok) {
        setOpen(false);
        await fetchTemplates();
      } else {
        alert("Failed to save template. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Error while saving template.");
    }
  };

  const handleEdit = (row) => {
    setForm({
      templateId: row["Template ID"] || "",
      name: row["Template Name"] || "",
      subject: row["Subject"] || "",
      fromName: row["From Name"] || "",
      fromEmail: row["From Email"] || "",
      html: row["HTML"] || "",
      status: row["Status"] || "Active",
    });
    setOpen(true);
  };

  const columns = [
    { field: "Template Name", headerName: "Template Name", flex: 1 },
    { field: "Subject", headerName: "Subject", flex: 1 },
    { field: "From Name", headerName: "From Name", flex: 1 },
    {
      field: "actions",
      headerName: "",
      width: 80,
      renderCell: (params) => (
        <IconButton onClick={() => handleEdit(params.row)}>
          <EditIcon />
        </IconButton>
      ),
    },
  ];

  return (
    <Box sx={{ fontFamily: "Montserrat, sans-serif", p: 2 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={1}
      >
        <Typography variant="h6" fontWeight={600}>
          Email Templates
        </Typography>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={() => {
            setForm({
              templateId: "",
              name: "",
              subject: "",
              fromName: "",
              fromEmail: "",
              html: "",
              status: "Active",
            });
            setOpen(true);
          }}
          sx={{
            backgroundColor: "#6495ED",
            fontFamily: "Montserrat, sans-serif",
            textTransform: "none",
            "&:hover": { backgroundColor: "#5077d5" },
          }}
        >
          New Template
        </Button>
      </Stack>

      <div style={{ height: 450, width: "100%" }}>
        <DataGrid
          rows={rows || []}
          getRowId={(r) =>
            r["Template ID"] || Math.random().toString(36).slice(2)
          }
          columns={columns}
          pageSize={5}
          disableSelectionOnClick
          sx={{
            fontFamily: "Montserrat, sans-serif",
            "& .MuiDataGrid-columnHeaders": {
              background: "#f0f4ff",
              fontWeight: 600,
            },
          }}
        />
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle
          sx={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}
        >
          {form.templateId ? "Edit Template" : "New Template"}
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Template Name"
            fullWidth
            margin="dense"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            label="Subject"
            fullWidth
            margin="dense"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="From Name"
              margin="dense"
              fullWidth
              value={form.fromName}
              onChange={(e) => setForm({ ...form, fromName: e.target.value })}
            />
            <TextField
              label="From Email"
              margin="dense"
              fullWidth
              value={form.fromEmail}
              onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
            />
          </Stack>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            HTML / Body
          </Typography>
          <ReactQuill
            theme="snow"
            value={form.html}
            onChange={(v) => setForm({ ...form, html: v })}
            style={{ height: 250, marginBottom: 20 }}
          />

          <Stack direction="row" justifyContent="flex-end" spacing={2}>
            <Button
              onClick={() => setOpen(false)}
              sx={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              sx={{
                background: "#6495ED",
                fontFamily: "Montserrat, sans-serif",
                "&:hover": { background: "#5077d5" },
              }}
            >
              Save
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
