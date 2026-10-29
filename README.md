# 🎨 gpt-image-mcp

Gere e edite imagens **direto de dentro do Claude Code**, usando o **gpt-image-2** — o modelo de imagem mais novo da OpenAI (com reasoning, ótimo pra imagens com texto legível).

Você pede em português normal ("gera um mockup de app de finanças em tons de verde") e a imagem aparece salva numa pasta do seu computador. Sem site, sem copiar e colar, sem intermediário — o servidor chama a API da OpenAI direto.

> **Não é programador? Sem problema.** 💚
> Este projeto foi feito pra ser instalado com a ajuda do próprio Claude Code. Abra o Claude Code, cole a frase abaixo e ele faz tudo pra você:
>
> ```
> Instala pra mim o MCP deste repositório: https://github.com/anagsoares/gpt-image-mcp
> Leia o README e o CLAUDE.md e me conduza passo a passo.
> ```

## O que ele faz

| Ferramenta | O que faz |
|---|---|
| `generate_image` | Cria imagens a partir de um texto (prompt). Escolhe tamanho, qualidade, formato, fundo transparente, até 10 de uma vez. |
| `edit_image` | Transforma imagens que já existem no seu computador — troca texto, muda estilo, combina referências, inpainting com máscara. |

## Quanto custa

A cobrança é feita **na sua conta da OpenAI** (você precisa de uma chave de API com créditos). Preço aproximado por imagem:

| Qualidade | Preço | Quando usar |
|---|---|---|
| `low` | ~US$ 0,006 | rascunhos, testes de ideia |
| `medium` (padrão) | ~US$ 0,024 | posts, mockups, thumbnails — já fica ótimo |
| `high` | ~US$ 0,21 | só quando precisar de qualidade máxima |

## Instalação (passo a passo)

### 1. Baixe o projeto

```bash
git clone https://github.com/anagsoares/gpt-image-mcp.git
cd gpt-image-mcp
npm install
```

### 2. Guarde sua chave da OpenAI

Pegue sua chave em [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

**No Mac (recomendado):** guarde no Keychain, assim ela nunca fica solta em arquivo nenhum:

```bash
security add-generic-password -a "$USER" -s openai-gpt-image -w
```

(vai pedir pra você colar a chave — cole e dê Enter)

**Em outros sistemas:** defina a variável de ambiente `OPENAI_API_KEY` (dá pra passar no bloco `env` do passo 3).

### 3. Registre no Claude Code

Adicione ao arquivo `~/.claude.json`, dentro de `mcpServers`:

```json
{
  "mcpServers": {
    "gpt-image": {
      "command": "node",
      "args": ["/caminho/completo/ate/gpt-image-mcp/server.js"],
      "env": {
        "GPT_IMAGE_OUTPUT_DIR": "/caminho/da/pasta/onde/salvar/as/imagens"
      }
    }
  }
}
```

- Troque `/caminho/completo/ate/` pelo lugar onde você clonou o repositório.
- `GPT_IMAGE_OUTPUT_DIR` é opcional — sem ele, as imagens vão pra `~/Documents/gpt-image`.

### 4. Reinicie o Claude Code

Feche e abra de novo. Pronto: peça uma imagem em linguagem natural e o Claude usa a ferramenta sozinho.

```
Gera uma imagem 1536x1024 de um escritório aconchegante com uma
plaquinha escrita "foco no que importa", qualidade medium.
```

## Perguntas frequentes

**Preciso de conta paga da OpenAI?** Precisa de uma chave de API com créditos (é separado do ChatGPT Plus). Veja em platform.openai.com → Billing.

**Funciona no Windows/Linux?** Funciona — só a parte do Keychain que é exclusiva do Mac; nos outros sistemas use a variável `OPENAI_API_KEY`.

**Onde as imagens ficam?** Na pasta que você definiu em `GPT_IMAGE_OUTPUT_DIR` (ou `~/Documents/gpt-image`). O Claude sempre te mostra o caminho exato de cada arquivo gerado.

**Deu erro, e agora?** As mensagens de erro do servidor já vêm com dica do que fazer (chave inválida, créditos esgotados, sem acesso ao modelo). Se travar, cole o erro no Claude Code e peça ajuda.

---

Feito por [Ana G. Soares](https://instagram.com/ana.gsoares) com Claude Code · Licença [MIT](LICENSE)
