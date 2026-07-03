import OpenAI, { toFile } from "openai";
import fs from "node:fs";
import path from "node:path";

const src = process.argv[2];
const out = process.argv[3];
const size = process.argv[4] || "auto";
const prompt = process.env.PROMPT || "Translate all text to Brazilian Portuguese, keep the exact same layout.";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const type = src.toLowerCase().endsWith(".webp")
  ? "image/webp"
  : /\.jpe?g$/i.test(src) ? "image/jpeg" : "image/png";

const f = await toFile(fs.createReadStream(src), "image-0" + path.extname(src), { type });
try {
  const r = await client.images.edit({ model: "gpt-image-2", prompt, size, quality: "high", image: [f] });
  const b64 = r.data?.[0]?.b64_json;
  if (!b64) { console.log("ERRO: sem imagem na resposta"); process.exit(1); }
  fs.writeFileSync(out, Buffer.from(b64, "base64"));
  console.log("OK:", out);
} catch (e) {
  console.log("ERRO:", e.status, e.error?.message || e.message);
  process.exit(1);
}
