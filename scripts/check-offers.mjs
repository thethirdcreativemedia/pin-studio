// Commission safety check: every product must have a live Amazon offer and a link with the right tracking tag.
// Usage: node scripts/check-offers.mjs            (all products in data/products.json)
//        node scripts/check-offers.mjs us-B0XXXX  (only those keys)
// Prices are fetched only to confirm the item is sellable; they are never written to pins.
import { p, loadEnv, loadConfig, readJSON, sleep } from "./lib.mjs";

loadEnv();
const config = loadConfig();
const products = readJSON(p("data", "products.json"), {});
const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(products);
const tokenUrl = process.env.AMAZON_TOKEN_URL || "https://api.amazon.com/auth/o2/token";
const tokens = {};
async function token(market) {
  if (tokens[market]) return tokens[market];
  const M = market.toUpperCase();
  const r = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: process.env[`AMAZON_${M}_CLIENT_ID`],
      client_secret: process.env[`AMAZON_${M}_CLIENT_SECRET`], scope: "creatorsapi::default" }) });
  const j = await r.json();
  if (!j.access_token) throw new Error(`${market} login failed`);
  return (tokens[market] = j.access_token);
}

const problems = [];
let ok = 0;
const byMarket = {};
for (const k of keys) {
  const prod = products[k];
  if (!prod) { problems.push(`${k}: not in data/products.json`); continue; }
  (byMarket[prod.market] ||= []).push(prod);
}
for (const [market, list] of Object.entries(byMarket)) {
  const m = config.markets[market];
  for (let i = 0; i < list.length; i += 10) {
    const batch = list.slice(i, i + 10);
    let items = [];
    for (let attempt = 0; attempt < 4; attempt++) {
      const r = await fetch("https://creatorsapi.amazon/catalog/v1/getItems", { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token(market)}`, "x-marketplace": m.marketplace },
        body: JSON.stringify({ itemIds: batch.map((x) => x.asin), itemIdType: "ASIN", marketplace: m.marketplace,
          partnerTag: m.partnerTag, resources: ["offersV2.listings.price", "offersV2.listings.availability"] }) });
      if (r.status === 429) { await sleep(2500 * (attempt + 1)); continue; }
      const j = await r.json();
      items = (j.itemsResult || j.itemResults)?.items || [];
      break;
    }
    for (const prod of batch) {
      const it = items.find((x) => x.asin === prod.asin);
      const listing = it?.offersV2?.listings?.[0];
      const avail = listing?.availability?.type || listing?.availability?.message || "";
      const tagOk = new URL(prod.link).searchParams.get("tag") === m.partnerTag;
      const host = new URL(prod.link).hostname === m.marketplace;
      const issues = [];
      if (!tagOk) issues.push(`link tag is not ${m.partnerTag}`);
      if (!host) issues.push("link points to the wrong Amazon store");
      if (!listing?.price) issues.push("no live offer (unavailable or no buy box)");
      else if (/out ?of ?stock|unavailable/i.test(avail)) issues.push(`availability: ${avail}`);
      if (issues.length) problems.push(`${prod.key}: ${issues.join("; ")} | ${prod.title.slice(0, 60)}`);
      else ok++;
    }
    await sleep(1100);
  }
}
console.log(`${ok}/${keys.length} products have a live offer and a correctly tagged link.`);
console.log(problems.length ? `PROBLEMS:\n${problems.join("\n")}` : "No problems found.");
