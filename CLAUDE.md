# Pin Studio: instructions for Claude

This project turns Amazon products (Creators API) into Pinterest pins plus a bulk-upload CSV.
Pipeline: `npm run fetch` → **Claude writes data/copy.json** → `npm run scenes` (optional) → `npm run render` → review → `npm run csv`.

## When the user asks you to "write the pins" / "write copy"

Read `data/products.json` (title, features, market, key) and add pins to `data/copy.json`
(create `{ "pins": [] }` if missing; never delete pins already there, as they may be scheduled).
Make **3 pins per product, each a different format**, plus a **collage** pin for every 4–6 related products.

Pin object fields:
- `id`: unique kebab-case, e.g. `breville-latte-howto`. Also the PNG file name.
- `format`: `whybuy` | `howto` | `lifestyle` | `collage`
- `palette`: `warm` (beige/brown, the top-performing "Amazon finds" look) | `glacier` (icy blue, 2026 trend) | `deco` (green/gold Neo Deco) | `afro` (terracotta, Afrohemian) | `funhaus` (stripes) | `blush` (beauty/gifts for her)
- `products`: product keys like `us-B0XXXXXXX` (1 for whybuy/howto/lifestyle, 3–6 for collage, same market)
- `link`: the product key the pin links to (collage: the hero product)
- `kicker`: 2–4 word eyebrow, e.g. "Coffee bar upgrade"
- `headline`: ≤ 32 characters, benefit or curiosity, title case
- `script`: optional ≤ 28 char handwritten subtitle (whybuy, collage)
- `benefits`: whybuy only, exactly 3 lines, ≤ 38 chars each
- `steps`: howto only, 3–4 short imperative steps, ≤ 34 chars each. `tip`: optional ≤ 48 chars
- `caption`: lifestyle only, ≤ 22 chars, handwritten polaroid caption
- `cta`: ≤ 22 chars, e.g. "See it on Amazon →"
- `scene` + `scenePrompt`: optional AI background (lifestyle/howto look best). The prompt describes ONLY a setting
  (room, surface, light, colours): never the product, people, text or brands. Reuse one scene id across similar pins.
- `board`: Pinterest board name, must already exist. Current boards: Gift Ideas for Her, Cozy Living Room Decor,
  Christmas Gift Ideas, Wedding Decor Ideas, Home Improvement Ideas, Viral Beauty Finds, Tech Finds, Halloween Decor, Perfume Finds.
  Audience (Nov 2026 audit): 71% women, 25–34, US-focused. Favour home decor, gifts for her, wedding, kitchen, beauty;
  benefit-led product pins get 5–14% outbound click rates vs ~0.1% for curiosity pins. Use US links (OneLink covers Canada).
- `title`: ≤ 100 chars, keyword-first, as people search Pinterest
- `description`: ≤ 400 chars (the script appends "#affiliate" and the Amazon disclosure), natural sentences with 2–3 search keywords
- `keywords`: 3–6 Pinterest search phrases

## Rules (Amazon Associates + Pinterest)
- Only claim what the product's `features`/`title` support. No invented specs, no medical/health claims, no fake reviews or "best seller" claims.
- **Never put prices, discounts or "deal" wording** in any field (Amazon prices change; stale prices break Associates rules).
- Don't imply Amazon endorses the pin. Don't use the word "Amazon" in a way that looks like Amazon's own branding.
- The product photo is used **unmodified** (templates only resize it). Never ask an AI tool to redraw, edit or "recreate" Amazon images.
- Vary headlines: never reuse the same headline twice; Pinterest treats near-duplicates as spam.
- Seasonal focus: Nov–Dec gift guides ("gifts for coffee lovers", "luxury gifts for her"); Jan home gym/organisation; Feb–May patio, spring decor, travel.

After writing copy: run `npm run render`, open `output/preview.html`, look at a few PNGs, and fix any text that wraps badly.
