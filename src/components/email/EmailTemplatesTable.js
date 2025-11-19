import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import BackupIcon from "@mui/icons-material/Backup";
import PreviewIcon from "@mui/icons-material/Preview";
import CloseIcon from "@mui/icons-material/Close";

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzPNVeqRlTRcb_sCa_PU_EGW_EW8uZ9ClevCQRcKfa5KYR5-OpGyzp1Wsw4Sxb_x2vfqg/exec";

export default function EmailTemplatesTable() {
  const [rows, setRows] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Fetch templates from Drive
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${GAS_URL}?action=getTemplates`);
      const data = await res.json();
      if (data.ok) {
        const list = data.data.map((t, i) => ({
          id: t.id,
          name: t.name,
          modifiedTime: new Date(t.modifiedTime).toLocaleString(),
          url: t.url,
        }));
        setRows(list);
      }
    } catch (err) {
      console.error("Error loading templates:", err);
      alert("Failed to load templates.");
    }
  };

  // Preview template (HTML export)
  const handlePreview = async (id) => {
    try {
      const res = await fetch(`${GAS_URL}?action=previewTemplate&id=${id}`);
      const data = await res.json();
      if (data.ok) {
        setPreviewHtml(data.html);
        setPreviewOpen(true);
      } else {
        alert("Failed to preview template.");
      }
    } catch (err) {
      console.error(err);
      alert("Error loading preview.");
    }
  };

  // Create version (.X)
  const handleVersion = async (id) => {
    try {
      const res = await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "versionTemplate",
          templateId: id,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        alert(`Version ${data.version} created successfully.`);
        fetchTemplates();
      } else {
        alert("Failed to create version.");
      }
    } catch (err) {
      console.error(err);
      alert("Error creating template version.");
    }
  };

  const columns = [
    { field: "name", headerName: "Template Name", flex: 1 },
    { field: "modifiedTime", headerName: "Last Modified", width: 200 },
    {
      field: "preview",
      headerName: "Preview",
      width: 120,
      renderCell: (params) => (
        <IconButton onClick={() => handlePreview(params.row.id)}>
          <PreviewIcon sx={{ color: "#6495ED" }} />
        </IconButton>
      ),
    },
    {
      field: "open",
      headerName: "Open Doc",
      width: 130,
      renderCell: (params) => (
        <IconButton onClick={() => window.open(params.row.url, "_blank")}>
          <OpenInNewIcon sx={{ color: "#6495ED" }} />
        </IconButton>
      ),
    },
    {
      field: "version",
      headerName: "Version",
      width: 120,
      renderCell: (params) => (
        <IconButton onClick={() => handleVersion(params.row.id)}>
          <BackupIcon sx={{ color: "#6495ED" }} />
        </IconButton>
      ),
    },
  ];

  return (
    <Box sx={{ p: 2, fontFamily: "Montserrat, sans-serif" }}>
      
      {/* HEADER */}
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2, color: "#6495ED" }}>
        Email Templates
      </Typography>

      {/* DATAGRID */}
      <div style={{ height: 500, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          pageSizeOptions={[5, 10]}
          sx={{
            fontFamily: "Montserrat, sans-serif",
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "#f0f4ff",
              fontWeight: 700,
            },
            "& .MuiDataGrid-row:hover": {
              backgroundColor: "#f5f9ff",
            },
          }}
        />
      </div>

      {/* PREVIEW DIALOG */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, fontFamily: "Montserrat, sans-serif" }}>
          Template Preview
          <IconButton
            onClick={() => setPreviewOpen(false)}
            sx={{ position: "absolute", right: 16, top: 16 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            maxHeight: "70vh",
            overflowY: "auto",
            border: "1px solid #e0e0e0",
            padding: 2,
          }}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </Dialog>
    </Box>
  );
}
