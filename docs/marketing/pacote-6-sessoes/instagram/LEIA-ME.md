# Kit de Instagram do plano Ritmo: LEIA-ME

Fonte HTML/CSS das peças, script de render (Playwright) e textos de apoio. **O nome do plano e todos os textos moram em `src/config.json`.**

## Trocar o nome do plano e re-renderizar

1. Edite `src/config.json`: `"plano": { "nome": "Ritmo" }` (um único lugar; `{nome}` e `{plano}` nos textos viram o nome e "plano <nome>").
2. A partir da pasta `instagram/`:
   ```
   node src/render.mjs
   ```
   Requer Node 18+ e Playwright com Chromium (`npm i playwright && npx playwright install chromium`). O script também procura em `/opt/node-tools/node_modules/playwright`.
3. Saída: 25 PNGs em `out/` (tamanho exato, deviceScaleFactor 1), `out/alt-texts.json`, `contact-sheet.png` e `legendas.md` regenerados.

Quando o nome troca, legendas e alt texts acompanham. Os arquivos `roteiros-reels.md`, `calendario-14-dias.md` e `briefing-social-media.md` citam "Ritmo" à mão: troque por busca e substituição.

**Trava de conformidade:** `render.mjs` recusa renderizar (e `legendas.mjs` recusa gerar) se o texto tiver preço, "R$", desconto, promoção, oferta, "pacote", garantia, promessa, cura, "melhor", forma de pagamento, "vagas limitadas", depoimento, "antes e depois" e as palavras barradas da marca (lista em `src/render-lint.mjs`). Também confere que Fredoka e Nunito carregaram antes de cada captura e avisa se algum texto estourar a caixa.

**Handle:** `"handle": "@[PREENCHER]"`. Enquanto tiver `[PREENCHER]`, o handle não é impresso nas artes. Ao preencher (ex.: `"@seuperfil"`), ele aparece no último slide de cada carrossel.

## Estrutura

```
instagram/
  LEIA-ME.md  legendas.md  roteiros-reels.md  calendario-14-dias.md  briefing-social-media.md
  contact-sheet.png          visão geral de todas as peças
  out/                       PNGs finais + alt-texts.json
  src/
    config.json              nome do plano, handle, TODOS os textos
    pecas.mjs                templates HTML (carrosséis, post, stories, reels, destaque)
    styles.css               estilos (tokens da marca)
    render.mjs  render-lint.mjs  legendas.mjs
    assets/fonts/            Fredoka e Nunito (cópia local, vindas do site)
    assets/logos/            SVGs oficiais copiados de brand/svg (não redesenhados)
    _build/                  HTML intermediário (criado no render, pode apagar)
```

## Peças (25 PNGs)

Carrossel A (8) e B (7), 1080x1350; post de apresentação 1080x1350; 5 stories 1080x1920 (topo e base 250 px livres; story 3 com espaço central para a caixa de perguntas, story 4 com pílula clara para o adesivo de link); 3 capas de reel 1080x1920 (conteúdo no centro 4:5, y 285 a 1635); 1 capa de destaque 1080x1920 (conteúdo dentro de um círculo central de 800 px).

## Pendências antes de publicar

- **INPI:** consulta de marca do nome "Ritmo" não feita (estratégia, seção 4); checar também plano ou clínica homônima em Belém.
- **Revisão dos conselhos:** CFFa, CFP e COFFITO não responderam. Vale a regra mais dura (sem preço, sem foco em vantagem financeira, sem "pacote"). O texto do COFFITO não foi lido. Enviar o checklist e guardar a resposta por escrito.
- **Handle do Instagram:** `[PREENCHER]`.
- **Domínio e slug da landing** (`/lp/ritmo`) e UTMs: confirmar quando a página existir.
- **Profissionais nos reels:** nome, inscrição e autorização de imagem (reels 1 e 3).
- **Confirmar na operação** frases usadas: "dias e horários conversados com a família", "Portal da Família reúne sessões e contato com a equipe", "especialidades combináveis". Não foi usado "horário fixo" nem "agenda única" por ainda estarem sem confirmação.
- **Pagamento:** nenhuma peça fala de forma de pagamento (gateway inexistente). Não incluir até haver integração e decisão sobre Pix e boleto.
- Revisão final por profissional com inscrição antes de cada publicação.
- Fontes: foram copiadas do site (`landing_page_faca_amigos/public/assets/fonts`), variáveis, mesmas do site em produção.
