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
      height: "calc(100vh - 64px)",
      width: "100%",
      fromElement: false,
      storageManager: false,
      showOffsets: true,
      noticeOnUnload: false,
      plugins: ["grapesjs-preset-newsletter", "grapesjs-mjml"],
      pluginsOpts: {
        "grapesjs-preset-newsletter": {
          modalLabelImport: "Paste your HTML here",
          modalLabelExport: "Copy the HTML below",
          codeViewOptions: "htmlmixed",
        },
        "grapesjs-mjml": {},
      },
      panels: { defaults: [] },
      canvas: {
        styles: [
          "https://cdnjs.cloudflare.com/ajax/libs/meyer-reset/2.0/reset.min.css",
          "https://fonts.googleapis.com/css?family=Montserrat:400,500,700",
        ],
      },
    });

    gjsRef.current = editor;

    // ✅ Define Left & Top Panels
    editor.Panels.addPanel({
      id: "panel-top",
      el: ".panel__top",
    });

    editor.Panels.addPanel({
      id: "basic-actions",
      el: ".panel__basic-actions",
      buttons: [
        {
          id: "visibility",
          className: "fa fa-square-o",
          command: "sw-visibility",
          active: true,
          attributes: { title: "Toggle Canvas" },
        },
        {
          id: "export",
          className: "fa fa-code",
          command: "export-template",
          attributes: { title: "View Code" },
        },
        {
          id: "undo",
          className: "fa fa-undo",
          command: "undo",
          attributes: { title: "Undo" },
        },
        {
          id: "redo",
          className: "fa fa-repeat",
          command: "redo",
          attributes: { title: "Redo" },
        },
        {
          id: "save",
          className: "fa fa-save",
          command: "save-template",
          attributes: { title: "Save Template" },
        },
      ],
    });

    // ✅ Add block manager (left toolbar)
    editor.Panels.addPanel({
      id: "panel-left",
      el: ".panel__left",
      resizable: {
        maxDim: 350,
        minDim: 200,
        tc: 0,
        cl: 1,
        cr: 0,
        bc: 0,
      },
    });

    // ✅ Show the block manager content
    const blockManager = editor.BlockManager;
    editor.on("load", () => {
      blockManager.render();
    });

    // ✅ Add Save Command
    editor.Commands.add("save-template", {
      run: () => {
        const html = editor.getHtml();
        const css = editor.getCss();
        const fullHTML = `<style>${css}</style>${html}`;
        localStorage.setItem("email_template_draft", fullHTML);
        alert("✅ Template saved locally. Will connect to Google Sheets next.");
      },
    });
  }, []);

  return (
    <Box
      sx={{
        height: "100vh",
        fontFamily: "Montserrat, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* --- Header Bar --- */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        p={2}
        sx={{ background: "#f0f4ff", borderBottom: "1px solid #ccc" }}
      >
        <Typography variant="h6" fontWeight={600}>
          Email Template Studio
        </Typography>
        <Button
          variant="contained"
          onClick={() => {
            const html = localStorage.getItem("email_template_draft");
            console.log("Saved draft HTML:", html);
            alert("Open console to preview saved HTML");
          }}
          sx={{ background: "#6495ED" }}
        >
          Save & Preview
        </Button>
      </Stack>

      {/* --- Layout Wrapper --- */}
      <Box sx={{ display: "flex", height: "calc(100vh - 64px)" }}>
        {/* LEFT TOOLBAR (Block Manager) */}
        <div
          className="panel__left"
          style={{
            width: "250px",
            background: "#fafafa",
            borderRight: "1px solid #ccc",
            overflowY: "auto",
          }}
        ></div>

        {/* MAIN EDITOR AREA */}
        <Box sx={{ flexGrow: 1, position: "relative" }}>
          <div
            className="panel__top"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 10px",
              background: "#fff",
              borderBottom: "1px solid #ddd",
            }}
          ></div>

          <div
            className="panel__basic-actions"
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              padding: "8px 12px",
              background: "#f7f9fc",
              borderBottom: "1px solid #ddd",
            }}
          ></div>

          <div
            ref={editorRef}
            style={{
              height: "calc(100% - 60px)",
              overflow: "hidden",
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
