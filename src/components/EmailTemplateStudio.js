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

    // ✅ Build layout containers safely
    const container = editorRef.current;
    container.innerHTML = `
      <div id="gjs-wrapper" style="display:flex;height:100%;">
        <div id="blocks" style="
          width:260px;
          background:#f8f9fb;
          border-right:1px solid #ddd;
          overflow-y:auto;
          padding:10px;
        "></div>
        <div id="gjs-canvas" style="flex-grow:1;"></div>
      </div>
    `;

    // ✅ Initialize GrapesJS
    const editor = grapesjs.init({
      container: "#gjs-canvas",
      fromElement: false,
      height: "calc(100vh - 72px)",
      width: "100%",
      storageManager: false,
      plugins: ["grapesjs-preset-newsletter", "grapesjs-mjml"],
      blockManager: { appendTo: "#blocks" },
      canvas: {
        styles: [
          "https://fonts.googleapis.com/css?family=Montserrat:400,500,600,700&display=swap",
        ],
      },
      panels: { defaults: [] },
    });
    gjsRef.current = editor;

    // ✅ Ensure blocks appear and default layout loads
    editor.on("load", () => {
      editor.BlockManager.render();
      editor.runCommand("open-blocks");
      // Auto-load layout for immediate visibility
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

    // ✅ Save (no-CORS safe)
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

      {/* GrapesJS Mount Point */}
      <Box ref={editorRef} sx={{ height: "calc(100vh - 72px)" }} />
    </Box>
  );
}
