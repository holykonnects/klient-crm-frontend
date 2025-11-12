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

    const editor = grapesjs.init({
      container: editorRef.current,
      height: "calc(100vh - 72px)",
      width: "100%",
      fromElement: false,
      storageManager: false,
      noticeOnUnload: false,
      showOffsets: true,
      plugins: ["grapesjs-preset-newsletter", "grapesjs-mjml"],
      pluginsOpts: {
        "grapesjs-preset-newsletter": {
          modalLabelImport: "Paste your HTML here",
          modalLabelExport: "Copy the HTML below",
          codeViewOptions: "htmlmixed",
        },
        "grapesjs-mjml": {},
      },
      canvas: {
        styles: [
          "https://fonts.googleapis.com/css?family=Montserrat:400,500,600,700&display=swap",
        ],
      },
      panels: { defaults: [] },
    });

    gjsRef.current = editor;

    // ✅ Create left sidebar for block manager
    const panelManager = editor.Panels;
    panelManager.addPanel({
      id: "panel-left",
      el: ".gjs-panel-left",
      resizable: { maxDim: 400, minDim: 200, cl: 1, cr: 0, tc: 0, bc: 0 },
    });

    // ✅ Add top toolbar
    panelManager.addPanel({
      id: "panel-top",
      el: ".gjs-panel-top",
      buttons: [
        {
          id: "undo",
          className: "fa fa-undo",
          command: "core:undo",
          attributes: { title: "Undo" },
        },
        {
          id: "redo",
          className: "fa fa-repeat",
          command: "core:redo",
          attributes: { title: "Redo" },
        },
        {
          id: "export",
          className: "fa fa-code",
          command: "export-template",
          attributes: { title: "View HTML" },
        },
        {
          id: "save",
          className: "fa fa-save",
          command: "save-template",
          attributes: { title: "Save Template" },
        },
      ],
    });

    // ✅ Block Manager appears on load
    editor.on("load", () => {
      editor.BlockManager.render();
    });

    // ✅ Add Save Command with no-cors
    editor.Commands.add("save-template", {
      run: async () => {
        const html = `<style>${editor.getCss()}</style>${editor.getHtml()}`;
        localStorage.setItem("email_template_draft", html);
        alert("✅ Template saved locally. (no-cors safe)");
        try {
          await fetch(
            "https://script.google.com/macros/s/AKfycbxE6byG1FUHiBPg902xADIJwOIQ8IlwCx4riqkQ2fLG_2TxuxYsseUPqG9SR0ePhXBf/exec",
            {
              method: "POST",
              mode: "no-cors",
              body: JSON.stringify({ action: "saveTemplate", html }),
            }
          );
        } catch (e) {
          console.error("Save failed (no-cors)", e);
        }
      },
    });
  }, []);

  return (
    <Box sx={{ height: "100vh", fontFamily: "Montserrat, sans-serif" }}>
      {/* --- Header --- */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{
          background: "#f0f4ff",
          borderBottom: "1px solid #d9e3f0",
          p: 2,
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          Email Template Studio
        </Typography>
        <Button
          variant="contained"
          sx={{ background: "#6495ED", fontWeight: 500 }}
          onClick={() => {
            const html = localStorage.getItem("email_template_draft");
            console.log("Draft HTML:", html);
            alert("Open console to view saved HTML.");
          }}
        >
          Save & Preview
        </Button>
      </Stack>

      {/* --- Main Layout --- */}
      <Box sx={{ display: "flex", height: "calc(100vh - 72px)" }}>
        {/* LEFT TOOLBAR */}
        <div
          className="gjs-panel-left"
          style={{
            width: "260px",
            background: "#f8f9fb",
            borderRight: "1px solid #ddd",
            overflowY: "auto",
          }}
        />

        {/* MAIN CANVAS + TOP TOOLBAR */}
        <Box sx={{ flexGrow: 1, position: "relative" }}>
          <div
            className="gjs-panel-top"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "8px 12px",
              background: "#fff",
              borderBottom: "1px solid #ddd",
              fontSize: "14px",
            }}
          />
          <div
            ref={editorRef}
            style={{
              height: "calc(100% - 45px)",
              background: "#fff",
              overflow: "hidden",
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
