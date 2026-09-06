---
name: FaçaAmigos — Gestão Clínica
description: Identidade oficial da marca FaçaAmigos (Playground Inclusivo) aplicada ao sistema interno de gestão da clínica
colors:
  bg: "#f7f5f2"
  surface: "#ffffff"
  text: "#1a3f35"
  pink: "#f0196b"
  pink-hover: "#c8155a"
  pink-active: "#a01248"
  teal: "#2ecfb5"
  amber: "#c99020"
  yellow: "#ffe234"
  status-positive: "#28c880"
  status-positive-soft: "#e2f9ee"
  status-positive-text: "#0e6b3f"
  status-pending: "#c99020"
  status-pending-soft: "#faf1de"
  status-pending-text: "#7c5a0b"
  status-active: "#f0196b"
  status-active-soft: "#fde6ef"
  status-active-text: "#a01248"
  status-negative: "#e83030"
  status-negative-soft: "#fce4e4"
  status-negative-text: "#8a1f1f"
  status-neutral: "#5a636e"
  status-neutral-soft: "#e8eaec"
  status-neutral-text: "#262c32"
typography:
  display:
    fontFamily: "Fredoka, Nunito, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1.15
  body:
    fontFamily: "Nunito, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  numbers:
    fontFamily: "Nunito, Segoe UI, sans-serif"
    fontVariantNumeric: "tabular-nums"
    fontWeight: 800
rounded:
  button: "9999px"
  card: "24px"
  input: "14px"
spacing:
  card-padding: "20px"
  grid-gap: "24px"
components:
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-padding}"
    shadow: "var(--shadow-sm)"
---

# Design System: FaçaAmigos — Gestão Clínica

