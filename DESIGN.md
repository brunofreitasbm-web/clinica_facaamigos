---
name: FaçaAmigos — Gestão Clínica
description: Gráfico de crescimento pediátrico como sistema operacional para uma clínica de TEA/TDAH
colors:
  paper: "#faf8f3"
  paper-line: "#e4dfd2"
  paper-line-strong: "#cfc8b4"
  ink: "#1c2530"
  ink-soft: "#57606b"
  ink-faint: "#5f656f"
  chart: "#0f5c7d"
  chart-strong: "#0a4a5f"
  chart-soft: "#d9e8ee"
  status-positive: "#1b8a6b"
  status-positive-soft: "#dcefe8"
  status-positive-text: "#0e5c44"
  status-pending: "#c97c1f"
  status-pending-soft: "#f6e8d5"
  status-pending-text: "#8a530e"
  status-active: "#0f5c7d"
  status-active-soft: "#d9e8ee"
  status-active-text: "#0a4a5f"
  status-negative: "#c4432b"
  status-negative-soft: "#f5ded8"
  status-negative-text: "#93301c"
  status-neutral: "#8a8f98"
  status-neutral-soft: "#e7e6e2"
  status-neutral-text: "#4b4f56"
  milestone: "#c9971f"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  measured:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "1.875rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
rounded:
  card: "6px"
spacing:
  card-padding: "20px 20px"
  grid-gap: "24px"
components:
  measurement-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-padding}"
---

# Design System: FaçaAmigos — Gestão Clínica

<!-- SEED-TO-SCAN: mundo escolhido via new-work (impeccable, seed 2b7f8b5e,
assignedIndex 6, roll degradado sem rede) e implementado no scaffold Next.js
(app/globals.css, app/layout.tsx, components/). Passou por revisão final em
2 rodadas: 8 material_fixes na primeira, 5 resolved + 3 partial na segunda
(bug de escala de SVG corrigido; a fita de tendência repetida e a banda de
referência sem dado seguem como débito conhecido — ver Do's and Don'ts). -->

## Overview

**Creative North Star: "O Gráfico de Crescimento Pediátrico"**

O sistema lê como uma caderneta de crescimento pendurada aos pés da mesa de exame, não como um app de bem-estar. Cada tela é uma página de medição: papel milimetrado quente ao fundo, tinta azul de caderneta clínica como único acento, números medidos em mono tabular, bandeirinha dourada quando uma meta é atingida de verdade. Nada de gradiente decorativo, nada de sombra dura fora do fio de 1px que separa um cartão do papel. Rejeitado explicitamente: o dashboard SaaS genérico de bem-estar (cards roxo/rosa, ícones fofos, sidebar arredondada) que é o padrão do setor, e o extremo oposto, o EHR hospitalar cinza e frio.

**Key Characteristics:**
- Fundo de papel quente com grade milimetrada de duas ordens (linha fina a cada 24px, linha de escala a cada 96px) — nunca decoração, é a superfície de medição do mundo.
- Um único acento saturado (azul de caderneta), usado com parcimônia — pontos de status, números-chave, rótulo de eixo.
- Números medidos sempre em mono tabular; unidades e legendas continuam em sans.
- Honestidade de dado: um valor que ainda não é medição real nunca se veste de veredito (nunca "0 → atenção" em vermelho).

## Colors

Paleta restrita: neutros quentes de papel/tinta + um único acento azul + cinco cores de status com par claro (fundo) / escuro (texto, AA).

### Primary
- **Azul de Caderneta Clínica** (`#0f5c7d`): rótulo de eixo, pontos de status "ativo", número-chave em destaque, hover de navegação. Nunca mais que um elemento saturado por tela.

### Neutral
- **Papel** (`#faf8f3`): fundo de página. Nunca branco puro — é a cor de papel de caderneta real.
- **Linha do Papel** (`#e4dfd2`) / **Linha de Escala** (`#cfc8b4`): as duas ordens da grade milimetrada de fundo, também usada como borda de cartão (linha de escala).
- **Tinta** (`#1c2530`): texto primário. **Tinta Suave** (`#57606b`): descrições. **Tinta Fraca** (`#5f656f`, ≥4.5:1 sobre o papel): unidades, texto auxiliar.

### Named Rules
**A Regra do Zero Honesto.** Um valor placeholder nunca herda uma cor de status que implique medição real. `MeasurementCard` tem `placeholder=true` por padrão nesta fase: força tratamento neutro ("aguardando dado real"), ignora `status` e suprime a bandeirinha de marco. Só a query real do Supabase no root usa `placeholder={false}`.

## Typography

**Display/Body Font:** Inter (system-ui como fallback)
**Measured Font:** IBM Plex Mono — reservada estritamente ao número medido (`.tabular-figure`), nunca à unidade ou legenda ao lado dele.

