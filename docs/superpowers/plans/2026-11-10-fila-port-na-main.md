# Fila de entrada: port do nosso trabalho para a tela da main (/recepcao/fila) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep main's "Fila de entrada" screen at `/recepcao/fila` (PR #115), restore `/recepcao/a-autorizar` exactly to main, and port four pieces of our branch into main's screen: "Plano negou" / "Plano pediu mais documentos", 8-second Desfazer (restore-style), 14 px text and 40 px targets, and detail on demand that matches the list.

**Architecture:** Main's pure model `lib/fila/fila-model-pure.ts` stays the ONLY stage/group model; it learns the plan outcomes (`activePlanOutcome` moves into it) and the Chat summary reads its step text. Undo is one mechanism: server actions in `intake-actions.ts` return an `UndoToken` (`lib/intake-undo-pure.ts`) and `restoreIntakeState` applies it; the client toast (`undo-toast.tsx`, moved into `app/recepcao/fila/`) holds it for 8 s. Detail is one mechanism: a GET route handler returns a `FilaDetail` built from the SAME consolidated draft as the list, consolidating only the list item's member drafts, with no merge persistence.

**Tech Stack:** Next.js 16.3.4 (App Router, breaking changes: read `node_modules/next/dist/docs/` first), React 19, TypeScript, Supabase (Postgres + RLS), Twilio WhatsApp, `node --experimental-strip-types --test` for tests.

