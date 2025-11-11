import { useEffect, useRef } from "react";
import { Box, Button, Stack, Typography, MenuItem, Select } from "@mui/material";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import "grapesjs-preset-newsletter";
import "grapesjs-mjml";

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbxE6byG1FUHiBPg902xADIJwOIQ8IlwCx4riqkQ2fLG_2TxuxYsseUPqG9SR0ePhXBf/exec";

// px sizes @ ~96dpi: A4 = 794x1123, Letter ≈ 816x1056
const PAGE_SIZES = {
  "A4 Portrait": { w: 794, h: 1123 },
  "A4 Landscape": { w: 1123, h: 794 },
  "Letter Portrait": { w: 816, h: 1056 },
  "Letter Landscape": { w: 1056, h: 816 },
};

export default function EmailTemplateStudio() {
  const mountRef = useRef(null);
  const editorRef = useRef(null);
  const sizeRef = useRef("A4 Portrait");

  // --- helper to apply page size inside canvas ---
  const applyPageSize = (ed, sizeKey) => {
    const { w, h } = PAGE_SIZES[sizeKey] || PAGE_SIZES["A4 Portrait"];
    const frameEl = ed.Canvas.getFrameEl();
    if (!frameEl) return;
    const doc = frameEl.contentDocument;
    const page = doc.getElementById("kk-page");
    if (page) {
      page.style.width = w + "px";
      page.style.minHeight = h + "px";
      // also update a data attr for potential CSS
      page.setAttribute("data-page", sizeKey);
    }
  };

  // --- build the page scaffold (Header/Body/Footer) ---
  const basePageHTML = () => `
    <div id="page-wrap" style="display:flex;justify-content:center;padding:40px 0;background:linear-gradient(135deg,#f8fbff,#eef3ff);">
      <div id="kk-page"
           style="width:${PAGE_SIZES["A4 Portrait"].w}px;min-height:${PAGE_SIZES["A4 Portrait"].h}px;background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(9,30,66,.08);overflow:hidden;display:flex;flex-direction:column;">
        <!-- Header -->
        <div data-gjs="header" style="padding:20px 28px;background:#f0f4ff;border-bottom:1px solid #e1e9ff;">
          <table width="100%" style="border-spacing:0;">
            <tr>
              <td style="text-align:left;">
                <img src="https://via.placeholder.com/140x40?text=Logo" alt="Logo" style="display:block;margin:0"/>
              </td>
              <td style="text-align:right;font-family:Montserrat,sans-serif;color:#2A2A2A;font-weight:600;">
                {{Company}}
              </td>
            </tr>
          </table>
        </div>

        <!-- Body -->
        <div data-gjs="body" style="flex:1;padding:28px;">
          <h2 style="margin:0 0 8px;font-family:Montserrat;">Title / Subject</h2>
          <p style="margin:0 0 16px;">Start adding sections from the left panel. This area is the page body.</p>

          <!-- starter two-col -->
          <table width="100%" style="border-spacing:0;">
            <tr>
              <td width="50%" style="padding:10px;vertical-align:top">
                <h3 style="margin:0 0 6px;">Left Column</h3>
                <p style="margin:0;">Write content here…</p>
              </td>
              <td width="50%" style="padding:10px;vertical-align:top">
                <h3 style="margin:0 0 6px;">Right Column</h3>
                <p style="margin:0;">Write content here…</p>
              </td>
            </tr>
          </table>
        </div>

        <!-- Footer -->
        <div data-gjs="footer" style="padding:16px 24px;background:#f8f8f8;border-top:1px solid #eee;text-align:center;font-size:12px;color:#666;">
          © {{Company}} | {{Year}} · <a href="{{UnsubscribeURL}}" style="color:#6495ED;text-decoration:none;">Unsubscribe</a><br/>
          123, Your Street, Your City
        </div>
      </div>
    </div>
  `;

  useEffect(() => {
    if (!mountRef.current || editorRef.current) return;

    // ---------- Shell layout: Blocks | Canvas | Styles ----------
    const root = mountRef.current;
    root.innerHTML = `
      <div id="gjs-shell" style="display:flex;height:100%;width:100%;">
        <aside id="gjs-blocks" style="width:280px;background:#f6f9ff;border-right:2px solid #d6e1fb;display:flex;flex-direction:column;">
          <div style="padding:10px;border-bottom:1px solid #e6eeff;font-weight:600;font-family:Montserrat;">Blocks</div>
          <div id="blocks-list" style="flex:1;overflow:auto;padding:10px;"></div>
        </aside>
        <main id="gjs-canvas" style="flex:1;background:#eef3ff;"></main>
        <aside id="gjs-styles" style="width:320px;background:#fafbff;border-left:2px solid #d6e1fb;overflow:auto;padding:12px;"></aside>
      </div>
    `;

    // ---------- GrapesJS init ----------
    const editor = grapesjs.init({
      container: "#gjs-canvas",
      height: "calc(100vh - 118px)", // header + selector strip
      width: "100%",
      storageManager: false,
      noticeOnUnload: false,
      plugins: ["grapesjs-preset-newsletter", "grapesjs-mjml"],
      blockManager: { appendTo: "#blocks-list" },
      styleManager: { appendTo: "#gjs-styles" },
      canvas: {
        styles: [
          "https://fonts.googleapis.com/css?family=Montserrat:400,500,600,700&display=swap",
        ],
        // ensure our centered page wrapper is used
        // we inject the page scaffold on load via setComponents
      },
      panels: { defaults: [] },
    });
    editorRef.current = editor;

    // ---------- Theme UI (Cornflower Blue) ----------
    const css = document.createElement("style");
    css.innerHTML = `
      .gjs-one-bg { background-color:#f6f9ff !important; }
      .gjs-two-color { color:#6495ED !important; }
      .gjs-three-bg { background-color:#6495ED !important; }
      .gjs-four-color, .gjs-color-h { color:#6495ED !important; }
      .gjs-block { border-radius:10px;border:1px solid #e6eeff;padding:10px;background:#fff; }
      .gjs-block:hover { box-shadow:0 6px 16px rgba(100,149,237,.25); transform:translateY(-1px); }
      .gjs-frame { background:transparent; }
    `;
    document.head.appendChild(css);

    // ---------- Blocks (a compact but rich set) ----------
    const bm = editor.BlockManager;
    const cat = (name) => ({ category: { label: name, open: false } });

    bm.add("section-clear", {
      label: "Section",
      content: `
        <section style="padding:24px;background:#ffffff;border-radius:8px;box-shadow:0 2px 8px rgba(9,30,66,.06);">
          <h3 style="margin:0 0 6px;">Section Title</h3>
          <p style="margin:0;">Write something…</p>
        </section>`,
      ...cat("Layout"),
    });

    bm.add("2col", {
      label: "2 Columns",
      content: `
        <table width="100%" style="border-spacing:0;">
          <tr>
            <td width="50%" style="padding:10px;vertical-align:top">
              <h3>Left</h3><p>Text…</p>
            </td>
            <td width="50%" style="padding:10px;vertical-align:top">
              <h3>Right</h3><p>Text…</p>
            </td>
          </tr>
        </table>`,
      ...cat("Layout"),
    });

    bm.add("3col", {
      label: "3 Columns",
      content: `
        <table width="100%" style="border-spacing:0;">
          <tr>
            <td width="33%" style="padding:10px;vertical-align:top;text-align:center">
              <img src="https://via.placeholder.com/120" style="border-radius:8px;display:block;margin:0 auto 8px"/><p>Feature 1</p>
            </td>
            <td width="33%" style="padding:10px;vertical-align:top;text-align:center">
              <img src="https://via.placeholder.com/120" style="border-radius:8px;display:block;margin:0 auto 8px"/><p>Feature 2</p>
            </td>
            <td width="33%" style="padding:10px;vertical-align:top;text-align:center">
              <img src="https://via.placeholder.com/120" style="border-radius:8px;display:block;margin:0 auto 8px"/><p>Feature 3</p>
            </td>
          </tr>
        </table>`,
      ...cat("Layout"),
    });

    bm.add("image", {
      label: "Image",
      content: `<img src="https://via.placeholder.com/800x300" style="width:100%;border-radius:10px;display:block;">`,
      ...cat("Elements"),
    });

    bm.add("text", {
      label: "Text",
      content: `<p style="margin:0;">Add your paragraph text…</p>`,
      ...cat("Elements"),
    });

    bm.add("button", {
      label: "Button",
      content: `<a href="#" style="background:#6495ED;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Button</a>`,
      ...cat("Elements"),
    });

    bm.add("divider", {
      label: "Divider",
      content: `<hr style="border:none;border-top:1px solid #e3ecff;margin:16px 0">`,
      ...cat("Elements"),
    });

    bm.add("spacer", {
      label: "Spacer",
      content: `<div style="height:24px;"></div>`,
      ...cat("Elements"),
    });

    // ---------- Style Manager extras (backgrounds) ----------
    const sm = editor.StyleManager;
    sm.addProperty("decorations", {
      id: "bg-image",
      name: "Background Image",
      type: "file",
      property: "background-image",
      defaults: "",
      full: true,
    });
    sm.addProperty("decorations", {
      id: "bg-size",
      name: "Bg Size",
      type: "select",
      property: "background-size",
      defaults: "cover",
      options: [
        { id: "cover", label: "Cover" },
        { id: "contain", label: "Contain" },
        { id: "auto", label: "Auto" },
      ],
    });
    sm.addProperty("decorations", {
      id: "bg-pos",
      name: "Bg Position",
      type: "text",
      property: "background-position",
      defaults: "center",
      full: true,
    });

    // ---------- Load the page scaffold ----------
    editor.on("load", () => {
      editor.setComponents(basePageHTML());
      applyPageSize(editor, sizeRef.current);
    });

    // ---------- Save & Preview ----------
    editor.Commands.add("save-template", {
      run: async () => {
        const html = `<style>${editor.getCss()}</style>${editor.getHtml()}`;
        localStorage.setItem("email_template_draft", html);
        alert("✅ Saved locally (no-CORS).");
        try {
          await fetch(WEBAPP_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "saveTemplate", html }),
          }).catch(() => {});
        } catch {}
      },
    });

    editor.Commands.add("preview-template", {
      run: () => {
        const html = `<style>${editor.getCss()}</style>${editor.getHtml()}`;
        const w = window.open("", "_blank");
        w.document.write(html);
        w.document.close();
      },
    });
  }, []);

  // Top bar with size selector
  const onChangeSize = (val) => {
    sizeRef.current = val;
    const ed = editorRef.current;
    if (ed) {
      // ensure scaffold exists, then apply size
      applyPageSize(ed, val);
    }
  };

  return (
    <Box sx={{ height: "100vh", fontFamily: "Montserrat, sans-serif" }}>
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          background: "#f0f4ff",
          borderBottom: "2px solid #d6e1fb",
          p: 2,
          gap: 2,
        }}
      >
        <Typography variant="h6" fontWeight={600} color="#2A2A2A">
          Email Template Studio
        </Typography>

        <Stack direction="row" alignItems="center" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography fontWeight={600}>Page Size</Typography>
            <Select
              size="small"
              value={sizeRef.current}
              onChange={(e) => onChangeSize(e.target.value)}
              sx={{
                minWidth: 180,
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "#6495ED" },
              }}
            >
              {Object.keys(PAGE_SIZES).map((key) => (
                <MenuItem key={key} value={key}>{key}</MenuItem>
              ))}
            </Select>
          </Stack>

          <Button
            variant="outlined"
            sx={{ color: "#6495ED", borderColor: "#6495ED", fontWeight: 600 }}
            onClick={() => editorRef.current?.runCommand("preview-template")}
          >
            Preview
          </Button>
          <Button
            variant="contained"
            sx={{ background: "#6495ED", fontWeight: 600, "&:hover": { background: "#4a76d2" } }}
            onClick={() => editorRef.current?.runCommand("save-template")}
          >
            Save
          </Button>
        </Stack>
      </Stack>

      {/* Editor */}
      <Box ref={mountRef} sx={{ height: "calc(100vh - 118px)" }} />
    </Box>
  );
}