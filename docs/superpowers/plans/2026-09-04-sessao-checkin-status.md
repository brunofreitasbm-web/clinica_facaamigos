# Sessão: check-in/check-out e status com motivo/autor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à recepção as ações de check-in, check-out e falta/cancelamento (com motivo e autor) sobre uma sessão da agenda, fazendo `appointments.status` chegar em `realizada` pela primeira vez fora do fluxo de avaliação.

**Architecture:** Painel lateral client-side sobre a grade já existente (`/recepcao/agenda`), aberto ao clicar num cartão de sessão. Server Actions fazem os `update` diretos na tabela `appointments` via cliente admin (service-role, sem RLS — mesmo padrão já usado em todo o projeto), mapeando erros do trigger `appointments_authorization_guard` (já existente no banco) para mensagens em português.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, `@supabase/supabase-js` (cliente admin service-role), Supabase Postgres (projeto `vththexblpxwocbowhsv`).

## Global Constraints

- Todo cliente admin (`lib/supabase/admin.ts`) só é importado por Server Actions e Server Components — nunca por um arquivo com `"use client"` (regra já em vigor no projeto).
- Toda Server Action retorna `{ success: true } | { success: false; error: string }` — nunca lança exceção sem tratamento pro client component.
- Mensagens de erro de constraint/trigger do Postgres nunca aparecem cruas na UI — sempre mapeadas para texto em português.
- Cores de status e componentes visuais seguem o design system já commitado (`DESIGN.md`) — reusar tokens (`bg-chart`, `text-status-negative-text`, `border-paper-line-strong`, etc.), não inventar cor nova.
- `DEV_CLINIC_ID` (já existe em `lib/constants.ts`) continua sendo o único `clinic_id` usado; esta entrega adiciona `DEV_RECEPTION_PROFILE_ID` ao mesmo arquivo.
- Sem autenticação real nesta entrega — débito técnico já registrado no projeto; `cancelled_by` usa o profile fixo de recepção criado no seed.
- Sem framework de teste automatizado configurado no projeto (nenhum `*.test.ts`/`*.spec.ts`, apesar de `@playwright/test` estar como devDependency não usada ainda) — todas as tasks seguem o padrão já usado nas entregas anteriores: testar manualmente com `npm run dev` e verificar dado via `mcp__Supabase__execute_sql` quando necessário. Não introduzir um test runner novo nesta entrega.
- Ver `docs/superpowers/specs/2026-09-04-sessao-checkin-status-design.md` para o design completo e as decisões de escopo já tomadas.

---

## Task 1: Seed — profile de recepção + constante

**Files:**
- Modify: `docs/superpowers/scratch/seed-dev-data.sql`
- Modify: `lib/constants.ts`

**Interfaces:**
- Consumes: nada novo (mesmo padrão do seed da Task 1 do plano de cadastro contínuo).
- Produces: `DEV_RECEPTION_PROFILE_ID: string` (exportado de `lib/constants.ts`), consumida pela Task 4 (`markMissedOrCancelled`). Registro real no banco: 1 `profiles` row com `role='recepcao'`, id `c1000000-0000-0000-0000-000000000004`.

- [ ] **Step 1: Adicionar ao seed SQL**

Abra `docs/superpowers/scratch/seed-dev-data.sql` e adicione ao final (mantendo o que já existe acima):

```sql
insert into auth.users (id, email) values
  ('c1000000-0000-0000-0000-000000000004', 'recepcao@facaamigos.dev')
on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name, active) values
  ('c1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'recepcao', 'Recepção FaçaAmigos', true)
on conflict do nothing;
```

- [ ] **Step 2: Rodar o SQL** (via `mcp__Supabase__execute_sql`, `project_id="vththexblpxwocbowhsv"`) — o arquivo inteiro é idempotente, pode rodar de novo sem duplicar.

- [ ] **Step 3: Verificar**

```sql
select id, role, full_name from profiles where role = 'recepcao';
```

Expected: 1 linha, `full_name = 'Recepção FaçaAmigos'`.

- [ ] **Step 4: Adicionar a constante**

Em `lib/constants.ts`, adicione:

