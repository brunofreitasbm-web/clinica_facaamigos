# Fechamento de competência + exportação pro faturista Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fatia de faturamento do PRD §9.8 / Fase 1 ("Fechamento de competência", "Exportação para faturista"): dado um convênio e um mês, listar as sessões `realizada` com evolução assinada que pertencem a esse convênio, gerar `billing_items` pras que têm autorização + preço vigente, marcar como inconsistência as que não têm, e exportar o lote em CSV pro faturista.

**Architecture:** Server Components (`app/faturamento/competencias/page.tsx`, `[id]/page.tsx`) fazem toda leitura via `createClient()` (cliente de sessão) — RLS já aplicada (`gestor`/`faturamento` leem/escrevem `billing_periods`/`billing_items`/`insurer_price_tables`, escopados por `insurers.clinic_id`). Duas Server Actions em `app/faturamento/competencias/actions.ts`: `closeCompetence` (idempotente — cria a competência se não existir, insere só os itens que ainda faltam) e `exportCompetenceCsv` (monta o CSV e marca `status='enviada'`). A lógica de elegibilidade/inconsistência é extraída pra `lib/billing-eligibility.ts`, reusada tanto pelo fechamento (que insere os elegíveis) quanto pela página de detalhe (que recalcula e mostra as inconsistências on-the-fly, sem persistir).

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, `@supabase/supabase-js` (cliente de sessão via `lib/supabase/server.ts`), Supabase Postgres (projeto `vththexblpxwocbowhsv`).

## Global Constraints

- `const supabase = await createClient()` (cliente de sessão) em toda leitura/escrita — nunca o cliente admin. RLS decide o que cada papel vê/escreve.
- `session_notes` não é legível diretamente pelo papel `faturamento` (RLS: só `gestor`/`supervisor`/terapeuta dono da sessão) — a checagem de "tem evolução" usa a RPC `session_note_pending` (já `SECURITY DEFINER`, escopada por clínica), mesmo padrão de `lib/session-note-pending.ts`.
- `billing_periods.status` tem `CHECK (status IN ('aberta','fechada','enviada','paga'))` no banco — não existe `'aberto'`/`'exportado'` como enum livre. Usa-se o default `'aberta'` na criação e `'enviada'` na exportação (mapeamento mais próximo do fluxo real: "aberta" até ser mandada pro faturista, "enviada" depois de exportada).
- Toda Server Action retorna `{ success: true, ... } | { success: false; error: string }`; erro de Postgres/trigger nunca aparece cru na UI.
- Sessão `realizada` sem evolução ainda é ignorada em silêncio na tela de fechamento (não é elegível, não é inconsistência) — já visível na métrica "Sessões sem evolução" da home de faturamento.
- Mês de competência tratado em `CLINIC_TIMEZONE` via `zonedDateTimeToUtc`/`civilDateInTimeZone` (`lib/timezone.ts`) — nunca mês civil ingênuo em UTC.
- Fora de escopo: importação de retorno de glosa, repasse por sessão/terapeuta, edição/exclusão manual de item, PDF, envio automático, job agendado.

---

## Task 1: `civilDateInTimeZone` em `lib/timezone.ts`

**Files:** Modify: `lib/timezone.ts`

- [x] Extraída de `todayInTimeZone` (que agora delega pra ela) uma função `civilDateInTimeZone(instant: Date, timeZone: string): string`, pra converter qualquer instante (não só "agora") na data civil `YYYY-MM-DD` no fuso da clínica. Necessária pra comparar a data da sessão com a vigência (`valid_from`/`valid_to`) do preço.

## Task 2: `lib/billing-eligibility.ts` — elegibilidade e inconsistência

**Files:** Create: `lib/billing-eligibility.ts`

- [x] `computeCompetenceEligibility(supabase, insurerId, monthStr)` retorna `{ eligible: EligibleSession[]; inconsistent: InconsistentSession[] }`. Passos:
  1. `patient_insurance` do convênio (`is_private=false`) → lista de `patient_id`. Convênio sem paciente vinculado retorna listas vazias direto (sem query de `appointments`).
  2. `appointments` com `status='realizada'`, `patient_id in (...)`, `starts_at` dentro do mês (bounds calculados via `zonedDateTimeToUtc` sobre o dia 1 do mês e o dia 1 do mês seguinte).
  3. Por sessão: `session_note_pending` (RPC) — se pendente, `continue` (ignora, critério "não é nem candidata ainda").
  4. Sem `authorization_id` → inconsistência "Sem autorização vinculada".
  5. `authorization_id` presente mas authorization não resolve (RLS/inexistente) → mesma inconsistência.
  6. Com `procedure_code` da autorização: busca em `insurer_price_tables` (já carregada uma vez por convênio) um preço cujo `valid_from <= dataDaSessão` e (`valid_to` nulo ou `>= dataDaSessão`) — comparação de string `YYYY-MM-DD`, válida lexicograficamente. Sem preço → inconsistência "Sem preço cadastrado para {procedure_code}". Com preço → elegível.

