// Step 1: pull product data from the Amazon Creators API (official, allowed).
// Input: products.txt ("us B0XXXX" or "ca https://www.amazon.ca/dp/B0XXXX" per line)
// Output: data/products.json
import fs from "node:fs";
import { p, loadEnv, loadConfig, readJSON, writeJSON, sleep } from "./lib.mjs";

loadEnv();
const config = loadConfig();
const API = "https://creatorsapi.amazon/catalog/v1/getItems";
const RESOURCES = ["itemInfo.title", "itemInfo.features", "images.primary.large", "images.variants.large"];

const tokenUrl = process.env.AMAZON_TOKEN_URL || "https://api.amazon.com/auth/o2/token";
// Each market (us, ca) is its own Associates account with its own credential.
const creds = (market) => {
  const M = market.toUpperCase();
  const env = process.env;
  return { id: env[`AMAZON_${M}_CLIENT_ID`] || env.AMAZON_CLIENT_ID, secret: env[`AMAZON_${M}_CLIENT_SECRET`] || env.AMAZON_CLIENT_SECRET };
};

// --- read products.txt ---
const listFile = p("products.txt");
if (!fs.existsSync(listFile)) {
  console.error("Missing products.txt. Copy products.example.txt and add your products.");
  process.exit(1);
}
const wanted = {}; // market -> Set(asin)
for (const raw of fs.readFileSync(listFile, "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const [market, ref] = line.split(/\s+/);
  const asin = (ref || "").match(/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1] || ref;
  if (!config.markets[market] || !/^[A-Z0-9]{10}$/i.test(asin || "")) {
    console.warn(`Skipping line (need "us|ca ASIN-or-URL"): ${line}`);
    continue;
  }
  (wanted[market] ||= new Set()).add(asin.toUpperCase());
}

// --- OAuth token (client credentials, JSON body per Creators API docs) ---
async function getToken({ id, secret }) {
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: id, client_secret: secret, scope: "creatorsapi::default" }),
  });
  if (!res.ok) throw new Error(`Token request failed ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function getItems(token, market, asins) {
  const m = config.markets[market];
  const body = { itemIds: asins, itemIdType: "ASIN", marketplace: m.marketplace, partnerTag: m.partnerTag, resources: RESOURCES };
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-marketplace": m.marketplace },
      body: JSON.stringify(body),
    });
    if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`getItems ${market} failed ${res.status}: ${await res.text()}`);
    return res.json();
  }
  throw new Error("Rate limited too many times (HTTP 429). Try again later.");
}

const products = readJSON(p("data", "products.json"), {});
let count = 0;

for (const [market, set] of Object.entries(wanted)) {
  const c = creds(market);
  if (!c.id || !c.secret) {
    console.warn(`Skipping ${set.size} ${market.toUpperCase()} product(s): no AMAZON_${market.toUpperCase()}_CLIENT_ID / _SECRET in .env yet.`);
    continue;
  }
  const token = await getToken(c);
  const asins = [...set];
  for (let i = 0; i < asins.length; i += 10) {
    const json = await getItems(token, market, asins.slice(i, i + 10));
    const items = (json.itemsResult || json.itemResults || {}).items || [];
    for (const it of items) {
      const img = it.images?.primary?.large;
      products[`${market}-${it.asin}`] = {
        key: `${market}-${it.asin}`,
        market,
        asin: it.asin,
        title: it.itemInfo?.title?.displayValue || "",
        features: it.itemInfo?.features?.displayValues || [],
        imageUrl: img?.url || "",
        extraImages: (it.images?.variants || []).map((v) => v.large?.url).filter(Boolean).slice(0, 8),
        link: it.detailPageURL, // already contains your partner tag
        fetchedAt: new Date().toISOString(),
      };
      count++;
    }
    for (const e of json.errors || []) console.warn(`  ${market}: ${e.code} - ${e.message}`);
    await sleep(1100); // new accounts start at 1 request/second
  }
}

writeJSON(p("data", "products.json"), products);
console.log(`Fetched ${count} products -> data/products.json`);
console.log("Next: ask Claude to write the pin copy (data/copy.json). See README step 3.");