**Spec:** `docs/superpowers/specs/2026-11-10-fila-de-entrada-design.md` (owner ruling of 10/11/2026 in `.superpowers/sdd/2026-11-10-fila-de-entrada/progress.md`, last line, overrides the spec where they differ: main's screen and vocabulary win).

## Global Constraints

- AGENTS.md: "This is NOT the Next.js you know". Before touching any route, page or route handler, read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` and `.../03-file-conventions/dynamic-routes.md` (`params` is a Promise). Heed deprecation notices. Commit the AGENTS.md block if `next dev` re-adds it.
- AGENTS.md rule 3 (duplicate prevention) must not regress: nothing here creates drafts or authorizations; detail and summary are read-only.
- Migration `supabase/migrations/20261110120000_intake_plan_outcomes.sql` is NEVER applied to production project `vththexblpxwocbowhsv` (nor any DB) without explicit owner approval. Code must keep working when the four columns are missing (`lib/intake-columns-pure.ts`, commit dde9bb1).
- No writes to any database during implementation. No deploys, no Vercel preview: preview envs share production Supabase and Twilio (real WhatsApp). Never dispatch real WhatsApp sends.
- No em dashes (U+2014) and no en dashes (U+2013) anywhere in code, comments, copy or commit messages.
- UI copy in Portuguese, sentence case, no `uppercase`. Minimum text 14 px (`text-sm`), interactive targets at least 40 px tall.
- Every action shows Desfazer for exactly 8 seconds (`UNDO_SECONDS = 8`). Every action that sends WhatsApp (document request, reminder, opener, slot offer via `enableDraftScheduling`, including "Plano autorizou" which enables) asks for confirmation with what will be sent, and has NO Desfazer.
- One stage model (`lib/fila/fila-model-pure.ts`), one undo mechanism (`restoreIntakeState`), one detail mechanism (route handler). Do not reintroduce `lib/intake-queue-pure.ts` vocabulary ("2 de 4 · Enviar guia").
- Pure files (`*-pure.ts`) have no `@/` imports; relative imports end in `.ts`; they run under `node --experimental-strip-types`.
- Nav badge (spec open point "menu shows only Agir agora") is out of scope. Do not touch `components/recepcao-nav.tsx`.
- Commits end with the attribution lines given in the session's system reminder.

## Review Focus

- Production without the migration: every Fila action except the two plan-outcome buttons must still work; they just come back without Desfazer. Tested in Task 4 (`withUndo` fallback).
- Desfazer clicked after the case changed tab or the operator opened another family: the undo must act on the draft of the action, never the selected one. Tested in Task 5 (toast entry carries `draftId`; existing `canUndo` tests moved with the file).
- Double click on a WhatsApp confirm button sends twice: confirm buttons disabled while pending or while detail is locked. Tested in Task 5 (static check) and Task 6 (lock).
- Chat link `?item=<secondary draft id>` for a merged family must open that family, not nothing. Tested in Task 6 (`findFilaItem`).
- "Plano pediu mais documentos" for something the system does not track (no missing doc keys): no empty WhatsApp send; the primary becomes "Abrir conversa no Chat". Tested in Task 2.

---

## File map (decided)

Kept from our branch as-is or adapted:
- `supabase/migrations/20261110120000_intake_plan_outcomes.sql` (comment reference updated in Task 2)
- `lib/database.types.ts` (plan columns)
- `lib/intake-columns-pure.ts`, `tests/intake-columns-pure.test.ts`
- `lib/intake-detail-pick-pure.ts` (test re-added in Task 6)
- `lib/intake-undo-pure.ts`, `tests/intake-undo-pure.test.ts` (kinds changed in Task 4)
- `app/recepcao/pacientes/pendencias/intake-actions.ts` (reduced in Task 4)
- `lib/draft-merge.ts` (plan fields; `mergedDraftIds` and `persist` option added in Task 6)
- `lib/reception-queue.ts` (column fallback, plan fields, `getConsolidatedRegistrationDraft`; `intake` field and multi-key template hunk removed in Task 1)
- `perf/intake-load.mjs` (default path changed to `/recepcao/fila` in Task 1)

Moved:
- `app/recepcao/a-autorizar/undo-toast.tsx` to `app/recepcao/fila/undo-toast.tsx`
- `app/recepcao/a-autorizar/undo-toast-pure.ts` to `app/recepcao/fila/undo-toast-pure.ts`
- `app/api/recepcao/fila-de-entrada/[draftId]/route.ts` to `app/api/recepcao/fila/[draftId]/route.ts` (Task 6)

Restored to `origin/main` exactly (Task 1):
- `app/recepcao/a-autorizar/authorizations-workspace.tsx`, `loading.tsx`, `page.tsx`
- `app/recepcao/atendimento/case-summary-actions.ts`, `lib/atendimento/case-summary-pure.ts`, `tests/case-summary-pure.test.ts` (changed again in Task 3)
- `app/recepcao/pacientes/pendencias/document-request-actions.ts`, `draft-pipeline.tsx`, `portal-robot-panel.tsx`
- `components/page-header.tsx` (the optional `axisLabel` was only for the dropped screen)
- `lib/document-request-templates.ts`, `lib/draft-pipeline-steps-pure.ts`, `tests/draft-pipeline-steps-pure.test.ts`

Deleted (Task 1):
- `app/recepcao/a-autorizar/`: `chase-all-dialog.tsx`, `confirm-dialog.tsx`, `intake-copy-field.tsx`, `intake-detail.tsx`, `intake-filters-pure.ts`, `intake-list-item-pure.ts`, `intake-list.tsx`, `intake-primary-action-pure.ts`, `intake-row.tsx`, `intake-stage-trail.tsx`, `intake-tabs.tsx`, `pending-warning.tsx`
- `lib/intake-queue-pure.ts`, `lib/intake-queue-build-pure.ts` (logic re-homed in Task 2), `lib/intake-actions-pure.ts`, `lib/document-template-keys-pure.ts`
- `perf/intake-payload-estimate.mjs`
- Tests: `intake-queue-pure`, `intake-queue-build-pure`, `intake-primary-action-pure`, `intake-filters-pure`, `intake-list-item-pure`, `intake-actions-pure`, `document-template-keys-pure`, `intake-a11y-static` (recreated as `fila-a11y-static` in Task 7), `intake-detail-consistency` (recreated as `fila-detail` in Task 6)

Created later: `lib/fila/fila-action-policy-pure.ts` (Task 5), `lib/fila/fila-detail-pure.ts` (Task 6), tests named in each task.

Deleted later: `app/recepcao/fila/fila-detail-action.ts` (Task 6, replaced by the route handler).

---

### Task 1: Restore main and prune the dropped rewrite

**Files:**
- Restore: every file in "Restored to origin/main exactly" above
- Delete: every file in "Deleted (Task 1)" above
- Move: `app/recepcao/a-autorizar/undo-toast.tsx`, `undo-toast-pure.ts` to `app/recepcao/fila/`; update import in `tests/undo-toast-pure.test.ts` to `../app/recepcao/fila/undo-toast-pure.ts`
- Modify: `lib/reception-queue.ts`, `perf/intake-load.mjs`

**Interfaces:**
- Produces: `PendingRegistrationDraft` WITHOUT `intake`; `DraftPipeline.planDeniedAt` / `planAskedMoreDocsAt: string | null` kept; `getConsolidatedRegistrationDraft(supabase, draftId, clinicId?)` kept (signature changes in Task 6).

- [ ] **Step 1: Restore main's versions**

```bash
git checkout origin/main -- app/recepcao/a-autorizar/authorizations-workspace.tsx app/recepcao/a-autorizar/loading.tsx app/recepcao/a-autorizar/page.tsx \
  app/recepcao/atendimento/case-summary-actions.ts lib/atendimento/case-summary-pure.ts tests/case-summary-pure.test.ts \
  app/recepcao/pacientes/pendencias/document-request-actions.ts app/recepcao/pacientes/pendencias/draft-pipeline.tsx \
  app/recepcao/pacientes/pendencias/portal-robot-panel.tsx components/page-header.tsx lib/document-request-templates.ts \
  lib/draft-pipeline-steps-pure.ts tests/draft-pipeline-steps-pure.test.ts
```

- [ ] **Step 2: Move the toast, delete the orphans**

`git mv` the two undo-toast files into `app/recepcao/fila/`, then `git rm` every path in "Deleted (Task 1)". Fix the test import.

- [ ] **Step 3: Trim `lib/reception-queue.ts`**

Remove the `buildIntake` import, the `intake: DraftIntake` field of `PendingRegistrationDraft`, the `Omit<..., "intake">` wrappers and the two `{ ...d, intake: buildIntake(...) }` maps (return the consolidated list and `base` directly). Restore main's single-key loop in `getDraftDocumentRequests` (`parseTemplateKey`, one `key`), i.e. revert that hunk to `origin/main`. Keep the missing-column fallback, the `plan_denied_at, plan_more_docs_at` select, the pipeline fields and `getConsolidatedRegistrationDraft`.

- [ ] **Step 4: Point the perf script at the kept screen**

`perf/intake-load.mjs`: default `PATH_UNDER_TEST` and header comment become `/recepcao/fila`.

- [ ] **Step 5: Verify nothing references the deleted code and main's screens are byte-identical**

Run:
```bash
git grep -nE "intake-queue-pure|intake-queue-build-pure|intake-actions-pure|document-template-keys-pure|intake-list-item-pure|intake-primary-action|parseTemplateKeys|draft\.intake|a-autorizar/undo-toast" -- ':!docs' ':!.superpowers'
git diff --stat origin/main -- app/recepcao/a-autorizar components/page-header.tsx components/recepcao-nav.tsx app/recepcao/fila/page.tsx
```
Expected: first command no output (the migration comment still names `intake-queue-build-pure`; it is fixed in Task 2, so `supabase/` may be the only hit); second command shows only the two `undo-toast` deletions under `a-autorizar`.

- [ ] **Step 6: Run checks**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass (lint warnings pre-existing only).

- [ ] **Step 7: Commit**

```bash
git add -A app components lib tests perf
git commit -m "chore(fila): devolve Autorizacoes a versao da main e remove a reescrita paralela"
```

---

### Task 2: Plan outcomes in main's Fila model

**Files:**
- Modify: `lib/fila/fila-model-pure.ts`, `lib/fila/fila-source.ts`, `tests/fila-model-pure.test.ts`, `supabase/migrations/20261110120000_intake_plan_outcomes.sql` (comment only: `activePlanOutcome` now lives in `lib/fila/fila-model-pure.ts`)

**Interfaces:**
- Consumes: `DraftPipeline.guideSentAt`, `planDeniedAt`, `planAskedMoreDocsAt` from `lib/reception-queue.ts`.
- Produces (all in `lib/fila/fila-model-pure.ts`):
  - `FilaSource.pipeline` gains optional `guideSentAt?: string | null; planDeniedAt?: string | null; planAskedMoreDocsAt?: string | null` (absent means null: migration pending or old caller).
  - `export const FAMILY_WAIT_DAYS = 3;`
  - `export type PlanOutcome = "denied" | "more_docs" | null;`
  - `export function activePlanOutcome(p: { authorization: FilaSource["pipeline"]["authorization"]; guideSentAt: string | null; planDeniedAt: string | null; planAskedMoreDocsAt: string | null }): { planDeniedAt: string | null; planAskedMoreDocsAt: string | null }` (port verbatim from `git show 453c37d:lib/intake-queue-build-pure.ts`).
  - `FilaStepKind` gains `"plan_more_docs"`.
  - `FilaItem` gains `planOutcome: PlanOutcome; planOutcomeAt: string | null; moreDocsKeys: string[]`.
  - `export function buildFilaItem(src: FilaSource, nowMs: number): FilaItem` (new `nowMs` parameter; `buildFilaItems` in `fila-source.ts` already has it).
  - `trailStates(input: { authorization; schedulingEnabledAt; missingCount; planOutcome?: PlanOutcome })`.
  - `buildHistory` input `pipeline` gains optional `planDeniedAt?: string | null; planAskedMoreDocsAt?: string | null`.

Decision table (precedence top to bottom; "chased" = latest `documentRequests[].sentAt` that is >= `planAskedMoreDocsAt`):

| Condition | group | step.kind | listText | primaryLabel |
| --- | --- | --- | --- | --- |
| `schedulingEnabledAt` | concluidos | with_supervision | (main) | null |
| active denial | agir | send_guide | `Plano negou: enviar a guia de novo` | `Registrar guia enviada` |
| active more-docs, chased, `missingDocs` empty | agir | send_guide | `Documentos chegaram: reenviar a guia` | `Registrar guia enviada` |
| active more-docs, chased less than 3 days ago | familia | wait_family | `Plano pediu mais documentos: aguardando a família` | `Enviar lembrete` if `remindKeys` non-empty, else `Abrir conversa no Chat` |
| active more-docs, not chased | agir | plan_more_docs | `Plano pediu mais documentos` | `Pedir documentos à família` if `moreDocsKeys` non-empty, else `Abrir conversa no Chat` |
| active more-docs, chased 3+ days ago | agir | plan_more_docs | `Plano pediu mais documentos: família sem resposta há N dias` | same as previous row |
| otherwise | main's existing `computeGroup` / `computeStep`, unchanged |

Copy: denial step title `Enviar a guia de novo`, description `O plano negou a guia. Ajuste o que for preciso e envie de novo.` plus ` Ainda faltam documentos: o plano pode negar de novo.` when `missingCount > 0`. More-docs step title `O plano pediu mais documentos`, description `Peça à família o que o plano pediu. Quando chegar, registre a guia enviada de novo.` `moreDocsKeys` = all `missingDocs` keys when more-docs is active, else `[]`. Trail: denial `["done","current","locked","locked"]`; more-docs `["current","locked","locked","locked"]`. History texts: `Plano negou a guia.` and `Plano pediu mais documentos.` The 3-day rule applies ONLY to the more-docs path (main's ordinary "Aguardando família" keeps its current behavior; see Risks).

- [ ] **Step 1: Write the failing tests** in `tests/fila-model-pure.test.ts`

Update every existing `buildFilaItem(x)` call to `buildFilaItem(x, NOW)`. Port the four `activePlanOutcome` tests from `git show 453c37d:tests/intake-queue-build-pure.test.ts` (names starting `activePlanOutcome:`), importing from `../lib/fila/fila-model-pure.ts`. Add:

```ts
const P = (over: Partial<FilaSource["pipeline"]>) => ({ ...base.pipeline, ...over });

test("plano negou: volta para Agir agora no passo de enviar a guia, mesmo com documento faltando", () => {
  const i = buildFilaItem(src({ missingCount: 1, missingDocs: [LAUDO], pipeline: P({ planDeniedAt: ago(1) }) }), NOW);
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "send_guide");
  assert.equal(i.planOutcome, "denied");
  assert.match(i.step.description, /pode negar de novo/);
  assert.deepEqual(trailStates(i), ["done", "current", "locked", "locked"]);
});

