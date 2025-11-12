import { useEffect, useRef, useState } from "react";
import {
  Box,
  IconButton,
  Tooltip,
  Stack,
  Drawer,
  Divider,
} from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import ImageIcon from "@mui/icons-material/Image";
import SmartButtonIcon from "@mui/icons-material/SmartButton";
import GridViewIcon from "@mui/icons-material/GridView";
import ViewSidebarIcon from "@mui/icons-material/ViewSidebar";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SaveIcon from "@mui/icons-material/Save";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";
import ZoomInMapIcon from "@mui/icons-material/ZoomInMap";
import TuneIcon from "@mui/icons-material/Tune";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbxE6byG1FUHiBPg902xADIJwOIQ8IlwCx4riqkQ2fLG_2TxuxYsseUPqG9SR0ePhXBf/exec";

const PAGE_SIZES = {
  "A4 Portrait": { w: 794, h: 1123 },
  "A4 Landscape": { w: 1123, h: 794 },
};

export default function EmailTemplateStudio() {
  const mountRef = useRef(null);
  const editorRef = useRef(null);
  const [drawer, setDrawer] = useState(""); // which side panel is open

  const toggleDrawer = (name) => {
    setDrawer(drawer === name ? "" : name);
  };

  // --- Helpers
  const getPage = () => {
    const ed = editorRef.current;
    const frame = ed?.Canvas.getFrameEl();
    const doc = frame?.contentDocument;
    return doc?.getElementById("kk-body") || null;
  };

  const fitWidth = () => {
    const ed = editorRef.current;
    const page = getPage();
    if (!ed || !page) return;
    const rect = ed.Canvas.getElement().getBoundingClientRect();
    const scale = Math.min(1, (rect.width - 48) / page.offsetWidth);
    ed.Canvas.setZoom(scale || 1);
    ed.Canvas.centerContent();
  };

  const fitPage = () => {
    const ed = editorRef.current;
    const page = getPage();
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

  // --- Editor setup
  useEffect(() => {
    if (!mountRef.current || editorRef.current) return;

    const shell = document.createElement("div");
    shell.id = "gjs-shell";
    shell.style.cssText = "display:flex;height:100%;width:100%;";
    shell.innerHTML = `<div id="gjs-canvas" style="flex:1;background:#e9ecf4;overflow:hidden;"></div>`;
    mountRef.current.appendChild(shell);

    const editor = grapesjs.init({
      container: "#gjs-canvas",
      height: "calc(100vh - 56px)",
      storageManager: false,
      blockManager: {},
      styleManager: { appendTo: null },
      canvas: {
        styles: ["https://fonts.googleapis.com/css?family=Montserrat:400,600&display=swap"],
      },
      panels: { defaults: [] },
    });
    editorRef.current = editor;

    // theme polish
    const css = document.createElement("style");
    css.innerHTML = `
      .gjs-one-bg { background:#f6f9ff !important; }
      .gjs-two-color { color:#6495ED !important; }
      .gjs-three-bg { background:#6495ED !important; }
      .gjs-block { border-radius:10px; background:#fff; border:1px solid #e6eeff; padding:10px; text-align:center; cursor:grab; }
      .gjs-block:hover { box-shadow:0 6px 16px rgba(100,149,237,.25); transform:translateY(-1px); }
    `;
    document.head.appendChild(css);

    // --- Components ---
    const scaffold = `
      <div id="page-wrap" style="display:flex;justify-content:center;min-height:100%;padding:32px 0;background:#e9ecf4;">
        <div id="kk-page" style="width:794px;min-height:1123px;background:#fff;border-radius:12px;box-shadow:0 6px 20px rgba(9,30,66,.15);overflow:hidden;display:flex;flex-direction:column;font-family:Montserrat;">
          <div id="kk-header" style="padding:16px 20px;background:#f0f4ff;border-bottom:1px solid #d6e1fb;">
            <table width="100%">
              <tr>
                <td><img src="https://via.placeholder.com/120x34?text=Logo"/></td>
                <td align="right"><b>{{Company}}</b></td>
              </tr>
            </table>
          </div>
          <div id="kk-body" style="flex:1;padding:20px;" data-gjs-droppable="true">
            <table width="100%">
              <tr>
                <td width="50%" style="padding:8px;vertical-align:top">
                  <h3>Left Column</h3>
                  <p>Write something...</p>
                </td>
                <td width="50%" style="padding:8px;vertical-align:top">
                  <h3>Right Column</h3>
                  <p>Write something...</p>
                </td>
              </tr>
            </table>
          </div>
          <div id="kk-footer" style="padding:14px 16px;background:#f8f8f8;border-top:1px solid #eee;text-align:center;font-size:12px;color:#666;">
            <div><a href="{{Unsubscribe}}" style="color:#6495ED;text-decoration:none;">Unsubscribe</a></div>
            <div style="margin:8px 0;">
              <img src="https://via.placeholder.com/20/6495ED/FFFFFF?text=F" style="margin:0 6px"/>
              <img src="https://via.placeholder.com/20/6495ED/FFFFFF?text=T" style="margin:0 6px"/>
              <img src="https://via.placeholder.com/20/6495ED/FFFFFF?text=I" style="margin:0 6px"/>
              <img src="https://via.placeholder.com/20/6495ED/FFFFFF?text=L" style="margin:0 6px"/>
            </div>
            <div>© {{Company}} | {{Year}}</div>
          </div>
        </div>
      </div>`;

    editor.setComponents(scaffold);
    editor.on("load", () => fitWidth());
  }, []);

  // --- Save / Preview
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
    await fetch(WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveTemplate", html }),
    }).catch(() => {});
    alert("✅ Saved (no-CORS).");
  };

  // --- Drawer content (Wix style left panel)
  const blockCategories = {
    layout: [
      { label: "Section", html: "<section style='padding:20px;'>Section</section>" },
      { label: "2 Columns", html: "<table width='100%'><tr><td width='50%'>Left</td><td width='50%'>Right</td></tr></table>" },
    ],
    text: [
      { label: "Heading", html: "<h2>Heading Text</h2>" },
      { label: "Paragraph", html: "<p>Type your paragraph...</p>" },
    ],
    media: [
      { label: "Image", html: "<img src='https://via.placeholder.com/800x300' style='width:100%;'/>" },
    ],
    button: [
      { label: "Button", html: "<a href='#' style='background:#6495ED;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;'>Button</a>" },
    ],
    sections: [
      { label: "Footer", html: "<footer style='padding:20px;text-align:center;'>Footer Section</footer>" },
    ],
  };

  const DrawerContent = ({ items }) => (
    <Box sx={{ width: 240, p: 2 }}>
      <Stack spacing={1}>
        {items.map((it, i) => (
          <Box
            key={i}
            sx={{
              border: "1px solid #e6eeff",
              borderRadius: 2,
              p: 1,
              textAlign: "center",
              fontSize: 12,
              cursor: "grab",
              bgcolor: "#fff",
              "&:hover": { boxShadow: "0 4px 10px rgba(100,149,237,.25)" },
            }}
            onClick={() => {
              const ed = editorRef.current;
              const body = getPage();
              body?.insertAdjacentHTML("beforeend", it.html);
            }}
          >
            {it.label}
          </Box>
        ))}
      </Stack>
    </Box>
  );

  return (
    <Box sx={{ height: "100vh", fontFamily: "Montserrat, sans-serif" }}>
      {/* --- Toolbar --- */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          height: 56,
          px: 1,
          borderBottom: "1px solid #d6e1fb",
          background: "#f0f4ff",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Tooltip title="Layout">
            <IconButton onClick={() => toggleDrawer("layout")}>
              <GridViewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Text">
            <IconButton onClick={() => toggleDrawer("text")}>
              <TextFieldsIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Media">
            <IconButton onClick={() => toggleDrawer("media")}>
              <ImageIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Buttons">
            <IconButton onClick={() => toggleDrawer("button")}>
              <SmartButtonIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Sections">
            <IconButton onClick={() => toggleDrawer("sections")}>
              <DescriptionIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Tooltip title="Fit Width">
            <IconButton onClick={fitWidth}>
              <ZoomInMapIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fit Page">
            <IconButton onClick={fitPage}>
              <ZoomOutMapIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Preview">
            <IconButton onClick={doPreview}>
              <VisibilityIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Save">
            <IconButton onClick={doSave}>
              <SaveIcon sx={{ color: "#6495ED" }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* --- Canvas --- */}
      <Box ref={mountRef} sx={{ height: "calc(100vh - 56px)" }} />

      {/* --- Wix-style Drawer --- */}
      <Drawer
        anchor="left"
        open={Boolean(drawer)}
        onClose={() => setDrawer("")}
        PaperProps={{ sx: { background: "#f6f9ff", borderRight: "1px solid #d6e1fb" } }}
      >
        {drawer && <DrawerContent items={blockCategories[drawer]} />}
      </Drawer>
    </Box>
  );
}
