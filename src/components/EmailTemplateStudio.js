import { useEffect, useRef } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import "grapesjs-preset-newsletter";
import "grapesjs-mjml";

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbxE6byG1FUHiBPg902xADIJwOIQ8IlwCx4riqkQ2fLG_2TxuxYsseUPqG9SR0ePhXBf/exec";

export default function EmailTemplateStudio() {
  const mountRef = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current || editorRef.current) return;

    // ---------- Shell layout: Blocks | Canvas | Styles ----------
    const root = mountRef.current;
    root.innerHTML = `
      <div id="gjs-shell" style="display:flex;height:100%;width:100%;">
        <aside id="gjs-blocks" style="width:280px;background:#f6f9ff;border-right:2px solid #d6e1fb;display:flex;flex-direction:column;">
          <div style="padding:10px;border-bottom:1px solid #e6eeff;">
            <input id="gjs-blocks-search" placeholder="Search blocks…" style="width:100%;padding:10px 12px;border:1px solid #cfe0ff;border-radius:8px;outline:none;font-family:Montserrat"/>
          </div>
          <div id="blocks-list" style="flex:1;overflow:auto;padding:10px;"></div>
        </aside>
        <main id="gjs-canvas" style="flex:1;background:linear-gradient(135deg,#f8fbff 0%,#eef3ff 100%);"></main>
        <aside id="gjs-styles" style="width:320px;background:#fafbff;border-left:2px solid #d6e1fb;overflow:auto;padding:12px;"></aside>
      </div>
    `;

    const editor = grapesjs.init({
      container: "#gjs-canvas",
      height: "calc(100vh - 72px)",
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
      },
      panels: { defaults: [] },
    });
    editorRef.current = editor;

    // ---------- Theme the editor UI ----------
    const theme = document.createElement("style");
    theme.innerHTML = `
      .gjs-one-bg { background-color:#f6f9ff !important; }
      .gjs-two-color { color:#6495ED !important; }
      .gjs-three-bg { background-color:#6495ED !important; }
      .gjs-four-color, .gjs-color-h { color:#6495ED !important; }
      .gjs-block { border-radius:10px; border:1px solid #e6eeff; padding:10px; }
      .gjs-block:hover { box-shadow:0 6px 16px rgba(100,149,237,.25); transform:translateY(-1px); }
      .gjs-block-category .gjs-title { font-family:Montserrat,sans-serif; font-weight:600; }
      .gjs-editor { font-family:Montserrat,sans-serif; }
      .gjs-frame { background:#ffffff; box-shadow:0 8px 24px rgba(9,30,66,.08); }
      .gjs-sm-property .gjs-label, .gjs-trt-trait__label { font-weight:600; }
      .gjs-cv-canvas__frames { background:#eef3ff; }
    `;
    document.head.appendChild(theme);

    // ---------- Block Manager: rich library ----------
    const bm = editor.BlockManager;
    const cat = (name) => ({ category: { label: name, open: false } });

    // Header / Hero / CTA
    bm.add("header-basic", {
      label: "Header",
      content: `
        <table width="100%" style="background:#f0f4ff;border-radius:12px;">
          <tr>
            <td style="padding:20px;text-align:center;">
              <img src="https://via.placeholder.com/140x40?text=Logo" alt="Logo" style="display:block;margin:0 auto 8px"/>
              <h1 style="margin:0;color:#2A2A2A;">{{Company}}</h1>
            </td>
          </tr>
        </table>`,
      ...cat("Headers"),
    });

    bm.add("hero-image", {
      label: "Hero Banner",
      content: `
        <table width="100%" style="border-radius:12px;overflow:hidden;">
          <tr>
            <td background="https://via.placeholder.com/1200x360" style="background-size:cover;background-position:center;padding:60px 20px;text-align:center;">
              <h2 style="margin:0;color:#fff;font-size:32px;">Your Majestic Headline</h2>
              <p style="margin:12px 0 24px;color:#f0f4ff;font-size:16px;">Bringing you the latest updates</p>
              <a href="#" style="background:#6495ED;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Call to Action</a>
            </td>
          </tr>
        </table>`,
      ...cat("Headers"),
    });

    bm.add("cta", {
      label: "CTA Button",
      content: `<div style="text-align:center;padding:16px;">
        <a href="#" style="background:#6495ED;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Click Here</a>
      </div>`,
      ...cat("Content"),
    });

    // Content / Columns
    bm.add("one-col", {
      label: "1 Column",
      content: `
        <table width="100%"><tr><td style="padding:16px;">
          <h3 style="margin:0 0 8px;">Section Title</h3>
          <p style="margin:0;">Write something amazing here…</p>
        </td></tr></table>`,
      ...cat("Layout"),
    });

    bm.add("two-col", {
      label: "2 Columns",
      content: `
        <table width="100%">
          <tr>
            <td width="50%" style="padding:10px;vertical-align:top">
              <h3>Left Column</h3><p>Text goes here…</p>
            </td>
            <td width="50%" style="padding:10px;vertical-align:top">
              <h3>Right Column</h3><p>Text goes here…</p>
            </td>
          </tr>
        </table>`,
      ...cat("Layout"),
    });

    bm.add("three-col", {
      label: "3 Columns",
      content: `
        <table width="100%">
          <tr>
            <td width="33%" style="padding:10px;text-align:center;vertical-align:top">
              <img src="https://via.placeholder.com/120" style="border-radius:8px;display:block;margin:0 auto 8px"/><p>Feature 1</p>
            </td>
            <td width="33%" style="padding:10px;text-align:center;vertical-align:top">
              <img src="https://via.placeholder.com/120" style="border-radius:8px;display:block;margin:0 auto 8px"/><p>Feature 2</p>
            </td>
            <td width="33%" style="padding:10px;text-align:center;vertical-align:top">
              <img src="https://via.placeholder.com/120" style="border-radius:8px;display:block;margin:0 auto 8px"/><p>Feature 3</p>
            </td>
          </tr>
        </table>`,
      ...cat("Layout"),
    });

    bm.add("image-text", {
      label: "Image + Text",
      content: `
        <table width="100%">
          <tr>
            <td width="40%" style="padding:10px;vertical-align:top">
              <img src="https://via.placeholder.com/420x280" style="width:100%;border-radius:10px"/>
            </td>
            <td width="60%" style="padding:10px;vertical-align:top">
              <h3>Title</h3>
              <p>Compelling paragraph explaining this section.</p>
              <a href="#" style="color:#6495ED;text-decoration:none;">Learn more →</a>
            </td>
          </tr>
        </table>`,
      ...cat("Content"),
    });

    bm.add("features-grid", {
      label: "Feature Grid",
      content: `
        <table width="100%">
          <tr>
            <td width="50%" style="padding:12px;">
              <h4>✓ Feature A</h4><p>Short detail.</p>
            </td>
            <td width="50%" style="padding:12px;">
              <h4>✓ Feature B</h4><p>Short detail.</p>
            </td>
          </tr>
          <tr>
            <td width="50%" style="padding:12px;">
              <h4>✓ Feature C</h4><p>Short detail.</p>
            </td>
            <td width="50%" style="padding:12px;">
              <h4>✓ Feature D</h4><p>Short detail.</p>
            </td>
          </tr>
        </table>`,
      ...cat("Content"),
    });

    bm.add("testimonial", {
      label: "Testimonial",
      content: `
        <table width="100%" style="background:#ffffff;border-radius:12px;">
          <tr><td style="padding:20px;">
            <p style="font-style:italic;">“Incredible experience with {{Company}}. Highly recommended.”</p>
            <p style="margin:0;font-weight:600;">— Jane Doe, CEO</p>
          </td></tr>
        </table>`,
      ...cat("Content"),
    });

    bm.add("pricing", {
      label: "Pricing Card",
      content: `
        <table width="100%" style="background:#fff;border-radius:12px;">
          <tr><td style="padding:24px;text-align:center;">
            <h3 style="margin:0 0 4px;">Pro Plan</h3>
            <div style="font-size:28px;font-weight:700;margin:8px 0;">₹2,499</div>
            <p>Best for growing teams</p>
            <a href="#" style="background:#6495ED;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Choose Plan</a>
          </td></tr>
        </table>`,
      ...cat("Content"),
    });

    // Elements
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

    bm.add("button", {
      label: "Button",
      content: `<a href="#" style="background:#6495ED;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Button</a>`,
      ...cat("Elements"),
    });

    bm.add("list", {
      label: "Bullet List",
      content: `<ul style="padding-left:20px;margin:0;"><li>Point one</li><li>Point two</li><li>Point three</li></ul>`,
      ...cat("Elements"),
    });

    bm.add("social", {
      label: "Social Row",
      content: `
        <p style="text-align:center;">
          <a href="#" style="color:#6495ED;text-decoration:none;margin:0 8px;">Facebook</a>•
          <a href="#" style="color:#6495ED;text-decoration:none;margin:0 8px;">Instagram</a>•
          <a href="#" style="color:#6495ED;text-decoration:none;margin:0 8px;">LinkedIn</a>
        </p>`,
      ...cat("Elements"),
    });

    bm.add("footer", {
      label: "Footer",
      content: `
        <table width="100%" style="background:#f8f8f8;border-radius:12px;">
          <tr><td style="padding:16px;text-align:center;font-size:12px;color:#666;">
            © {{Company}} | {{Year}} · <a href="{{UnsubscribeURL}}" style="color:#6495ED;">Unsubscribe</a><br/>
            123, Your Street, Your City
          </td></tr>
        </table>`,
      ...cat("Footers"),
    });

    bm.add("raw-html", {
      label: "Raw HTML",
      content: `<div><!-- Paste custom HTML here --></div>`,
      ...cat("Advanced"),
    });

    // ---------- Background controls (image / gradient / overlay) ----------
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
    sm.addProperty("decorations", {
      id: "bg-gradient",
      name: "Gradient",
      type: "text",
      property: "background",
      defaults: "",
      placeholder: "linear-gradient(135deg,#6495ED,#4a76d2)",
      full: true,
    });
    sm.addProperty("extra", {
      id: "overlay",
      name: "Overlay RGBA",
      type: "color",
      property: "box-shadow",
      defaults: "",
      full: true,
      // overlay effect by inset shadow
      // user can pick rgba(0,0,0,0.35) etc.
    });

    // ---------- Search blocks ----------
    const search = root.querySelector("#gjs-blocks-search");
    search.addEventListener("input", (e) => {
      const term = (e.target.value || "").toLowerCase();
      bm.getAll().forEach((b) => {
        const el = b.get("el");
        if (!el) return;
        const label = (b.get("label") || "").toLowerCase();
        el.style.display = label.includes(term) ? "" : "none";
      });
    });

    // ---------- Default starting canvas ----------
    editor.on("load", () => {
      editor.BlockManager.render();
      editor.StyleManager.render();
      editor.setComponents(`
        <table width="100%" style="font-family:Montserrat,sans-serif;color:#333;border-spacing:0;">
          <tr><td style="padding:24px;">
            <table width="100%" style="background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(9,30,66,.08);">
              <tr><td style="padding:24px;text-align:center;">
                <h2 style="margin:0;">Start your majestic email ✨</h2>
                <p style="margin:8px 0 0;">Drag blocks from the left. Style on the right.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      `);
    });

    // ---------- Commands: Save (no-CORS) & Preview ----------
    editor.Commands.add("save-template", {
      run: async () => {
        const html = `<style>${editor.getCss()}</style>${editor.getHtml()}`;
        localStorage.setItem("email_template_draft", html);
        alert("✅ Template saved locally (no-cors).");
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

  return (
    <Box sx={{ height: "100vh", fontFamily: "Montserrat, sans-serif" }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{
          background: "#f0f4ff",
          borderBottom: "2px solid #d6e1fb",
          p: 2,
          boxShadow: "0 2px 6px rgba(0,0,0,.05)",
        }}
      >
        <Typography variant="h6" fontWeight={600} color="#2A2A2A">
          Email Template Studio
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            sx={{ color: "#6495ED", borderColor: "#6495ED", fontWeight: 600 }}
            onClick={() => editorRef.current?.runCommand("preview-template")}
          >
            Preview in Browser
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

      <Box ref={mountRef} sx={{ height: "calc(100vh - 72px)" }} />
    </Box>
  );
}