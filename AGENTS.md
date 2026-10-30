<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Diretrizes do Projeto - BI & Dashboards

1. **KPIs com Comparativo Obrigatório:**
   - Todo e qualquer KPI/indicador de Business Intelligence (BI) DEVE SEMPRE possuir algum tipo de comparativo ou métrica de referência (ex.: *vs. Mês Anterior*, *vs. Período Anterior*, *vs. Meta/Target*, *% de Atingimento do Orçamento*, *Variação YoY*).
   - Métricas isoladas sem contexto comparativo não são consideradas KPIs válidos no sistema.

2. **Dashboards de BI dentro do sistema, sem ferramenta paga:**
   - Dashboards e relatórios analíticos gerenciais são páginas do próprio sistema (área do gestor), lendo Views/Materialized Views read-only do Postgres/Supabase protegidas por RLS. Metabase **não** é usado (custo); não introduzir ferramenta de BI paga sem decisão explícita do dono do projeto.
   - As Views antigas com prefixo `metabase_` continuam valendo como camada de dados (o prefixo é só herança de nome).

# Diretrizes do Projeto - Fila de Autorizações & Agenda de Avaliação

3. **Prevenção de Duplicidade em Autorizações e Agenda de 1ª Avaliação:**
   - Quando um paciente/telefone já possuir cadastro validado (`patient_id` vinculado) ou já estiver com a 1ª avaliação habilitada/autorizada ou com oferta de agendamento em andamento, novos contatos ou rascunhos de WhatsApp (`registration_drafts`) para o mesmo número/criança NÃO devem gerar um processo paralelo como "aguardando envio de guia" no painel de Autorizações.
   - Identificada duplicidade entre um processo em andamento no agendamento e um rascunho órfão em Autorizações, o rascunho redundante deve ser arquivado/rejeitado com motivo explícito de duplicidade, mantendo-se o processo oficial que já possui autorização e agendamento ativos.

