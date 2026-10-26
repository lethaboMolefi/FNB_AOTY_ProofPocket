// Draws every UML diagram (apps/api/uml/*.mmd, Mermaid) as SVG, PNG and PDF, once, at build time, in headless
// Chromium (the one the end-to-end tests use). The API serves these files to founders and admins only, so the
// website needs no diagram code and keeps its strict content security policy.
//   pnpm --filter @proofpocket/web uml:render      (after changing a .mmd file; a test fails if a render is stale)
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const dir = new URL("../../api/uml/", import.meta.url);
const out = new URL("rendered/", dir);
mkdirSync(out, { recursive: true });
const diagrams = JSON.parse(readFileSync(new URL("index.json", dir), "utf8"));
const mermaidJs = readFileSync(new URL("../node_modules/mermaid/dist/mermaid.min.js", import.meta.url), "utf8");

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent("<!doctype html><html><body style='margin:0;background:#fff'></body></html>");
await page.addScriptTag({ content: mermaidJs });
await page.evaluate(() => window.mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral", fontFamily: "Arial, sans-serif" }));

const manifest = {};
for (const d of diagrams) {
  const source = readFileSync(new URL(`${d.id}.mmd`, dir), "utf8");
  const { svg, w, h } = await page.evaluate(async ({ id, source }) => {
    const { svg } = await window.mermaid.render(`d-${id}`, source);
    // The real size instead of width="100%", so the file opens at its natural size anywhere.
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
    const [, , w, h] = (doc.getAttribute("viewBox") ?? "0 0 1200 800").split(/\s+/).map(Number);
    doc.setAttribute("width", String(Math.ceil(w))); doc.setAttribute("height", String(Math.ceil(h))); doc.removeAttribute("style");
    return { svg: new XMLSerializer().serializeToString(doc), w: Math.ceil(w), h: Math.ceil(h) };
  }, { id: d.id, source });
  writeFileSync(new URL(`${d.id}.svg`, out), svg);
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff"><div id="d" style="display:inline-block;padding:24px">${svg}</div></body></html>`);
  await page.locator("#d").screenshot({ path: new URL(`${d.id}.png`, out).pathname });
  const pdf = await page.pdf({ width: `${w + 48}px`, height: `${h + 48}px`, printBackground: true, pageRanges: "1" });
  writeFileSync(new URL(`${d.id}.pdf`, out), pdf);
  await page.setContent("<!doctype html><html><body style='margin:0;background:#fff'></body></html>");
  await page.addScriptTag({ content: mermaidJs });
  await page.evaluate(() => window.mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral", fontFamily: "Arial, sans-serif" }));
  manifest[d.id] = createHash("sha256").update(source).digest("hex");
  console.log(`rendered ${d.id}`);
}
writeFileSync(new URL("manifest.json", out), JSON.stringify(manifest, null, 1) + "\n");
await browser.close();
