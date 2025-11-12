import { useEffect, useRef, useState } from "react";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import "grapesjs-preset-newsletter";
import { Box, Button, Stack, Typography } from "@mui/material";

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbxE6byG1FUHiBPg902xADIJwOIQ8IlwCx4riqkQ2fLG_2TxuxYsseUPqG9SR0ePhXBf/exec";

export default function EmailTemplateStudio({ template, onClose }) {
  const editorRef = useRef(null);
  const [editor, setEditor] = useState(null);

  useEffect(() => {
    const e = grapesjs.init({
      container: "#gjs",
      height: "85vh",
      fromElement: false,
      storageManager: false,
      plugins: ["gjs-preset-newsletter"],
      pluginsOpts: { "gjs-preset-newsletter": {} },
      styleManager: { sectors: [] },
      assetManager: {
        upload: false,
        assets: [
          // optional default images
          "https://ridosports.com/logo.png",
        ],
      },
    });
    // Load existing HTML if editing
    if (template?.HTML) e.setComponents(template.HTML);

    // Add a block group for tokens
    e.BlockManager.add("token-firstname", {
      label: "{{First Name}}",
      category: "Tokens",
      content: "{{First Name}}",
    });
    e.BlockManager.add("token-company", {
      label: "{{Company}}",
      category: "Tokens",
      content: "{{Company}}",
    });
    e.BlockManager.add("token-unsub", {
      label: "{{UnsubscribeURL}}",
      category: "Tokens",
      content: '<a href="{{UnsubscribeURL}}">Unsubscribe</a>',
    });

    editorRef.current = e;
    setEditor(e);
    return () => e.destroy();
  }, [template]);

  const handleSave = async () => {
    const html = editorRef.current.getHtml();
    const payload = {
      action: "saveTemplate",
      templateId: template?.["Template ID"],
      name: template?.["Template Name"] || "New Template",
      subject: template?.Subject || "Untitled",
      fromName: template?.["From Name"] || "Rido Sports",
      fromEmail: template?.["From Email"] || "info@ridosports.com",
      html,
    };
    await fetch(WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    onClose && onClose();
  };

  return (
    <Box sx={{ p: 2, fontFamily: "Montserrat, sans-serif" }}>
      <Typography variant="h6" fontWeight={600} mb={2}>
        Email Template Studio
      </Typography>
      <div id="gjs" style={{ border: "1px solid #ccc" }}></div>

      <Stack direction="row" spacing={2} justifyContent="flex-end" mt={2}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} sx={{ background: "#6495ED" }}>
          Save Template
        </Button>
      </Stack>
    </Box>
  );
}
