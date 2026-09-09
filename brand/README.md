# Kit de marca — FaçaAmigos

Vetorização e decomposição da logo a partir das artes originais em JPEG
(`logo/WhatsApp Image 2026-09-08 at 21.52.05.jpeg` como fonte mestre).
Todos os SVGs são vetores reais (curvas), sem imagem embutida — escalam sem perda.

## Estrutura da marca

| Parte | Descrição | Cores |
|---|---|---|
| **Símbolo** | dois arcos entrelaçados + ponto | amarelo, turquesa, rosa |
| **Wordmark** | "FaçaAmigos" | petróleo ("Faça") + rosa ("Amigos") |
| **Assinatura** | "Centro de Terapia Comportamental" | petróleo |

## Arquivos

### `svg/` — vetores editáveis (a fonte de verdade)
Cada arquivo tem grupos nomeados (`#simbolo`, `#wordmark`, `#assinatura`) e
paths com id (`#arco-amarelo`, `#arco-turquesa`, `#ponto`, `#faca`, `#amigos`).

| Arquivo | Proporção | Quando usar |
|---|---|---|
| `facaamigos-horizontal.svg` | 5,8:1 | padrão para cabeçalhos, sites, papelaria |
| `facaamigos-horizontal-sem-assinatura.svg` | 7:1 | espaços muito largos e baixos |
| `facaamigos-vertical.svg` | 1,7:1 | fachada, uniformes, posts quadrados |
| `facaamigos-vertical-sem-assinatura.svg` | 1,9:1 | quando a assinatura ficaria ilegível |
| `facaamigos-simbolo.svg` | 1,7:1 | avatar, ícone, marca d'água, padronagem |
| `facaamigos-wordmark.svg` | 5,7:1 | quando o símbolo já aparece ao lado |
| `facaamigos-assinatura.svg` | 17:1 | uso isolado da linha descritiva |

Cada um também existe em três versões monocromáticas, para aplicações onde não
há reprodução em cores (carimbo, gravação, bordado, fundo colorido, fax/xerox):
`-mono-petroleo.svg`, `-mono-branco.svg`, `-mono-preto.svg`.

### `png/` — rasterizados com fundo transparente
512, 1024 e 2048 px de largura para cada variante, mais uma versão branca
(`-mono-branco-1024.png`) para aplicar sobre fotos e fundos escuros.

### `favicon/` — ícones de app e navegador
`favicon.svg` (símbolo com respiro de 10%), `favicon.ico` (16/32/48),
`icon-16..512.png`, `apple-touch-icon-180.png` (símbolo sobre petróleo),
`maskable-512.png` + `maskable.svg` (área segura de 34% para PWA/Android).

### Tokens
`cores.json`, `tokens.css` (custom properties `--fa-*`), `tokens.scss`.

## Paleta

| Cor | Hex | Papel |
|---|---|---|
| Amarelo | `#FDC51D` | arco esquerdo, destaque |
| Turquesa | `#07C5C8` | arco direito, apoio |
| Rosa | `#FB3D6A` | ponto, "Amigos", CTA |
| Petróleo | `#065264` | "Faça", assinatura, texto |

**Contraste:** só o petróleo sobre branco passa em WCAG AA para texto (8,75:1).
Amarelo (1,59:1), turquesa (2,14:1) e rosa (3,51:1) sobre branco são cores de
preenchimento — não use para texto corrido. Rosa como fundo de botão com texto
branco funciona (3,51:1) apenas em texto grande/bold; para AA em texto normal,
use petróleo.

## Regras de aplicação

**Área de respiro.** Reserve, em toda a volta da logo, uma margem igual ao
diâmetro do ponto rosa (16% da largura do símbolo). Nada entra nessa área.

**Tamanho mínimo.**
- horizontal com assinatura: 160 px / 45 mm de largura (abaixo disso a
  assinatura fecha) — use a versão sem assinatura;
- horizontal sem assinatura: 90 px / 25 mm;
- símbolo isolado: 24 px / 8 mm.

**Não faça:** distorcer a proporção, trocar as cores dos arcos, aplicar sombra
ou contorno, recolorir só uma parte, rotacionar, ou colocar a versão colorida
sobre fundo colorido de baixo contraste (use a `-mono-branco`).

## Nota sobre a origem

Estes vetores foram traçados a partir de JPEGs de 1254 px — são uma
reconstrução fiel, não o arquivo original do designer. As curvas foram
suavizadas e as cores normalizadas para 4 valores exatos. Para impressão em
grande formato ou registro de marca, o ideal continua sendo obter o `.ai`/`.eps`
original com o autor da logo; para todo o resto (web, app, papelaria, redes,
brindes, sinalização), este kit é suficiente.
