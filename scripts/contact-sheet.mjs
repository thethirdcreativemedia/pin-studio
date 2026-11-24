// Makes review sheets (12 pins each) from docs/pins -> output/sheet-N.png
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { p } from "./lib.mjs";

const dir = process.argv.includes("--sample") ? p("output", "sample") : p("docs", "pins");
// --recent=90 only includes PNGs rendered in the last 90 minutes (review a new batch)
const recent = Number(process.argv.find((a) => a.startsWith("--recent="))?.slice(9) || 0);
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png"))
  .filter((f) => !recent || Date.now() - fs.statSync(`${dir}/${f}`).mtimeMs < recent * 60000).sort();
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1800, height: 1640 } });
for (let i = 0; i < files.length; i += 12) {
  const html = `<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(6,300px);gap:0;font:12px sans-serif;color:#ddd">${files
    .slice(i, i + 12).map((f) => `<div><img src="${pathToFileURL(`${dir}/${f}`).href}" style="width:300px;display:block"><div style="padding:2px 4px;height:16px">${f}</div></div>`).join("")}</body>`;
  fs.writeFileSync(p("output", "_tmp", "sheet.html"), html);
  await page.goto(pathToFileURL(p("output", "_tmp", "sheet.html")).href, { waitUntil: "load" });
  await page.screenshot({ path: p("output", `sheet-${i / 12 + 1}.png`), fullPage: true });
}
await b.close();
console.log(`${Math.ceil(files.length / 12)} sheets in output/`);
