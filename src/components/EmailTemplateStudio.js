import { useEffect, useRef, useState } from "react";
import { Box, IconButton, Tooltip, Select, MenuItem, Stack } from "@mui/material";
import ViewSidebarIcon from "@mui/icons-material/ViewSidebar";      // Toggle Blocks
import TuneIcon from "@mui/icons-material/Tune";                      // Toggle Styles
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";          // Fit Page
import ZoomInMapIcon from "@mui/icons-material/ZoomInMap";            // Fit Width
import VisibilityIcon from "@mui/icons-material/Visibility";          // Preview
import SaveIcon from "@mui/icons-material/Save";                      // Save
import DescriptionIcon from "@mui/icons-material/Description";        // Page size icon

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

  // --- page scaffold (header/body/footer) ---
  const pageHTML = (key = "A4 Portrait") => {
    const { w, h } = PAGE_SIZES[key] || PAGE_SIZES["A4 Portrait"];
    return `
      <div id="page-wrap" style="
        display:flex;justify-content:center;
        min-height:100%;padding:32px 0;
        background:var(--kk-grid,#eef3ff);
      ">
        <div id="kk-page"
          style="
            width:${w}px;min-height:${h}px;background:#fff;
            border-radius:12px;box-shadow:0 8px 24px rgba(9,30,66,.08);
            overflow:hidden;display:flex;flex-direction:column;
          " data-page="${key}">
          <div data-gjs="header" style="padding:14px 20px;background:#f0f4ff;border-bottom:1px solid #e1e9ff;">
            <table width="100%" style="border-spacing:0;">
              <tr>
                <td style="text-align:left">
                  <img src="https://via.placeholder.com/120x34?text=Logo" alt="Logo" style="display:block;margin:0"/>
                </td>
                <td style="text-align:right;font:600 14px Montserrat;color:#2A2A2A;">
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
                  <h3 style="margin:0 0 4px;">Left</h3><p style="margin:0;">Write here…</p>
                </td>
                <td width="50%" style="padding:8px;vertical-align:top">
                  <h3 style="margin:0 0 4px;">Right</h3><p style="margin:0;">Write here…</p>
                </td>
              </tr>
            </table>
          </div>

          <div data-gjs="footer" style="padding:12px 16px;background:#f8f8f8;border-top:1px solid #eee;text-align:center;font-size:12px;color:#666;">
            © {{Company}} | {{Year}} · <a href="{{UnsubscribeURL}}" style="color:#6495ED;text-decoration:none;">Unsubscribe</a>
          </div>
        </div>
      </div>`;
  };

  // ---- helpers: find page + fit logic ----
  const getPage = () => {
    const ed = editorRef.current;
    const frame = ed?.Canvas.getFrameEl();
    const doc = frame?.contentDocument;
    return doc?.getElementById("kk-page") || null;
  };

  const fitWidth = () => {
    const ed = editorRef.current;
    const page = getPage();
    if (!ed || !page) return;
    const canvasRect = ed.Canvas.getElement().getBoundingClientRect();
    const avail = canvasRect.width;
    const scale = Math.min(1, (avail - 48) / page.offsetWidth); // side padding
    ed.Canvas.setZoom(scale || 1);
    ed.Canvas.centerContent();
  };

  const fitPage = () => {
    const ed = editorRef.current;
    const page = getPage();
    if (!ed || !page) return;
    const canvasRect = ed.Canvas.getElement().getBoundingClientRect();
    const scaleW = (canvasRect.width - 48) / page.offsetWidth;
    const scaleH = (canvasRect.height - 48) / page.offsetHeight;
    const scale = Math.min(1, scaleW, scaleH);
    ed.Canvas.setZoom(scale || 1);
    ed.Canvas.centerContent();
  };

  const applySize = (key) => {
    const page = getPage();
    if (!page) return;
    const { w, h } = PAGE_SIZES[key] || PAGE_SIZES["A4 Portrait"];
    page.style.width = `${w}px`;
    page.style.minHeight = `${h}px`;
    page.setAttribute("data-page", key);
    // refit after size change
    setTimeout(fitWidth, 10);
  };

  useEffect(() => {
    if (!mountRef.current || editorRef.current) return;

    // shell
    mountRef.current.innerHTML = `
      <style>
        /* subtle grid background for canvas */
        #gjs-canvas { --kk-grid: repeating-linear-gradient(0deg,#eef3ff,#eef3ff 22px,#e9f0ff 22px,#e9f0ff 44px); }
      </style>
      <div id="gjs-shell" style="display:flex;height:100%;width:100%;">
        <aside id="blocks-col" style="width:240px;min-width:240px;background:#f6f9ff;border-right:1px solid #d6e1fb;display:flex;flex-direction:column;">
          <div style="padding:8px 10px;border-bottom:1px solid #e6eeff;font:600 12px Montserrat;">Blocks</div>
          <div id="blocks-list" style="flex:1;overflow:auto;padding:10px;"></div>
        </aside>
        <main id="gjs-canvas" style="flex:1;background:var(--kk-grid);"></main>
        <aside id="styles-col" style="width:280px;min-width:280px;background:#fafbff;border-left:1px solid #d6e1fb;display:flex;flex-direction:column;">
          <div style="padding:8px 10px;border-bottom:1px solid #e6eeff;font:600 12px Montserrat;">Styles</div>
          <div id="gjs-styles" style="flex:1;overflow:auto;padding:10px;"></div>
        </aside>
      </div>
    `;

    const editor = grapesjs.init({
      container: "#gjs-canvas",
      height: "calc(100vh - 56px)",          // compact top bar
      storageManager: false,
      blockManager: { appendTo: "#blocks-list" },
      styleManager: { appendTo: "#gjs-styles" },
      canvas: {
        styles: ["https://fonts.googleapis.com/css?family=Montserrat:400,500,600,700&display=swap"],
      },
      panels: { defaults: [] },
    });
    editorRef.current = editor;

    // theme (cornflower)
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

    // blocks (concise)
    const bm = editor.BlockManager;
    const cat = (name) => ({ category: { label: name, open: true } });
    bm.add("section", { label: "Section",
      content: `<section style="padding:16px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(9,30,66,.06);"><h3 style="margin:0 0 6px;">Section</h3><p style="margin:0;">Write…</p></section>`, ...cat("Layout") });
    bm.add("two-col", { label: "2 Columns",
      content: `<table width="100%" style="border-spacing:0;"><tr><td width="50%" style="padding:8px;vertical-align:top"><h4>Left</h4><p>Text…</p></td><td width="50%" style="padding:8px;vertical-align:top"><h4>Right</h4><p>Text…</p></td></tr></table>`, ...cat("Layout") });
    bm.add("image",    { label: "Image", content:`<img src="https://via.placeholder.com/800x300" style="width:100%;border-radius:8px;display:block;">`, ...cat("Elements") });
    bm.add("text",     { label: "Text",  content:`<p style="margin:0;">Add paragraph…</p>`, ...cat("Elements") });
    bm.add("button",   { label: "Button", content:`<a href="#" style="background:#6495ED;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Button</a>`, ...cat("Elements") });
    bm.add("divider",  { label: "Divider", content:`<hr style="border:none;border-top:1px solid #e3ecff;margin:12px 0">`, ...cat("Elements") });

    // load scaffold when iframe is ready, then fit
    editor.on("load", () => {
      editor.setComponents(pageHTML(pageKey));
    });
    editor.on("canvas:frame:load", () => {
      // give layout a tick to compute
      setTimeout(fitWidth, 50);
    });

    // refit on canvas resize
    const ro = new ResizeObserver(() => fitWidth());
    ro.observe(editor.Canvas.getElement());

    return () => { ro.disconnect(); };
  }, []); // mount once

  // toolbar handlers
  const toggleBlocks = () => {
    const el = document.getElementById("blocks-col");
    if (!el) return;
    el.style.display = el.style.display === "none" ? "flex" : "none";
    setTimeout(fitWidth, 30);
  };
  const toggleStyles = () => {
    const el = document.getElementById("styles-col");
    if (!el) return;
    el.style.display = el.style.display === "none" ? "flex" : "none";
    setTimeout(fitWidth, 30);
  };
  const doPreview = () => {
    const ed = editorRef.current;
    if (!ed) return;
    const html = `<style>${ed.getCss()}</style>${ed.getHtml()}`;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  };
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

  return (
    <Box sx={{ height: "100vh", fontFamily: "Montserrat, sans-serif" }}>
      {/* Icon toolbar */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ height: 56, px: 1, borderBottom: "1px solid #d6e1fb", background: "#f0f4ff" }}
      >
        <Tooltip title="Toggle Blocks"><IconButton size="small" onClick={toggleBlocks}><ViewSidebarIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Toggle Styles"><IconButton size="small" onClick={toggleStyles}><TuneIcon fontSize="small" /></IconButton></Tooltip>

        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ ml: 1 }}>
          <DescriptionIcon sx={{ fontSize: 18, color: "#6495ED" }} />
          <Select
            size="small"
            value={pageKey}
            onChange={(e) => { setPageKey(e.target.value); setTimeout(() => applySize(e.target.value), 10); }}
            sx={{
              minWidth: 160, height: 32,
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#6495ED" },
              "& .MuiSelect-select": { py: 0.4 },
            }}
          >
            {Object.keys(PAGE_SIZES).map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
          </Select>
        </Stack>

        <Box sx={{ flex: 1 }} />

        <Tooltip title="Fit Width"><IconButton size="small" onClick={fitWidth}><ZoomInMapIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Fit Page"><IconButton size="small" onClick={fitPage}><ZoomOutMapIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Preview"><IconButton size="small" onClick={doPreview}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Save"><IconButton size="small" onClick={doSave} sx={{ color: "#6495ED" }}><SaveIcon fontSize="small" /></IconButton></Tooltip>
      </Stack>

      {/* Editor */}
      <Box ref={mountRef} sx={{ height: "calc(100vh - 56px)" }} />
    </Box>
  );
}