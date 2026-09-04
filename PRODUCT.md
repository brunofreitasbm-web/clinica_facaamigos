# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + TypeScript, na raiz do repositório, deploy na Vercel. Tailwind CSS para estilo. Supabase (Postgres + Auth + RLS + Storage) como backend, cliente via `@supabase/ssr` (browser + server). Schema já implementado e aplicado (ver `supabase/migrations/`).

## Users

Seis papéis, cada um com sua própria home, sem menu compartilhado (PRD §3.6 "papel define tela"):

- **Recepção**: cadastra pacientes, agenda sessões, confirma presença, registra falta, anexa documentos de entrada. Trabalha numa tela desktop o dia inteiro, decisão rápida, muita interrupção.
- **Terapeuta (PJ)**: registra evolução clínica e coleta de dados ABA no celular, entre uma sessão e outra — precisa de app leve, mobile-first, tolerante a rede ruim (offline-first pra evolução).
- **Coordenador/Supervisor clínico**: monta grade, aprova plano terapêutico, valida metas, supervisiona a equipe. Desktop, visão de carteira inteira.
- **Faturamento**: fecha competência, exporta lote pro faturista, registra retorno de glosa. Desktop, foco em sessões realizadas e guias.
- **Dono/Gestor**: painel executivo — metas por cargo, bonificação, indicadores financeiros. Desktop + resumo mobile.
- **Responsável (pai/mãe)**: portal do paciente — agenda do filho, frequência, metas em linguagem simples, documentos liberados. Mobile-first, login por telefone/OTP.

## Product Purpose

Sistema próprio de gestão para uma clínica de TEA/TDAH que abre em dezembro/2026. Transforma cada sessão num registro rastreável do primeiro contato até o recebimento, e expõe os quatro vazamentos de receita do setor (falta sem recuperação, sessão sem guia vigente, evolução atrasada, evasão silenciosa) como métricas por cargo — a bonificação de recepção/coordenação/faturamento e a progressão de faixa dos terapeutas saem de dados, não de percepção.

## Positioning

O mercado (ComportaTUDO, Cliniconect, BlueSmiles) cobre bem agenda e prontuário, mas nenhum liga esses dados a métricas de cargo, bloqueia agendamento sem guia vigente de forma dura, ou expõe motivo de falta/cancelamento por origem. É exatamente o que este sistema faz — e é o que sustenta o modelo de bonificação da clínica.

## Operating Context

- Ciclo real de atendimento: lead → avaliação → autorização (guia) → grade de sessões recorrentes → sessão (check-in/check-out) → evolução assinada → faturamento por competência → repasse ao terapeuta.
- ~1.500–2.500 sessões/mês no ano 1 (15+ terapeutas, 100+ crianças) — agenda e prontuário precisam de performance e multiusuário desde o início.
- Dado clínico é dado de saúde de menor (LGPD art. 11, retenção legal de 20 anos) — nunca aparece bruto pro portal da família, nunca vaza entre papéis sem permissão.
- Terapeuta usa o celular no intervalo entre sessões — qualquer fricção na evolução (meta é ≤ 2 min) reduz adesão.
- Multi-tenant desde o schema (`clinic_id` em toda tabela), mas a UI é single-tenant nesta fase — uma clínica só.

## Capabilities and Constraints

- Auth: e-mail/senha pra equipe; OTP por telefone/WhatsApp pra família (não implementado ainda nesta fase de scaffold).
- RLS já aplicada em 100% das tabelas — toda leitura/escrita do cliente passa pela policy real do papel logado, o front não pode assumir permissão que o banco não impõe.
- Protocolos clínicos licenciados (VB-MAPP/ABLLS-R/ESDM) nunca podem aparecer em tela de recepção, faturamento ou família — regra de UI que espelha a RLS.
- Evolução clínica (`session_notes`) é append-only no banco — a UI de terapeuta precisa refletir isso (nova versão, nunca "editar por cima").
- Cores de status precisam ser consistentes entre todas as telas (confirmada/a confirmar/em atendimento/falta/cancelada); tipografia legível a 1m de distância na tela de recepção; agenda do dia carrega em <1s com 200 sessões.
- Acessibilidade mínima: contraste AA, foco visível, operável por teclado na recepção.

## Brand Commitments

Nenhuma marca/identidade visual definida ainda — nome do sistema, logo e paleta ficam em aberto (decisão de new-work).

## Evidence on Hand

Nenhum dado real, screenshot ou asset de marca disponível. Schema Postgres real já existe e deve ser a fonte de verdade para nomes de campo, enums e regras de negócio ao desenhar telas — nunca inventar campo que não existe no schema aplicado.

## Product Principles

1. Papel define tela — cada home é desenhada pro trabalho daquele papel, não é uma view genérica com permissões escondidas.
2. Uma sessão só existe com guia vigente, terapeuta, sala e paciente — a UI bloqueia, não avisa (espelha o guard do banco).
3. Evolução em 2 minutos — campos estruturados primeiro, texto livre por último.
4. Pais veem progresso, não prontuário — portal nunca expõe evolução bruta.
5. Nada de dado clínico sensível trafega pra papel sem RLS que autorize.