test("negativa resolvida: guia reenviada depois dela volta para Aguardando plano", () => {
  const i = buildFilaItem(src({ pipeline: P({ authorization: "enviada", guideSentAt: ago(0), planDeniedAt: ago(1) }) }), NOW);
  assert.equal(i.group, "plano");
  assert.equal(i.planOutcome, null);
});

test("pediu mais documentos sem cobrança: Agir agora, pedir o que falta", () => {
  const i = buildFilaItem(src({ missingCount: 1, missingDocs: [LAUDO], pipeline: P({ planAskedMoreDocsAt: ago(1) }) }), NOW);
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "plan_more_docs");
  assert.deepEqual(i.moreDocsKeys, ["laudo_medico"]);
  assert.equal(i.step.primaryLabel, "Pedir documentos à família");
  assert.deepEqual(trailStates(i), ["current", "locked", "locked", "locked"]);
});

test("pediu mais documentos e nada rastreável falta: botão abre o Chat, nunca uma mensagem vazia", () => {
  const i = buildFilaItem(src({ pipeline: P({ planAskedMoreDocsAt: ago(1) }) }), NOW);
  assert.deepEqual(i.moreDocsKeys, []);
  assert.equal(i.step.primaryLabel, "Abrir conversa no Chat");
});

test("cobrada depois do pedido há menos de 3 dias: Aguardando família; 3 dias ou mais: volta para Agir agora", () => {
  const fresh = buildFilaItem(src({ missingCount: 1, missingDocs: [LAUDO], documentRequests: [{ key: "laudo_medico", sentAt: ago(2) }], pipeline: P({ planAskedMoreDocsAt: ago(2.5) }) }), NOW);
  assert.equal(fresh.group, "familia");
  assert.equal(fresh.step.kind, "wait_family");
  const stale = buildFilaItem(src({ missingCount: 1, missingDocs: [LAUDO], documentRequests: [{ key: "laudo_medico", sentAt: ago(3) }], pipeline: P({ planAskedMoreDocsAt: ago(4) }) }), NOW);
  assert.equal(stale.group, "agir");
  assert.match(stale.step.listText, /sem resposta há 3 dias/);
});

test("cobrança anterior ao pedido do plano não conta como cobrança", () => {
  const i = buildFilaItem(src({ missingCount: 1, missingDocs: [LAUDO], documentRequests: [{ key: "laudo_medico", sentAt: ago(2) }], pipeline: P({ planAskedMoreDocsAt: ago(1) }) }), NOW);
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "plan_more_docs");
});

test("documentos chegaram depois da cobrança: reenviar a guia", () => {
  const i = buildFilaItem(src({ documentRequests: [{ key: "laudo_medico", sentAt: ago(1) }], pipeline: P({ planAskedMoreDocsAt: ago(2) }) }), NOW);
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "send_guide");
  assert.match(i.step.listText, /reenviar/);
});

test("habilitado vence negativa e pedido de documentos", () => {
  const i = buildFilaItem(src({ pipeline: P({ authorization: "autorizada", schedulingEnabledAt: ago(0), planDeniedAt: ago(1) }) }), NOW);
  assert.equal(i.group, "concluidos");
});

test("histórico mostra negativa e pedido de documentos", () => {
  const h = buildHistory({ createdAt: ago(5), pipeline: { guideSentAt: null, guideSentByName: null, authorizedAt: null, authorizedByName: null, schedulingEnabledAt: null, returned: null, planDeniedAt: ago(2), planAskedMoreDocsAt: ago(1) }, documentRequests: [] });
  assert.deepEqual(h.slice(0, 2).map((e) => e.text), ["Plano pediu mais documentos.", "Plano negou a guia."]);
});

