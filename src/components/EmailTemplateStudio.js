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
      height: "100vh",
      fromElement: false,
      storageManager: false,
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

    // ✅ Add panels (top + left)
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

    editor.Panels.addPanel({
      id: "panel-left",
      el: ".panel__left",
      buttons: [
        {
          id: "add-block",
          className: "fa fa-plus-square",
          command: "show-blocks",
          active: true,
          attributes: { title: "Blocks" },
        },
      ],
    });

    // ✅ Render default blocks
    const bm = editor.BlockManager;
    editor.on("load", () => {
      bm.render();
    });

    // ✅ Save template locally (can later connect to Apps Script)
    editor.Commands.add("save-template", {
      run: () => {
        const html = editor.getHtml();
        const css = editor.getCss();
        const fullHTML = `<style>${css}</style>${html}`;
        localStorage.setItem("email_template_draft", fullHTML);
        alert("✅ Template saved locally. We’ll connect Google Sheets next.");
      },
    });

  }, []);

  return (
    <Box sx={{ height: "100vh", fontFamily: "Montserrat, sans-serif" }}>
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

      {/* --- Toolbar Containers --- */}
      <div className="panel__top"></div>
      <div className="panel__basic-actions"></div>
      <div className="panel__left"></div>

      {/* --- Editor Container --- */}
      <div
        ref={editorRef}
        style={{
          height: "calc(100vh - 64px)",
          overflow: "hidden",
        }}
      />
    </Box>
  );
}
