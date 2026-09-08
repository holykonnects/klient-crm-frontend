import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import FolderIcon from "@mui/icons-material/Folder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useAuth } from "./AuthContext";

const EDITOR_USERS = new Set([
  "sandeep@ridosports.com",
  "sidhant@ridosports.com",
  "holy@klientkonnect.com",
]);

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return String(value);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSize(value) {
  const n = Number(value || 0);
  if (!n) return "-";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function canPreview(file) {
  const type = String(file?.mimeType || "");
  return (
    type === "application/pdf" ||
    type.startsWith("image/") ||
    type.startsWith("text/") ||
    type.startsWith("application/vnd.google-apps.")
  );
}

export default function NomenclatureManager() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [folderStack, setFolderStack] = useState([]);
  const [rootFolderId, setRootFolderId] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const currentFolderId = folderStack[folderStack.length - 1]?.id || "";
  const userEmail = useMemo(() => String(user?.username || "").trim().toLowerCase(), [user?.username]);
  const isEditor = canEdit || EDITOR_USERS.has(userEmail);

  async function loadFolder(folderId = currentFolderId, nextStack = folderStack) {
    if (!userEmail) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ user: userEmail });
      if (folderId) params.set("folderId", folderId);
      const res = await fetch(`/api/nomenclature?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `Nomenclature failed with status ${res.status}`);

      setRootFolderId(json.rootFolderId || "");
      setCanEdit(Boolean(json.canEdit));
      setFolders(json.folders || []);
      setFiles(json.files || []);
      setFolderStack(nextStack);
      setSelectedFile(null);
    } catch (err) {
      setError(err.message || "Unable to load nomenclature files");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFolder("", []);
  }, [userEmail]);

  if (!userEmail) {
    return (
      <Alert severity="error">
        Please sign in to access Nomenclature Manager.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3, fontFamily: "Montserrat, sans-serif" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2} mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#1f2937">
            Nomenclature Manager
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review baseline files, preview them, and download your own working copies.
          </Typography>
          <Chip
            size="small"
            sx={{ mt: 1 }}
            color={isEditor ? "primary" : "default"}
            label={isEditor ? "Baseline editor" : "Download only"}
          />
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={() => loadFolder()} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction="row" spacing={1} alignItems="center" mb={2} flexWrap="wrap">
        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          disabled={!folderStack.length || loading}
          onClick={() => {
            const next = folderStack.slice(0, -1);
            loadFolder(next[next.length - 1]?.id || rootFolderId, next);
          }}
        >
          Back
        </Button>
        <Chip size="small" label="Root" />
        {folderStack.map((folder) => (
          <Chip key={folder.id} size="small" label={folder.name} />
        ))}
      </Stack>

      <Stack direction={{ xs: "column", lg: "row" }} gap={2} alignItems="stretch">
        <Paper sx={{ width: { xs: "100%", lg: 420 }, minHeight: 560, borderRadius: 1, overflow: "hidden" }}>
          <Box sx={{ p: 2, bgcolor: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
            <Typography fontWeight={700}>Baseline Library</Typography>
          </Box>
          {loading ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <List dense disablePadding>
              {folders.map((folder) => (
                <ListItemButton
                  key={folder.id}
                  onClick={() => loadFolder(folder.id, [...folderStack, { id: folder.id, name: folder.name }])}
                >
                  <FolderIcon sx={{ color: "#6495ED", mr: 1.5 }} />
                  <ListItemText primary={folder.name} secondary="Folder" />
                </ListItemButton>
              ))}
              {!!folders.length && !!files.length && <Divider />}
              {files.map((file) => (
                <ListItemButton
                  key={file.id}
                  selected={selectedFile?.id === file.id}
                  onClick={() => setSelectedFile(file)}
                >
                  <InsertDriveFileIcon sx={{ color: "#64748b", mr: 1.5 }} />
                  <ListItemText
                    primary={file.name}
                    secondary={`${formatDate(file.modifiedTime)} • ${formatSize(file.size)}`}
                  />
                </ListItemButton>
              ))}
              {!folders.length && !files.length && (
                <Box sx={{ p: 3, color: "text.secondary" }}>No files found in this folder.</Box>
              )}
            </List>
          )}
        </Paper>

        <Paper sx={{ flex: 1, minHeight: 560, borderRadius: 1, overflow: "hidden" }}>
          <Box sx={{ p: 2, bgcolor: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
              <Box>
                <Typography fontWeight={700}>{selectedFile?.name || "Preview"}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedFile ? `${selectedFile.mimeType || "File"} • ${formatDate(selectedFile.modifiedTime)}` : "Select a file to preview"}
                </Typography>
              </Box>
              {selectedFile && (
                <Stack direction="row" spacing={1}>
                  {isEditor && selectedFile.webViewLink && (
                    <Button
                      size="small"
                      startIcon={<OpenInNewIcon />}
                      href={selectedFile.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Edit in Drive
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    href={`/api/nomenclature?action=download&fileId=${encodeURIComponent(selectedFile.id)}&user=${encodeURIComponent(userEmail)}`}
                  >
                    Download
                  </Button>
                </Stack>
              )}
            </Stack>
          </Box>

          {selectedFile && canPreview(selectedFile) ? (
            <Box
              component="iframe"
              title={selectedFile.name}
              src={`/api/nomenclature?action=preview&fileId=${encodeURIComponent(selectedFile.id)}&user=${encodeURIComponent(userEmail)}`}
              sx={{ width: "100%", height: 500, border: 0 }}
            />
          ) : (
            <Box sx={{ p: 4, color: "text.secondary" }}>
              {selectedFile ? "Preview is not available for this file type. Use Open or Download." : "Select a file from the library."}
            </Box>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}