**Character:** Inter é o cavalo de batalha de UI Operate — legível a 1m de distância na recepção (PRD §9.11). O Plex Mono entra só onde há uma medição de verdade, reforçando "isto é um número contado", nunca decorando prosa.

### Hierarchy
- **Título de página** (600, 1.875rem–2.25rem responsivo, 1.2): um por rota.
- **Rótulo de eixo** (500, 0.75rem, tracking 0.14em, uppercase, mono): acompanha uma régua SVG com tique — nunca aparece sozinho como eyebrow decorativo.
- **Corpo** (400, 0.875rem, 1.5): descrições, legendas.
- **Medição** (600, 1.875rem, mono tabular): o valor numérico central de cada `MeasurementCard`.

## Layout

Grid CSS responsivo (`grid-cols-1` no mobile, 3–4 colunas no desktop), com `content-start items-start` explícito — decisão corrigida durante o build: sem esses dois, o grid herda `align-items: stretch` e os cartões esticam pra preencher toda a altura restante da viewport (achado real, não teórico). Espaçamento de 24px entre cartões. Padding de página 24px (mobile) / 40px (desktop, `sm:p-10`).

## Elevation & Depth

Sem sombra. Profundidade vem só do fio de 1px (`shadow-[0_1px_0_0_var(--color-paper-line-strong)]`) na borda inferior do cartão — como o traço de régua de uma tabela impressa, não elevação de material design.

### Named Rules
**A Regra do Fio, Não Sombra.** Nenhum componente usa `box-shadow` com blur. Separação de camada é sempre um fio de 1px na cor de linha do papel.

## Shapes

Cantos levemente arredondados (`rounded-md`, 6px) em cartões — o suficiente pra não parecer recorte de papel serrilhado, pouco o bastante pra não puxar pro mundo de app de consumo. Sem clipping decorativo, sem ícone de glifo solto — os únicos SVGs desenhados a mão são a régua de eixo e a bandeirinha de marco, ambos dispositivos nativos do mundo.

## Components

### Measurement Card (`components/measurement-card.tsx`)
- **Forma:** `rounded-md`, borda 1px `paper-line-strong`, fundo `paper/60` (deixa a grade de fundo passar através).
- **Anatomia:** ponto de status (8px) + rótulo uppercase → número em mono tabular + unidade em sans → pílula de status (texto sempre na variante `-text`, AA contra o fundo `-soft`) → bandeirinha de marco opcional (canto superior direito, só quando `placeholder=false`).
- **Regra de honestidade:** `placeholder=true` por padrão; força neutro e "aguardando dado real", ignora status/milestone.

### Page Header (`components/page-header.tsx`)
- Rótulo de eixo (mono, uppercase) + régua SVG com 7 tiques (`vector-effect="non-scaling-stroke"` — sem isso os traços de 1px distorcem quando o SVG estica de forma não-uniforma, achado real do build) + título + descrição.

### Trend Strip (`components/trend-strip.tsx`)
- Painel com legenda, banda de referência (`chart-soft`) e polyline de tendência (mono, tracejada quando não há histórico). **Débito conhecido:** hoje é idêntica nas 6 rotas de papel (só a legenda muda) e a banda de referência lê como medição real mesmo dizendo "sem histórico" na legenda abaixo — ver Do's and Don'ts.

## Do's and Don'ts

### Do:
- **Do** usar `vector-effect="non-scaling-stroke"` em qualquer linha/polyline dentro de um SVG com `preserveAspectRatio="none"` — é a única forma de manter traço de 1px fino quando o viewBox estica sem manter proporção.
- **Do** usar `placeholder=true` (padrão) em `MeasurementCard` sempre que o valor não vier de uma query real — a Regra do Zero Honesto é o ponto mais citado pela revisão final deste build.
- **Do** manter a grade de fundo em duas ordens (24px / 96px) — uma ordem só lê como textura decorativa, não como escala de medição real (achado da revisão final).
- **Do** restringir `.tabular-figure` só ao `<span>` do número, nunca ao parágrafo inteiro com a unidade junto.

### Don't:
- **Don't** dar à `TrendStrip` uma banda de referência sólida sem rótulo/escala — a revisão final apontou que isso reintroduz, uma camada acima, exatamente o problema que a Regra do Zero Honesto resolveu nos cartões (forma sem medição lendo como dado real). Corrigir antes de replicar o componente em telas com dado de verdade.
- **Don't** deixar `TrendStrip` idêntica entre rotas quando houver dado real disponível — hoje as 6 instâncias só diferem na legenda; isso é aceitável só enquanto não há série temporal real por trás.
- **Don't** usar `axisLabel`/kicker sem a régua SVG que o acompanha — sozinho ele é exatamente o eyebrow genérico que o piso do impeccable proíbe.
- **Don't** aplicar `flex-1` diretamente num container `grid` sem também setar `items-start`/`content-start` — o grid herda `align-items: stretch` e os cartões filhos esticam pra ocupar toda a altura disponível (bug real encontrado e corrigido durante este build).
