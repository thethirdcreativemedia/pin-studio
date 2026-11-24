// Step 6: build the Pinterest bulk-upload CSV (Business account > Create > Create Pins in bulk).
// Only pins whose PNG exists in docs/pins and that were not exported before are included.
// Use --sample to test with the sample pins, --all to re-export everything.
// --only=id1,id2 exports just those pins (even if exported before), e.g. to re-send rows Pinterest rejected.
// --after=2026-11-30T17:30 starts the schedule at the first slot after that UTC time (default: tomorrow).
// Pinterest rejects a row whose link already appears in the same file ("Duplicate Pin link"), so pins that share
// a link are spread over separate files (-1, -2, -3 ...). Upload each file on its own.
import fs from "node:fs";
import { p, loadConfig, readJSON, writeJSON, DISCLOSURE } from "./lib.mjs";

const SAMPLE = process.argv.includes("--sample");
const ALL = process.argv.includes("--all");
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const ONLY = arg("only")?.split(",").filter(Boolean);
const AFTER = arg("after");
const config = loadConfig();
const products = SAMPLE ? readJSON(p("samples", "products.json"), {}) : readJSON(p("data", "products.json"), {});
const copy = SAMPLE ? readJSON(p("samples", "copy.json"), { pins: [] }) : readJSON(p("data", "copy.json"), { pins: [] });
const pinDir = SAMPLE ? p("output", "sample") : p("docs", "pins");
const exportedFile = p("data", "exported.json");
const exportedAll = SAMPLE ? {} : readJSON(exportedFile, {});
const exported = SAMPLE || ALL || ONLY ? {} : exportedAll;
const base = config.imageBaseUrl.replace(/\/?$/, "/");

const HEADERS = ["Title", "Media URL", "Pinterest board", "Thumbnail", "Description", "Link", "Publish date", "Keywords"];
const cell = (v = "") => `"${String(v).replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
const cut = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");

// collect pins that are ready
let ready = [];
for (const pin of copy.pins) {
  if (!pin.id || exported[pin.id]) continue;
  if (ONLY && !ONLY.includes(pin.id)) continue;
  if (!fs.existsSync(`${pinDir}/${pin.id}.png`)) { console.warn(`  skip ${pin.id}: no image rendered yet`); continue; }
  if (!pin.board) { console.warn(`  skip ${pin.id}: no board set`); continue; }
  // gift guides link to their shoppable page (every product tagged); other pins link straight to the product
  if (pin.format === "guide") {
    if (!fs.existsSync(p("docs", "guides", pin.id, "index.html"))) { console.warn(`  skip ${pin.id}: run npm run guides first`); continue; }
    ready.push({ pin, link: base.replace(/pins\/$/, "") + `guides/${pin.id}/` });
    continue;
  }
  const prod = products[pin.link || pin.products?.[0]];
  if (!prod?.link) { console.warn(`  skip ${pin.id}: no product link`); continue; }
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
const start = AFTER ? new Date(AFTER.replace(/Z?$/, "Z")) : s.startDate ? new Date(`${s.startDate}T00:00:00Z`) : new Date(Date.now() + 86400000);
const day0 = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
const slot = (k) => {
  const d = new Date(day0 + Math.floor(k / perDay) * 86400000);
  const [hh, mm] = times[k % perDay % times.length].split(":");
  d.setUTCHours(+hh, +mm, 0, 0);
  return d;
};
let skip = 0;
if (AFTER) while (slot(skip) <= start) skip++;
const when = (n) => slot(n + skip).toISOString().slice(0, 19); // YYYY-MM-DDTHH:MM:SS (UTC)

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

// Pinterest accepts up to 200 pins per file, and each link only once per file: put every row in the first
// file that has room and does not already contain its link.
fs.mkdirSync(p("output"), { recursive: true });
const groups = [];
for (const r of rows) {
  let g = groups.find((x) => x.length < 200 && !x.some((y) => y[5] === r[5]));
  if (!g) groups.push((g = []));
  g.push(r);
}
const files = [];
for (const group of groups) {
  const name = `pinterest-upload${SAMPLE ? "-sample" : ""}-${new Date().toISOString().slice(0, 10)}-${files.length + 1}.csv`;
  const csv = [HEADERS.map(cell).join(","), ...group.map((r) => r.map(cell).join(","))].join("\r\n");
  fs.writeFileSync(p("output", name), "﻿" + csv + "\r\n");
  files.push(name);
}

if (!SAMPLE) {
  for (const { pin } of ordered) exportedAll[pin.id] = new Date().toISOString();
  writeJSON(exportedFile, exportedAll);
}
console.log(rows.length ? `${rows.length} pins scheduled from ${rows[0][6]} to ${rows.at(-1)[6]} UTC -> output/${files.join(", output/")}${files.length > 1 ? " (upload each file separately)" : ""}` : "No new pins to export.");
if (!SAMPLE && rows.length) console.log("Reminder: push docs/pins to GitHub first so the Media URLs work, then upload the CSV.");
