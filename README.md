# Pin Studio

Turns Amazon products into "why buy", "how to use", lifestyle and "Amazon finds" collage pins,
then writes a Pinterest bulk-upload CSV. Everything runs free on your PC:

| Part | Tool | Cost |
|---|---|---|
| Product data, photos, your tagged links | Amazon Creators API | free |
| Pin copy (titles, benefits, steps, descriptions) | Claude (your subscription) | included |
| AI background scenes (optional) | ComfyUI + SDXL on your RTX 3080 | free |
| Rendering 1000×1500 pins | Playwright (headless Chrome) | free |
| Image hosting (Pinterest needs public image URLs) | GitHub Pages | free |
| Scheduling and posting | Pinterest's own bulk "Create Pins" CSV upload | free |

The Amazon photo is always used **as-is** (only resized). The AI paints the room around it and never
redraws the product, which keeps you inside the Amazon Associates rules.

---

## One-time setup

### 1. Install
Node.js is already installed. In this folder:
```powershell
npm install
```
```powershell
npx playwright install chromium
```

### 2. Your keys and settings
1. Copy `.env.example` to `.env` and paste your **Creators API** Client ID and Secret
   (Associates Central → Tools → Creators API). US and Canada are separate Associates accounts,
   so each gets its own credential (`AMAZON_US_…` and `AMAZON_CA_…`). Never share this file.
2. Copy `config.example.json` to `config.json` and set:
   - `markets.us.partnerTag` and `markets.ca.partnerTag`: your US and Canada tracking IDs
   - `imageBaseUrl`: your GitHub Pages address (step 4)
   - `schedule.pinsPerDay`: start with 5–6 a day

### 2b. AI scenes (optional, free, uses your GPU)
1. Download **ComfyUI Windows portable** from https://github.com/comfyanonymous/ComfyUI/releases and unzip it.
2. Put an SDXL model in `ComfyUI\models\checkpoints\`. `sd_xl_base_1.0.safetensors` from
   https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0 works; RealVisXL / Juggernaut XL look more photographic.
   Put its exact file name in `config.json` → `comfyui.checkpoint`.
3. Start it with `run_nvidia_gpu.bat` and leave it running while you run `npm run scenes`.

Without ComfyUI, pins use clean trend-colour backgrounds, which match the top "Amazon finds" style anyway.

### 3. Pinterest boards
Create your boards first (the CSV refers to them by exact name), e.g. *Coffee Bar Ideas*,
*Amazon Home Finds*, *Cozy Living Room Ideas*, *Gift Ideas for Her*, *Kitchen Must Haves*.

### 4. Free image hosting with GitHub Pages
1. Create a free GitHub account and a **public** repository named `pin-studio`.
2. Push this folder (the `.gitignore` already keeps `.env`, `config.json` and `data/` private).
3. Repository → Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/docs`.
4. Your images will be at `https://<username>.github.io/pin-studio/pins/<id>.png`, which is the `imageBaseUrl`.

---

## Every batch (about 20–30 minutes)

1. **Pick products.** Put them in `products.txt`, one per line: `us B0XXXXXXXX` or `ca https://www.amazon.ca/dp/B0XXXXXXXX`.
2. **Fetch:** `npm run fetch` pulls titles, features, photos and your tagged links.
3. **Write copy:** open this folder in Claude Code and say *"write the pins for the new products"*.
   Claude follows `CLAUDE.md` and fills `data/copy.json`.
4. **Scenes (optional):** with ComfyUI running, `npm run scenes`
5. **Render:** `npm run render`, then open `output/preview.html` and check every pin.
6. **Publish images:** commit and push `docs/pins` to GitHub. Wait about 1 minute for Pages to update.
7. **CSV:** `npm run csv` writes `output/pinterest-upload-<date>-1.csv` (max 200 pins per file, times in UTC).
8. **Upload:** Pinterest (desktop) → Create → *Create Pins in bulk* → upload the CSV.

Try it without any keys: `npm run sample` renders demo pins into `output/sample/`.

## Staying safe with Amazon and Pinterest
- Disclosure (`#affiliate As an Amazon Associate I earn from qualifying purchases.`) is added to every description automatically.
- No prices on pins; prices change and stale prices break the Associates rules.
- Product photos are never edited, cropped or covered. Text sits around them, not on them.
- Spread pins out (the CSV schedules them through the day) and never post identical pins twice.
- Creators API access needs ongoing sales (10 qualifying sales per 30 days reported; access is lost after 30 days without sales). Keep an eye on it in Associates Central.
- AI backgrounds may get Pinterest's "AI modified" label. Compare saves/clicks of scene pins vs plain pins in Pinterest Analytics and keep what works.
