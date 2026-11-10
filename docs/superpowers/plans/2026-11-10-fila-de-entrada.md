# Fila de entrada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a tela Autorizações (`/recepcao/a-autorizar`) pela "Fila de entrada": um modelo de 4 etapas, 4 grupos, uma ação principal por caso.

**Architecture:** Uma função pura (`lib/intake-queue-pure.ts`) calcula etapa e grupo e é a única fonte de numeração (substitui `pipelineStageLabel`). A UI é reescrita em arquivos pequenos ao lado de `authorizations-workspace.tsx` (1152 linhas, que sai por último). Dados vêm de `getReceptionQueue` (`lib/reception-queue.ts`); ações reaproveitam `draft-pipeline-actions.ts`.

**Tech Stack:** Next.js 16.3.4 (ler `node_modules/next/dist/docs/` antes de mexer em rotas, conforme AGENTS.md), React 19, Supabase, testes `node --test` com `--experimental-strip-types` (arquivos puros sem alias `@/`).

**Spec:** `docs/superpowers/specs/2026-11-10-fila-de-entrada-design.md`

## Global Constraints

- Só em branch e preview; produção intocada. Migrations só em branch do Supabase (`create_branch`), nunca no projeto de produção.
- Etapas: 1 Documentos recebidos, 2 Guia enviada ao plano, 3 Plano autorizou, 4 Habilitado para agendamento.
- Nenhuma etapa bloqueia por documento faltando; a tela só avisa.
- Grupos: Agir agora, Aguardando família, Aguardando plano, Concluídos; ordenados por quem espera há mais tempo; cada caso em um grupo só; soma dos grupos = total.
- Desfazer de 8 segundos em toda ação; só o envio de WhatsApp pede confirmação.
- Texto mínimo 14 px, alvo de clique 40 px, nenhuma frase em caixa alta.
- Aviso de pendência colado ao botão da etapa 2: "Faltam laudo e pedido médico. O plano pode negar."
- Atraso: 5 dias de espera (suposição da spec, a confirmar).
- AGENTS.md item 3: rascunho duplicado de paciente já validado/habilitado não vira caso na fila.

## Review Focus

- Caso devolvido pela Supervisão (`pipeline.returned`) sem guia enviada: deve cair em "Agir agora", etapa 2.
- Autorização `dispensada` sem agendamento habilitado: spec não cobre; fica etapa 3, "Agir agora".
- Lead com conversa encerrada (`dropLeadsWithClosedChat`): a soma das abas deve bater com a lista já filtrada, não com a bruta.
- Cobrança enviada antes de o plano pedir mais documentos: não pode mandar o caso para "Aguardando família".
- Desfazer após o usuário trocar de caso ou recarregar a página: não pode reverter outro caso.

---

### Task 1: Função pura de etapa e grupo (fase 1)

**Files:**
- Create: `lib/intake-queue-pure.ts`
- Test: `tests/intake-queue-pure.test.ts`

**Interfaces:**
- Produces:
  - `type IntakeStage = 1 | 2 | 3 | 4`
  - `type IntakeGroup = "agir_agora" | "aguardando_familia" | "aguardando_plano" | "concluidos"`
  - `type IntakeInput = { authorization: "pendente"|"enviada"|"autorizada"|"dispensada"; schedulingEnabledAt: string|null; missingDocs: number; familyChasedAt: string|null; planDeniedAt: string|null; planAskedMoreDocsAt: string|null }`
  - `intakeStage(i: IntakeInput): IntakeStage`
  - `intakeGroup(i: IntakeInput): IntakeGroup`
  - `intakeStageLabel(i: IntakeInput): string` (ex.: `"2 de 4 · Enviar guia"`)
  - `INTAKE_GROUP_ORDER: IntakeGroup[]`

- [ ] **Step 1: Escrever testes que falham** em `tests/intake-queue-pure.test.ts`, um por regra:
  - pendente, 0 faltando → `(2, agir_agora)`
  - pendente, 6 faltando, `familyChasedAt=null` → `(2, agir_agora)`; com `familyChasedAt` → `(2, aguardando_familia)`
  - enviada → `(3, aguardando_plano)`
  - autorizada sem habilitar → `(3, agir_agora)`
  - autorizada + `schedulingEnabledAt` → `(4, concluidos)`
  - `planDeniedAt` (mais recente que `guideSentAt` implícito) → `(2, agir_agora)` mesmo com cobrança
  - `planAskedMoreDocsAt` → `(1, aguardando_familia)` se `familyChasedAt >= planAskedMoreDocsAt`, senão `(1, agir_agora)`
  - dispensada sem habilitar → `(3, agir_agora)`
  - `intakeStageLabel(pendente)` igual a `"2 de 4 · Enviar guia"`; etapa 3 `"3 de 4 · Aguardar plano"`; etapa 4 `"4 de 4 · Habilitado"`; etapa 1 `"1 de 4 · Documentos"`
  - propriedade: enumerar todas as combinações dos campos e afirmar que `intakeGroup` devolve exatamente um valor de `INTAKE_GROUP_ORDER` e que `intakeStage` fica entre 1 e 4.