```typescript
export const DEV_RECEPTION_PROFILE_ID = "c1000000-0000-0000-0000-000000000004";
```

(Arquivo final deve ter `DEV_CLINIC_ID`, `CLINIC_TIMEZONE` e `DEV_RECEPTION_PROFILE_ID`.)

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/scratch/seed-dev-data.sql lib/constants.ts
git commit -m "feat: seed de profile de recepção + DEV_RECEPTION_PROFILE_ID"
```

---

## Task 2: Constantes compartilhadas — motivos de cancelamento e estado derivado da sessão

**Files:**
- Create: `lib/appointment-cancel-reasons.ts`
- Create: `lib/appointment-ui-state.ts`

**Interfaces:**
- Produces: `CANCEL_REASONS: readonly {value: string; label: string}[]`, `NEGATIVE_STATUSES: readonly {value: string; label: string}[]` (de `lib/appointment-cancel-reasons.ts`) — consumidas pelas Tasks 4 (validação server-side) e 6 (formulário).
- Produces: `type AppointmentUiState = "aguardando" | "em_atendimento" | "realizada" | "terminal_negativo"` e `computeAppointmentUiState(appointment: {status: string; checkinAt: string | null; checkoutAt: string | null}): AppointmentUiState` (de `lib/appointment-ui-state.ts`) — consumida pela Task 6 (`AppointmentPanel`).

- [ ] **Step 1: Criar `lib/appointment-cancel-reasons.ts`**

```typescript
// lib/appointment-cancel-reasons.ts
/**
 * Lista fechada de motivos de falta/cancelamento — PRD §9.2. Usada tanto na
 * validação server-side (session-actions.ts) quanto no formulário
 * (appointment-panel.tsx), pra nunca divergir entre as duas pontas.
 */
export const CANCEL_REASONS = [
  { value: "doenca_crianca", label: "Doença da criança" },
  { value: "transporte", label: "Transporte" },
  { value: "esquecimento", label: "Esquecimento" },
  { value: "viagem", label: "Viagem" },
  { value: "sem_justificativa", label: "Sem justificativa" },
  { value: "terapeuta_indisponivel", label: "Terapeuta indisponível" },
  { value: "sala_indisponivel", label: "Sala indisponível" },
  { value: "clinica_fechada", label: "Clínica fechada" },
  { value: "outro", label: "Outro" },
] as const;

/**
 * Os 5 status negativos que a recepção pode aplicar a uma sessão ainda
 * agendada/confirmada (falta, os 3 tipos de cancelamento, remarcação).
 * `falta_familia` fica fora de CANCELLED_APPOINTMENT_STATUSES
 * (lib/patient-stage.ts) de propósito — aquela lista serve pra cálculo de
 * estágio do paciente, não pra esta UI.
 */
export const NEGATIVE_STATUSES = [
  { value: "falta_familia", label: "Falta da família" },
  { value: "cancelada_familia", label: "Cancelada pela família" },
  { value: "cancelada_terapeuta", label: "Cancelada pelo terapeuta" },
  { value: "cancelada_clinica", label: "Cancelada pela clínica" },
  { value: "remarcada", label: "Remarcada" },
] as const;
```

- [ ] **Step 2: Criar `lib/appointment-ui-state.ts`**

```typescript
// lib/appointment-ui-state.ts
/**
 * Estado de UI derivado de status + checkin_at + checkout_at — não é um
 * novo valor de `appointments.status` no banco (ver design doc).
 */
export type AppointmentUiState =
  | "aguardando"
  | "em_atendimento"
  | "realizada"
  | "terminal_negativo";

