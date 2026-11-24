// Product research: search Amazon via the Creators API and list high-ticket candidates.
// Usage: node scripts/find-products.mjs [market] "query|SearchIndex|minPriceDollars" ...
// Output: data/candidates.json (price is only used for filtering, never shown on pins)
import { p, loadEnv, loadConfig, readJSON, writeJSON, sleep } from "./lib.mjs";

loadEnv();
const config = loadConfig();
const args = process.argv.slice(2);
const market = config.markets[args[0]] ? args.shift() : "us";
const m = config.markets[market];
const M = market.toUpperCase();
const id = process.env[`AMAZON_${M}_CLIENT_ID`], secret = process.env[`AMAZON_${M}_CLIENT_SECRET`];
const tokenUrl = process.env.AMAZON_TOKEN_URL || "https://api.amazon.com/auth/o2/token";

const tok = await (await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ grant_type: "client_credentials", client_id: id, client_secret: secret, scope: "creatorsapi::default" }) })).json();
if (!tok.access_token) { console.error("Login failed", tok); process.exit(1); }

const RESOURCES = ["itemInfo.title", "itemInfo.byLineInfo", "images.primary.large", "offersV2.listings.price", "customerReviews.count", "customerReviews.starRating"];

async function search(keywords, searchIndex = "All", minDollars = 150) {
  const body = { keywords, searchIndex, itemCount: 10, partnerTag: m.partnerTag, marketplace: m.marketplace, resources: RESOURCES };
  if (minDollars) body.minPrice = minDollars * 100;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch("https://creatorsapi.amazon/catalog/v1/searchItems", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok.access_token}`, "x-marketplace": m.marketplace },
      body: JSON.stringify(body) });
    if (r.status === 429) { await sleep(2500 * (attempt + 1)); continue; }
    const text = await r.text();
    if (!r.ok) {
      // some resources may not exist on the Creators API: retry once without reviews
      if (r.status === 400 && body.resources.some((x) => x.startsWith("customerReviews"))) {
        body.resources = body.resources.filter((x) => !x.startsWith("customerReviews")); continue;
      }
      throw new Error(`searchItems ${r.status}: ${text.slice(0, 300)}`);
    }
    return JSON.parse(text).searchResult?.items || [];
  }
  return [];
}

const out = readJSON(p("data", "candidates.json"), {});
for (const q of args) {
  const [keywords, index = "All", min = "150"] = q.split("|");
  const items = await search(keywords, index, Number(min));
  console.log(`\n## ${keywords} (${index}, $${min}+)`);
  for (const it of items) {
    const price = it.offersV2?.listings?.[0]?.price?.money;
    const rev = it.customerReviews;
    const row = {
      market, asin: it.asin, query: keywords,
      title: it.itemInfo?.title?.displayValue || "",
      brand: it.itemInfo?.byLineInfo?.brand?.displayValue || "",
      price: price?.amount ?? null,
      rating: rev?.starRating?.value ?? null, reviews: rev?.count ?? null,
      image: it.images?.primary?.large?.url || "",
    };
    out[`${market}-${it.asin}`] = row;
    console.log(`${it.asin} | $${row.price ?? "?"} | ${row.rating ?? "-"}★ (${row.reviews ?? "-"}) | ${row.brand} | ${row.title.slice(0, 80)}`);
  }
  await sleep(1200);
}
writeJSON(p("data", "candidates.json"), out);
