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

    // --- Wrapper Layout ---
    const container = editorRef.current;
    container.innerHTML = `
      <div id="gjs-wrapper" style="display:flex;height:100%;width:100%;">
        <div id="blocks" style="
          width:260px;
          background:#f7f9ff;
          border-right:2px solid #d0ddf7;
          overflow-y:auto;
          padding:12px;
        "></div>
        <div id="gjs-canvas" style="
          flex-grow:1;
          background:linear-gradient(135deg,#f8fbff 0%,#eef3ff 100%);
          box-shadow:inset 0 0 10px rgba(0,0,0,0.05);
        "></div>
        <div id="styles" style="
          width:300px;
          background:#fafbff;
          border-left:2px solid #d0ddf7;
          overflow-y:auto;
          padding:12px;
        "></div>
      </div>
    `;

    // --- Initialize GrapesJS ---
    const editor = grapesjs.init({
      container: "#gjs-canvas",
      height: "calc(100vh - 72px)",
      width: "100%",
      fromElement: false,
      storageManager: false,
      noticeOnUnload: false,
      plugins: ["grapesjs-preset-newsletter", "grapesjs-mjml"],
      blockManager: { appendTo: "#blocks" },
      styleManager: { appendTo: "#styles" },
      canvas: {
        styles: [
          "https://fonts.googleapis.com/css?family=Montserrat:400,500,600,700&display=swap",
        ],
      },
      panels: { defaults: [] },
    });
    gjsRef.current = editor;

    // --- Custom Blocks ---
    const bm = editor.BlockManager;

    bm.add("hero-banner", {
      label: "Hero Banner",
      category: "Layout",
      content: `
        <section style="background-image:url('https://via.placeholder.com/800x250');
          background-size:cover;
          background-position:center;
          color:white;
          text-align:center;
          padding:60px 20px;
          border-radius:12px;
        ">
          <h1 style="font-family:Montserrat,sans-serif;font-size:32px;margin:0;">Your Majestic Headline</h1>
          <p style="font-size:18px;margin:10px 0 20px;">Inspire your readers with a beautiful banner</p>
          <a href="#" style="background:#6495ED;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Call to Action</a>
        </section>
      `,
    });

    bm.add("two-column", {
      label: "2 Columns",
      category: "Layout",
      content: `
        <table width="100%" style="padding:20px 0;">
          <tr>
            <td width="50%" style="padding:10px;">
              <h3 style="font-family:Montserrat;">Column One</h3>
              <p>Write content here.</p>
            </td>
            <td width="50%" style="padding:10px;">
              <h3 style="font-family:Montserrat;">Column Two</h3>
              <p>Write content here.</p>
            </td>
          </tr>
        </table>
      `,
    });

    bm.add("three-column", {
      label: "3 Columns",
      category: "Layout",
      content: `
        <table width="100%" style="padding:20px 0;">
          <tr>
            <td width="33%" style="padding:10px;text-align:center;">
              <img src="https://via.placeholder.com/100" style="border-radius:50%;"><p>Feature 1</p>
            </td>
            <td width="33%" style="padding:10px;text-align:center;">
              <img src="https://via.placeholder.com/100" style="border-radius:50%;"><p>Feature 2</p>
            </td>
            <td width="33%" style="padding:10px;text-align:center;">
              <img src="https://via.placeholder.com/100" style="border-radius:50%;"><p>Feature 3</p>
            </td>
          </tr>
        </table>
      `,
    });

    // --- Extra Style Controls (backgrounds) ---
    editor.StyleManager.addProperty("decorations", {
      id: "background-image",
      name: "Background Image",
      type: "file",
      property: "background-image",
      defaults: "",
      full: true,
    });
    editor.StyleManager.addProperty("decorations", {
      id: "background-gradient",
      name: "Gradient",
      type: "text",
      property: "background",
      defaults: "",
      full: true,
      placeholder: "linear-gradient(135deg,#6495ED,#4a76d2)",
    });

    // --- Load default layout ---
    editor.on("load", () => {
      editor.BlockManager.render();
      editor.StyleManager.render();
      editor.setComponents(`
        <section style="padding:40px;background:#ffffff;border-radius:12px;box-shadow:0 3px 8px rgba(0,0,0,0.08);">
          <h2 style="text-align:center;font-family:Montserrat;">Welcome to the Email Studio</h2>
          <p style="text-align:center;">Drag a Hero, Column or Text block from the left to get started.</p>
        </section>
      `);

      // Inject Cornflower Blue UI overrides
      const style = document.createElement("style");
      style.innerHTML = `
        .gjs-one-bg { background-color:#f7f9ff !important; }
        .gjs-two-color { color:#6495ED !important; }
        .gjs-three-bg { background-color:#6495ED !important; }
        .gjs-four-color, .gjs-color-h { color:#6495ED !important; }
        .gjs-block { border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.05); }
        .gjs-block:hover { box-shadow:0 3px 10px rgba(0,0,0,0.15); transform:translateY(-1px); }
        .gjs-pn-btn.gjs-pn-active, .gjs-pn-btn:hover { background:#6495ED !important; color:#fff !important; }
        .gjs-block-label { font-family:Montserrat,sans-serif; font-weight:600; }
      `;
      document.head.appendChild(style);
    });

    // --- Save (no-CORS) ---
    editor.Commands.add("save-template", {
      run: async () => {
        const html = `<style>${editor.getCss()}</style>${editor.getHtml()}`;
        localStorage.setItem("email_template_draft", html);
        alert("✅ Template saved locally (no-cors).");
        await fetch(
          "https://script.google.com/macros/s/AKfycbxE6byG1FUHiBPg902xADIJwOIQ8IlwCx4riqkQ2fLG_2TxuxYsseUPqG9SR0ePhXBf/exec",
          {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "saveTemplate", html }),
          }
        ).catch(() => {});
      },
    });

    // --- Preview ---
    editor.Commands.add("preview-template", {
      run: () => {
        const html = `<style>${editor.getCss()}</style>${editor.getHtml()}`;
        const preview = window.open("", "_blank");
        preview.document.write(html);
        preview.document.close();
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
        sx={{
          background: "#f0f4ff",
          borderBottom: "2px solid #d0ddf7",
          p: 2,
          boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
        }}
      >
        <Typography variant="h6" fontWeight={600} color="#2A2A2A">
          Email Template Studio
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            sx={{ color: "#6495ED", borderColor: "#6495ED", fontWeight: 600 }}
            onClick={() => gjsRef.current?.runCommand("preview-template")}
          >
            Preview in Browser
          </Button>
          <Button
            variant="contained"
            sx={{
              background: "#6495ED",
              fontWeight: 600,
              "&:hover": { background: "#4a76d2" },
            }}
            onClick={() => gjsRef.current?.runCommand("save-template")}
          >
            Save & Preview
          </Button>
        </Stack>
      </Stack>

      {/* Editor */}
      <Box ref={editorRef} sx={{ height: "calc(100vh - 72px)" }} />
    </Box>
  );
}