- [ ] **Step 2:** `npm test -- --test-name-pattern=intake` → falha por módulo ausente.
- [ ] **Step 3:** Implementar o módulo sem imports com alias. Precedência: habilitado > negou > pediu mais documentos > estado de `authorization`.
- [ ] **Step 4:** `npm test` inteiro passa.
- [ ] **Step 5:** `git add lib/intake-queue-pure.ts tests/intake-queue-pure.test.ts docs/superpowers && git commit -m "feat(fila-de-entrada): etapa e grupo em função pura"`

### Task 2: Alimentar a função a partir da fila e unificar a numeração (fase 1)

**Files:**
- Modify: `lib/reception-queue.ts` (adicionar `intake: { stage; group; waitingSince }` ao `PendingRegistrationDraft`, calculado perto da linha ~1049 com `computeLeadPendencies` para `missingDocs` e `documentRequests` para `familyChasedAt`)
- Modify: `lib/atendimento/case-summary-pure.ts:163` (trocar `pipelineStageLabel` por `intakeStageLabel`)
- Modify: `app/recepcao/pacientes/pendencias/draft-pipeline.tsx` (remover "Missão", "Etapa x/4" da barra de progresso; usar `intakeStage`)
- Modify: `tests/draft-pipeline-steps-pure.test.ts`, `tests/case-summary-pure.test.ts`
- Test: `tests/intake-queue-pure.test.ts` (cenário de soma)

**Interfaces:**
- Consumes: Task 1.
- Produces: `draft.intake.group` e `draft.intake.stage` em todo item da fila de autorizações; `waitingSince: string` (ISO, base da ordenação).

- [ ] **Step 1:** Teste: dado 7 itens sintéticos cobrindo todos os grupos, `sum(groups) === items.length`.
- [ ] **Step 2:** Rodar, ver falhar.
- [ ] **Step 3:** Implementar `buildIntake(draft): DraftIntake` em arquivo puro `lib/intake-queue-build-pure.ts` e chamá-lo em `reception-queue.ts`.
- [ ] **Step 4:** Remover `pipelineStageLabel` e atualizar testes dos dois consumidores; `grep -rn "Etapa [0-9]/4\|Missão" app lib` deve voltar vazio.
- [ ] **Step 5:** `npm test && npm run typecheck && npm run lint` limpos; commit.

### Task 3: Cabeçalho de uma linha, 4 abas e linha da fila (fase 2)

**Files:**
- Create: `app/recepcao/a-autorizar/intake-tabs.tsx`, `intake-row.tsx`, `intake-list.tsx`, `intake-filters-pure.ts`
- Modify: `app/recepcao/a-autorizar/page.tsx` (título "Fila de entrada", sem `axisLabel`, aviso de leads vira link no fim da lista), `components/recepcao-nav.tsx:17` (rótulo)
- Test: `tests/intake-filters-pure.test.ts`

**Interfaces:**
- Consumes: `draft.intake` (Task 2), `matchesSearch` de `queue-filters-pure.ts`.
- Produces: `groupItems(items): Record<IntakeGroup, Item[]>` ordenado por `waitingSince` crescente; `isOverdue(waitingSince, now, days = 5): boolean`; `<IntakeList items selectedId onSelect />`.

- [ ] **Step 1:** Testes: ordenação por espera, `isOverdue` em 4/5/6 dias, busca por nome e telefone sem acento, "Só os meus".
- [ ] **Step 2:** Rodar e ver falhar.
- [ ] **Step 3:** Implementar funções puras; depois os componentes. Linha: nome, `intakeStageLabel`, tempo de espera; cor só se `isOverdue`.
- [ ] **Step 4:** Testes passam; `npm run build` ok.
- [ ] **Step 5:** Playwright (`tests/e2e`, `--trace off`): primeiro paciente visível sem rolar a 1366x768; chips e seletores antigos ausentes. Commit.

### Task 4: Detalhe em coluna única e botão principal por caso (fase 3)

**Files:**
- Create: `app/recepcao/a-autorizar/intake-detail.tsx`, `intake-stage-trail.tsx`, `intake-copy-field.tsx`, `intake-primary-action-pure.ts`
- Modify: `app/recepcao/a-autorizar/authorizations-workspace.tsx` (passa a só compor lista + detalhe; remover o que migrou)
- Test: `tests/intake-primary-action-pure.test.ts`

**Interfaces:**
- Consumes: `getPortalRobotState(draftId)` → `agentOnline`; `markGuideSent`, `registerAuthorizedGuide`, `enableDraftScheduling`.
- Produces: `primaryAction(i: IntakeInput, robotOnline: boolean): { kind: "none"|"send_via_robot"|"mark_sent"|"upload_authorized_pdf"; label: string }`.

