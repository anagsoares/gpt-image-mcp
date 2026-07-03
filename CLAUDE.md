# gpt-image-mcp

> **Instrução pro Claude:** quem está usando este repositório pode não ser dev. Se a pessoa pedir ajuda pra instalar ou usar, conduza pela mão, um passo de cada vez, executando os comandos por ela sempre que possível e explicando em linguagem simples. As armadilhas abaixo existem porque já aconteceram — leve todas a sério.

MCP server **local** que gera e edita imagens com o modelo **`gpt-image-2`** da OpenAI, chamando a API **direto** (sem intermediário). Arquivo único: `server.js`.

## Stack
- Node (ESM, `type: module`), node v20+
- `@modelcontextprotocol/sdk` (transporte stdio) + `openai` SDK + `zod`

## Tools expostas
- `generate_image` — texto → imagem. Params: prompt, size (1024x1024 | 1536x1024 | 1024x1536 | auto), quality (low | medium | high | auto), n (1-10), output_format (png|jpeg|webp), background, output_dir.
- `edit_image` — edição/inpainting a partir de arquivos locais + máscara opcional.

## Chave / segredo
- A `OPENAI_API_KEY` **NÃO** deve ficar em arquivo. No macOS, guarde no **Keychain**, serviço `openai-gpt-image`.
- O server lê assim: env `OPENAI_API_KEY` tem prioridade; senão `security find-generic-password -s openai-gpt-image -w`.
- Gravar/regravar a chave no Keychain: `security add-generic-password -a "$USER" -s openai-gpt-image -w -U` (vai pedir o valor).
- Fora do Mac: passe `OPENAI_API_KEY` no bloco `env` do registro do MCP.

## ⚠️ Armadilha nº 1 — onde registrar o MCP
A extensão do Claude Code pro VSCode lê MCPs do **`~/.claude.json`** (chave `mcpServers`), **NÃO** do `~/.claude/settings.json`. Registrar no settings.json não funciona (o servidor simplesmente nunca conecta, sem mensagem de erro). Local correto = `~/.claude.json` → `mcpServers.gpt-image`:

```json
{ "command": "node", "args": ["/caminho/ate/gpt-image-mcp/server.js"],
  "env": { "GPT_IMAGE_OUTPUT_DIR": "/pasta/onde/salvar" } }
```

Sem segredos no JSON (chave no Keychain). Só carrega após **reiniciar** o Claude Code. Conferir se subiu: as tools `mcp__gpt-image__*` precisam aparecer.

## Saída
- Imagens salvam em `GPT_IMAGE_OUTPUT_DIR`. Sem o env, caem em `~/Documents/gpt-image`.
- Nome dos arquivos: `gptimg-<timestamp>-<n>.<ext>`.

## Comandos
- Rodar manual: `npm start` (precisa da chave no Keychain ou env).
- Testar handshake: enviar JSON-RPC `initialize` + `tools/list` via stdio.
- `edit_img.mjs` — script CLI avulso de exemplo pra editar uma imagem sem passar pelo MCP: `PROMPT="..." OPENAI_API_KEY=... node edit_img.mjs entrada.png saida.png [size]`.

## Custo / armadilha nº 2 — billing
- Cobrança direto na conta OpenAI de quem usa. Preços aprox/imagem: low $0.006, medium $0.024, high $0.21.
- **Default de qualidade é `medium` de propósito** — `high` custa ~9x mais e raramente é necessário. Não suba pra high sem a pessoa pedir.
- Se a API retornar `HTTP 400: Billing hard limit has been reached`, o código está ok — é limite/créditos da conta OpenAI. Resolver em platform.openai.com → Billing.

## Detalhe de implementação que já mordeu
- No `edit_image`, usar `toFile()` do SDK da OpenAI com filename + mimetype explícitos. Passar `createReadStream` sozinho faz o upload virar `application/octet-stream` e a API rejeita.