## Task 3: Server Actions — `closeCompetence` e `exportCompetenceCsv`

**Files:** Create: `app/faturamento/competencias/actions.ts`

- [x] `closeCompetence(insurerId, monthStr)`: valida `monthStr` (`YYYY-MM`); busca `billing_periods` existente por `(insurer_id, competence_month)`, reusa o `id`; se não existe, insere (trata corrida via `code === "23505"` re-buscando em vez de falhar); roda `computeCompetenceEligibility`; busca `appointment_id` já presentes em `billing_items` da competência; insere só os que faltam. Idempotente — chamar de novo (botão "Reprocessar") só adiciona o que faltava.
- [x] `exportCompetenceCsv(billingPeriodId)`: monta CSV (`;` como separador, `\n` como quebra de linha, BOM UTF-8 pro Excel PT-BR abrir acentuação corretamente) com cabeçalho `Paciente;Carteirinha;Guia;Procedimento;Data;Hora;Profissional;Conselho;Valor`, a partir de `billing_items` com embed até `appointments → patients/authorizations/patient_insurance` e `profiles!therapist_id` (alias necessário — `appointments` tem duas FKs pra `profiles`). Escapa `;`/aspas/quebra de linha por campo. Atualiza `billing_periods.status='enviada'` + `exported_at=now()` na mesma chamada. Retorna `{csv, filename}` pro client baixar.

## Task 4: UI — lista, formulário de fechamento, detalhe, reprocessar, exportar

**Files:**
- Create: `app/faturamento/competencias/page.tsx`, `competence-form.tsx`, `csv-export-button.tsx`
- Create: `app/faturamento/competencias/[id]/page.tsx`, `reprocess-button.tsx`
- Modify: `app/faturamento/page.tsx` (link "Ver competências →")

- [x] `page.tsx`: lista `billing_periods` (convênio, mês, status, nº de itens, total via `billing_items(amount)` embutido) + `CompetenceForm` (select de convênio + `input type="month"`) que chama `closeCompetence` e navega pro detalhe criado/existente.
- [x] `[id]/page.tsx`: cabeçalho com convênio/mês/status; total em destaque; lista "Itens faturáveis" (de `billing_items`, joins até paciente/procedimento/profissional); lista "Inconsistências" (recalculada via `computeCompetenceEligibility`, só o que falhou elegibilidade, com o motivo); botões `ReprocessButton` (chama `closeCompetence` de novo + `router.refresh()`) e `CsvExportButton` (chama `exportCompetenceCsv`, baixa via `Blob`/`URL.createObjectURL`/`<a download>`).
- [x] `app/faturamento/page.tsx`: única mudança é o link novo pra `/faturamento/competencias` — métricas existentes preservadas.

## Task 5: Verificação

- [x] `npm run build` — compilou limpo, todas as rotas novas listadas (`/faturamento/competencias`, `/faturamento/competencias/[id]`).
- [x] `npm run lint` — sem erros.
- [x] Conferido via `execute_sql` (read-only): `billing_periods_status_check` no banco real é `('aberta','fechada','enviada','paga')` — confirma o mapeamento de status desta entrega; schema de `billing_periods`/`billing_items`/`insurer_price_tables`/`authorizations`/`patient_insurance`/`session_notes` confere com `lib/database.types.ts`.

---

## Self-Review

**Spec coverage:** modelo de dados (billing_periods 1x(insurer,mês), billing_items 1x sessão), os 6 critérios de elegibilidade, inconsistência com motivo específico, sessão sem evolução ignorada em silêncio (já visível alhures), rotas `page.tsx`/`actions.ts`/`[id]/page.tsx`, CSV com o layout exato do PRD §9.8, idempotência do fechamento/reprocessamento, link de entrada em `app/faturamento/page.tsx` — todos os itens do briefing têm código correspondente.

**Desvio do briefing:** `billing_periods.status` usa `'aberta'`/`'enviada'` (valores reais do `CHECK` constraint do banco) em vez de `'aberto'`/`'exportado'` sugeridos no briefing — o briefing presumia "sem enum fixo no banco", mas a migração `20260904000009_billing.sql` já tem um `CHECK` explícito; usar um valor fora dele quebraria todo insert/update. `closeCompetence` ficou com assinatura `(insurerId, monthStr)` — sem o terceiro parâmetro opcional `formData?` sugerido no briefing, que não tinha uso definido e seria código morto.