export function computeAppointmentUiState(appointment: {
  status: string;
  checkinAt: string | null;
  checkoutAt: string | null;
}): AppointmentUiState {
  if (appointment.status === "realizada") return "realizada";
  if (appointment.status !== "agendada" && appointment.status !== "confirmada") {
    return "terminal_negativo";
  }
  if (appointment.checkinAt && !appointment.checkoutAt) return "em_atendimento";
  return "aguardando";
}
```

- [ ] **Step 3: Verificar manualmente**

Não há chamada de rede nem banco nestes dois arquivos — são funções puras. Confirme que `npx tsc --noEmit` (ou `npm run lint`) não acusa erro de tipo nos dois arquivos novos.

- [ ] **Step 4: Commit**

```bash
git add lib/appointment-cancel-reasons.ts lib/appointment-ui-state.ts
git commit -m "feat: constantes de motivo de cancelamento e estado derivado da sessão"
```

---

## Task 3: Estender `AgendaAppointment` e a query da página com os campos de check-in/cancelamento

**Files:**
- Modify: `app/recepcao/agenda/day-grid.tsx`
- Modify: `app/recepcao/agenda/page.tsx`

**Interfaces:**
- Consumes: nada novo.
- Produces: `AgendaAppointment` (tipo estendido, exportado de `day-grid.tsx`) e `STATUS_LABEL` (agora exportado de `day-grid.tsx`) — consumidos pelas Tasks 5 e 6.

- [ ] **Step 1: Estender o tipo e exportar `STATUS_LABEL` em `day-grid.tsx`**

No topo de `app/recepcao/agenda/day-grid.tsx`, troque o tipo e a constante por:

```typescript
export type AgendaAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  roomId: string;
  roomName: string;
  therapistName: string;
  patientName: string;
  status: string;
  checkinAt: string | null;
  checkoutAt: string | null;
  cancelReason: string | null;
  cancelledByName: string | null;
};

const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i); // 08h–19h

export const STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  falta_familia: "Falta",
  cancelada_familia: "Cancelada",
  cancelada_terapeuta: "Cancelada",
  cancelada_clinica: "Cancelada",
  remarcada: "Remarcada",
};
```

(O resto do arquivo — `DayGrid`, o loop de `HOURS`/`rooms` — não muda nesta task; a interatividade do cartão entra na Task 5.)

- [ ] **Step 2: Atualizar a query em `page.tsx`**

Em `app/recepcao/agenda/page.tsx`, troque o bloco de `select` de `appointments` e o `map` por:

```typescript
  // Nota: `appointments` tem duas FKs para `profiles` (therapist_id e
  // cancelled_by), então o Postgrest recusa o embed `profiles(...)` por
  // ambiguidade. Usar o nome da COLUNA da FK (`profiles!coluna`) com alias
  // desambigua e dá nome estável pra cada relação no resultado.
  const { data: rawAppointments } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, room_id, checkin_at, checkout_at, cancel_reason, rooms(name), therapist:profiles!therapist_id(full_name), canceller:profiles!cancelled_by(full_name), patients(full_name)",
    )
    .gte("starts_at", dayStart)
    .lt("starts_at", dayEnd);

  const appointments: AgendaAppointment[] = (rawAppointments ?? []).map((a) => ({
    id: a.id,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    roomId: a.room_id,
    roomName: (a.rooms as { name: string } | null)?.name ?? "",
    therapistName: (a.therapist as { full_name: string } | null)?.full_name ?? "",
    patientName: (a.patients as { full_name: string } | null)?.full_name ?? "",
    status: a.status,
    checkinAt: a.checkin_at,
    checkoutAt: a.checkout_at,
    cancelReason: a.cancel_reason,
    cancelledByName: (a.canceller as { full_name: string } | null)?.full_name ?? null,
  }));
