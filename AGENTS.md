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

# Diretrizes do Projeto - Deploy

4. **Merge automático quando o CI passar (autorizado pelo dono do projeto, regra permanente):**
   - Depois de commitar e dar push na branch da sessão, abrir o PR, aguardar o CI (`typecheck` e `npm test`) e, estando verde, marcar o PR como pronto e fazer o merge na `main` sem pedir confirmação. A Vercel publica a `main` em produção automaticamente.
   - Se o CI falhar, NÃO fazer merge: corrigir a causa e empurrar de novo. Nunca desabilitar ou pular teste para ficar verde.
   - Merge na `main` não aplica migrations no Supabase. Migrations e alterações de dados em produção continuam sendo ações separadas e explícitas.

# Diretrizes do Projeto - Experiência do Operador

5. **Fluidez acima de tudo (essência do sistema, regra do dono do projeto):**
   O sistema para o operador deve ser o mais fluido possível, intuitivo e sem poluição visual, para derrubar a curva de aprendizado. O operador não deve precisar procurar menus e telas. Critérios obrigatórios para qualquer tela de operador:
   - **A tela traz o trabalho:** a home de cada papel mostra a fila do que precisa de ação agora, ordenada por urgência. Nenhuma tarefa diária pode depender de navegar por menu.
   - **Ação onde o dado está:** confirmar, anexar, corrigir, agendar etc. acontecem no próprio item (linha, card ou painel lateral), sem ir para outra tela e voltar. Tarefa rotineira em no máximo 3 cliques a partir da home; exceção precisa ser justificada no PR.
   - **Uma ação primária por tela/estado:** um único botão de destaque; o resto é secundário ou fica em "mais ações". Sem blocos de texto explicativo, cards decorativos ou informação que não leva a uma decisão.
   - **Informação progressiva:** detalhe aparece sob demanda (expandir, painel lateral), não tudo de uma vez.
   - **O sistema decide o óbvio:** pré-preencher o que já se sabe, defaults sensatos, nunca pedir de novo um dado que já existe no banco.
   - **Erro e bloqueio dizem o que fazer:** a mensagem traz a próxima ação (ex.: "Falta guia vigente: Anexar guia"), não só o problema.
   - **Vocabulário do operador:** nada de nomes de tabela, enums crus ou jargão técnico na tela.
   - **Convivência com a regra 1:** o comparativo do KPI é uma linha compacta dentro do próprio KPI (ex.: "▲ 12% vs. mês anterior"), não um bloco extra.
   - **Checklist no PR que altera tela de operador:** quantos cliques a tarefa principal leva, qual é a ação primária e o que foi removido ou escondido. Tela que não passa no checklist não entra.
