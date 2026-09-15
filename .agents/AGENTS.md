# Diretrizes do Projeto - BI & Dashboards

1. **KPIs com Comparativo Obrigatório:**
   - Todo e qualquer KPI/indicador de Business Intelligence (BI) DEVE SEMPRE possuir algum tipo de comparativo ou métrica de referência (ex.: *vs. Mês Anterior*, *vs. Período Anterior*, *vs. Meta/Target*, *% de Atingimento do Orçamento*, *Variação Ano contra Ano*).
   - Um dado numérico isolado (ex.: "Faltas: 45") **não** deve ser apresentado como KPI sem sua devida contextualização comparativa (ex.: "Faltas: 45 | -12% vs Mês Anterior | Meta: < 30").

2. **Dashboards Exclusivamente via METABASE:**
   - A criação, exibição e gestão de Dashboards e visões analíticas de BI DEVEM SER realizadas via **METABASE** (self-hosted apontando para as `views` / `materialized views` read-only do Postgres/Supabase).
   - O sistema web principal (Next.js) foca nas fluxos operacionais e de gestão diária por papel, enquanto as análises executivas e dashboards analíticos de BI ficam centralizados no Metabase.