test("soma dos grupos continua igual ao total com casos de negativa e pedido de documentos", () => {
  const items = [P({ planDeniedAt: ago(1) }), P({ planAskedMoreDocsAt: ago(1) }), P({ authorization: "enviada", guideSentAt: ago(1) }), P({ schedulingEnabledAt: ago(1) })].map((p) => buildFilaItem(src({ pipeline: p }), NOW));
  const c = countByGroup(items, { mine: false, userId: null, query: "" });
  assert.equal(c.agir + c.familia + c.plano + c.concluidos, items.length);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types --test tests/fila-model-pure.test.ts`
Expected: FAIL (`activePlanOutcome` not exported, new kinds absent).

- [ ] **Step 3: Implement** the interfaces and decision table in `lib/fila/fila-model-pure.ts`

Compute `activePlanOutcome` once in `buildFilaItem` and pass the result into `computeGroup` / `computeStep` together with `nowMs`; keep main's branches untouched for the "otherwise" row. In `fila-source.ts` map `guideSentAt`, `planDeniedAt`, `planAskedMoreDocsAt` from `draft.pipeline`. Update the migration comment's reference line.

- [ ] **Step 4: Run tests**

Run: `npm test && npm run typecheck`
Expected: PASS (fix `fila-workspace.tsx`/`fila-detail.tsx` only if typecheck requires; `trailStates(item)` keeps working because `FilaItem` carries `planOutcome`).

- [ ] **Step 5: Commit**

```bash
git add lib/fila tests/fila-model-pure.test.ts supabase/migrations/20261110120000_intake_plan_outcomes.sql
git commit -m "feat(fila): plano negou e plano pediu mais documentos no modelo da Fila"
```

---

### Task 3: Chat summary uses the Fila vocabulary

**Files:**
- Modify: `lib/fila/fila-model-pure.ts`, `lib/fila/fila-source.ts`, `lib/atendimento/case-summary-pure.ts`, `app/recepcao/atendimento/case-summary-actions.ts`, `lib/draft-pipeline-steps-pure.ts` (remove `pipelineStageLabel`, now orphan), `tests/case-summary-pure.test.ts`, `tests/fila-model-pure.test.ts`, `tests/draft-pipeline-steps-pure.test.ts` (remove the `pipelineStageLabel` cases)

**Interfaces:**
- Consumes: `buildFilaItem(src, nowMs)` from Task 2.
- Produces:
  - `export function filaStageSummary(item: FilaItem): { label: string; allDone: boolean }` in `fila-model-pure.ts`: `{ label: item.step.listText, allDone: item.group === "concluidos" }`.
  - `export function draftToFilaSource(draft: PendingRegistrationDraft, queue: { id: string; patientName: string; assignedToId: string | null; assignedToName: string | null; overdue: boolean; postponed: boolean }): FilaSource` in `fila-source.ts`; `toFilaSource` delegates to it.
  - `CaseDraftInput.stage: { label: string; allDone: boolean }` replaces the `pipelineStageLabel(draft.pipeline)` call in `buildCaseSummary`.

- [ ] **Step 1: Write the failing tests**

`tests/fila-model-pure.test.ts`:
```ts
test("resumo da etapa para o Chat usa a mesma frase da lista", () => {
  assert.deepEqual(filaStageSummary(buildFilaItem(src(), NOW)), { label: "Enviar a guia ao plano", allDone: false });
  const done = buildFilaItem(src({ pipeline: P({ authorization: "autorizada", schedulingEnabledAt: ago(1) }) }), NOW);
  assert.equal(filaStageSummary(done).allDone, true);
});
```
`tests/case-summary-pure.test.ts`: every draft fixture gets `stage`; replace the expected `"Etapa 2/4 · Guia enviada ao plano"` with the fixture's `stage` passthrough, e.g. `stage: { label: "Pedir à família: carteirinha, laudo médico", allDone: false }` and `assert.deepEqual(s.stage, { label: "Pedir à família: carteirinha, laudo médico", allDone: false })`; keep the `next.kind` assertions (they depend on `allDone`). Add a static guard:
```ts
test("o resumo do Chat não usa vocabulário de etapa próprio", () => {
  const src = readFileSync("lib/atendimento/case-summary-pure.ts", "utf8");
  assert.doesNotMatch(src, /pipelineStageLabel|intakeStageLabel|de 4 ·|Etapa \d\/4/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --experimental-strip-types --test tests/fila-model-pure.test.ts tests/case-summary-pure.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`case-summary-actions.ts` builds `stage: filaStageSummary(buildFilaItem(draftToFilaSource(draftFull, { id: draftFull.id, patientName: draftFull.patientName ?? "", assignedToId: null, assignedToName: null, overdue: false, postponed: false }), Date.now()))`. Remove `pipelineStageLabel` from `draft-pipeline-steps-pure.ts` and its test cases after `git grep pipelineStageLabel` shows no other user.

- [ ] **Step 4: Run checks**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib app/recepcao/atendimento tests
git commit -m "refactor(chat): resumo do caso usa a etapa do modelo da Fila"
```

---

### Task 4: One restore-style undo on the server, no undo for WhatsApp

**Files:**
- Modify: `lib/intake-undo-pure.ts`, `tests/intake-undo-pure.test.ts`, `app/recepcao/pacientes/pendencias/intake-actions.ts`
- Create: `tests/intake-actions-static.test.ts`

**Interfaces:**
- Consumes: `markGuideSent`, `undoGuideSent`, `waiveDraftAuthorization` from `draft-pipeline-actions.ts` (all `(draftId: string) => Promise<ActionResult>`).
- Produces:
  - `UndoKind = "guide_sent" | "waive" | "plan_denied" | "plan_more_docs"` (remove `"scheduling"` and `"authorization"`: they undo WhatsApp-sending actions, which the owner forbids).
  - `DraftStateRow` and `DRAFT_STATE_COLUMNS` gain `plan_denied_by`, `plan_more_docs_by` (type `"uuid"`).
  - `RESTORE_COLUMNS.plan_denied = ["plan_denied_at","plan_denied_by","guide_sent_at","guide_sent_by"]`, `EXPECT_COLUMNS.plan_denied = ["plan_denied_at","guide_sent_at","plan_authorized_at","authorization_waived","scheduling_enabled_at"]`; same shape for `plan_more_docs` with the `plan_more_docs_*` columns.
  - In `intake-actions.ts`, exported server actions (all return `UndoableResult` unless noted):
    - `intakeMarkGuideSent(draftId)` (exists)
    - `intakeUnmarkGuideSent(draftId)`: `withUndo(draftId, "guide_sent", () => undoGuideSent(draftId))`
    - `intakeWaiveAuthorization(draftId)` (exists)
    - `intakeDenyPlan(draftId)`: `withUndo(draftId, "plan_denied", () => markPlanOutcome(draftId, "denied"))`
    - `intakePlanAskedMoreDocs(draftId)`: same with `"plan_more_docs"`
    - `restoreIntakeState(draftId, token): Promise<ActionResult>` (exists)
  - `markPlanOutcome(draftId, kind)` becomes internal and returns `{ success: true } | { success: false; error: string }` (same checks and compare-and-set update as today).
  - Removed: `denyPlan`, `undoDenyPlan`, `planAskedMoreDocs`, `undoPlanAskedMoreDocs`, `PlanOutcomeUndo`, `PlanOutcomeResult`, `intakeEnableScheduling`, `intakeDisableScheduling`, `intakeRegisterAuthorizedGuide`, `authorizedGuideGoesToRecord`, `AuthorizedUploadResult`.
  - `withUndo`: when `readState` returns `MISSING_COLUMNS`, it still runs the action and returns `{ success: true, note, undo: null }` (main's actions keep working before the migration). `markPlanOutcome` keeps returning `INTAKE_MIGRATION_PENDING_MESSAGE` itself.
  - `refresh()` revalidates `/recepcao/fila` instead of `/recepcao/a-autorizar`.

- [ ] **Step 1: Write the failing tests**

`tests/intake-undo-pure.test.ts`: delete the three tests for scheduling/authorization ("retirar habilitação", "habilitar caso devolvido", "guia autorizada gravada no prontuário"); extend the row fixture with `plan_denied_by: null, plan_more_docs_by: null`; add:
```ts
test("plano negou: desfazer devolve a guia enviada e a negativa anterior", () => {
  const before = row({ guide_sent_at: T1, guide_sent_by: U1, plan_denied_at: null, plan_denied_by: null });
  const after = row({ guide_sent_at: null, guide_sent_by: null, plan_denied_at: T2, plan_denied_by: U2 });
  const token = buildUndoToken("plan_denied", before, after)!;
  assert.deepEqual(token.previous, { plan_denied_at: null, plan_denied_by: null, guide_sent_at: T1, guide_sent_by: U1 });
  assert.deepEqual(decideRestore(token, after), { ok: true, update: token.previous });
  assert.deepEqual(decideRestore(token, { ...after, guide_sent_at: T3 }), { ok: false, reason: "changed" });
});
test("validateUndoToken recusa os tipos que mandam WhatsApp", () => {
  for (const kind of ["scheduling", "authorization"]) assert.equal(validateUndoToken({ kind, previous: {}, applied: {}, patient: null }), null);
});
```
(`row`, `T1..T3`, `U1..U2` are the file's existing helpers/constants; add any missing constant with a fixed ISO/UUID.) Add the symmetric `plan_more_docs` test.

`tests/intake-actions-static.test.ts` (source checks, the repo's pattern for server code without a DB):
```ts
const src = readFileSync("app/recepcao/pacientes/pendencias/intake-actions.ts", "utf8");
test("só ações sem WhatsApp têm desfazer", () => {
  assert.doesNotMatch(src, /enableDraftScheduling|registerAuthorizedGuide|disableDraftScheduling/);
  for (const name of ["intakeMarkGuideSent", "intakeUnmarkGuideSent", "intakeWaiveAuthorization", "intakeDenyPlan", "intakePlanAskedMoreDocs", "restoreIntakeState"]) assert.match(src, new RegExp(`export async function ${name}\\(`));
  assert.doesNotMatch(src, /export async function (denyPlan|undoDenyPlan|planAskedMoreDocs|undoPlanAskedMoreDocs)\(/);
});
test("sem a migration, withUndo executa a ação e devolve sem desfazer", () => {
  const fn = /async function withUndo[\s\S]*?\n}\n/.exec(src)?.[0] ?? "";
  assert.match(fn, /before === MISSING_COLUMNS\)[\s\S]*?await action\(\)[\s\S]*?undo: null/);
});
test("revalida a Fila, não a tela antiga", () => {
  assert.match(src, /revalidatePath\("\/recepcao\/fila"\)/);
  assert.doesNotMatch(src, /a-autorizar/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --experimental-strip-types --test tests/intake-undo-pure.test.ts tests/intake-actions-static.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the interfaces above in `lib/intake-undo-pure.ts` and `intake-actions.ts`.

- [ ] **Step 4: Run checks**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/intake-undo-pure.ts app/recepcao/pacientes/pendencias/intake-actions.ts tests/intake-undo-pure.test.ts tests/intake-actions-static.test.ts
git commit -m "refactor(fila): um desfazer so (restaura estado), sem desfazer para acoes que mandam WhatsApp"
```

---

### Task 5: Desfazer de 8 s, plan-outcome buttons and confirmation before "Plano autorizou" in the Fila UI

**Files:**
- Create: `lib/fila/fila-action-policy-pure.ts`, `tests/fila-action-policy-pure.test.ts`, `tests/fila-ui-static.test.ts`
- Modify: `app/recepcao/fila/fila-workspace.tsx`, `app/recepcao/fila/fila-detail.tsx`, `app/recepcao/fila/fila-next-step.tsx`

**Interfaces:**
- Consumes: Task 4 server actions; `useUndoToast(seconds, onUndone)` returning `{ toast, show, undo, dismiss }`, `UndoToast`, `UndoEntry = { draftId; message; undo: () => Promise<{success:true}|{success:false;error:string}> }` from `app/recepcao/fila/undo-toast.tsx`; `UNDO_SECONDS` from `undo-toast-pure.ts`; Task 2 `FilaItem.planOutcome`, `moreDocsKeys`, step kind `plan_more_docs`.
- Produces:
  - `export type FilaActionKey = "ask_documents" | "remind" | "more_docs_request" | "opener" | "guide_sent" | "guide_not_sent" | "waive" | "plan_denied" | "plan_more_docs" | "authorize_and_enable" | "enable_scheduling";`
  - `export const FILA_ACTION_POLICY: Record<FilaActionKey, { sendsWhatsApp: boolean; confirm: boolean; undo: boolean }>`: WhatsApp keys are `ask_documents`, `remind`, `more_docs_request`, `opener`, `authorize_and_enable`, `enable_scheduling`.
  - `FilaDetailPanel` and `FilaNextStep` gain prop `onUndoable: (entry: UndoEntry) => void`.

Behavior in `FilaNextStep` (only what changes from main):
- `send_guide` primary and "Guia reenviada ao plano": `intakeMarkGuideSent`; `waive`: `intakeWaiveAuthorization`; "A guia não foi enviada": `intakeUnmarkGuideSent`. On success with `undo` non-null call `onUndoable({ draftId: item.draftId, message, undo: () => restoreIntakeState(item.draftId, token) })`; with `undo: null` plain `toast(message + " (sem Desfazer)", "success")`. Remove the `undo`/`UNDO_MS` arguments from `toast()` and the imports of `undoGuideSent`, `undoDraftAuthorization`, `markGuideSent`, `waiveDraftAuthorization`.
- `wait_plan` secondaries: `Plano negou` (`intakeDenyPlan`, message `Negativa registrada. ${firstName} voltou para "Agir agora".`) and `Plano pediu mais documentos` (`intakePlanAskedMoreDocs`, message `Pedido do plano registrado. ${firstName} voltou para os documentos.`), both undoable, no confirmation.
- `plan_more_docs` primary: if `item.moreDocsKeys.length > 0`, `setConfirm("more_docs")` previewing and then sending `item.moreDocsKeys` with `requestMissingDocument` (same loop as `ask`); else a `Link` to `chatHref({ phone })` labeled `step.primaryLabel`. Secondary: `Guia reenviada ao plano`. `wait_family` with `remindKeys` empty renders the same Chat link.
- `send_guide` with `item.planOutcome === "denied"` shows a status line above the primary: `O plano negou a guia.` (history shows the date).
- "Plano autorizou" (finding I2): `AuthorizedGuideDialog.onConfirm` no longer saves. It stores the values in state `pendingGuide` and sets `confirm = "authorize"`, which renders `Ao salvar, a guia fica registrada e a família recebe os horários da 1ª avaliação por WhatsApp. Isso não pode ser desfeito.` with buttons `Salvar e enviar horários` / `Cancelar`. Only that button calls `registerAuthorizedGuide` then `enableDraftScheduling`. No Desfazer.
- `FilaWorkspace` owns `const undoToast = useUndoToast(UNDO_SECONDS, () => router.refresh())`, passes `undoToast.show` down and renders `<UndoToast toast={undoToast.toast} onUndo={undoToast.undo} onDismiss={undoToast.dismiss} />` once.
- Every action and confirm button: `disabled={isPending || locked}` (`locked` arrives in Task 6; until then pass `false`).

- [ ] **Step 1: Write the failing tests**

`tests/fila-action-policy-pure.test.ts`:
```ts
test("quem manda WhatsApp pede confirmação e não tem desfazer; o resto tem desfazer sem confirmação", () => {
  for (const [key, p] of Object.entries(FILA_ACTION_POLICY)) {
    if (p.sendsWhatsApp) assert.deepEqual([p.confirm, p.undo], [true, false], key);
    else assert.deepEqual([p.confirm, p.undo], [false, true], key);
  }
});
test("habilitar e plano autorizou contam como envio de WhatsApp (oferta de horários)", () => {
  assert.equal(FILA_ACTION_POLICY.enable_scheduling.sendsWhatsApp, true);
  assert.equal(FILA_ACTION_POLICY.authorize_and_enable.sendsWhatsApp, true);
});
```
`tests/fila-ui-static.test.ts`:
```ts
const step = readFileSync("app/recepcao/fila/fila-next-step.tsx", "utf8");
const ws = readFileSync("app/recepcao/fila/fila-workspace.tsx", "utf8");
test("desfazer da Fila é o restaurador, nunca as ações antigas de desfazer", () => {
  assert.doesNotMatch(step, /\bundoGuideSent\b|\bundoDraftAuthorization\b|UNDO_MS/);
  assert.match(step, /restoreIntakeState\(item\.draftId/);
  assert.match(ws, /useUndoToast\(UNDO_SECONDS/);
  assert.match(ws, /<UndoToast /);
});
test("plano autorizou só grava depois da confirmação", () => {
  const dialog = /<AuthorizedGuideDialog[\s\S]*?\/>/.exec(step)?.[0] ?? "";
  assert.doesNotMatch(dialog, /registerAuthorizedGuide|enableDraftScheduling/);
  assert.match(step, /Salvar e enviar horários/);
});
test("botões de confirmação travam enquanto envia", () => {
  assert.match(step, /disabled=\{isPending \|\| locked\}/);
});
test("plano negou e pediu mais documentos aparecem em Aguardando plano", () => {
  assert.match(step, /intakeDenyPlan\(item\.draftId\)/);
  assert.match(step, /intakePlanAskedMoreDocs\(item\.draftId\)/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --experimental-strip-types --test tests/fila-action-policy-pure.test.ts tests/fila-ui-static.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the policy file and the UI behavior above. Read the policy in `FilaNextStep` when deciding whether a key confirms or offers Desfazer, so the table is the single source.

- [ ] **Step 4: Run checks**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/fila/fila-action-policy-pure.ts app/recepcao/fila tests/fila-action-policy-pure.test.ts tests/fila-ui-static.test.ts
git commit -m "feat(fila): desfazer de 8 s, plano negou/pediu documentos e confirmacao antes de enviar horarios"
```

---

### Task 6: Detail on demand from the same consolidated draft (route handler, no merge persistence)

Read first: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `.../03-file-conventions/route.md`, `.../03-file-conventions/dynamic-routes.md`.

Decision: replace main's server action `getFilaDetail` (unconsolidated `getSingleRegistrationDraft`, and server actions run one at a time on the client, so fast switching queues behind writes) with a GET route handler. Keep main's `FilaDetail` shape (lighter than the full draft). Avoid the full-queue reload (I4): the list item carries the ids of the drafts merged into it; the route consolidates only those, so the result equals the list's consolidated draft at a fraction of the cost. GET never persists merges.

**Files:**
- Create: `lib/fila/fila-detail-pure.ts`, `tests/fila-detail.test.ts`, `app/api/recepcao/fila/[draftId]/route.ts`
- Delete: `app/api/recepcao/fila-de-entrada/[draftId]/route.ts`, `app/recepcao/fila/fila-detail-action.ts`
- Modify: `lib/draft-merge.ts`, `lib/reception-queue.ts`, `lib/fila/fila-model-pure.ts`, `lib/fila/fila-source.ts`, `app/recepcao/fila/fila-detail.tsx`, `app/recepcao/fila/fila-next-step.tsx`, `app/recepcao/fila/page.tsx`, `tests/draft-merge.test.ts`, `tests/fila-model-pure.test.ts`

**Interfaces:**
- `lib/draft-merge.ts`: merged output gains `mergedDraftIds: string[]` (primary first, then the others in group order); `consolidateRegistrationDrafts(drafts, pendencySources, rawExtractedByDraft?, opts: { persist?: boolean } = {})`, default `persist: true`; when `false` the `after`/`persistDraftMergeInDb` block is skipped.
- `lib/reception-queue.ts`: `getPendingRegistrationDrafts(supabase, clinicId, opts: { onlyIds?: string[]; persistMerge?: boolean } = {})` (adds `.in("id", onlyIds)` to both selects when given); `getConsolidatedRegistrationDraft(supabase: Supa, draftId: string, memberIds: string[], clinicId = DEV_CLINIC_ID): Promise<PendingRegistrationDraft | null>` calls it with `{ onlyIds: memberIds, persistMerge: false }`, then `pickConsolidatedDraft(...) ?? getSingleRegistrationDraft(...)`.
- `FilaSource.memberDraftIds?: string[]`, `FilaItem.memberDraftIds: string[]` (default `[draftId]`); `fila-source.ts` maps `draft.mergedDraftIds ?? [draft.id]`.
- `export function findFilaItem(items: FilaItem[], requested: string): FilaItem | null` in `fila-model-pure.ts` (matches `id`, `draftId` or any `memberDraftIds`); `page.tsx` uses it for `?item=`.
- `lib/fila/fila-detail-pure.ts`:
  - `export type FilaDetail` (main's type moved here; `pipeline` gains `planDeniedAt: string | null; planAskedMoreDocsAt: string | null`).
  - `export function toFilaDetail(draft: FilaDetailSource): FilaDetail` where `FilaDetailSource` is the structural subset of `PendingRegistrationDraft` main's action read (copy the field list from `fila-detail-action.ts`).
  - `export const MAX_MEMBER_IDS = 20;`
  - `export function parseMemberIds(raw: string | null, draftId: string): string[] | null`: `null` raw gives `[draftId]`; otherwise split on `,`, every id must match the UUID regex, list length 1..20, must contain `draftId`, else `null`.
  - `export type DetailLoad = { status: "loading"; requestId: number } | { status: "refreshing"; requestId: number; detail: FilaDetail } | { status: "ready"; detail: FilaDetail } | { status: "error"; requestId: number; kind: "auth" | "other"; message: string; detail: FilaDetail | null };`
  - `export function detailLoadReducer(state: DetailLoad, event: { type: "start"; requestId: number } | { type: "success"; requestId: number; detail: FilaDetail } | { type: "fail"; requestId: number; kind: "auth" | "other"; message: string }): DetailLoad`: `start` keeps the current detail as `refreshing` when there is one; `success`/`fail` with a `requestId` other than the pending one are ignored.
  - `export function isDetailLocked(state: DetailLoad): boolean`: true unless `ready`.
- Route `GET /api/recepcao/fila/[draftId]?ids=a,b`: session first (401 `{ error: "unauthenticated" }`), then `isUuid(draftId)` and `parseMemberIds` (400 `Caso inválido.`), then `getConsolidatedRegistrationDraft` (404 `Este caso não foi encontrado.`), respond `toFilaDetail(draft)`; every response `Cache-Control: private, no-store`. Session client only (RLS).
- Client (`fila-detail.tsx`): fetch with `AbortController`, `cache: "no-store"`, a new `requestId` per fetch, dispatching into `detailLoadReducer`. 401 gives kind `auth` with message `Sua sessão expirou. Entre de novo.` and a `Link` to `/login`; other errors show `Tentar de novo`. While `refreshing` show `Atualizando…`. Pass `locked={isDetailLocked(load)}` to `FilaNextStep`.

- [ ] **Step 1: Write the failing tests**

`tests/fila-detail.test.ts`:
```ts
test("pickConsolidatedDraft escolhe o caso consolidado pelo id, sem inventar", () => { /* port verbatim from git show 453c37d:tests/intake-detail-consistency.test.ts */ });
test("parseMemberIds: sem ids usa o próprio caso; recusa id inválido, lista longa ou sem o caso", () => {
  const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
  assert.deepEqual(parseMemberIds(null, A), [A]);
  assert.deepEqual(parseMemberIds(`${A},${B}`, A), [A, B]);
  assert.equal(parseMemberIds(`${B}`, A), null);
  assert.equal(parseMemberIds(`${A},nope`, A), null);
  assert.equal(parseMemberIds(Array(21).fill(A).join(","), A), null);
});
test("resposta antiga não sobrescreve a busca mais nova; a rebusca mantém o detalhe e trava as ações", () => {
  let s = detailLoadReducer({ status: "loading", requestId: 1 }, { type: "start", requestId: 2 });
  s = detailLoadReducer(s, { type: "success", requestId: 1, detail: D1 });
  assert.equal(s.status, "loading");
  s = detailLoadReducer(s, { type: "success", requestId: 2, detail: D2 });
  assert.deepEqual(s, { status: "ready", detail: D2 });
  s = detailLoadReducer(s, { type: "start", requestId: 3 });
  assert.equal(s.status, "refreshing");
  assert.equal(isDetailLocked(s), true);
  s = detailLoadReducer(s, { type: "fail", requestId: 3, kind: "auth", message: "Sua sessão expirou. Entre de novo." });
  assert.equal(s.status === "error" && s.kind, "auth");
});
test("toFilaDetail leva as marcas do plano e não leva campos pesados além do que o detalhe usa", () => {
  const d = toFilaDetail(SOURCE);
  assert.equal(d.pipeline.planDeniedAt, SOURCE.pipeline.planDeniedAt);
  assert.deepEqual(Object.keys(d).sort(), ["createdAt","documentRequests","draftId","error","facts","files","mergedDraftsCount","patientName","pills","pipeline","status","warnings"]);
});
test("rota: sessão antes do id, 401 JSON sem cache, consolidado sem persistir, nunca o avulso como primeira fonte", () => {
  const route = readFileSync("app/api/recepcao/fila/[draftId]/route.ts", "utf8").replace(/\/\/.*$/gm, "");
  assert.ok(route.indexOf("getUser()") < route.indexOf("isUuid(draftId)"));
  assert.match(route, /\{ error: "unauthenticated" \}, \{ status: 401, headers: NO_STORE \}/);
  assert.match(route, /getConsolidatedRegistrationDraft\(/);
  assert.doesNotMatch(route, /getSingleRegistrationDraft/);
  const lib = readFileSync("lib/reception-queue.ts", "utf8");
  const fn = /export async function getConsolidatedRegistrationDraft[\s\S]*?\n}\n/.exec(lib)?.[0] ?? "";
  assert.match(fn, /persistMerge: false/);
  assert.match(fn, /onlyIds: memberIds/);
});
test("a tela não usa mais a server action de detalhe", () => {
  assert.equal(existsSync("app/recepcao/fila/fila-detail-action.ts"), false);
  assert.match(readFileSync("app/recepcao/fila/fila-detail.tsx", "utf8"), /\/api\/recepcao\/fila\/\$\{item\.draftId\}\?ids=/);
});
```
(`D1`, `D2`, `SOURCE` are minimal fixtures defined at the top of the file.)

`tests/draft-merge.test.ts`, inside or next to the existing group test:
```ts
assert.deepEqual(merged.mergedDraftIds, [merged.id, ...groups[0].map((d) => d.id).filter((id) => id !== merged.id)]);
```
plus a static guard that `consolidateRegistrationDrafts` wraps the persistence block in `if (opts.persist !== false)`.

`tests/fila-model-pure.test.ts`:
```ts
test("?item= acha a família pelo item, pelo rascunho principal ou por um rascunho mesclado", () => {
  const i = buildFilaItem(src({ memberDraftIds: ["d1", "d9"] }), NOW);
  assert.equal(findFilaItem([i], "d9")?.id, "q1");
  assert.equal(findFilaItem([i], "q1")?.id, "q1");
  assert.equal(findFilaItem([i], "zz"), null);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --experimental-strip-types --test tests/fila-detail.test.ts tests/draft-merge.test.ts tests/fila-model-pure.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the interfaces above; delete the old route directory and `fila-detail-action.ts`; update the comment in `lib/fila/load-fila.ts` only if it mentions the action.

- [ ] **Step 4: Run checks**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS; build lists `ƒ /api/recepcao/fila/[draftId]` and no `fila-de-entrada` route.

- [ ] **Step 5: Commit**

```bash
git add -A lib app tests
git commit -m "feat(fila): detalhe sob demanda do mesmo caso consolidado da lista, sem recarregar a fila inteira"
```

---

### Task 7: 14 px text and 40 px targets on the Fila screen

**Files:**
- Create: `tests/fila-a11y-static.test.ts` (start from `git show 453c37d:tests/intake-a11y-static.test.ts`)
- Modify: `app/recepcao/fila/*.tsx` where the test reports violations

**Interfaces:**
- Scanner input: every `app/recepcao/fila/*.tsx` (expected today: `error.tsx`, `fila-detail.tsx`, `fila-next-step.tsx`, `fila-workspace.tsx`, `loading.tsx`, `page.tsx`, `undo-toast.tsx`).
- `hasMinHeight40(classes)` also accepts the unprefixed tokens `btn` and `input` (globals.css: `.btn` has `min-height: 48px`, `.input` has `min-height: 44px`).
- `TARGET_EXCEPTIONS` (closed list): the inline "Enviar a mensagem de abertura" button inside the 24 h sentence in `fila-next-step.tsx` (WCAG 2.5.8 inline target). No other exception.
- Imported shared components (`MoveToLastButton`, `ReassignOwnerButton`, `DraftAdjustButton`, `AuthorizedGuideDialog`) are not scanned (see Risks).

- [ ] **Step 1: Write the test**

Retarget `DIR` to `app/recepcao/fila`, list all `.tsx` files, replace the "files found" test with one requiring the seven names above, drop the `PrimaryButton/SecondaryButton` test, lower the scanner guard to `scanned >= 15`, and add:
```ts
test("btn e input valem como 40 px porque o CSS garante", () => {
  assert.equal(hasMinHeight40("btn btn-secondary"), true);
  assert.equal(hasMinHeight40("input w-full"), true);
  assert.equal(hasMinHeight40("md:btn"), false);
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(/\n\.btn \{[\s\S]*?\}/.exec(css)?.[0] ?? "", /min-height: 48px/);
  assert.match(/\n\.input \{[\s\S]*?\}/.exec(css)?.[0] ?? "", /min-height: 44px/);
});
```

- [ ] **Step 2: Run to see the violations**

Run: `node --experimental-strip-types --test tests/fila-a11y-static.test.ts`
Expected: FAIL listing at least `fila-next-step.tsx` `uppercase` ("Próximo passo"), the list row buttons and "Ir para" button in `fila-workspace.tsx`, `<summary>` and footer `Link`s and "Tentar de novo" in `fila-detail.tsx`/`fila-next-step.tsx`.

- [ ] **Step 3: Fix** each reported line: remove `uppercase tracking-wide`; add `min-h-10` (and `inline-flex items-center` on links/summary); raise any `text-xs` or `text-[<14px]` to `text-sm`.

- [ ] **Step 4: Run checks**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/fila-a11y-static.test.ts app/recepcao/fila
git commit -m "fix(fila): texto minimo de 14 px e alvos de 40 px na Fila de entrada"
```

---

### Task 8: Final verification and owner gate (STOP before any deploy or migration)

**Files:** none changed unless a check fails.

- [ ] **Step 1: Full checks**

Run: `npm ci` (only if `node_modules` is stale) then `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 2: Diff audit against main**

Run:
```bash
git diff --stat origin/main
git diff origin/main -- app/recepcao/a-autorizar components/page-header.tsx components/recepcao-nav.tsx
LC_ALL=C.UTF-8 git grep -nP "\x{2014}|\x{2013}" -- app lib tests supabase docs/superpowers/plans/2026-11-10-fila-port-na-main.md
```
Expected: second command empty (Autorizações identical to main); third command empty (no em/en dashes in touched areas; pre-existing hits outside touched files may be ignored but list them).

- [ ] **Step 3: Write the owner gate in the PR description (do not run any of it)**

The PR description lists, as unchecked items for the owner:
1. Approve applying `20261110120000_intake_plan_outcomes.sql`, and to which project. Until then "Plano negou" / "Plano pediu mais documentos" answer `Esta ação precisa da atualização do banco de dados (migration pendente).` and the other actions run without Desfazer.
2. Approve a deployment. Any Vercel preview uses production Supabase and Twilio: opening the Fila there and clicking a WhatsApp action sends a real message to a real family. Recommended: a separate Supabase project and Twilio sandbox for preview before phase 6 (the Supabase branch `ojllbeuosmgfhuamsqvl` is `MIGRATIONS_FAILED` with 0 public tables).
3. Confirm the scope choices in Risks below.

- [ ] **Step 4: Stop.** Do not deploy, do not apply migrations, do not open a preview, do not merge. Report to the owner.

---

## Risks and open decisions for the owner

- 3-day rule scope: applied only to "Plano pediu mais documentos". Main's ordinary "Aguardando família" still never returns to "Agir agora" by time. Extending it is a one-line change in `computeGroup` plus tests; needs the owner's yes.
- A chase done by free text in the Chat (not a document request) is invisible to the model; a more-docs case then stays in "Agir agora" until "Guia reenviada ao plano" is clicked.
- Shared components rendered inside the Fila (`MoveToLastButton`, `ReassignOwnerButton`, `DraftAdjustButton`, `AuthorizedGuideDialog`) still use 11 to 13 px text and small targets, and their actions (deixar para depois, reatribuir, ajustar cadastro) have no 8 s Desfazer. They are shared with Pendências; fixing them is a separate change.
- Undo token is client-held (shape-validated, whitelisted columns, compare-and-set), not signed; patient status restore is not atomic with the draft restore (carried from the previous review).
- Two toast systems on the same screen (the app toast for plain messages, `UndoToast` for Desfazer). Acceptable, but they can stack.
- Restoring `draft-pipeline.tsx` to main brings back main's step-number bug (columns numbered 2 to 5, final-review I3) on the old Autorizações/Pendências pipeline. The owner asked for main's version exactly; the one-line fix (`index` instead of `index + 1`) can go in a separate PR.
- Detail consistency relies on the list's `memberDraftIds` from the same page render. If a new conversation merges into the family after the page loaded, the detail shows the group as the list saw it until the next refresh (by design: list and detail never diverge).
