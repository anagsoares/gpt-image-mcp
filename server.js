#!/usr/bin/env node
// gpt-image-mcp — MCP server local para gerar/editar imagens com OpenAI gpt-image-2.
// Chama a API da OpenAI direto (sem intermediário). Modelo fixo: gpt-image-2.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import OpenAI, { toFile } from "openai";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const MODEL = "gpt-image-2";

// Chave: env OPENAI_API_KEY tem prioridade; senão busca no Keychain do macOS
// (serviço "openai-gpt-image"). Assim nenhum segredo fica no settings.json.
function resolveApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  try {
    return execFileSync(
      "security",
      ["find-generic-password", "-s", "openai-gpt-image", "-w"],
      { encoding: "utf8" }
    ).trim();
  } catch {
    return null;
  }
}

const apiKey = resolveApiKey();
if (!apiKey) {
  console.error(
    "[gpt-image-mcp] ERRO: chave não encontrada. Defina OPENAI_API_KEY ou guarde no Keychain:\n" +
      '  security add-generic-password -a "$USER" -s openai-gpt-image -w'
  );
  process.exit(1);
}
const client = new OpenAI({ apiKey });

// Diretório de saída padrão (sobrescrevível por parâmetro ou env GPT_IMAGE_OUTPUT_DIR).
const DEFAULT_OUTPUT_DIR =
  process.env.GPT_IMAGE_OUTPUT_DIR || path.join(os.homedir(), "Documents", "gpt-image");

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function saveImages(dataArray, outputDir, format) {
  fs.mkdirSync(outputDir, { recursive: true });
  const ext = format === "jpeg" ? "jpg" : format;
  const paths = [];
  const stamp = timestamp();
  dataArray.forEach((item, i) => {
    if (!item.b64_json) return;
    const file = path.join(outputDir, `gptimg-${stamp}-${i + 1}.${ext}`);
    fs.writeFileSync(file, Buffer.from(item.b64_json, "base64"));
    paths.push(file);
  });
  return paths;
}

function errText(err) {
  const status = err?.status ? ` (HTTP ${err.status})` : "";
  const msg = err?.error?.message || err?.message || String(err);
  let hint = "";
  if (err?.status === 401) hint = " — verifique se a OPENAI_API_KEY é válida e está ativa.";
  else if (err?.status === 429) hint = " — limite de taxa ou créditos esgotados na conta OpenAI.";
  else if (/model/i.test(msg) && /not|exist|access/i.test(msg))
    hint = " — sua conta pode ainda não ter acesso ao gpt-image-2; confira em platform.openai.com.";
  return `Falha na API da OpenAI${status}: ${msg}${hint}`;
}

const server = new McpServer({ name: "gpt-image", version: "1.0.0" });

server.registerTool(
  "generate_image",
  {
    title: "Gerar imagem (gpt-image-2)",
    description:
      "Gera uma ou mais imagens a partir de um prompt de texto usando o modelo gpt-image-2 da OpenAI " +
      "(o mais novo, com reasoning). Salva os arquivos no disco e retorna os caminhos. " +
      "Bom para mockups de produto, visuais de marketing, arte conceitual, imagens com texto legível.",
    inputSchema: {
      prompt: z.string().min(1).describe("Descrição da imagem desejada. Quanto mais específico, melhor."),
      size: z
        .enum(["1024x1024", "1536x1024", "1024x1536", "auto"])
        .default("1024x1024")
        .describe("Dimensões: 1024x1024 (quadrado), 1536x1024 (paisagem), 1024x1536 (retrato) ou auto."),
      quality: z
        .enum(["low", "medium", "high", "auto"])
        .default("medium")
        .describe(
          "Qualidade/custo: low (~$0.006), medium (~$0.024, PADRÃO), high (~$0.21) ou auto. " +
            "medium já é ótimo pra post/mockup/thumbnail; só peça high quando precisar de qualidade máxima."
        ),
      n: z.number().int().min(1).max(10).default(1).describe("Quantidade de imagens (1 a 10)."),
      output_format: z
        .enum(["png", "jpeg", "webp"])
        .default("png")
        .describe("Formato do arquivo salvo."),
      background: z
        .enum(["transparent", "opaque", "auto"])
        .default("auto")
        .describe("Fundo transparente (só png/webp), opaco, ou auto."),
      output_dir: z
        .string()
        .optional()
        .describe(`Pasta onde salvar. Padrão: ${DEFAULT_OUTPUT_DIR}`),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async ({ prompt, size, quality, n, output_format, background, output_dir }) => {
    try {
      const resp = await client.images.generate({
        model: MODEL,
        prompt,
        n,
        size,
        quality,
        output_format,
        background,
      });
      const dir = output_dir || DEFAULT_OUTPUT_DIR;
      const saved = saveImages(resp.data || [], dir, output_format);
      if (saved.length === 0) {
        return { isError: true, content: [{ type: "text", text: "A API não retornou imagens." }] };
      }
      return {
        content: [
          {
            type: "text",
            text:
              `Gerei ${saved.length} imagem(ns) com ${MODEL} (${size}, ${quality}).\n` +
              `Salvas em:\n${saved.map((p) => "  - " + p).join("\n")}`,
          },
        ],
        structuredContent: { model: MODEL, size, quality, files: saved },
      };
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: errText(err) }] };
    }
  }
);

