# Evolução clínica mínima — Design

**Data:** 2026-09-04
**Origem:** PRD §14 backlog item 5 ("Evolução estruturada + assinatura + versão + offline"), regras em §9.4, home do terapeuta em §11 (arquitetura) e no princípio 2 (§3: "evolução em 2 minutos").
**Depende de:** check-in/check-out da sessão (`app/recepcao/agenda/`, PR #2 — sessões chegam a `status='realizada'` de verdade pela primeira vez), seed de dev (`lib/supabase/admin.ts`, `lib/constants.ts`).
**Não inclui:** metas/`plan_goals` (Fase 2 — plano terapêutico não existe), coleta ABA por tentativa/`trial_data` (depende de `programs`, que depende de `plan_goals`), anexo de foto/vídeo (depende do módulo de anexos, item 6 do backlog, ainda não construído), rascunho offline-first com IndexedDB/PWA (entrega separada — decisão explícita, ver Escopo), PIN de verificação de assinatura (sem auth real ainda).

## Contexto

`/terapeuta` hoje é um scaffold mockado (`MeasurementCard`s zerados, sem query nenhuma). O schema já tem tudo que a evolução mínima precisa: `session_notes` (append-only, `structured jsonb` + `free_text`, `signed_at`) e a função `session_note_pending(appointment_id)` (já existe no banco: `true` quando a sessão está `realizada` e ainda não tem `session_notes`). Sem essa tela, nenhuma sessão realizada nunca ganha evolução, e as métricas que dependem disso (`note_24h_rate`, `data_collection_rate`, faturamento — que só fatura sessão com evolução) ficam sempre zeradas.

## Escopo (decisões tomadas com o usuário)

- **Identidade do terapeuta:** seletor no topo de `/terapeuta` ("Ver como: Ana Souza / Bruno Lima") — mesmo padrão de débito técnico já aceito no projeto (`DEV_RECEPTION_PROFILE_ID`), mas funcional pros dois terapeutas já seedados. Nenhum terapeuta novo é seedado nesta entrega.
- **Metas trabalhadas / resultado por meta:** fora do formulário nesta entrega — dependem de `plan_goals`, que só existe no schema (Fase 2, plano terapêutico). Entram numa entrega futura, quando o plano terapêutico existir.
- **Assinatura:** botão final "Confirmar e assinar" grava `signed_at = now()` sem campo de PIN (um PIN não verificaria identidade real sem auth) — mas o gatilho da regra "depois de assinada, só nova versão edita" fica valendo desde já, preservando o princípio de rastreabilidade do produto.
- **Offline-first:** fora desta entrega. O formulário assume rede disponível; se a conexão cair no meio do preenchimento, o terapeuta perde o que digitou (débito conhecido, documentado). PWA/IndexedDB/fila de sincronização é uma entrega separada e maior.
- **Anexo de foto/vídeo:** fora — depende do módulo de anexos (item 6 do backlog), que ainda não foi construído.

## Máquina de estado

`appointments.status = 'realizada'` (produzido pelo check-in/check-out do PR #2, ou por `markEvaluationDone` no fluxo de avaliação) sem nenhuma linha em `session_notes` → pendência. `session_note_pending(appointment_id)` já resolve essa checagem no banco; a UI só precisa chamá-la (ou replicar a mesma lógica em SQL: `status='realizada' and not exists (select 1 from session_notes where appointment_id = ...)`).

Depois que o terapeuta assina (Confirmar e assinar → `signed_at` setado), uma tentativa de editar **nunca faz UPDATE** na linha existente — grava uma nova linha com `version = anterior + 1` e `supersedes_id` apontando pra versão anterior. Esta entrega não constrói a UI de "editar depois de assinado" (não há necessidade ainda — toda evolução nasce assinada de uma vez, no fluxo linear "preencher → assinar"); só a regra de dados já nasce certa pro futuro.

## `/terapeuta` (home — ganha dado real)

Server Component. Query por terapeuta selecionado (via query param `?therapist=<id>`, sem cliente-side state — mesmo padrão de `/recepcao/agenda?date=`):

- **Sessões de hoje:** `appointments` do `therapist_id` selecionado, `starts_at` no dia civil de hoje (fuso da clínica, reusa `todayInTimeZone`/`zonedDateTimeToUtc` de `lib/timezone.ts`), com paciente e horário.
- **Evoluções pendentes:** sessões `realizada` do terapeuta selecionado (não restrito a hoje — uma sessão de ontem sem evolução continua pendente) sem `session_notes`, ordenadas pela mais antiga primeiro (mais urgente pro `note_24h_rate`). Cada uma linka pra `/terapeuta/evolucao/[appointmentId]`.
- Pendências aparecem **antes** das sessões de hoje na hierarquia visual (é o trabalho mais urgente, por isso o `description` atual do `PageHeader` já diz "Evoluções pendentes aparecem primeiro").

Seletor de terapeuta: `<select>` simples que muda o query param via `<form method="get">` — mesmo padrão do seletor de data da agenda.

## `/terapeuta/evolucao/[appointmentId]` (formulário)

Server Component busca a sessão (paciente, terapeuta, horário) e valida que está `realizada` e sem `session_notes` (senão, `notFound()` ou mensagem "evolução já registrada" com link pra ela — decisão de implementação, não de design: mostrar a versão mais recente em modo leitura é suficiente, sem edição nesta entrega).

Formulário (client component, mesmo padrão de `useTransition` + Server Action + erro em português já usado no projeto):

- **Presença e engajamento** — escala 1-5, botões de toque único (não dropdown — meta é 2 minutos, um toque por campo).
- **Comportamentos-alvo observados** — lista fixa (não vem de configuração do supervisor, que não existe ainda): Agitação, Estereotipia, Birra/crise, Autolesão, Agressividade, Choro, Recusa de atividade, Outro. Cada um selecionado ganha uma intensidade (leve/moderada/intensa). Múltipla seleção — nenhum comportamento observado é um estado válido (não obrigatório).
- **Orientação dada à família** — chips do §9.4, fixos: rotina, comunicação, alimentação, sono, escola, nenhuma. Múltipla seleção.
- **Texto livre** — opcional, textarea.
- **Confirmar e assinar** — único botão de submit. Grava tudo numa Server Action só.

### Server Action `createSessionNote`

```typescript
type ActionResult = { success: true } | { success: false; error: string };

createSessionNote(appointmentId: string, formData: FormData): Promise<ActionResult>
```

Validações antes de gravar:
- Sessão existe, está `realizada`, e não tem `session_notes` ainda (revalida no servidor — não confia só na checagem que already aconteceu no carregamento da página).
- Ao menos presença/engajamento preenchido (único campo que faz sentido exigir — o resto é genuinamente opcional per §9.4, incluindo "nenhum comportamento observado").

Grava em `session_notes`:
- `appointment_id`, `therapist_id` (do terapeuta selecionado na home — passado como campo oculto do formulário, já que não há sessão de auth pra extrair isso automaticamente).
- `version = 1`, `supersedes_id = null` (toda nota nesta entrega nasce na versão 1 — não há fluxo de reedição ainda).
- `structured` (jsonb): `{ presenca_engajamento: number, comportamentos: { tipo: string, intensidade: string }[], orientacoes: string[] }`.
- `free_text`: texto livre ou `null`.
- `created_at_device`: timestamp do clique em "Confirmar e assinar", capturado no cliente (`new Date().toISOString()`) — é o campo que existe justamente pra diferenciar de `created_at_server` quando offline-first existir; nesta entrega os dois ficam a poucos milissegundos um do outro, mas o campo já é preenchido corretamente.
- `created_at_server`: default do banco (`now()`).
- `signed_at`: `now()`, gravado na mesma inserção.

Depois de gravar com sucesso: `revalidatePath("/terapeuta")` (a pendência sai da lista) e redireciona pra `/terapeuta?therapist=<id>` (volta pra home, evolução já não aparece mais como pendente).

## Testes manuais (critério de aceite)

1. Com uma sessão `realizada` (via check-in/check-out do PR #2 ou `markEvaluationDone`) sem evolução: abrir `/terapeuta?therapist=<id-do-terapeuta-certo>`, confirmar que ela aparece na lista de pendências, clicar, preencher presença + 1 comportamento + 1 orientação + texto livre, "Confirmar e assinar".
2. Confirmar no banco: `session_notes` tem 1 linha, `structured` com os 3 campos certos, `signed_at` preenchido, `version=1`.
3. Voltar pra `/terapeuta` — a sessão não aparece mais em pendências.
4. Tentar preencher sem presença/engajamento → erro em português, sem gravar nada.
5. Trocar o seletor de terapeuta pro outro (Bruno Lima) — pendências e sessões de hoje mudam pra refletir o outro terapeuta.
6. Abrir a URL de uma evolução já registrada (`/terapeuta/evolucao/[appointmentId]` de uma sessão já com `session_notes`) — não deve permitir preencher de novo (mensagem clara, sem erro cru).

## Placeholder scan

Nenhum "TBD" — toda decisão de escopo (identidade do terapeuta, metas fora, assinatura sem PIN, offline fora, anexos fora) já está resolvida acima com a razão da escolha.
