// Checks the Creators API keys in .env without printing them.
// Usage: npm run check   (optionally: node scripts/check-keys.mjs us B0XXXXXXXX)
import { loadEnv, loadConfig } from "./lib.mjs";

loadEnv();
const config = loadConfig();
const tokenUrl = process.env.AMAZON_TOKEN_URL || "https://api.amazon.com/auth/o2/token";
const [onlyMarket, testAsin = "B07FZ8S74R"] = process.argv.slice(2);

for (const market of Object.keys(config.markets)) {
  if (onlyMarket && market !== onlyMarket) continue;
  const M = market.toUpperCase();
  const id = process.env[`AMAZON_${M}_CLIENT_ID`], secret = process.env[`AMAZON_${M}_CLIENT_SECRET`];
  if (!id || !secret) { console.log(`${M}: no key in .env (skipped)`); continue; }

  const t = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: id.trim(), client_secret: secret.trim(), scope: "creatorsapi::default" }) });
  const tb = await t.json().catch(() => ({}));
  if (!t.ok || !tb.access_token) {
    console.log(`${M}: login FAILED (HTTP ${t.status}) ${tb.error || ""} ${tb.error_description || ""}`.trim());
    continue;
  }
  console.log(`${M}: login OK (token valid ${tb.expires_in}s)`);

  const m = config.markets[market];
  const r = await fetch("https://creatorsapi.amazon/catalog/v1/getItems", { method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tb.access_token}`, "x-marketplace": m.marketplace },
    body: JSON.stringify({ itemIds: [testAsin], itemIdType: "ASIN", marketplace: m.marketplace, partnerTag: m.partnerTag, resources: ["itemInfo.title", "images.primary.large"] }) });
  const text = await r.text();
  let j = {}; try { j = JSON.parse(text); } catch {}
  const item = (j.itemsResult || j.itemResults || {}).items?.[0];
  if (r.ok && item) console.log(`${M}: product request OK -> "${item.itemInfo?.title?.displayValue?.slice(0, 60)}" | image: ${item.images?.primary?.large?.url ? "yes" : "no"} | link has tag: ${String(item.detailPageURL).includes(m.partnerTag)}`);
  else console.log(`${M}: product request HTTP ${r.status}: ${text.slice(0, 300)}`);
}