```

- [ ] **Step 3: Testar manualmente**

`npm run dev`, abrir `/recepcao/agenda`. Deve carregar sem erro (mesmo comportamento visual de antes — os campos novos ainda não são usados na Task 3, só passam a existir no tipo e na query). Se o Postgrest reclamar do alias `canceller`/`therapist`, confirme que a sintaxe é exatamente `alias:tabela!coluna_fk(campos)`.

- [ ] **Step 4: Commit**

```bash
git add app/recepcao/agenda/day-grid.tsx app/recepcao/agenda/page.tsx
git commit -m "feat: estender AgendaAppointment com campos de check-in e cancelamento"
```

---

## Task 4: Server Actions — check-in, check-out, falta/cancelamento

**Files:**
- Create: `app/recepcao/agenda/session-actions.ts`

**Interfaces:**
- Consumes: `createAdminClient` (`lib/supabase/admin.ts`), `DEV_RECEPTION_PROFILE_ID` (Task 1), `CANCEL_REASONS`/`NEGATIVE_STATUSES` (Task 2).
- Produces: `checkIn(appointmentId: string): Promise<ActionResult>`, `checkOut(appointmentId: string): Promise<ActionResult>`, `markMissedOrCancelled(appointmentId: string, formData: FormData): Promise<ActionResult>` — todas usadas pela Task 6 (`AppointmentPanel`). `type ActionResult = { success: true } | { success: false; error: string }` (mesmo formato de toda Server Action do projeto).

- [ ] **Step 1: Criar o arquivo**

```typescript
// app/recepcao/agenda/session-actions.ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_RECEPTION_PROFILE_ID } from "@/lib/constants";
import { CANCEL_REASONS, NEGATIVE_STATUSES } from "@/lib/appointment-cancel-reasons";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

function mapAuthorizationGuardError(message: string): string {
  if (message.includes("exige authorization_id")) {
    return "Sessão sem autorização vinculada — não é possível fechar.";
  }
  if (message.includes("não está ativa")) {
    return "Autorização não está mais ativa.";
  }
  if (message.includes("fora da vigência")) {
    return "Sessão fora da vigência da autorização.";
  }
  if (message.includes("sem sessões restantes")) {
    return "Autorização sem sessões restantes.";
  }
  return "Não foi possível fechar a sessão. Tente de novo.";
}

export async function checkIn(appointmentId: string): Promise<ActionResult> {
  const supabase = createAdminClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, status, checkin_at")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }
  if (appointment.status !== "agendada" && appointment.status !== "confirmada") {
    return { success: false, error: "Só é possível fazer check-in de sessão agendada ou confirmada." };
  }
  if (appointment.checkin_at) {
    return { success: false, error: "Check-in já registrado." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({ checkin_at: new Date().toISOString() })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, error: "Não foi possível registrar o check-in. Tente de novo." };
  }

  revalidatePath("/recepcao/agenda");
  return { success: true };
}

export async function checkOut(appointmentId: string): Promise<ActionResult> {
  const supabase = createAdminClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, checkin_at, checkout_at")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }
  if (!appointment.checkin_at) {
    return { success: false, error: "Registre o check-in antes do check-out." };
  }
  if (appointment.checkout_at) {
    return { success: false, error: "Check-out já registrado." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({ checkout_at: new Date().toISOString(), status: "realizada" })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, error: mapAuthorizationGuardError(error.message ?? "") };
  }

  revalidatePath("/recepcao/agenda");
  return { success: true };
}

