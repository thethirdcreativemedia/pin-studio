// Shared helpers: config, .env loading, JSON files, slugs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const p = (...parts) => path.join(ROOT, ...parts);

// Minimal .env reader (KEY=value lines). Secrets live only in .env, never in config.json.
export function loadEnv() {
  const file = p(".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export function loadConfig() {
  const file = p("config.json");
  if (!fs.existsSync(file)) {
    console.error("Missing config.json. Copy config.example.json to config.json and fill it in.");
    process.exit(1);
  }
  return parseJSON(file);
}

// Strip the byte-order mark Notepad/PowerShell may add, so hand-edited files still load.
const parseJSON = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));

export const readJSON = (file, fallback) => (fs.existsSync(file) ? parseJSON(file) : fallback);

export function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

export const slug = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const DISCLOSURE = "As an Amazon Associate I earn from qualifying purchases.";
