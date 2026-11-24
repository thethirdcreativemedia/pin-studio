// Builds one shoppable page per gift-guide pin: docs/guides/<pin id>/index.html
// Every product gets its own tagged Amazon link, numbered to match the pin image.
// Product names/notes come from data/blurbs.json (our own words). Photos load live from Amazon.
// Re-run after `npm run fetch` so image URLs and links stay current.
import fs from "node:fs";
import { p, loadConfig, readJSON, DISCLOSURE } from "./lib.mjs";

const config = loadConfig();
const products = readJSON(p("data", "products.json"), {});
const blurbs = readJSON(p("data", "blurbs.json"), {});
const copy = readJSON(p("data", "copy.json"), { pins: [] });
const pinBase = config.imageBaseUrl.replace(/\/?$/, "/");
const siteBase = pinBase.replace(/pins\/$/, "");

const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const short = (t) => t.split(/\s[-–|]\s|,|\|/)[0].trim();

const PALETTES = {
  holiday: { bg: "#5c1424", bg2: "#3a0a15", ink: "#f8ead7", accent: "#e0b874", card: "#fffaf3", cardInk: "#3a0a15", onAccent: "#3a0a15" },
  noir: { bg: "#1b1715", bg2: "#0b0908", ink: "#f4e9d8", accent: "#d6ad6a", card: "#fbf6ee", cardInk: "#1b1715", onAccent: "#1b1715" },
  cream: { bg: "#f4ece1", bg2: "#e6d6c1", ink: "#3d2a1e", accent: "#9c6b3f", card: "#fffdf9", cardInk: "#3d2a1e", onAccent: "#fff" },
  deco: { bg: "#1f3b33", bg2: "#16302a", ink: "#f3e7cf", accent: "#c9a45c", card: "#fbf7ef", cardInk: "#1f3b33", onAccent: "#1f3b33" },
};

let built = 0;
for (const pin of copy.pins.filter((x) => x.format === "guide")) {
  const c = PALETTES[pin.palette] || PALETTES.cream;
  const items = pin.products.map((key, i) => {
    const prod = products[key];
    if (!prod?.link) throw new Error(`${pin.id}: no product data for ${key} (run npm run fetch)`);
    const b = blurbs[key] || {};
    return `<li class="item">
      <div class="no">${i + 1}</div>
      <a class="photo" href="${esc(prod.link)}" rel="sponsored nofollow noopener" target="_blank"><img src="${esc(prod.imageUrl)}" alt="${esc(b.name || short(prod.title))}" loading="lazy"></a>
      <div class="text">
        <h2>${esc(b.name || short(prod.title))}</h2>
        ${b.note ? `<p>${esc(b.note)}</p>` : ""}
        <a class="btn" href="${esc(prod.link)}" rel="sponsored nofollow noopener" target="_blank">See it on Amazon →</a>
      </div>
    </li>`;
  });

  const title = `${pin.kicker ? pin.kicker + " " : ""}${pin.headline} ${pin.script || ""}`.replace(/\s+/g, " ").trim();
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pin.title || title)}</title>
<meta name="description" content="${esc(pin.description || "")}">
<meta property="og:title" content="${esc(pin.title || title)}">
<meta property="og:description" content="${esc(pin.description || "")}">
<meta property="og:image" content="${esc(pinBase + pin.id + ".png")}">
<meta property="og:type" content="article">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Inter:wght@400;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;background:radial-gradient(120% 60% at 50% 0%,${c.bg} 30%,${c.bg2} 100%) fixed;color:${c.ink};line-height:1.5}
.wrap{max-width:760px;margin:0 auto;padding:36px 18px 60px}
header{text-align:center;margin-bottom:22px}
.kicker{letter-spacing:5px;text-transform:uppercase;font-weight:700;font-size:13px;color:${c.accent}}
h1{font-family:"Playfair Display",Georgia,serif;font-size:clamp(38px,9vw,64px);line-height:1.05;margin-top:8px}
.script{font-family:"Great Vibes",cursive;font-size:clamp(34px,8vw,52px);color:${c.accent};line-height:1.1}
.sub{letter-spacing:4px;text-transform:uppercase;font-size:12px;opacity:.85;margin-top:4px}
.disc{font-size:13px;opacity:.8;margin:18px auto 0;max-width:560px}
.intro{margin:18px auto 0;max-width:600px;font-size:16px;opacity:.95}
ol{list-style:none;display:grid;gap:18px;margin-top:28px}
.item{position:relative;display:flex;gap:18px;align-items:center;background:${c.card};color:${c.cardInk};border-radius:22px;padding:16px;box-shadow:0 14px 34px rgba(0,0,0,.22)}
.no{position:absolute;top:-10px;left:-8px;width:42px;height:42px;border-radius:50%;background:${c.accent};color:${c.onAccent};font:700 20px "Playfair Display",serif;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.3)}
.photo{flex:0 0 150px;height:150px;background:#fff;border-radius:14px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.photo img{max-width:100%;max-height:100%;object-fit:contain}
.text h2{font-size:18px;line-height:1.25}
.text p{font-size:14.5px;opacity:.85;margin-top:4px}
.btn{display:inline-block;margin-top:10px;background:${c.accent};color:${c.onAccent};font-weight:700;font-size:14px;padding:10px 18px;border-radius:999px;text-decoration:none}
footer{text-align:center;font-size:13px;opacity:.75;margin-top:34px}
footer a{color:inherit}
@media(max-width:520px){.item{flex-direction:column;text-align:center}.photo{flex-basis:auto;width:100%;height:220px}}
</style></head>
<body><div class="wrap">
<header>
  ${pin.kicker ? `<div class="kicker">${esc(pin.kicker)}</div>` : ""}
  <h1>${esc(pin.headline)}</h1>
  ${pin.script ? `<div class="script">${esc(pin.script)}</div>` : ""}
  ${pin.sub ? `<div class="sub">${esc(pin.sub)}</div>` : ""}
  <p class="disc">${esc(DISCLOSURE)} Links below go to Amazon; prices and availability are shown there.</p>
  ${pin.description ? `<p class="intro">${esc(pin.description)}</p>` : ""}
</header>
<ol>${items.join("\n")}</ol>
<footer>Curated by <a href="https://www.pinterest.com/manuelfinds/" rel="noopener">Manuel Finds on Pinterest</a> · ${esc(DISCLOSURE)}</footer>
</div></body></html>`;

  fs.mkdirSync(p("docs", "guides", pin.id), { recursive: true });
  fs.writeFileSync(p("docs", "guides", pin.id, "index.html"), html);
  built++;
  console.log(`  ✓ ${siteBase}guides/${pin.id}/  (${pin.products.length} products)`);
}
console.log(`Built ${built} gift-guide pages.`);