export async function markMissedOrCancelled(
  appointmentId: string,
  formData: FormData,
): Promise<ActionResult> {
  const targetStatus = String(formData.get("target_status") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const reasonOther = String(formData.get("reason_other") ?? "").trim();

  if (!NEGATIVE_STATUSES.some((s) => s.value === targetStatus)) {
    return { success: false, error: "Selecione um status válido." };
  }
  if (!CANCEL_REASONS.some((r) => r.value === reason)) {
    return { success: false, error: "Selecione um motivo válido." };
  }
  if (reason === "outro" && !reasonOther) {
    return { success: false, error: "Descreva o motivo." };
  }

  const supabase = createAdminClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }
  if (appointment.status !== "agendada" && appointment.status !== "confirmada") {
    return { success: false, error: "Essa sessão já não pode mais ser cancelada." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      status: targetStatus,
      cancel_reason: reason === "outro" ? reasonOther : reason,
      cancelled_by: DEV_RECEPTION_PROFILE_ID,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, error: "Não foi possível registrar. Tente de novo." };
  }

  revalidatePath("/recepcao/agenda");
  return { success: true };
}
```

- [ ] **Step 2: Verificar tipos**

Rodar `npm run lint` (ou `npx tsc --noEmit`) — não deve haver erro nesta task (o arquivo ainda não é chamado por nenhuma UI, mas precisa compilar sozinho).

- [ ] **Step 3: Commit**

```bash
git add app/recepcao/agenda/session-actions.ts
git commit -m "feat: server actions de check-in, check-out e falta/cancelamento"
```

---

## Task 5: `DayGrid` clicável

**Files:**
- Modify: `app/recepcao/agenda/day-grid.tsx`

**Interfaces:**
- Consumes: `AgendaAppointment` (Task 3).
- Produces: `DayGrid` passa a aceitar `onSelect: (id: string) => void` — consumida pela Task 7 (`AgendaClient`).

- [ ] **Step 1: Adicionar a prop `onSelect` e tornar o cartão focável/clicável**

Em `app/recepcao/agenda/day-grid.tsx`, mude a assinatura de `DayGrid` e o cartão da sessão:

```tsx
export function DayGrid({
  rooms,
  appointments,
  onSelect,
}: {
  rooms: { id: string; name: string }[];
  appointments: AgendaAppointment[];
  onSelect: (id: string) => void;
}) {
```

E, dentro do `.map((room) => ...)`, troque o `<div>` do cartão de sessão por um `<button>` (dá foco/teclado de graça, sem `role`/`tabIndex` manual — requisito de acessibilidade do §9.11):

```tsx
              return (
                <div
                  key={room.id}
                  className="min-h-14 border-b border-r border-paper-line-strong p-1 last:border-r-0"
                >
                  {match && (
                    <button
                      type="button"
                      onClick={() => onSelect(match.id)}
                      className="w-full rounded bg-chart-soft px-2 py-1 text-left text-xs hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-chart"
                    >
                      <p className="font-medium text-ink">{match.patientName}</p>
                      <p className="text-ink-soft">{match.therapistName}</p>
                      <p className="text-ink-faint">{STATUS_LABEL[match.status] ?? match.status}</p>
                    </button>
                  )}
                </div>
              );
```

(`STATUS_LABEL` já foi exportado na Task 3, então esta referência continua igual — só o elemento em volta mudou de `<div>` pra `<button>`.)

- [ ] **Step 2: Testar manualmente**

`npm run dev`, abrir `/recepcao/agenda` — os cartões de sessão devem parecer clicáveis (cursor de botão) e navegáveis por Tab. Como `onSelect` ainda não é consumido por ninguém (Task 7 faz isso), qualquer chamada de página que ainda use `<DayGrid rooms={...} appointments={...} />` sem `onSelect` vai falhar a tipagem — normal, será corrigido na Task 7. Confirme com `npx tsc --noEmit` que o único erro restante é exatamente esse (prop `onSelect` faltando em `page.tsx`).

- [ ] **Step 3: Commit**

```bash
git add app/recepcao/agenda/day-grid.tsx
git commit -m "feat: cartão de sessão da agenda vira clicável (prop onSelect)"
```

---

## Task 6: Painel de sessão (`AppointmentPanel`)

**Files:**
- Create: `app/recepcao/agenda/appointment-panel.tsx`

**Interfaces:**
- Consumes: `AgendaAppointment`, `STATUS_LABEL` (Task 3); `checkIn`, `checkOut`, `markMissedOrCancelled` (Task 4); `computeAppointmentUiState` (Task 2); `CANCEL_REASONS`, `NEGATIVE_STATUSES` (Task 2).
- Produces: componente `AppointmentPanel` (props `{ appointment: AgendaAppointment; onClose: () => void }`) — consumido pela Task 7.

- [ ] **Step 1: Criar o componente**

```tsx
// app/recepcao/agenda/appointment-panel.tsx
"use client";

import { useState, useTransition } from "react";
import type { AgendaAppointment } from "./day-grid";
import { STATUS_LABEL } from "./day-grid";
import { checkIn, checkOut, markMissedOrCancelled } from "./session-actions";
import { computeAppointmentUiState } from "@/lib/appointment-ui-state";
import { CANCEL_REASONS, NEGATIVE_STATUSES } from "@/lib/appointment-cancel-reasons";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export function AppointmentPanel({
  appointment,
  onClose,
}: {
  appointment: AgendaAppointment;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showCancelForm, setShowCancelForm] = useState(false);

  const uiState = computeAppointmentUiState(appointment);

  function runAction(
    action: () => Promise<{ success: true } | { success: false; error: string }>,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="fixed inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col gap-4 overflow-y-auto border-l border-paper-line-strong bg-paper p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            {formatTime(appointment.startsAt)}–{formatTime(appointment.endsAt)} · {appointment.roomName}
          </h2>
          <p className="mt-1 text-lg font-medium text-ink">{appointment.patientName}</p>
          <p className="text-sm text-ink-soft">{appointment.therapistName}</p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-ink-faint hover:text-ink">
          Fechar
        </button>
      </div>

      <p className="text-sm text-ink-soft">
        Status: <span className="font-medium text-ink">{STATUS_LABEL[appointment.status] ?? appointment.status}</span>
      </p>

      {uiState === "aguardando" && !showCancelForm && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => runAction(() => checkIn(appointment.id))}
            className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
          >
            {isPending ? "Registrando…" : "Check-in"}
          </button>
          <button
            type="button"
            onClick={() => setShowCancelForm(true)}
            className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-ink"
          >
            Falta / Cancelar
          </button>
        </div>
      )}

      {uiState === "aguardando" && showCancelForm && (
        <form
          className="flex flex-col gap-3"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await markMissedOrCancelled(appointment.id, formData);
              if (!result.success) {
                setError(result.error);
                return;
              }
              setShowCancelForm(false);
            });
          }}
        >
          <select
            name="target_status"
            required
            className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm"
          >
            <option value="">Status</option>
            {NEGATIVE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            name="reason"
            required
            className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm"
          >
            <option value="">Motivo</option>
            {CANCEL_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="reason_other"
            placeholder="Descreva o motivo (se 'Outro')"
            className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
            >
              {isPending ? "Salvando…" : "Confirmar"}
            </button>
            <button
              type="button"
              onClick={() => setShowCancelForm(false)}
              className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-ink"
            >
              Voltar
            </button>
          </div>
        </form>
      )}

      {uiState === "em_atendimento" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => runAction(() => checkOut(appointment.id))}
          className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
        >
          {isPending ? "Registrando…" : "Check-out"}
        </button>
      )}

      {uiState === "realizada" && appointment.checkinAt && appointment.checkoutAt && (
        <p className="text-sm text-status-positive-text">
          Sessão realizada — check-in {formatTime(appointment.checkinAt)}, check-out{" "}
          {formatTime(appointment.checkoutAt)}.
        </p>
      )}

      {uiState === "terminal_negativo" && (
        <div className="text-sm text-status-negative-text">
          <p>Motivo: {appointment.cancelReason ?? "não informado"}</p>
          <p>Autor: {appointment.cancelledByName ?? "não informado"}</p>
        </div>
      )}

      {error && <p className="text-xs text-status-negative-text">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

`npx tsc --noEmit` — não deve haver erro novo introduzido por este arquivo (ele ainda não é renderizado por ninguém; a Task 7 conecta).

- [ ] **Step 3: Commit**

```bash
git add app/recepcao/agenda/appointment-panel.tsx
git commit -m "feat: painel de ações da sessão (check-in, check-out, falta/cancelar)"
```

---

## Task 7: Conectar tudo — `AgendaClient` e `page.tsx`

**Files:**
- Create: `app/recepcao/agenda/agenda-client.tsx`
- Modify: `app/recepcao/agenda/page.tsx`

**Interfaces:**
- Consumes: `DayGrid` (Task 5), `AppointmentPanel` (Task 6), `AgendaAppointment` (Task 3).
- Produces: componente `AgendaClient` (props `{ rooms: {id:string; name:string}[]; appointments: AgendaAppointment[] }`) — usado só em `page.tsx`.

- [ ] **Step 1: Criar `agenda-client.tsx`**

```tsx
// app/recepcao/agenda/agenda-client.tsx
"use client";

import { useState } from "react";
import { DayGrid, type AgendaAppointment } from "./day-grid";
import { AppointmentPanel } from "./appointment-panel";

export function AgendaClient({
  rooms,
  appointments,
}: {
  rooms: { id: string; name: string }[];
  appointments: AgendaAppointment[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  return (
    <>
      <DayGrid rooms={rooms} appointments={appointments} onSelect={setSelectedId} />
      {selected && <AppointmentPanel appointment={selected} onClose={() => setSelectedId(null)} />}
    </>
  );
}
```

- [ ] **Step 2: Trocar `DayGrid` por `AgendaClient` em `page.tsx`**

Em `app/recepcao/agenda/page.tsx`:

1. Troque o import:

```typescript
import { AgendaClient } from "./agenda-client";
```

(remova o import de `DayGrid`/`AgendaAppointment` — `AgendaAppointment` ainda é necessário como tipo pro `map`, então mantenha `import { type AgendaAppointment } from "./day-grid";` junto com o import acima, ou importe os dois na mesma linha: `import { type AgendaAppointment } from "./day-grid"; import { AgendaClient } from "./agenda-client";`).

2. Troque a última linha do JSX:

```tsx
        <AgendaClient rooms={rooms ?? []} appointments={appointments} />
```

(no lugar de `<DayGrid rooms={rooms ?? []} appointments={appointments} />`).

- [ ] **Step 3: Testar manualmente — fluxo completo**

`npm run dev`, abrir `/recepcao/agenda` numa data com pelo menos 1 sessão `agendada` (usar o formulário "+ Agendar sessão" se precisar criar uma, com um paciente que já tenha autorização ativa — ver seed/Tasks anteriores).

1. Clicar no cartão da sessão → painel abre à direita, mostra "Aguardando" com botões "Check-in" e "Falta / Cancelar".
2. Clicar "Check-in" → painel atualiza pra "Check-out" sem fechar (revalida a página; o `selected` é recalculado a partir do array `appointments` atualizado após `revalidatePath`).
3. Clicar "Check-out" → `status` vira `realizada`; painel mostra os horários de check-in/check-out. Se o paciente não tiver `authorization_id` ativo, confirmar que aparece a mensagem em português (não o erro cru do Postgres) — testar isso com um paciente sem autorização vigente.
4. Abrir outra sessão `agendada`, clicar "Falta / Cancelar", escolher "Falta da família" + motivo "Esquecimento", confirmar → painel mostra "Motivo: esquecimento" e "Autor: Recepção FaçaAmigos".
5. Reabrir essa mesma sessão (clicar de novo no cartão) → painel mostra o estado terminal, sem nenhum botão de ação.
6. Testar navegação por teclado: Tab até um cartão de sessão, Enter abre o painel.

- [ ] **Step 4: Commit**

```bash
git add app/recepcao/agenda/agenda-client.tsx app/recepcao/agenda/page.tsx
git commit -m "feat: conectar painel de sessão à agenda (check-in/check-out/falta/cancelamento)"
```

---

## Self-Review

**Spec coverage:** máquina de estados de UI (Task 2 + 6), autor fixo de recepção (Task 1 + 4), painel lateral clicável (Task 5 + 6 + 7), mapeamento de erro do guard de autorização (Task 4), motivos padronizados do §9.2 (Task 2), remarcação só como mudança de status (Task 4, sem sugestão automática), confirmar presença deliberadamente fora do escopo (nenhuma task toca `confirmed_at`/`confirmed_via`) — todos os itens do spec `2026-09-04-sessao-checkin-status-design.md` têm task correspondente.

**Placeholder scan:** nenhum "TBD"/"implementar depois" — a única dependência entre tasks que exige atenção (Task 5 quebra a tipagem de `page.tsx` até a Task 7 conectar) já está anotada explicitamente no Step 2 da Task 5, não é um placeholder vazio.

**Type consistency:** `ActionResult` (Task 4) é o mesmo formato `{success:true}|{success:false,error:string}` de toda Server Action do projeto, consumido sem adaptação pelo `runAction`/`action=` da Task 6. `AgendaAppointment` (Task 3) é estendido uma única vez e usado sem divergência nas Tasks 5, 6 e 7. `STATUS_LABEL` é definido uma vez (Task 3, dentro de `day-grid.tsx`) e importado (não redefinido) na Task 6. `computeAppointmentUiState`/`AppointmentUiState` (Task 2) são definidos uma vez e consumidos só na Task 6.
