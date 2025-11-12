import { useEffect, useRef, useState } from "react";
import {
  Box,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import ViewSidebarIcon from "@mui/icons-material/ViewSidebar";
import TuneIcon from "@mui/icons-material/Tune";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";
import ZoomInMapIcon from "@mui/icons-material/ZoomInMap";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SaveIcon from "@mui/icons-material/Save";
import DescriptionIcon from "@mui/icons-material/Description";
import SplitscreenIcon from "@mui/icons-material/Splitscreen";
import GridViewIcon from "@mui/icons-material/GridView";
import ImageIcon from "@mui/icons-material/Image";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import SmartButtonIcon from "@mui/icons-material/SmartButton";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";

import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbxE6byG1FUHiBPg902xADIJwOIQ8IlwCx4riqkQ2fLG_2TxuxYsseUPqG9SR0ePhXBf/exec";

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

  const pageHTML = (key = "A4 Portrait") => {
    const { w, h } = PAGE_SIZES[key] || PAGE_SIZES["A4 Portrait"];
    return `
      <div id="page-wrap" style="
        display:flex;justify-content:center;
        min-height:100%;padding:32px 0;
        background:#eef3ff;
      ">
        <div id="kk-page"
          data-gjs-type="page"
          data-gjs-droppable="true"
          style="
            width:${w}px;min-height:${h}px;background:#fff;
            border-radius:12px;box-shadow:0 8px 24px rgba(9,30,66,.08);
            overflow:hidden;display:flex;flex-direction:column;
          " data-page="${key}">
          <div data-gjs-type="header" data-gjs-droppable="false" style="padding:14px 20px;background:#f0f4ff;border-bottom:1px solid #e1e9ff;">
            <table width="100%" style="border-spacing:0;">
              <tr>
                <td><img src="https://via.placeholder.com/120x34?text=Logo" alt="Logo" style="display:block;"/></td>
                <td style="text-align:right;font:600 14px Montserrat;color:#2A2A2A;">
                  {{Company}}
                </td>
              </tr>
            </table>
          </div>

          <div data-gjs-type="body" data-gjs-droppable="true" style="flex:1;padding:18px 20px;">
            <p>Drop blocks here...</p>
          </div>

          <div data-gjs-type="footer" data-gjs-droppable="true" style="padding:12px 16px;background:#f8f8f8;border-top:1px solid #eee;text-align:center;font-size:12px;color:#666;">
            © {{Company}} | {{Year}}
          </div>
        </div>
      </div>`;
  };

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
    const scale = Math.min(1, (avail - 48) / page.offsetWidth);
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
    setTimeout(fitWidth, 10);
  };

  useEffect(() => {
    if (!mountRef.current || editorRef.current) return;

    mountRef.current.innerHTML = `
      <div id="gjs-shell" style="display:flex;height:100%;width:100%;">
        <aside id="blocks-col" style="width:250px;background:#f6f9ff;border-right:1px solid #d6e1fb;display:flex;flex-direction:column;">
          <div style="padding:8px 10px;border-bottom:1px solid #e6eeff;font:600 12px Montserrat;">Blocks</div>
          <div id="blocks-list" style="flex:1;overflow:auto;padding:10px;"></div>
        </aside>
        <main id="gjs-canvas" style="flex:1;background:#eef3ff;"></main>
        <aside id="styles-col" style="width:280px;background:#fafbff;border-left:1px solid #d6e1fb;">
          <div id="gjs-styles" style="height:100%;overflow:auto;padding:10px;"></div>
        </aside>
      </div>
    `;

    const editor = grapesjs.init({
      container: "#gjs-canvas",
      height: "calc(100vh - 56px)",
      storageManager: false,
      blockManager: { appendTo: "#blocks-list" },
      styleManager: { appendTo: "#gjs-styles" },
      canvas: {
        styles: ["https://fonts.googleapis.com/css?family=Montserrat:400,500,600,700&display=swap"],
      },
      panels: { defaults: [] },
    });
    editorRef.current = editor;

    // Cornflower blue theme
    const css = document.createElement("style");
    css.innerHTML = `
      .gjs-one-bg { background:#f6f9ff !important; }
      .gjs-two-color { color:#6495ED !important; }
      .gjs-three-bg { background:#6495ED !important; }
      .gjs-four-color, .gjs-color-h { color:#6495ED !important; }
      .gjs-block { border-radius:10px; background:#fff; border:1px solid #e6eeff; padding:12px; text-align:center; cursor:grab; }
      .gjs-block:hover { box-shadow:0 6px 16px rgba(100,149,237,.25); transform:translateY(-1px); }
      .gjs-block svg { color:#6495ED; margin-bottom:4px; }
    `;
    document.head.appendChild(css);

    // Block Manager
    const bm = editor.BlockManager;
    const makeIconBlock = (id, label, icon, html) => {
      bm.add(id, {
        label: `
          <div style="display:flex;flex-direction:column;align-items:center;">
            ${icon}
            <span style="font-size:11px;font-weight:600;">${label}</span>
          </div>`,
        content: html,
        category: "Elements",
      });
    };

    makeIconBlock(
      "section",
      "Section",
      `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20"><path fill="#6495ED" d="M3 3h18v2H3V3zm0 7h18v2H3v-2zm0 7h18v2H3v-2z"/></svg>`,
      `<section style="padding:16px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(9,30,66,.06);"><h3>Section</h3><p>Write something…</p></section>`
    );

    makeIconBlock(
      "two-col",
      "2 Col",
      `<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20"><path fill="#6495ED" d="M3 5h8v14H3V5zm10 0h8v14h-8V5z"/></svg>`,
      `<table width="100%" style="border-spacing:0;"><tr><td width="50%" style="padding:8px;vertical-align:top"><h4>Left</h4><p>Text…</p></td><td width="50%" style="padding:8px;vertical-align:top"><h4>Right</h4><p>Text…</p></td></tr></table>`
    );

    makeIconBlock(
      "image",
      "Image",
      `<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20"><path fill="#6495ED" d="M21 19V5H3v14Zm0 2H3a2.006 2.006 0 0 1-2-2V5a2.006 2.006 0 0 1 2-2h18a2.006 2.006 0 0 1 2 2v14a2.006 2.006 0 0 1-2 2ZM8.5 13 5 17h14l-4.5-6-3.5 5Z"/></svg>`,
      `<img src="https://via.placeholder.com/800x300" style="width:100%;border-radius:8px;">`
    );

    makeIconBlock(
      "text",
      "Text",
      `<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20"><path fill="#6495ED" d="M3 17v-2h18v2Zm0-5v-2h18v2Zm0-5V5h18v2Z"/></svg>`,
      `<p style="margin:0;">Add paragraph text…</p>`
    );

    makeIconBlock(
      "button",
      "Button",
      `<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20"><path fill="#6495ED" d="M3 7h18v10H3Zm0-2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"/></svg>`,
      `<a href="#" style="background:#6495ED;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Button</a>`
    );

    makeIconBlock(
      "divider",
      "Line",
      `<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20"><path fill="#6495ED" d="M3 11h18v2H3z"/></svg>`,
      `<hr style="border:none;border-top:1px solid #e3ecff;margin:12px 0">`
    );

    // Load
    editor.on("load", () => {
      editor.setComponents(pageHTML(pageKey));
    });
    editor.on("canvas:frame:load", () => setTimeout(fitWidth, 100));

    const ro = new ResizeObserver(() => fitWidth());
    ro.observe(editor.Canvas.getElement());
    return () => ro.disconnect();
  }, []);

  const toggle = (id) => {
    const el = document.getElementById(id);
    el.style.display = el.style.display === "none" ? "flex" : "none";
    setTimeout(fitWidth, 50);
  };

  const doPreview = () => {
    const ed = editorRef.current;
    const html = `<style>${ed.getCss()}</style>${ed.getHtml()}`;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  };

  const doSave = async () => {
    const ed = editorRef.current;
    const html = `<style>${ed.getCss()}</style>${ed.getHtml()}`;
    localStorage.setItem("email_template_draft", html);
    await fetch(WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveTemplate", html }),
    }).catch(() => {});
    alert("✅ Saved (no-CORS).");
  };

  return (
    <Box sx={{ height: "100vh", fontFamily: "Montserrat, sans-serif" }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ height: 56, px: 1, borderBottom: "1px solid #d6e1fb", background: "#f0f4ff" }}
      >
        <Tooltip title="Toggle Blocks"><IconButton onClick={() => toggle("blocks-col")}><ViewSidebarIcon /></IconButton></Tooltip>
        <Tooltip title="Toggle Styles"><IconButton onClick={() => toggle("styles-col")}><TuneIcon /></IconButton></Tooltip>
        <Stack direction="row" alignItems="center" spacing={0.5}>
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
        <Tooltip title="Fit Width"><IconButton onClick={fitWidth}><ZoomInMapIcon /></IconButton></Tooltip>
        <Tooltip title="Fit Page"><IconButton onClick={fitPage}><ZoomOutMapIcon /></IconButton></Tooltip>
        <Tooltip title="Preview"><IconButton onClick={doPreview}><VisibilityIcon /></IconButton></Tooltip>
        <Tooltip title="Save"><IconButton onClick={doSave}><SaveIcon sx={{ color: "#6495ED" }} /></IconButton></Tooltip>
      </Stack>

      <Box ref={mountRef} sx={{ height: "calc(100vh - 56px)" }} />
    </Box>
  );
}
