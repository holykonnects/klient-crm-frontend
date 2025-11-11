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

    const blockPanel = document.createElement("div");
    blockPanel.id = "blocks";
    blockPanel.style.width = "280px";
    blockPanel.style.background = "#f8f9fb";
    blockPanel.style.borderRight = "1px solid #ddd";
    blockPanel.style.overflowY = "auto";
    blockPanel.style.padding = "10px";
    blockPanel.style.boxSizing = "border-box";

    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.height = "100%";
    wrapper.appendChild(blockPanel);
    wrapper.appendChild(editorRef.current.parentNode.replaceChild(wrapper, editorRef.current));
    wrapper.appendChild(editorRef.current);

    const editor = grapesjs.init({
      container: editorRef.current,
      height: "calc(100vh - 72px)",
      width: "100%",
      fromElement: false,
      storageManager: false,
      noticeOnUnload: false,
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

    editor.on("load", () => {
      editor.BlockManager.render();
      editor.runCommand("open-blocks");
    });

    // --- Default Layout Button ---
    editor.Commands.add("load-default-layout", {
      run: () => {
        const layoutHTML = `
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
                      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse euismod.</p>
                      <a href="#" style="color:#6495ED;">Read more →</a>
                    </td>
                    <td width="50%" style="padding:10px; vertical-align:top;">
                      <img src="https://via.placeholder.com/250" alt="Image" width="100%" style="border-radius:8px;">
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
        `;
        editor.setComponents(layoutHTML);
      },
    });

    // --- Save Template (no-cors safe) ---
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
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            sx={{ color: "#6495ED", borderColor: "#6495ED" }}
            onClick={() => gjsRef.current?.runCommand("load-default-layout")}
          >
            Load Default Layout
          </Button>
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
      </Stack>

      {/* Canvas */}
      <Box sx={{ display: "flex", height: "calc(100vh - 72px)", background: "#fff" }}>
        <div ref={editorRef} style={{ flexGrow: 1 }} />
      </Box>
    </Box>
  );
}
