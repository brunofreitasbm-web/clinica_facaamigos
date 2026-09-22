# Diretrizes do Projeto - BI & Dashboards

1. **KPIs com Comparativo Obrigatório:**
   - Todo e qualquer KPI/indicador de Business Intelligence (BI) DEVE SEMPRE possuir algum tipo de comparativo ou métrica de referência (ex.: *vs. Mês Anterior*, *vs. Período Anterior*, *vs. Meta/Target*, *% de Atingimento do Orçamento*, *Variação Ano contra Ano*).
   - Um dado numérico isolado (ex.: "Faltas: 45") **não** deve ser apresentado como KPI sem sua devida contextualização comparativa (ex.: "Faltas: 45 | -12% vs Mês Anterior | Meta: < 30").

2. **Dashboards Analíticos Nativos (Next.js):**
   - A criação, exibição e gestão de Dashboards e visões analíticas de BI devem ser integradas diretamente na aplicação web (Next.js), consumindo as `views` / `materialized views` do Postgres/Supabase.
   - O sistema web centraliza tanto os fluxos operacionais quanto os dashboards analíticos por perfil de usuário.
