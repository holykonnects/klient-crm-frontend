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

    // 🎨 Layout: Left (Blocks), Center (Canvas), Right (Styles)
    const container = editorRef.current;
    container.innerHTML = `
      <div id="gjs-wrapper" style="display:flex;height:100%;width:100%;">
        <div id="blocks" style="
          width:260px;
          background:#f7f9fc;
          border-right:1px solid #ddd;
          overflow-y:auto;
          padding:10px;
        "></div>
        <div id="gjs-canvas" style="flex-grow:1;background:#fff;"></div>
        <div id="styles" style="
          width:300px;
          background:#f7f9fc;
          border-left:1px solid #ddd;
          overflow-y:auto;
          padding:10px;
        "></div>
      </div>
    `;

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

    // 🧱 Define custom blocks (sections, columns, image)
    const bm = editor.BlockManager;

    bm.add("section", {
      label: "Section",
      category: "Layout",
      content: `
        <section style="padding:40px; background:#ffffff;">
          <h2 style="font-family:Montserrat, sans-serif;">New Section</h2>
          <p>Write something amazing here...</p>
        </section>
      `,
    });

    bm.add("image-block", {
      label: "Image",
      category: "Media",
      content: '<img src="https://via.placeholder.com/600x200" style="width:100%;border-radius:8px;">',
    });

    bm.add("text-block", {
      label: "Text",
      category: "Content",
      content: '<p style="font-family:Montserrat,sans-serif;">Add your text here...</p>',
    });

    // Add a background image option in the Style Manager
    editor.StyleManager.addProperty("extra", {
      id: "background-image",
      name: "Background Image",
      type: "file",
      property: "background-image",
      defaults: "",
      full: true,
    });

    // Load default layout
    editor.on("load", () => {
      editor.BlockManager.render();
      editor.StyleManager.render();

      editor.setComponents(`
        <table width="100%" style="font-family: Montserrat, sans-serif; color:#333;">
          <tr>
            <td align="center" style="background:#f0f4ff; padding:20px;">
              <h1 style="margin:0;">{{Company}} Newsletter</h1>
              <p style="margin:5px 0 0 0;">Bringing you the latest updates</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;">
              <table width="100%">
                <tr>
                  <td width="50%" style="padding:10px; vertical-align:top;">
                    <h2>Left Column Title</h2>
                    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
                    <a href="#" style="color:#6495ED;">Read more →</a>
                  </td>
                  <td width="50%" style="padding:10px; vertical-align:top;">
                    <img src="https://via.placeholder.com/250" width="100%" style="border-radius:8px;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background:#f8f8f8; padding:15px; font-size:12px; color:#777;">
              <p>© {{Company}} | {{Year}}<br>
              <a href="{{UnsubscribeURL}}" style="color:#6495ED;">Unsubscribe</a></p>
            </td>
          </tr>
        </table>
      `);
    });

    // 💾 Save (no-cors)
    editor.Commands.add("save-template", {
      run: async () => {
        const html = `<style>${editor.getCss()}</style>${editor.getHtml()}`;
        localStorage.setItem("email_template_draft", html);
        alert("✅ Template saved locally (no-cors).");
        try {
          await fetch(
            "https://script.google.com/macros/s/AKfycbxE6byG1FUHiBPg902xADIJwOIQ8IlwCx4riqkQ2fLG_2TxuxYsseUPqG9SR0ePhXBf/exec",
            {
              method: "POST",
              mode: "no-cors",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "saveTemplate", html }),
            }
          ).catch(() => {});
        } catch {}
      },
    });

    // 👁️ Preview
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
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ background: "#f0f4ff", borderBottom: "1px solid #d9e3f0", p: 2 }}
      >
        <Typography variant="h6" fontWeight={600}>
          Email Template Studio
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            sx={{ color: "#6495ED", borderColor: "#6495ED" }}
            onClick={() => gjsRef.current?.runCommand("preview-template")}
          >
            Preview in Browser
          </Button>
          <Button
            variant="contained"
            sx={{ background: "#6495ED", fontWeight: 500 }}
            onClick={() => gjsRef.current?.runCommand("save-template")}
          >
            Save & Preview
          </Button>
        </Stack>
      </Stack>

      <Box ref={editorRef} sx={{ height: "calc(100vh - 72px)" }} />
    </Box>
  );
}