- [ ] **Step 1:** Testes: etapa 1 → `none`; etapa 2 robô ligado → `"Enviar guia ao plano"`/`send_via_robot`; etapa 2 robô desligado → `"Marcar guia como enviada"`/`mark_sent`; etapa 3 → `"Subir guia autorizada (PDF)"`; etapa 4 → `none`.
- [ ] **Step 2:** Rodar e ver falhar.
- [ ] **Step 3:** Implementar a função e a UI do detalhe: cabeçalho do paciente com Copiar (telefone, carteirinha), menu "Mais" (Reatribuir, Ajustar cadastro), etapas concluídas em uma linha, futuras só com título, "Dados recebidos" recolhido, "O que falta" uma vez dentro da etapa 1.
- [ ] **Step 4:** Testes passam; typecheck.
- [ ] **Step 5:** Playwright: botão do robô desabilitado/trocado com robô offline. Commit.

### Task 5: Desfecho do plano, cobrança unificada, aviso e desfazer (fase 4)

**Files:**
- Create: `supabase/migrations/20261110120000_intake_plan_outcomes.sql` (colunas `plan_denied_at`, `plan_more_docs_at` em `registration_drafts`)
- Create: `app/recepcao/pacientes/pendencias/intake-actions.ts` (`denyPlan`, `planAskedMoreDocs`, `undo*`), `app/recepcao/a-autorizar/undo-toast.tsx`, `chase-all-dialog.tsx`, `pending-warning.tsx`
- Modify: `lib/reception-queue.ts` (ler as colunas), `document-request-actions.ts` (aceitar várias chaves em uma mensagem)
- Test: `tests/intake-actions-pure.test.ts` (texto da mensagem e do aviso)

**Interfaces:**
- Consumes: `missingChaseKeys` de `lead-pendencies.ts`, `undoGuideSent`, `undoDraftAuthorization`, `disableDraftScheduling`.
- Produces: `buildChaseMessage(keys: ChaseKey[]): string`; `buildPendingWarning(keys: ChaseKey[]): string | null` (`"Faltam laudo e pedido médico. O plano pode negar."`); `useUndoToast(seconds = 8)`.

- [ ] **Step 1:** Testes: aviso com 0, 1, 2 itens (sem aviso quando 0; plural e "e" correto); mensagem de cobrança lista todos os itens uma vez.
- [ ] **Step 2:** Rodar e ver falhar.
- [ ] **Step 3:** Implementar funções; aplicar migration só em branch do Supabase; ações novas com desfazer que zera o campo.
- [ ] **Step 4:** Testes passam; no preview, "Plano negou" move o caso para etapa 2 / Agir agora e o desfazer o devolve.
- [ ] **Step 5:** Commit.

### Task 6: Acessibilidade e carregamento (fase 5)

**Files:**
- Modify: componentes `intake-*`, `app/recepcao/a-autorizar/page.tsx`, `loading.tsx`
- Create: `perf/intake-load.mjs` (mede tempo até a lista visível e até o detalhe, antes e depois)

**Interfaces:**
- Consumes: Tasks 3 a 5. Produces: números de tempo registrados em `docs/superpowers/plans/2026-11-10-fila-de-entrada-medicao.md`.

- [ ] **Step 1:** Rodar `perf/intake-load.mjs` na tela atual e salvar a linha de base antes de mexer.
- [ ] **Step 2:** Lista leve primeiro (sem `files`, `messages` e `facts`); detalhe carregado ao selecionar.
- [ ] **Step 3:** Checagem automática no Playwright: nenhum texto abaixo de 14 px e nenhum botão com altura menor que 40 px na tela.
- [ ] **Step 4:** Rodar de novo e registrar antes e depois. Commit.

### Task 7: Remoção do legado e validação no preview (fase 6)

**Files:**
- Delete: o que sobrar de `authorizations-workspace.tsx` não usado
- Create: `docs/superpowers/plans/2026-11-10-fila-de-entrada-validacao.md` (roteiro e anotações)

- [ ] **Step 1:** `npm run lint && npm run typecheck && npm test && npm run build` limpos.
- [ ] **Step 2:** Push da branch e URL de preview do Vercel (só preview, sem promover).
- [ ] **Step 3:** Roteiro: cada uma das 3 atendentes conclui 5 casos reais sem ajuda; anotar travas.
- [ ] **Step 4:** Ajustes viram commits; merge só com aprovação do dono.

## Self-review

- Cobertura: decisões da spec ↔ Tasks 1 a 7; pontos em aberto continuam abertos (ver mensagem de entrega).
- Risco: o modelo atual não tem "negou" nem "pediu mais documentos" (Task 5 exige migration). A etapa 1 só aparece depois de "pediu mais documentos", porque hoje a etapa 1 é sempre concluída; confirmar com o dono.
