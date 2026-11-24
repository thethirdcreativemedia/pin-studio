// Review sheet of every Amazon image per product (main = 0, variants = 1..n), so Claude/you can
// pick lifestyle shots for pins via "image": n in copy.json. Images are loaded live from Amazon, not stored.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { p, readJSON } from "./lib.mjs";

const products = readJSON(p("data", "products.json"), {});
const only = process.argv.slice(2);
const keys = Object.keys(products).filter((k) => !only.length || only.some((o) => k.includes(o)));
const rows = keys.map((k) => {
  const x = products[k];
  const imgs = [x.imageUrl, ...(x.extraImages || [])];
  return `<div style="display:flex;gap:6px;align-items:center;margin:6px 0"><div style="width:170px;font:12px sans-serif;color:#eee">${k}<br>${x.title.slice(0, 40)}</div>${imgs
    .map((u, i) => `<div style="position:relative"><img src="${u}" style="height:150px;width:150px;object-fit:contain;background:#fff"><b style="position:absolute;left:4px;top:2px;background:#e33;color:#fff;font:12px sans-serif;padding:1px 5px">${i}</b></div>`).join("")}</div>`;
});
fs.mkdirSync(p("output", "_tmp"), { recursive: true });
fs.writeFileSync(p("output", "_tmp", "images.html"), `<body style="margin:8px;background:#333">${rows.join("")}</body>`);
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(pathToFileURL(p("output", "_tmp", "images.html")).href, { waitUntil: "networkidle" });
await page.screenshot({ path: p("output", "image-sheet.png"), fullPage: true });
await b.close();
console.log("output/image-sheet.png");
