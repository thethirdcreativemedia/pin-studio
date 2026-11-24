// Step 3b (optional): AI background scenes with ComfyUI running locally on your GPU (free).
// The AI only paints the SETTING (a kitchen, a reading corner...). It never sees or redraws
// the Amazon product photo; the real photo is placed on top, untouched, by render-pins.
// Each pin in data/copy.json can have:  "scene": "cozy-kitchen", "scenePrompt": "..."
import fs from "node:fs";
import { p, loadConfig, readJSON, sleep } from "./lib.mjs";

const config = loadConfig();
const c = config.comfyui || {};
const base = (c.url || "http://127.0.0.1:8188").replace(/\/$/, "");
const copyFile = process.argv.includes("--sample") ? p("samples", "copy.json") : p("data", "copy.json");
const copy = readJSON(copyFile, { pins: [] });
const outDir = p("output", "scenes");
fs.mkdirSync(outDir, { recursive: true });

const NEGATIVE =
  "text, words, letters, logo, watermark, brand name, product close-up, appliance, people, hands, faces, " +
  "clutter, blurry, lowres, deformed, oversaturated";

const scenes = new Map();
for (const pin of copy.pins) if (pin.scene && pin.scenePrompt && !scenes.has(pin.scene)) scenes.set(pin.scene, pin.scenePrompt);
const todo = [...scenes].filter(([id]) => !fs.existsSync(`${outDir}/${id}.png`));
if (!todo.length) { console.log("No new scenes to generate."); process.exit(0); }

try { await fetch(`${base}/system_stats`); } catch {
  console.error(`ComfyUI is not running at ${base}. Start ComfyUI first (README step 2b), or skip scenes: pins fall back to plain trend-colour backgrounds.`);
  process.exit(1);
}

function workflow(prompt, seed) {
  return {
    "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: c.checkpoint || "sd_xl_base_1.0.safetensors" } },
    "5": { class_type: "EmptyLatentImage", inputs: { width: 832, height: 1216, batch_size: 1 } },
    "6": { class_type: "CLIPTextEncode", inputs: { clip: ["4", 1],
      text: `${prompt}, empty space in the centre, soft natural light, editorial interior photography, pinterest aesthetic, high detail` } },
    "7": { class_type: "CLIPTextEncode", inputs: { clip: ["4", 1], text: NEGATIVE } },
    "3": { class_type: "KSampler", inputs: { model: ["4", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0],
      seed, steps: c.steps || 28, cfg: c.cfg || 6.5, sampler_name: "dpmpp_2m", scheduler: "karras", denoise: 1 } },
    "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
    "9": { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: "pinscene" } },
  };
}

for (const [id, prompt] of todo) {
  process.stdout.write(`  painting scene "${id}"... `);
  const seed = Math.floor(Math.random() * 1e12);
  const res = await fetch(`${base}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow(prompt, seed) }) });
  if (!res.ok) { console.log(`failed: ${await res.text()}`); continue; }
  const { prompt_id } = await res.json();

  let image;
  for (let i = 0; i < 300 && !image; i++) {
    await sleep(2000);
    const hist = await (await fetch(`${base}/history/${prompt_id}`)).json();
    image = hist[prompt_id]?.outputs?.["9"]?.images?.[0];
  }
  if (!image) { console.log("timed out"); continue; }
  const q = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder, type: image.type });
  const png = Buffer.from(await (await fetch(`${base}/view?${q}`)).arrayBuffer());
  fs.writeFileSync(`${outDir}/${id}.png`, png);
  console.log("done");
}
console.log("Scenes saved in output/scenes. Delete one and re-run to repaint it.");