<!-- REBRAND: em 2026-09-05, a pedido explícito do dono do produto, o sistema
saiu do mundo "Broadsheet/Gráfico de Crescimento Pediátrico" (navy #14284b +
dourado #b8933a, papel neutro, sem sombra, fio de 1px) para a identidade
oficial da marca FaçaAmigos (Playground Inclusivo), fonte:
`fa-aamigos-design-system` (pasta de branding do projeto-irmão). O pedido foi
"aplicar em absolutamente tudo": recepção, agenda, prontuário, faturamento,
financeiro, portal da família — não só telas de marketing/consumo. Isso
substitui integralmente as decisões abaixo; ver git history para o racional
antigo. -->

## Overview

**Creative North Star: "FaçaAmigos, o playground inclusivo, por trás do balcão"**

O sistema é a mesma marca que a família já reconhece no playground — rosa
vibrante, cantos sempre arredondados, tipografia bem-humorada — só que
operando em modo denso: telas de recepção, faturamento e prontuário
carregam muito texto e número o dia inteiro, então usam fundo claro e
cartões brancos com sombra (não o app escuro do playground), exatamente
como a própria marca já resolve isso no kiosk do operador. O portal da
família (`app/familia`) é onde a marca aparece mais "solta": cabeçalho
escuro, títulos grandes em Fredoka, tom de voz direto na segunda pessoa.

**Key Characteristics:**
- Rosa `#F0196B` como accent primário (ação, link, foco, chrome ativo) — o
  único lugar que herdou o papel do antigo azul de caderneta.
- Teal `#2ECFB5` como secundário (status "realizada"/concluído) e âmbar
  `#C99020` como accent raro (marco, destaque de card, kicker de seção) —
  o âmbar é o mesmo tom dourado da marca-mãe, então herdou literalmente o
  papel do antigo dourado (`--color-gold`/`--color-milestone` continuam
  sendo o alias do âmbar).
- Fredoka nos títulos grandes (`h1`, `--font-display`); Nunito em todo o
  resto da UI (botão, rótulo, corpo, número) — números ainda usam
  `tabular-nums` (`.tabular-figure`), mas na fonte da marca, não mais em
  mono dedicado.
- Cantos sempre arredondados: botão/tag/badge são pílula (`--radius-full`),
  cartão/diálogo usam 24px (`--radius-lg`). Nenhum canto reto no sistema.
- Cartão sempre tem sombra (`--shadow-sm` em repouso, `--shadow-md`/
  `--shadow-pink`/`--shadow-teal` em hover) — nunca só um fio de 1px.

## Colors

Rosa como único accent saturado de interação; âmbar como accent raro de
destaque; cinco cores de status com par claro (fundo) / escuro (texto, AA).

### Primary
- **Rosa FaçaAmigos** (`#F0196B`): botão primário, link, foco, borda ativa
  de navegação, status "em atendimento". Hover `#C8155A`, active `#A01248`.

### Secondary / rare accent
- **Teal** (`#2ECFB5`): status "realizada" (sessão concluída), botão
  variante secundária alternativa.
- **Âmbar** (`#C99020`): status "agendada" (a confirmar), bandeirinha de
  marco/meta atingida, kicker de card — herdeiro direto do antigo dourado.

### Neutral
- **Fundo** (`#F7F5F2`): fundo de página, quente mas claro (nunca o app
  escuro `#141414` do playground — ver nota de kiosk abaixo).
- **Superfície** (`#FFFFFF`): fundo de cartão/diálogo/input.
- **Tinta** (`#1A3F35`, o "verde-escuro Faça" da marca): texto primário.

### Status (sessão/faturamento — iguais em todas as telas)
- **Confirmada** → verde de sucesso `#28C880`
- **Agendada / a confirmar** → âmbar `#C99020`
- **Em atendimento** → rosa `#F0196B`
- **Realizada** → teal `#2ECFB5`
- **Falta** → vermelho `#E83030`
- **Cancelada** → cinza neutro `#5A636E`

### Named Rules
**Por que o sistema não é escuro.** A marca FaçaAmigos define
explicitamente que o app de consumo é escuro, mas que o **kiosk do
operador é claro de propósito** — porque é a tela mais densa de texto que
a equipe lê o dia inteiro. Recepção, faturamento e prontuário são
exatamente esse caso, então seguem claro; só o hero do portal da família
usa o fundo escuro `--color-dark` como bloco decorativo pontual.

## Typography

**Display:** Fredoka (weights 500–700) — usada só em `h1` (título de
página) e nos poucos lugares que precisam do impacto "app de playground"
(ex. nome da marca no header do portal da família).
**Body/UI:** Nunito (400–900) — todo o resto: `h2`–`h6`, botão, input,
tag, badge, nav, tabela, número tabular.

**Font substitution:** Fredoka é o `Fredoka` variável do Google Fonts
(a fonte de peso único "Fredoka One" não está disponível via `next/font`
nesta versão do Next.js); usamos peso 600 para aproximar o visual "bubbly"
de peso único da marca.

### Hierarchy
- **Título de página** (`h1`, Fredoka 600, 40px): um por rota.
- **Subtítulo/section** (`h2`–`h4`, Nunito 800): título de card, diálogo.
- **Kicker/tagline** (`h6`, Nunito 800, uppercase, tracking 0.14em, cor
  âmbar): segue a regra "tagline" da marca (ver `PLAYGROUND INCLUSIVO` no
  logo) — nunca aparece como eyebrow decorativo sem contexto.
- **Corpo** (Nunito 400, 15px, 1.55): texto padrão de UI.
- **Número medido** (`.tabular-figure`, Nunito 800, tabular-nums): contagem,
  percentual, valor monetário.

## Layout

Sem mudança estrutural: grid CSS responsivo (`grid-cols-1` no mobile,
3–4 colunas no desktop), `content-start items-start` explícito. Espaçamento
de 24px entre cartões, padding de página 24px (mobile) / 40px (desktop).

## Elevation & Depth

Ao contrário do sistema anterior ("Regra do Fio, Não Sombra"), a marca
FaçaAmigos usa sombra de verdade: `.card` tem `--shadow-sm` em repouso e
`--shadow-md` (ou `--shadow-pink`/`--shadow-teal` em botões/CTAs) em
hover. A escala padrão do Tailwind (`shadow-sm`/`shadow-md`/`shadow-lg`/
`shadow-xl`) foi reapontada no `@theme inline` de `app/globals.css` para
esses mesmos tokens, então qualquer rota que já usava `shadow-md` cru
herdou a sombra da marca sem precisar editar a rota.

## Shapes

Cantos sempre arredondados, sem exceção — a mesma reapontada de tema
eleva a escala padrão do Tailwind: `rounded-md` agora é 14px, `rounded-lg`
24px, e a classe `.btn`/`.tag`/`.tag-status`/`.btn-icon` força pílula
(`--radius-full`) explicitamente. Nenhum componente novo deve usar
`rounded-none` ou depender de canto reto.

## Components

Toda a superfície de componente reaproveitável (`.btn`, `.card`, `.input`,
`.tag`, `.tag-status`, `.table`, `.dialog`, `.nav`, `.seg`, `.radio`) mora em
`app/globals.css` e foi retematizada lá — ver os comentários no topo do
arquivo. Os nomes de classe e de variável CSS **não mudaram** (só os
valores), então nenhum componente React precisou ser reescrito para herdar
a marca nova; só telas que tinham cor crua hardcoded (hex direto em vez de
token) precisaram de edição pontual — ver histórico de commit do rebrand.

### Botão (`.btn-primary`/`.btn-secondary`/`.btn-gold`/`.btn-ghost`)
Pílula, sem borda (exceto `.btn-secondary`, que é contorno rosa 2px, igual
ao componente `Button` oficial da marca), com leve `scale()` de
press/hover (`--transition-bounce`) e brilho colorido (`--shadow-pink`) no
hover do botão primário.

### Cartão / Diálogo
Fundo branco, `border-radius: 24px`, sombra sempre, nunca borda sozinha.

### Status pill (`.tag-status` + `.st-*`)
Pílula com ponto colorido + texto no par `-text` (AA garantido) — ver
mapeamento de cor de status acima.

## Do's and Don'ts

### Do:
- **Do** usar sempre uma classe/token existente (`bg-paper`, `text-ink`,
  `bg-status-positive-soft`, `var(--color-accent-2)`, ...) em vez de um
  hex cru — é o que mantém o app inteiro reskinável a partir de
  `app/globals.css`.
- **Do** reservar Fredoka (`--font-display`) só para `h1`/títulos de
  impacto — usá-la em rótulo pequeno (11–13px) fica ilegível.
- **Do** manter recepção/faturamento/prontuário claros (fundo `--color-bg`
  claro) — é a decisão de kiosk documentada pela própria marca, não um
  esquecimento.

### Don't:
- **Don't** reintroduzir o fundo escuro `#141414` do app de consumo em
  telas operacionais densas — a marca define isso como erro de produto,
  não só de estilo.
- **Don't** hardcodar hex novo em uma rota — se a cor que você precisa não
  existe como token, adicione o token em `app/globals.css` primeiro.
- **Don't** usar `rounded-none`/canto reto em componente novo — a marca é
  explícita: "no sharp corners anywhere".
