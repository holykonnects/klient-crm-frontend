import { useEffect, useRef } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import "grapesjs-preset-newsletter";
import "grapesjs-mjml";

export default function EmailTemplateStudio() {
  const editorRef = useRef(null);
  const gjsRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current || gjsRef.current) return;

    // --- Initialize editor ---
    const editor = grapesjs.init({
      container: editorRef.current,
      height: "calc(100vh - 72px)",
      width: "100%",
      fromElement: false,
      storageManager: false,
      noticeOnUnload: false,
      showOffsets: true,
      plugins: ["grapesjs-preset-newsletter", "grapesjs-mjml"],
      canvas: {
        styles: [
          "https://fonts.googleapis.com/css?family=Montserrat:400,500,600,700&display=swap",
        ],
      },
      panels: { defaults: [] },
    });
    gjsRef.current = editor;

    // --- Add Top Toolbar ---
    editor.Panels.addPanel({
      id: "panel-top",
      el: ".gjs-panel-top",
      buttons: [
        { id: "undo", className: "fa fa-undo", command: "core:undo" },
        { id: "redo", className: "fa fa-repeat", command: "core:redo" },
        { id: "code", className: "fa fa-code", command: "export-template" },
        { id: "save", className: "fa fa-save", command: "save-template" },
      ],
    });

    // --- Left Toolbar (Block Manager) ---
    editor.Panels.addPanel({
      id: "panel-left",
      el: ".gjs-panel-left",
      resizable: { minDim: 200, maxDim: 350, cl: 1, cr: 0 },
    });

    // --- Render Block Manager on load ---
    editor.on("load", () => {
      editor.BlockManager.render();
      editor.runCommand("open-blocks"); // 👈 force it visible
    });

    // --- Safe no-cors Save Command ---
    editor.Commands.add("save-template", {
      run: async () => {
        const html = `<style>${editor.getCss()}</style>${editor.getHtml()}`;
        localStorage.setItem("email_template_draft", html);
        alert("✅ Template saved locally (no-cors mode).");

        try {
          await fetch(
            "https://script.google.com/macros/s/AKfycbxE6byG1FUHiBPg902xADIJwOIQ8IlwCx4riqkQ2fLG_2TxuxYsseUPqG9SR0ePhXBf/exec",
            {
              method: "POST",
              mode: "no-cors",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "saveTemplate", html }),
            }
          ).catch(() => {}); // suppress network errors
        } catch {
          /* ignored intentionally */
        }
      },
    });
  }, []);

  return (
    <Box sx={{ height: "100vh", fontFamily: "Montserrat, sans-serif" }}>
      {/* Header */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ background: "#f0f4ff", borderBottom: "1px solid #d9e3f0", p: 2 }}
      >
        <Typography variant="h6" fontWeight={600}>
          Email Template Studio
        </Typography>
        <Button
          variant="contained"
          sx={{ background: "#6495ED", fontWeight: 500 }}
          onClick={() => {
            const html = localStorage.getItem("email_template_draft");
            console.log("Saved draft HTML:", html);
            alert("Open console to preview saved HTML");
          }}
        >
          Save & Preview
        </Button>
      </Stack>

      {/* Main Layout */}
      <Box sx={{ display: "flex", height: "calc(100vh - 72px)" }}>
        {/* Left Toolbar */}
        <div
          className="gjs-panel-left"
          style={{
            width: "260px",
            background: "#f8f9fb",
            borderRight: "1px solid #ddd",
            overflowY: "auto",
          }}
        ></div>

        {/* Main Canvas */}
        <Box sx={{ flexGrow: 1 }}>
          <div
            className="gjs-panel-top"
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              padding: "8px 12px",
              background: "#fff",
              borderBottom: "1px solid #ddd",
            }}
          ></div>
          <div
            ref={editorRef}
            style={{ height: "calc(100% - 45px)", background: "#fff" }}
          />
        </Box>
      </Box>
    </Box>
  );
}
