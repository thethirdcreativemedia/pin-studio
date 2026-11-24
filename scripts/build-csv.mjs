// Step 6: build the Pinterest bulk-upload CSV (Business account > Create > Create Pins in bulk).
// Only pins whose PNG exists in docs/pins and that were not exported before are included.
// Use --sample to test with the sample pins, --all to re-export everything.
import fs from "node:fs";
import { p, loadConfig, readJSON, writeJSON, DISCLOSURE } from "./lib.mjs";

const SAMPLE = process.argv.includes("--sample");
const ALL = process.argv.includes("--all");
const config = loadConfig();
const products = SAMPLE ? readJSON(p("samples", "products.json"), {}) : readJSON(p("data", "products.json"), {});
const copy = SAMPLE ? readJSON(p("samples", "copy.json"), { pins: [] }) : readJSON(p("data", "copy.json"), { pins: [] });
const pinDir = SAMPLE ? p("output", "sample") : p("docs", "pins");
const exportedFile = p("data", "exported.json");
const exported = SAMPLE || ALL ? {} : readJSON(exportedFile, {});
const base = config.imageBaseUrl.replace(/\/?$/, "/");

const HEADERS = ["Title", "Media URL", "Pinterest board", "Thumbnail", "Description", "Link", "Publish date", "Keywords"];
const cell = (v = "") => `"${String(v).replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
const cut = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");

// collect pins that are ready
let ready = [];
for (const pin of copy.pins) {
  if (!pin.id || exported[pin.id]) continue;
  if (!fs.existsSync(`${pinDir}/${pin.id}.png`)) { console.warn(`  skip ${pin.id}: no image rendered yet`); continue; }
  const prod = products[pin.link || pin.products?.[0]];
  if (!prod?.link) { console.warn(`  skip ${pin.id}: no product link`); continue; }
  if (!pin.board) { console.warn(`  skip ${pin.id}: no board set`); continue; }
  ready.push({ pin, link: prod.link });
}

// order so the same product link is never posted back-to-back
const ordered = [];
while (ready.length) {
  const last = ordered.at(-1)?.link;
  const i = ready.findIndex((r) => r.link !== last);
  ordered.push(...ready.splice(i === -1 ? 0 : i, 1));
}

// schedule: N pins per day at the configured UTC times, starting tomorrow (or startDate)
const s = config.schedule || {};
const perDay = Math.max(1, s.pinsPerDay || 6);
const times = (s.timesUtc?.length ? s.timesUtc : ["14:00", "17:00", "20:00", "23:00"]);
const start = s.startDate ? new Date(`${s.startDate}T00:00:00Z`) : new Date(Date.now() + 86400000);
const day0 = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
const when = (n) => {
  const d = new Date(day0 + Math.floor(n / perDay) * 86400000);
  const [hh, mm] = times[n % perDay % times.length].split(":");
  d.setUTCHours(+hh, +mm, 0, 0);
  return d.toISOString().slice(0, 19); // YYYY-MM-DDTHH:MM:SS (UTC)
};

const rows = ordered.map(({ pin, link }, n) => [
  cut(pin.title || pin.headline, 100),
  base + `${pin.id}.png`,
  pin.board,
  "",
  cut(`${pin.description || ""} #affiliate ${DISCLOSURE}`.trim(), 500),
  link,
  when(n),
  (pin.keywords || []).join(", "),
]);

// Pinterest accepts up to 200 pins per file
fs.mkdirSync(p("output"), { recursive: true });
const files = [];
for (let i = 0; i < rows.length; i += 200) {
  const name = `pinterest-upload${SAMPLE ? "-sample" : ""}-${new Date().toISOString().slice(0, 10)}-${files.length + 1}.csv`;
  const csv = [HEADERS.map(cell).join(","), ...rows.slice(i, i + 200).map((r) => r.map(cell).join(","))].join("\r\n");
  fs.writeFileSync(p("output", name), "﻿" + csv + "\r\n");
  files.push(name);
}

if (!SAMPLE) {
  for (const { pin } of ordered) exported[pin.id] = new Date().toISOString();
  writeJSON(exportedFile, exported);
}
console.log(rows.length ? `${rows.length} pins scheduled from ${rows[0][6]} to ${rows.at(-1)[6]} UTC -> output/${files.join(", output/")}` : "No new pins to export.");
if (!SAMPLE && rows.length) console.log("Reminder: push docs/pins to GitHub first so the Media URLs work, then upload the CSV.");