server.registerTool(
  "edit_image",
  {
    title: "Editar imagem (gpt-image-2)",
    description:
      "Edita/transforma imagens existentes a partir de um prompt usando gpt-image-2. " +
      "Aceita um ou mais arquivos locais de referência e uma máscara opcional para inpainting. " +
      "Salva o resultado no disco e retorna os caminhos.",
    inputSchema: {
      prompt: z.string().min(1).describe("O que mudar/criar a partir das imagens de referência."),
      images: z
        .array(z.string())
        .min(1)
        .describe("Caminhos de arquivos locais das imagens de referência (png/jpeg/webp)."),
      mask: z
        .string()
        .optional()
        .describe("Caminho de arquivo de máscara (png) para inpainting. Áreas transparentes são editadas."),
      size: z.enum(["1024x1024", "1536x1024", "1024x1536", "auto"]).default("auto"),
      quality: z.enum(["low", "medium", "high", "auto"]).default("medium"),
      output_format: z.enum(["png", "jpeg", "webp"]).default("png"),
      output_dir: z.string().optional().describe(`Pasta onde salvar. Padrão: ${DEFAULT_OUTPUT_DIR}`),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async ({ prompt, images, mask, size, quality, output_format, output_dir }) => {
    try {
      for (const p of images) {
        if (!fs.existsSync(p)) {
          return { isError: true, content: [{ type: "text", text: `Arquivo não encontrado: ${p}` }] };
        }
      }
      if (mask && !fs.existsSync(mask)) {
        return { isError: true, content: [{ type: "text", text: `Máscara não encontrada: ${mask}` }] };
      }
      const mimeFor = (p) => {
        const e = p.toLowerCase();
        if (e.endsWith(".webp")) return "image/webp";
        if (e.endsWith(".jpg") || e.endsWith(".jpeg")) return "image/jpeg";
        return "image/png";
      };
      // toFile garante filename + mimetype corretos (createReadStream sozinho vira octet-stream).
      const imageFiles = await Promise.all(
        images.map((p, i) =>
          toFile(fs.createReadStream(p), `image-${i}${path.extname(p) || ".png"}`, {
            type: mimeFor(p),
          })
        )
      );
      const req = { model: MODEL, prompt, size, quality, image: imageFiles };
      if (mask) {
        req.mask = await toFile(fs.createReadStream(mask), "mask.png", { type: "image/png" });
      }
      const resp = await client.images.edit(req);
      const dir = output_dir || DEFAULT_OUTPUT_DIR;
      const saved = saveImages(resp.data || [], dir, output_format);
      if (saved.length === 0) {
        return { isError: true, content: [{ type: "text", text: "A API não retornou imagens." }] };
      }
      return {
        content: [
          {
            type: "text",
            text: `Editei e salvei ${saved.length} imagem(ns):\n${saved.map((p) => "  - " + p).join("\n")}`,
          },
        ],
        structuredContent: { model: MODEL, files: saved },
      };
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: errText(err) }] };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[gpt-image-mcp] servidor no ar (modelo: " + MODEL + ").");
