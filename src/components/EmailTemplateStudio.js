import { useEffect, useRef, useState } from "react";
import { Box, Button, Stack, Typography, MenuItem, Select, IconButton } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import TuneIcon from "@mui/icons-material/Tune";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbxE6byG1FUHiBPg902xADIJwOIQ8IlwCx4riqkQ2fLG_2TxuxYsseUPqG9SR0ePhXBf/exec";

// px @ ~96dpi
const PAGE_SIZES = {
  "A4 Portrait": { w: 794, h: 1123 },
  "A4 Landscape": { w: 1123, h: 794 },
  "Letter Portrait": { w: 816, h: 1056 },
  "Letter Landscape": { w: 1056, h: 816 },
};

export default function EmailTemplateStudio() {
  const mountRef = useRef(null);
  const editorRef = useRef(null);
  const [pageKey, setPageKey] = useState("A4 Portrait");
  const [showBlocks, setShowBlocks] = useState(true);
  const [showStyles, setShowStyles] = useState(true);

  // Build the page (header/body/footer) inside a centered “paper”
  const pageHTML = (key = "A4 Portrait") => {
    const { w, h } = PAGE_SIZES[key] || PAGE_SIZES["A4 Portrait"];
    return `
      <div id="page-wrap" style="
        display:flex;justify-content:center;
        padding:32px 0;
        background:linear-gradient(135deg,#f8fbff,#eef3ff);
        min-height:100%;
      ">
        <div id="kk-page"
          style="
            width:${w}px; min-height:${h}px;
            background:#fff; border-radius:12px;
            box-shadow:0 8px 24px rgba(9,30,66,.08);
            overflow:hidden; display:flex; flex-direction:column;
          "
          data-page="${key}"
        >
          <div data-gjs="header" style="padding:14px 20px;background:#f0f4ff;border-bottom:1px solid #e1e9ff;">
            <table width="100%" style="border-spacing:0;">
              <tr>
                <td style="text-align:left;">
                  <img src="https://via.placeholder.com/110x32?text=Logo" alt="Logo" style="display:block;margin:0"/>
                </td>
                <td style="text-align:right;font-family:Montserrat,sans-serif;color:#2A2A2A;font-weight:600;">
                  {{Company}}
                </td>
              </tr>
            </table>
          </div>

          <div data-gjs="body" style="flex:1;padding:18px 20px;">
            <h2 style="margin:0 0 6px;font-family:Montserrat;">Title</h2>
            <p style="margin:0 0 10px;">Drag blocks from the left into this Body.</p>
            <table width="100%" style="border-spacing:0;">
              <tr>
                <td width="50%" style="padding:8px;vertical-align:top">
                  <h3 style="margin:0 0 4px;">Left</h3>
                  <p style="margin:0;">Write here…</p>
                </td>
                <td width="50%" style="padding:8px;vertical-align:top">
                  <h3 style="margin:0 0 4px;">Right</h3>
                  <p style="margin:0;">Write here…</p>
                </td>
              </tr>
            </table>
          </div>

          <div data-gjs="footer" style="padding:12px 16px;background:#f8f8f8;border-top:1px solid #eee;text-align:center;font-size:12px;color:#666;">
            © {{Company}} | {{Year}} · <a href="{{UnsubscribeURL}}" style="color:#6495ED;text-decoration:none;">Unsubscribe</a>
          </div>
        </div>
      </div>
    `;
  };

  // Fit page to width or whole page in view (via GrapesJS zoom)
  const fitToWidth = () => {
    const ed = editorRef.current;
    if (!ed) return;
    const frame = ed.Canvas.getFrameEl();
    if (!frame) return;
    const doc = frame.contentDocument;
    const page = doc.getElementById("kk-page");
    if (!page) return;

    const canvasRect = ed.Canvas.getElement().getBoundingClientRect();
    const leftPanel = document.getElementById("blocks-col");
    const rightPanel = document.getElementById("styles-col");
    const sidePads =
      (leftPanel && leftPanel.offsetParent ? leftPanel.offsetWidth : 0) +
      (rightPanel && rightPanel.offsetParent ? rightPanel.offsetWidth : 0);

    const avail = canvasRect.width; // canvas inner column width
    const scale = Math.min(1, (avail - 40) / page.offsetWidth); // 20px padding each side
    ed.Canvas.setZoom(scale || 1);
    ed.Canvas.centerContent();
  };

  const fitPage = () => {
    const ed = editorRef.current;
    if (!ed) return;
    const frame = ed.Canvas.getFrameEl();
    if (!frame) return;
    const doc = frame.contentDocument;
    const page = doc.getElementById("kk-page");
    if (!page) return;

    const canvasRect = ed.Canvas.getElement().getBoundingClientRect();
    const scaleW = (canvasRect.width - 40) / page.offsetWidth;
    const scaleH = (canvasRect.height - 40) / page.offsetHeight;
    const scale = Math.min(1, scaleW, scaleH);
    ed.Canvas.setZoom(scale || 1);
    ed.Canvas.centerContent();
  };

  // Apply new size to the page (keeping content)
  const applySize = (key) => {
    const ed = editorRef.current;
    if (!ed) return;
    const frame = ed.Canvas.getFrameEl();
    if (!frame) return;
    const doc = frame.contentDocument;
    const page = doc.getElementById("kk-page");
    if (!page) return;
    const { w, h } = PAGE_SIZES[key] || PAGE_SIZES["A4 Portrait"];
    page.style.width = `${w}px`;
    page.style.minHeight = `${h}px`;
    page.setAttribute("data-page", key);
    // adjust zoom after size change
    fitToWidth();
  };

  useEffect(() => {
    if (!mountRef.current || editorRef.current) return;

    // Shell layout (Blocks | Canvas | Styles)
    mountRef.current.innerHTML = `
      <div id="gjs-shell" style="display:flex;height:100%;width:100%;">
        <aside id="blocks-col" style="width:250px;min-width:250px;background:#f6f9ff;border-right:1px solid #d6e1fb;display:flex;flex-direction:column;">
          <div style="padding:8px 10px;border-bottom:1px solid #e6eeff;font:600 12px Montserrat;">Blocks</div>
          <div id="blocks-list" style="flex:1;overflow:auto;padding:10px;"></div>
        </aside>
        <main id="gjs-canvas" style="flex:1;background:#eef3ff;"></main>
        <aside id="styles-col" style="width:280px;min-width:280px;background:#fafbff;border-left:1px solid #d6e1fb;display:flex;flex-direction:column;">
          <div style="padding:8px 10px;border-bottom:1px solid #e6eeff;font:600 12px Montserrat;">Styles</div>
          <div id="gjs-styles" style="flex:1;overflow:auto;padding:10px;"></div>
        </aside>
      </div>
    `;

    const editor = grapesjs.init({
      container: "#gjs-canvas",
      height: "calc(100vh - 88px)", // compact header
      width: "100%",
      storageManager: false,
      noticeOnUnload: false,
      blockManager: { appendTo: "#blocks-list" },
      styleManager: { appendTo: "#gjs-styles" },
      canvas: {
        styles: [
          "https://fonts.googleapis.com/css?family=Montserrat:400,500,600,700&display=swap",
        ],
      },
      panels: { defaults: [] },
    });
    editorRef.current = editor;

    // Theme
    const css = document.createElement("style");
    css.innerHTML = `
      .gjs-one-bg { background-color:#f6f9ff !important; }
      .gjs-two-color { color:#6495ED !important; }
      .gjs-three-bg { background-color:#6495ED !important; }
      .gjs-four-color, .gjs-color-h { color:#6495ED !important; }
      .gjs-block { border-radius:8px;border:1px solid #e6eeff;background:#fff;padding:8px;font:600 12px Montserrat; }
      .gjs-block:hover { box-shadow:0 5px 14px rgba(100,149,237,.25); }
      .gjs-frame { background:transparent; }
    `;
    document.head.appendChild(css);

    // Minimal blocks (you can add more later)
    const bm = editor.BlockManager;
    const cat = (name) => ({ category: { label: name, open: true } });

    bm.add("section", {
      label: "Section",
      content: `<section style="padding:16px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(9,30,66,.06);"><h3 style="margin:0 0 6px;">Section</h3><p style="margin:0;">Write…</p></section>`,
      ...cat("Layout"),
    });

    bm.add("two-col", {
      label: "2 Columns",
      content: `
        <table width="100%" style="border-spacing:0;">
          <tr>
            <td width="50%" style="padding:8px;vertical-align:top"><h4>Left</h4><p>Text…</p></td>
            <td width="50%" style="padding:8px;vertical-align:top"><h4>Right</h4><p>Text…</p></td>
          </tr>
        </table>`,
      ...cat("Layout"),
    });

    bm.add("image", {
      label: "Image",
      content: `<img src="https://via.placeholder.com/800x300" style="width:100%;border-radius:8px;display:block;">`,
      ...cat("Elements"),
    });

    bm.add("text", {
      label: "Text",
      content: `<p style="margin:0;">Add paragraph…</p>`,
      ...cat("Elements"),
    });

    bm.add("button", {
      label: "Button",
      content: `<a href="#" style="background:#6495ED;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Button</a>`,
      ...cat("Elements"),
    });

    bm.add("divider", {
      label: "Divider",
      content: `<hr style="border:none;border-top:1px solid #e3ecff;margin:12px 0">`,
      ...cat("Elements"),
    });

    // Load page and fit
    editor.on("load", () => {
      editor.setComponents(pageHTML(pageKey));
      // give iframe a tick to render, then fit
      setTimeout(fitToWidth, 100);
    });

    // Refit on canvas resize
    const ro = new ResizeObserver(() => fitToWidth());
    ro.observe(document.getElementById("gjs-canvas"));

    // Clean up
    return () => {
      ro.disconnect();
    };
  }, []); // mount once

  // UI handlers
  const handleSize = (val) => {
    setPageKey(val);
    applySize(val);
  };

  const toggleBlocks = () => {
    const el = document.getElementById("blocks-col");
    setShowBlocks((v) => {
      const next = !v;
      if (el) el.style.display = next ? "flex" : "none";
      // refit after layout change
      setTimeout(fitToWidth, 50);
      return next;
    });
  };

  const toggleStyles = () => {
    const el = document.getElementById("styles-col");
    setShowStyles((v) => {
      const next = !v;
      if (el) el.style.display = next ? "flex" : "none";
      setTimeout(fitToWidth, 50);
      return next;
    });
  };

  // Save / Preview (no-CORS)
  const doSave = async () => {
    const ed = editorRef.current;
    if (!ed) return;
    const html = `<style>${ed.getCss()}</style>${ed.getHtml()}`;
    localStorage.setItem("email_template_draft", html);
    try {
      await fetch(WEBAPP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveTemplate", html }),
      }).catch(() => {});
      alert("✅ Saved (no-CORS).");
    } catch {}
  };

  const doPreview = () => {
    const ed = editorRef.current;
    if (!ed) return;
    const html = `<style>${ed.getCss()}</style>${ed.getHtml()}`;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  };

  return (
    <Box sx={{ height: "100vh", fontFamily: "Montserrat, sans-serif" }}>
      {/* Compact top bar */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          background: "#f0f4ff",
          borderBottom: "1px solid #d6e1fb",
          px: 1.5,
          py: 1,
          gap: 1,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton size="small" onClick={toggleBlocks} title="Toggle Blocks">
            <MenuIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={toggleStyles} title="Toggle Styles">
            <TuneIcon fontSize="small" />
          </IconButton>
          <Typography sx={{ fontWeight: 700, fontSize: 14, ml: 0.5 }}>
            Email Template Studio
          </Typography>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography sx={{ fontWeight: 600, fontSize: 12 }}>Page</Typography>
          <Select
            size="small"
            value={pageKey}
            onChange={(e) => handleSize(e.target.value)}
            sx={{
              minWidth: 150,
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#6495ED" },
              fontSize: 12,
              height: 32,
            }}
          >
            {Object.keys(PAGE_SIZES).map((k) => (
              <MenuItem key={k} value={k}>
                {k}
              </MenuItem>
            ))}
          </Select>

          <Button size="small" variant="outlined" onClick={fitToWidth}
            sx={{ color: "#6495ED", borderColor: "#6495ED", textTransform: "none" }}>
            Fit Width
          </Button>
          <Button size="small" variant="outlined" onClick={fitPage}
            sx={{ color: "#6495ED", borderColor: "#6495ED", textTransform: "none" }}>
            Fit Page
          </Button>

          <Button size="small" variant="outlined" onClick={doPreview}
            sx={{ color: "#6495ED", borderColor: "#6495ED", textTransform: "none" }}>
            Preview
          </Button>
          <Button size="small" variant="contained" onClick={doSave}
            sx={{ background: "#6495ED", textTransform: "none", "&:hover": { background: "#4a76d2" } }}>
            Save
          </Button>
        </Stack>
      </Stack>

      {/* Editor area */}
      <Box ref={mountRef} sx={{ height: "calc(100vh - 48px)" }} />
    </Box>
  );
}