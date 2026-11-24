// Step 4: turn data/copy.json + data/products.json into 1000x1500 PNG pins.
// Real run  -> docs/pins/<id>.png (published with GitHub Pages)
// --sample  -> output/sample/<id>.png using the placeholder products in samples/
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { p, readJSON, slug } from "./lib.mjs";

const SAMPLE = process.argv.includes("--sample");
// --only=id1,id2 renders just those pins; --new skips pins that already have a PNG (never overwrite published pins)
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const NEW = process.argv.includes("--new");

const products = SAMPLE ? readJSON(p("samples", "products.json"), {}) : readJSON(p("data", "products.json"), {});
const copy = SAMPLE ? readJSON(p("samples", "copy.json"), { pins: [] }) : readJSON(p("data", "copy.json"), { pins: [] });
const outDir = SAMPLE ? p("output", "sample") : p("docs", "pins");
const tmpDir = p("output", "_tmp");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

if (!copy.pins.length) {
  console.error(SAMPLE ? "samples/copy.json has no pins." : "data/copy.json has no pins yet. Ask Claude to write it (README step 3).");
  process.exit(1);
}

const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const imgSrc = (u) => (/^https?:/.test(u) ? u : pathToFileURL(p(u)).href);

// image index: 0 = main photo, 1..n = Amazon's other listing photos (often lifestyle shots)
function imageUrl(key, index = 0) {
  const prod = products[key];
  if (!prod?.imageUrl) throw new Error(`No product/image for "${key}". Run npm run fetch first.`);
  const all = [prod.imageUrl, ...(prod.extraImages || [])];
  if (!all[index]) throw new Error(`"${key}" has no image #${index}`);
  return imgSrc(all[index]);
}

function productImg(key, index = 0) {
  return `<div class="card"><img src="${esc(imageUrl(key, index))}" alt=""></div>`;
}

function background(pin) {
  const scene = pin.scene && p("output", "scenes", `${pin.scene}.png`);
  if (scene && fs.existsSync(scene)) return `<div class="scene" style="background-image:url('${pathToFileURL(scene).href}')"></div>`;
  return `<div class="bgfill"></div>`;
}

const header = (pin) => `
  ${pin.kicker ? `<div class="kicker">${esc(pin.kicker)}</div>` : ""}
  <div class="headline">${esc(pin.headline)}</div>
  ${pin.script ? `<div class="script">${esc(pin.script)}</div>` : ""}`;

const layouts = {
  hero: (pin) => `<div class="top">${header(pin)}</div>
    <div class="photo"><img src="${esc(imageUrl(pin.products[0], pin.image || 0))}" alt=""></div>
    <div class="cta">${esc(pin.cta || "Tap to shop →")}</div>`,

  guide: (pin) => {
    const keys = pin.products.slice(0, 12);
    // 9 or 12 products: 3 columns; up to 6: 2 columns of large square tiles. Use 6, 9 or 12 products.
    const cols = keys.length > 6 ? "c3" : "c2s";
    const rows = Math.ceil(keys.length / (cols === "c3" ? 3 : 2));
    return `${header(pin)}${pin.sub ? `<div class="sub">${esc(pin.sub)}</div>` : ""}
    <div class="gg ${cols}" style="${cols === "c3" ? `grid-template-rows:repeat(${rows},1fr)` : ""}">${keys
      .map((k, i) => `<div class="tile"><img src="${esc(imageUrl(k, 0))}" alt=""><div class="no">${i + 1}</div></div>`).join("")}</div>
    <div class="cta">${esc(pin.cta || "Tap to shop the list →")}</div>`;
  },

  whybuy: (pin) => `${header(pin)}
    ${productImg(pin.products[0], pin.image || 0).replace('class="card"', 'class="card hero"')}
    <div class="benefits">${(pin.benefits || []).slice(0, 3).map((b) => `<div class="benefit"><div class="tick">✓</div><div>${esc(b)}</div></div>`).join("")}</div>
    <div class="cta">${esc(pin.cta || "See it on Amazon →")}</div>`,

  howto: (pin) => `${header(pin)}
    <div class="row">${productImg(pin.products[0], pin.image || 0).replace('class="card"', 'class="card hero"')}
      <div class="steps">${(pin.steps || []).slice(0, 4).map((s, i) => `<div class="step"><div class="num">${i + 1}</div><span>${esc(s)}</span></div>`).join("")}</div>
    </div>
    ${pin.tip ? `<div class="tip">${esc(pin.tip)}</div>` : ""}
    <div class="cta">${esc(pin.cta || "Get yours on Amazon →")}</div>`,

  lifestyle: (pin) => `${header(pin)}
    <div class="polaroid">${productImg(pin.products[0], pin.image || 0)}<div class="caption">${esc(pin.caption || "")}</div></div>
    <div class="cta">${esc(pin.cta || "Shop the look →")}</div>`,

  collage: (pin) => {
    const keys = pin.products.slice(0, 6);
    return `${header(pin)}
    <div class="grid n${Math.max(3, keys.length)}">${keys.map(productImg).join("")}</div>
    <div class="cta">${esc(pin.cta || "Shop the full list →")}</div>`;
  },
};

function html(pin) {
  const layout = layouts[pin.format];
  if (!layout) throw new Error(`Unknown format "${pin.format}" (use whybuy, howto, lifestyle, collage, hero, guide)`);
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Inter:wght@400;600;700;800&family=Playfair+Display:wght@600;700&display=block" rel="stylesheet">
<link rel="stylesheet" href="${pathToFileURL(p("templates", "pin.css")).href}">
</head><body class="${esc(pin.palette || "warm")} ${pin.format}">${background(pin)}<div class="wrap">${layout(pin)}</div></body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1500 } });
const rendered = [];

for (const pin of copy.pins) {
  pin.id ||= slug(pin.headline);
  if (only && !only.includes(pin.id)) continue;
  if (NEW && fs.existsSync(path.join(outDir, `${pin.id}.png`))) continue;
  try {
    const file = path.join(tmpDir, `${pin.id}.html`);
    fs.writeFileSync(file, html(pin));
    await page.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => (i.onload = i.onerror = r)))));
    });
    const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).length);
    if (broken) throw new Error(`${broken} product image(s) failed to load`);
    await page.screenshot({ path: path.join(outDir, `${pin.id}.png`), type: "png" });
    rendered.push(pin.id);
    console.log(`  ✓ ${pin.id}`);
  } catch (e) {
    console.warn(`  ✗ ${pin.id}: ${e.message}`);
  }
}
await browser.close();

// simple review gallery
const gallery = `<!doctype html><meta charset="utf-8"><title>Pin preview</title>
<style>body{font-family:sans-serif;background:#222;color:#eee;margin:20px}div{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;width:300px}img{width:300px;border-radius:12px}figcaption{font-size:13px;margin-top:4px}</style>
<h2>${rendered.length} pins</h2><div>${rendered.map((id) => `<figure><img src="${pathToFileURL(path.join(outDir, id + ".png")).href}"><figcaption>${id}</figcaption></figure>`).join("")}</div>`;
fs.writeFileSync(p("output", SAMPLE ? "sample-preview.html" : "preview.html"), gallery);
console.log(`Rendered ${rendered.length}/${copy.pins.length} pins -> ${path.relative(p(), outDir)}`);
