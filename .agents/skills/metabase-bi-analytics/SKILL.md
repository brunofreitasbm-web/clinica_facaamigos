---
name: metabase-bi-analytics
description: "Use when creating or modifying SQL views, materialized views, analytical queries, or BI dashboards for Metabase in the Clinica Faca Amigos project."
---

# Metabase BI & Dashboards SQL

## Diretrizes Obrigatórias de BI do Projeto (AGENTS.md)

1. **Dashboards Exclusivamente via METABASE:**
   - A criação, exibição e gestão de Dashboards de BI e relatórios analíticos gerenciais DEVEM SER realizadas via **METABASE** (self-hosted apontando para as Views/Materialized Views read-only do Postgres/Supabase).
   - O sistema web principal (Next.js) foca nos fluxos operacionais diários, enquanto as visões analíticas gerenciais ficam centralizadas no Metabase.

2. **KPIs com Comparativo Obrigatório:**
   - Todo e qualquer KPI/indicador de Business Intelligence (BI) DEVE SEMPRE possuir algum tipo de comparativo ou métrica de referência (ex.: *vs. Mês Anterior*, *vs. Período Anterior*, *vs. Meta/Target*, *% de Atingimento do Orçamento*, *Variação YoY*).
   - Métricas isoladas sem contexto comparativo (ex.: "Faltas: 45") **não são aceitas**. Devem vir acompanhadas da variação ou meta (ex.: "Faltas: 45 | -12% vs. Mês Anterior | Meta < 30").

## Padrões de Views SQL para Metabase

Ao criar views em `supabase/migrations/`:
- Prefira views read-only ou materialized views para agregação de dados.
- Inclua colunas calculadas de variação percentual:
  `((current_val - previous_val) / NULLIF(previous_val, 0)) * 100 AS variance_pct`
- Utilize `security_invoker = true` em views Postgres 15+.
