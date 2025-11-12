// /components/EmailTemplateStudio.js
import { useEffect, useRef } from "react";
import { Box, Button, Stack, Tooltip, IconButton, Typography } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import "grapesjs-preset-newsletter";
import "grapesjs-mjml";

export default function EmailTemplateStudio() {
  const editorRef = useRef(null);
  const gjsRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current || gjsRef.current) return;

    // ----- Layout containers -----
    const container = editorRef.current;
    container.innerHTML = `
      <div id="gjs-wrapper" style="display:flex;height:100%;width:100%;">
        <div id="blocks" style="width:260px;background:#f7f9fc;border-right:1px solid #d9e3f0;overflow-y:auto;padding:10px;"></div>
        <div id="gjs-canvas" style="flex-grow:1;background:#fff;"></div>
        <div id="styles" style="width:320px;background:#f7f9fc;border-left:1px solid #d9e3f0;overflow-y:auto;padding:10px;"></div>
      </div>
    `;

    // ----- GrapesJS init -----
    const editor = grapesjs.init({
      container: "#gjs-canvas",
      height: "calc(100vh - 72px)",
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

    // ----- Responsive scaling CSS -----
    const responsiveCSS = `
      html, body { margin:0; padding:0; box-sizing:border-box; }
      * { box-sizing:border-box; }
      img, .gjs-image {
        max-width:100% !important;
        height:auto !important;
        object-fit:contain !important;
      }
      table, td {
        border-collapse:collapse !important;
        width:auto;
      }
      @media only screen and (max-width:1024px) {
        body { zoom:0.9; }
      }
      @media only screen and (max-width:768px) {
        body { zoom:0.85; }
        h1, h2, h3, h4 { font-size:calc(1em + 0.3vw); }
        table, td { width:100% !important; display:block; }
        section { padding:20px !important; }
      }
      @media only screen and (max-width:480px) {
        body { zoom:0.8; }
        img { width:100% !important; height:auto !important; }
        h1, h2, h3 { font-size:calc(1em + 0.2vw); }
      }
    `;

    // ----- Add blocks -----
    const bm = editor.BlockManager;
    bm.add("section", {
      label: "Section",
      category: "Layout",
      content: `
        <section style="padding:40px;background:#ffffff;">
          <h2 style="font-family:Montserrat,sans-serif;">New Section</h2>
          <p>Add your content here...</p>
        </section>`,
    });
    bm.add("two-columns", {
      label: "2 Columns",
      category: "Layout",
      content: `
        <table width="100%">
          <tr>
            <td width="50%" style="padding:10px;vertical-align:top;">
              <p>Left column content</p>
            </td>
            <td width="50%" style="padding:10px;vertical-align:top;">
              <p>Right column content</p>
            </td>
          </tr>
        </table>`,
    });
    bm.add("image", {
      label: "Image",
      category: "Media",
      content: `<img src="https://via.placeholder.com/600x200" style="width:100%;border-radius:8px;">`,
    });
    bm.add("button", {
      label: "Button",
      category: "Content",
      content: `<a href="#" style="display:inline-block;background:#6495ED;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Click Me</a>`,
    });
    bm.add("text", {
      label: "Text",
      category: "Content",
      content: `<p style="font-family:Montserrat,sans-serif;">Type your text here...</p>`,
    });

    // ----- Load initial content -----
    editor.on("load", () => {
      editor.BlockManager.render();
      editor.StyleManager.render();
      editor.setComponents(`
        <table width="100%" style="font-family:Montserrat,sans-serif;color:#333;">
          <tr>
            <td align="center" style="background:#f0f4ff;padding:20px;">
              <h1 style="margin:0;">{{Company}} Newsletter</h1>
              <p style="margin:5px 0 0 0;">Bringing you the latest updates</p>
              <img src="https://via.placeholder.com/200x60?text=Logo" style="margin-top:10px;">
            </td>
          </tr>
          <tr>
            <td style="padding:20px;">
              <table width="100%">
                <tr>
                  <td width="50%" style="padding:10px;vertical-align:top;">
                    <h2>Left Column Title</h2>
                    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
                    <a href="#" style="color:#6495ED;">Read more →</a>
                  </td>
                  <td width="50%" style="padding:10px;vertical-align:top;">
                    <img src="https://via.placeholder.com/250" width="100%" style="border-radius:8px;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background:#f8f8f8;padding:15px;font-size:12px;color:#777;">
              <p>© {{Company}} | {{Year}}<br><a href="{{UnsubscribeURL}}" style="color:#6495ED;">Unsubscribe</a></p>
            </td>
          </tr>
        </table>
      `);
      // Inject responsive CSS inside canvas
      const frame = editor.Canvas.getFrameEl();
      const doc = frame?.contentDocument;
      if (doc) {
        const styleEl = doc.createElement("style");
        styleEl.innerHTML = responsiveCSS;
        doc.head.appendChild(styleEl);
      }
    });

    // ----- Smart scaling (auto responsive toggle) -----
    const resizeHandler = () => {
      const width = window.innerWidth;
      if (width > 1024) editor.setDevice("Desktop");
      else if (width > 768) editor.setDevice("Tablet");
      else editor.setDevice("Mobile portrait");
    };
    window.addEventListener("resize", resizeHandler);
    resizeHandler();

    // ----- Save -----
    editor.Commands.add("save-template", {
      run: async () => {
        const html = `<style>${editor.getCss()}</style>${responsiveCSS}${editor.getHtml()}`;
        localStorage.setItem("email_template_draft", html);
        alert("✅ Template saved locally (no-CORS).");
        try {
          await fetch(
            "https://script.google.com/macros/s/AKfycbxE6byG1FUHiBPg902xADIJwOIQ8IlwCx4riqkQ2fLG_2TxuxYsseUPqG9SR0ePhXBf/exec",
            {
              method: "POST",
              mode: "no-cors",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "saveTemplate", html }),
            }
          );
        } catch {}
      },
    });

    // ----- Preview -----
    editor.Commands.add("preview-template", {
      run: () => {
        const html = `<style>${editor.getCss()}</style>${responsiveCSS}${editor.getHtml()}`;
        const w = window.open("", "_blank");
        w.document.write(html);
        w.document.close();
      },
    });

    return () => window.removeEventListener("resize", resizeHandler);
  }, []);

  // ----- Toolbar -----
  return (
    <Box sx={{ height: "100vh", fontFamily: "Montserrat, sans-serif" }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ background: "#f0f4ff", borderBottom: "1px solid #d9e3f0", p: 2 }}
      >
        <Typography variant="h6" fontWeight={600}>
          Email Template Studio
        </Typography>

        <Stack direction="row" spacing={1}>
          <Tooltip title="Add Section">
            <IconButton
              onClick={() => {
                const ed = gjsRef.current;
                ed.addComponents(
                  `<section style="padding:40px;background:#ffffff;"><h2>New Section</h2><p>Write your content here...</p></section>`
                );
              }}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Delete Selected">
            <IconButton
              onClick={() => {
                const ed = gjsRef.current;
                const selected = ed.getSelected();
                if (selected) selected.remove();
              }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Preview Template">
            <IconButton onClick={() => gjsRef.current?.runCommand("preview-template")}>
              <VisibilityIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Save Template">
            <IconButton onClick={() => gjsRef.current?.runCommand("save-template")}>
              <SaveIcon sx={{ color: "#6495ED" }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* GrapesJS Mount */}
      <Box ref={editorRef} sx={{ height: "calc(100vh - 72px)" }} />
    </Box>
  );
}
