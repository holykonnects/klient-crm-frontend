import { useEffect, useRef, useState } from "react";
import { Box, IconButton, Tooltip, Select, MenuItem, Stack } from "@mui/material";
import ViewSidebarIcon from "@mui/icons-material/ViewSidebar";
import TuneIcon from "@mui/icons-material/Tune";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";
import ZoomInMapIcon from "@mui/icons-material/ZoomInMap";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SaveIcon from "@mui/icons-material/Save";
import DescriptionIcon from "@mui/icons-material/Description";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbxE6byG1FUHiBPg902xADIJwOIQ8IlwCx4riqkQ2fLG_2TxuxYsseUPqG9SR0ePhXBf/exec";

// px @ 96dpi
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

  // ------ helpers ------
  const getPageEl = () => {
    const ed = editorRef.current;
    const frame = ed?.Canvas.getFrameEl();
    const doc = frame?.contentDocument;
    return doc?.getElementById("kk-page") || null;
  };

  const fitWidth = () => {
    const ed = editorRef.current;
    const page = getPageEl();
    if (!ed || !page) return;
    const rect = ed.Canvas.getElement().getBoundingClientRect();
    const scale = Math.min(1, (rect.width - 48) / page.offsetWidth);
    ed.Canvas.setZoom(scale || 1);
    ed.Canvas.centerContent();
  };

  const fitPage = () => {
    const ed = editorRef.current;
    const page = getPageEl();
    if (!ed || !page) return;
    const rect = ed.Canvas.getElement().getBoundingClientRect();
    const scale = Math.min(
      1,
      (rect.width - 48) / page.offsetWidth,
      (rect.height - 48) / page.offsetHeight
    );
    ed.Canvas.setZoom(scale || 1);
    ed.Canvas.centerContent();
  };

  const applySize = (key) => {
    const page = getPageEl();
    if (!page) return;
    const { w, h } = PAGE_SIZES[key] || PAGE_SIZES["A4 Portrait"];
    page.style.width = `${w}px`;
    page.style.minHeight = `${h}px`;
    page.setAttribute("data-page", key);
    setTimeout(fitWidth, 10);
  };

  useEffect(() => {
    if (!mountRef.current || editorRef.current) return;

    // Shell: single left column (Blocks). Styles hidden by default (toggleable).
    mountRef.current.innerHTML = `
      <div id="gjs-shell" style="display:flex;height:100%;width:100%;">
        <aside id="blocks-col" style="width:250px;min-width:250px;background:#f6f9ff;border-right:1px solid #d6e1fb;display:flex;flex-direction:column;">
          <div style="padding:8px 10px;border-bottom:1px solid #e6eeff;font:600 12px Montserrat;">Blocks</div>
          <div id="blocks-list" style="flex:1;overflow:auto;padding:10px;"></div>
        </aside>
        <main id="gjs-canvas" style="flex:1;background:linear-gradient(135deg,#f8fbff,#eef3ff);"></main>
        <aside id="styles-col" style="display:none;width:280px;min-width:280px;background:#fafbff;border-left:1px solid #d6e1fb;flex-direction:column;">
          <div style="padding:8px 10px;border-bottom:1px solid #e6eeff;font:600 12px Montserrat;">Styles</div>
          <div id="gjs-styles" style="flex:1;overflow:auto;padding:10px;"></div>
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

    // Theme polish
    const css = document.createElement("style");
    css.innerHTML = `
      .gjs-one-bg { background:#f6f9ff !important; }
      .gjs-two-color { color:#6495ED !important; }
      .gjs-three-bg { background:#6495ED !important; }
      .gjs-block { border-radius:10px; background:#fff; border:1px solid #e6eeff; padding:10px; text-align:center; cursor:grab; }
      .gjs-block:hover { box-shadow:0 6px 16px rgba(100,149,237,.25); transform:translateY(-1px); }
    `;
    document.head.appendChild(css);

    // ---- REGISTER COMPONENT TYPES so drops work reliably ----
    const domc = editor.DomComponents;

    domc.addType("kk-page", {
      model: {
        defaults: {
          tagName: "div",
          attributes: { id: "kk-page" },
          droppable: false, // page itself wraps header/body/footer
          selectable: true,
          stylable: ["width", "min-height", "background"],
          styles: `
            #kk-page{
              background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(9,30,66,.08);
              overflow:hidden;display:flex;flex-direction:column;
            }`,
        },
      },
    });

    domc.addType("kk-header", {
      model: {
        defaults: {
          droppable: true,
          removable: false,
          copyable: false,
          draggable: true,
          name: "Header",
        },
      },
    });

    domc.addType("kk-body", {
      model: {
        defaults: {
          droppable: true, // <— primary drop zone
          removable: false,
          copyable: false,
          draggable: false,
          name: "Body",
          highlightable: true,
        },
      },
    });

    domc.addType("kk-footer", {
      model: {
        defaults: {
          droppable: true,
          removable: false,
          copyable: false,
          draggable: true,
          name: "Footer",
        },
      },
    });

    // ---- DEFAULT SCAFFOLD: header + 2-col body + footer (unsubscribe + socials) ----
    const scaffold = () => {
      const { w, h } = PAGE_SIZES[pageKey] || PAGE_SIZES["A4 Portrait"];
      const wrapper = editor.getWrapper();

      // page wrapper (centered)
      wrapper.set({
        attributes: { style: "min-height:100%;padding:32px 0;display:flex;justify-content:center;" },
      });

      const page = wrapper.append({
        type: "kk-page",
        attributes: { "data-page": pageKey, style: `width:${w}px;min-height:${h}px;` },
      });

      // Header
      page.append({
        type: "kk-header",
        components: `
          <div style="padding:14px 20px;background:#f0f4ff;border-bottom:1px solid #e1e9ff;">
            <table width="100%" style="border-spacing:0;">
              <tr>
                <td style="text-align:left;">
                  <img src="https://via.placeholder.com/120x34?text=Logo" style="display:block"/>
                </td>
                <td style="text-align:right;font:600 14px Montserrat;color:#2A2A2A;">
                  {{Company}}
                </td>
              </tr>
            </table>
          </div>`,
      });

      // Body (2 columns by default)
      const body = page.append({
        type: "kk-body",
        attributes: { id: "kk-body" },
        components: `
          <div style="flex:1;padding:18px 20px;">
            <table width="100%" style="border-spacing:0;">
              <tr>
                <td width="50%" style="padding:8px;vertical-align:top">
                  <h3 style="margin:0 0 6px;font-family:Montserrat;">Left Column</h3>
                  <p style="margin:0;">Write here…</p>
                </td>
                <td width="50%" style="padding:8px;vertical-align:top">
                  <h3 style="margin:0 0 6px;font-family:Montserrat;">Right Column</h3>
                  <p style="margin:0;">Write here…</p>
                </td>
              </tr>
            </table>
          </div>`,
      });

      // Ensure BODY is the convenient drop container
      body.addAttributes({ "data-gjs-droppable": "true" });

      // Footer with Unsubscribe + Social
      page.append({
        type: "kk-footer",
        components: `
          <div style="padding:14px 16px;background:#f8f8f8;border-top:1px solid #eee;text-align:center;font-size:12px;color:#666;">
            <div style="margin-bottom:8px;">
              <a href="{{UnsubscribeURL}}" style="color:#6495ED;text-decoration:none;">Unsubscribe</a>
            </div>
            <div>
              <a href="https://facebook.com" style="margin:0 6px;"><img src="https://via.placeholder.com/20/F6F9FF/6495ED?text=F" style="vertical-align:middle"/></a>
              <a href="https://twitter.com" style="margin:0 6px;"><img src="https://via.placeholder.com/20/F6F9FF/6495ED?text=T" style="vertical-align:middle"/></a>
              <a href="https://instagram.com" style="margin:0 6px;"><img src="https://via.placeholder.com/20/F6F9FF/6495ED?text=I" style="vertical-align:middle"/></a>
              <a href="https://linkedin.com" style="margin:0 6px;"><img src="https://via.placeholder.com/20/F6F9FF/6495ED?text=L" style="vertical-align:middle"/></a>
            </div>
            <div style="margin-top:8px;">© {{Company}} | {{Year}}</div>
          </div>`,
      });
    };

    // Basic icon blocks (single column already via left aside)
    const bm = editor.BlockManager;
    const addBlock = (id, label, html) =>
      bm.add(id, {
        label: `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                  <div style="width:28px;height:28px;border-radius:6px;background:#eaf1ff;border:1px solid #dbe7ff"></div>
                  <span style="font-size:11px;font-weight:600">${label}</span>
                </div>`,
        content: html,
        category: "Elements",
      });

    addBlock(
      "section",
      "Section",
      `<section style="padding:16px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(9,30,66,.06);"><h3>Section</h3><p>Write…</p></section>`
    );
    addBlock(
      "two-col",
      "2 Columns",
      `<table width="100%" style="border-spacing:0;"><tr><td width="50%" style="padding:8px;vertical-align:top"><h4>Left</h4><p>Text…</p></td><td width="50%" style="padding:8px;vertical-align:top"><h4>Right</h4><p>Text…</p></td></tr></table>`
    );
    addBlock(
      "image",
      "Image",
      `<img src="https://via.placeholder.com/800x300" style="width:100%;border-radius:8px;display:block;">`
    );
    addBlock("text", "Text", `<p style="margin:0;">Add paragraph…</p>`);
    addBlock(
      "button",
      "Button",
      `<a href="#" style="background:#6495ED;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Button</a>`
    );
    addBlock("divider", "Divider", `<hr style="border:none;border-top:1px solid #e3ecff;margin:12px 0">`);

    // Load scaffold then fit
    editor.on("load", () => {
      editor.DomComponents.clear(); // ensure a clean start
      scaffold();
    });
    editor.on("canvas:frame:load", () => setTimeout(fitWidth, 80));

    // Refit on canvas resize
    const ro = new ResizeObserver(() => fitWidth());
    ro.observe(editor.Canvas.getElement());

    return () => ro.disconnect();
  }, []); // mount once

  // Toolbar actions
  const togglePanel = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = el.style.display === "none" ? "flex" : "none";
    setTimeout(fitWidth, 40);
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
      {/* Icon toolbar */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ height: 56, px: 1, borderBottom: "1px solid #d6e1fb", background: "#f0f4ff" }}
      >
        <Tooltip title="Toggle Blocks">
          <IconButton size="small" onClick={() => togglePanel("blocks-col")}>
            <ViewSidebarIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Toggle Styles">
          <IconButton size="small" onClick={() => togglePanel("styles-col")}>
            <TuneIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ ml: 1 }}>
          <DescriptionIcon sx={{ fontSize: 18, color: "#6495ED" }} />
          <Select
            size="small"
            value={pageKey}
            onChange={(e) => {
              setPageKey(e.target.value);
              setTimeout(() => applySize(e.target.value), 10);
            }}
            sx={{
              minWidth: 160,
              height: 32,
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#6495ED" },
              "& .MuiSelect-select": { py: 0.4 },
            }}
          >
            {Object.keys(PAGE_SIZES).map((k) => (
              <MenuItem key={k} value={k}>
                {k}
              </MenuItem>
            ))}
          </Select>
        </Stack>

        <Box sx={{ flex: 1 }} />
        <Tooltip title="Fit Width">
          <IconButton size="small" onClick={fitWidth}>
            <ZoomInMapIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Fit Page">
          <IconButton size="small" onClick={fitPage}>
            <ZoomOutMapIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Preview">
          <IconButton size="small" onClick={doPreview}>
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Save">
          <IconButton size="small" onClick={doSave} sx={{ color: "#6495ED" }}>
            <SaveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Editor area */}
      <Box ref={mountRef} sx={{ height: "calc(100vh - 56px)" }} />
    </Box>
  );
}