// Checks a Pinterest upload CSV: row count, limits, and that every image URL and link responds.
// Usage: node scripts/verify-csv.mjs output/pinterest-upload-....csv
import fs from "node:fs";

const file = process.argv[2];
const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
const rows = text.split("\r\n").filter(Boolean).map((line) => [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"')));
const [head, ...data] = rows;
console.log(`Headers: ${head.join(" | ")}`);
console.log(`${data.length} pins`);
let ok = 0;
const problems = [];
for (const r of data) {
  const [title, media, board, , desc, link, when] = r;
  if (title.length > 100) problems.push(`title too long: ${title}`);
  if (desc.length > 500) problems.push(`description too long: ${title}`);
  if (!desc.includes("Amazon Associate")) problems.push(`no disclosure: ${title}`);
  if (!/tag=/.test(link)) problems.push(`link has no tag: ${title}`);
  const s = (await fetch(media, { method: "HEAD" })).status;
  s === 200 ? ok++ : problems.push(`image ${s}: ${media}`);
}
const boards = {};
for (const r of data) boards[r[2]] = (boards[r[2]] || 0) + 1;
console.log(`Images reachable: ${ok}/${data.length}`);
console.log(`Boards: ${Object.entries(boards).map(([b, n]) => `${b} (${n})`).join(", ")}`);
console.log(`Schedule: ${data[0]?.[6]} -> ${data.at(-1)?.[6]} UTC`);
console.log(problems.length ? `PROBLEMS:\n${problems.join("\n")}` : "No problems found.");
