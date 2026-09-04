# Evolução Clínica Mínima Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à home `/terapeuta` dado real (sessões de hoje + evoluções pendentes) e um formulário de evolução clínica mínima que grava em `session_notes`, sem depender de plano terapêutico (Fase 2).

**Architecture:** Server Components para leitura (mesmo padrão de `/recepcao/agenda`), um Server Action único (`createSessionNote`) pra gravação, seletor de terapeuta via query param (sem client state, mesmo padrão do seletor de data da agenda). Constantes de campo (comportamentos, orientações) compartilhadas entre o formulário e a validação server-side.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, `@supabase/supabase-js` (cliente admin service-role), Supabase Postgres (projeto `vththexblpxwocbowhsv`).

## Global Constraints

- Todo cliente admin (`lib/supabase/admin.ts`) só é importado por Server Actions e Server Components — nunca por um arquivo com `"use client"`.
- Toda Server Action retorna `{ success: true } | { success: false; error: string }` — nunca lança exceção sem tratamento pro client component.
- Mensagens de erro do Postgres nunca aparecem cruas na UI — sempre mapeadas para texto em português.
- Cores de status e componentes visuais seguem o design system já commitado (`DESIGN.md`) — reusar `components/page-header.tsx`, tokens (`bg-chart`, `text-status-positive-text`, `border-paper-line-strong`), não inventar cor nova.
- `DEV_CLINIC_ID` e `CLINIC_TIMEZONE` (já em `lib/constants.ts`) continuam sendo os únicos usados pra escopo de clínica e fuso.
- Identidade do terapeuta é um seletor na UI (query param `?therapist=<id>`), não um perfil fixo — decisão do design doc, já que há 2 terapeutas seedados e qualquer um deles pode estar "logado".
- Nenhum campo do formulário depende de `plan_goals`/`programs`/`trial_data` — essas tabelas não têm UI nesta entrega (Fase 2). Nenhum anexo de foto/vídeo (depende do módulo de anexos, ainda não construído). Sem rascunho offline — o formulário assume rede disponível.
- Toda evolução nesta entrega nasce com `version = 1`, `supersedes_id = null` e `signed_at` preenchido no momento da gravação — não há fluxo de reedição/nova versão nesta entrega (só a estrutura de dados já fica correta pro futuro).
- Sem framework de teste automatizado configurado no projeto — todas as tasks seguem o padrão já usado: testar manualmente com `npm run dev` e verificar dado via `mcp__Supabase__execute_sql` quando necessário.
- Ver `docs/superpowers/specs/2026-09-04-evolucao-clinica-minima-design.md` para o design completo e as decisões de escopo já tomadas.

---

## Task 1: Constantes de campo compartilhadas

**Files:**
- Create: `lib/session-note-fields.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `BEHAVIOR_TYPES`, `BEHAVIOR_INTENSITIES`, `FAMILY_GUIDANCE_OPTIONS` (arrays `readonly {value: string; label: string}[]`) e `type SessionNoteStructured = { presenca_engajamento: number; comportamentos: { tipo: string; intensidade: string }[]; orientacoes: string[] }` — consumidos pelas Tasks 3 (Server Action) e 4 (formulário).

- [ ] **Step 1: Criar `lib/session-note-fields.ts`**

```typescript
// lib/session-note-fields.ts
/**
 * Campos estruturados da evolução clínica mínima — PRD §9.4, sem a parte
 * de metas trabalhadas (depende de plan_goals, Fase 2). Lista de
 * comportamentos é fixa nesta entrega — configuração pelo supervisor
 * (mencionada no §9.4 como "lista configurável") ainda não existe.
 */
export const BEHAVIOR_TYPES = [
  { value: "agitacao", label: "Agitação" },
  { value: "estereotipia", label: "Estereotipia" },
  { value: "birra_crise", label: "Birra/crise" },
  { value: "autolesao", label: "Autolesão" },
  { value: "agressividade", label: "Agressividade" },
  { value: "choro", label: "Choro" },
  { value: "recusa_atividade", label: "Recusa de atividade" },
  { value: "outro", label: "Outro" },
] as const;

export const BEHAVIOR_INTENSITIES = [
  { value: "leve", label: "Leve" },
  { value: "moderada", label: "Moderada" },
  { value: "intensa", label: "Intensa" },
] as const;

/** Chips de orientação à família — lista literal do §9.4. */
export const FAMILY_GUIDANCE_OPTIONS = [
  { value: "rotina", label: "Rotina" },
  { value: "comunicacao", label: "Comunicação" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "sono", label: "Sono" },
  { value: "escola", label: "Escola" },
  { value: "nenhuma", label: "Nenhuma" },
] as const;

/** Formato gravado em session_notes.structured (jsonb). */
export type SessionNoteStructured = {
  presenca_engajamento: number;
  comportamentos: { tipo: string; intensidade: string }[];
  orientacoes: string[];
};
```

- [ ] **Step 2: Verificar tipos**

Rodar `npx tsc --noEmit` — arquivo novo, sem dependência de nada, não deve introduzir erro.

- [ ] **Step 3: Commit**

```bash
git add lib/session-note-fields.ts
git commit -m "feat: constantes de campo da evolução clínica (comportamentos, orientações)"
```

---

## Task 2: `/terapeuta` — home com dado real e seletor de terapeuta

**Files:**
- Modify: `app/terapeuta/page.tsx` (reescrita completa — hoje é só mock)

**Interfaces:**
- Consumes: `createAdminClient` (`lib/supabase/admin.ts`), `DEV_CLINIC_ID`/`CLINIC_TIMEZONE` (`lib/constants.ts`), `zonedDateTimeToUtc`/`todayInTimeZone`/`nextCalendarDay` (`lib/timezone.ts`) — todos já existem e já são usados em `app/recepcao/agenda/page.tsx`.
- Produces: rota `/terapeuta/evolucao/[appointmentId]` linkada a partir daqui (consumida pela Task 4, que cria essa rota).

- [ ] **Step 1: Reescrever `app/terapeuta/page.tsx`**

```tsx
// app/terapeuta/page.tsx
import { PageHeader } from "@/components/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { zonedDateTimeToUtc, todayInTimeZone, nextCalendarDay } from "@/lib/timezone";

export default async function TerapeutaPage({
  searchParams,
}: {
  searchParams: Promise<{ therapist?: string }>;
}) {
  const supabase = createAdminClient();

  const { data: therapists } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("role", "terapeuta")
    .order("full_name");

  const { therapist } = await searchParams;
  const therapistId = therapist ?? therapists?.[0]?.id ?? "";

  const today = todayInTimeZone(CLINIC_TIMEZONE);
  const dayStart = zonedDateTimeToUtc(today, "00:00", CLINIC_TIMEZONE).toISOString();
  const dayEnd = zonedDateTimeToUtc(nextCalendarDay(today), "00:00", CLINIC_TIMEZONE).toISOString();

  const { data: todaySessions } = therapistId
    ? await supabase
        .from("appointments")
        .select("id, starts_at, status, patients(full_name)")
        .eq("therapist_id", therapistId)
        .gte("starts_at", dayStart)
        .lt("starts_at", dayEnd)
        .order("starts_at")
    : { data: null };

  const { data: realizedSessions } = therapistId
    ? await supabase
        .from("appointments")
        .select("id, starts_at, patients(full_name)")
        .eq("therapist_id", therapistId)
        .eq("status", "realizada")
        .order("starts_at", { ascending: true })
    : { data: null };

  const realizedIds = (realizedSessions ?? []).map((a) => a.id);

  const { data: existingNotes } = realizedIds.length
    ? await supabase.from("session_notes").select("appointment_id").in("appointment_id", realizedIds)
    : { data: null };

  const notedIds = new Set((existingNotes ?? []).map((n) => n.appointment_id));
  const pending = (realizedSessions ?? []).filter((a) => !notedIds.has(a.id));

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Terapeuta"
        title="Minhas sessões de hoje"
        description="Evoluções pendentes aparecem primeiro — meta é registrar em até 2 minutos."
      />
      <div className="flex flex-col gap-6 p-6 sm:p-10">
        <form className="flex items-center gap-2" method="get">
          <select
            name="therapist"
            defaultValue={therapistId}
            className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
          >
            {(therapists ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-paper-line-strong px-3 py-2 text-sm text-ink hover:border-chart"
          >
            Ver como
          </button>
        </form>

        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Evoluções pendentes
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {pending.map((a) => (
              <li key={a.id}>
                <a
                  href={`/terapeuta/evolucao/${a.id}`}
                  className="flex items-center justify-between rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm hover:border-chart"
                >
                  <span className="font-medium text-ink">
                    {(a.patients as { full_name: string } | null)?.full_name ?? ""}
                  </span>
                  <span className="text-ink-faint">
                    {new Date(a.starts_at).toLocaleDateString("pt-BR")}
                  </span>
                </a>
              </li>
            ))}
            {pending.length === 0 && (
              <li className="text-sm text-ink-faint">Nenhuma evolução pendente.</li>
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Sessões de hoje
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {(todaySessions ?? []).map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm"
              >
                <span className="font-medium text-ink">
                  {(a.patients as { full_name: string } | null)?.full_name ?? ""}
                </span>
                <span className="text-ink-faint">
                  {new Date(a.starts_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: CLINIC_TIMEZONE,
                  })}
                </span>
              </li>
            ))}
            {(todaySessions ?? []).length === 0 && (
              <li className="text-sm text-ink-faint">Nenhuma sessão hoje.</li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
```

**Nota:** o link pra `/terapeuta/evolucao/${a.id}` aponta pra uma rota que só existe a partir da Task 4 — até lá, dá 404 ao clicar. Normal, corrigido quando a Task 4 entrar.

- [ ] **Step 2: Testar manualmente**

`npm run dev`, abrir `/terapeuta` — deve carregar sem erro, mostrar o seletor com "Ana Souza" e "Bruno Lima", trocar o seletor e confirmar que "Ver como" recarrega a página com `?therapist=<id>` na URL e os dados mudam. Se não houver sessão nenhuma pro terapeuta, confirmar que aparece "Nenhuma sessão hoje." e "Nenhuma evolução pendente." em vez de tela vazia/erro.

- [ ] **Step 3: Commit**

```bash
git add app/terapeuta/page.tsx
git commit -m "feat: home do terapeuta com dado real (sessões de hoje + evoluções pendentes)"
```

---

## Task 3: Server Action `createSessionNote`

**Files:**
- Create: `app/terapeuta/evolucao/actions.ts`

**Interfaces:**
- Consumes: `createAdminClient` (`lib/supabase/admin.ts`), `BEHAVIOR_TYPES`/`BEHAVIOR_INTENSITIES`/`FAMILY_GUIDANCE_OPTIONS` (Task 1).
- Produces: `createSessionNote(appointmentId: string, therapistId: string, formData: FormData): Promise<{ success: true } | { success: false; error: string }>` — consumida pela Task 4.

- [ ] **Step 1: Criar o arquivo**

```typescript
// app/terapeuta/evolucao/actions.ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  BEHAVIOR_TYPES,
  BEHAVIOR_INTENSITIES,
  FAMILY_GUIDANCE_OPTIONS,
} from "@/lib/session-note-fields";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

export async function createSessionNote(
  appointmentId: string,
  therapistId: string,
  formData: FormData,
): Promise<ActionResult> {
  const presencaRaw = formData.get("presenca_engajamento");
  const presenca = presencaRaw ? Number(presencaRaw) : NaN;

  if (!presencaRaw || Number.isNaN(presenca) || presenca < 1 || presenca > 5) {
    return { success: false, error: "Selecione a presença/engajamento (1 a 5)." };
  }

  const behaviorTypes = formData.getAll("comportamento_tipo").map(String);
  const comportamentos = behaviorTypes
    .filter((tipo) => BEHAVIOR_TYPES.some((b) => b.value === tipo))
    .map((tipo) => {
      const intensidadeRaw = String(formData.get(`comportamento_intensidade_${tipo}`) ?? "");
      const intensidade = BEHAVIOR_INTENSITIES.some((i) => i.value === intensidadeRaw)
        ? intensidadeRaw
        : "leve";
      return { tipo, intensidade };
    });

  const orientacoes = formData
    .getAll("orientacao")
    .map(String)
    .filter((valor) => FAMILY_GUIDANCE_OPTIONS.some((g) => g.value === valor));

  const freeText = String(formData.get("free_text") ?? "").trim();
  const createdAtDeviceRaw = String(formData.get("created_at_device") ?? "");
  const createdAtDevice = createdAtDeviceRaw || new Date().toISOString();

  const supabase = createAdminClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }
  if (appointment.status !== "realizada") {
    return { success: false, error: "Esta sessão ainda não foi realizada." };
  }

  const { data: existingNote } = await supabase
    .from("session_notes")
    .select("id")
    .eq("appointment_id", appointmentId)
    .limit(1)
    .maybeSingle();

  if (existingNote) {
    return { success: false, error: "Já existe uma evolução registrada para esta sessão." };
  }

  const { error } = await supabase.from("session_notes").insert({
    appointment_id: appointmentId,
    therapist_id: therapistId,
    version: 1,
    structured: {
      presenca_engajamento: presenca,
      comportamentos,
      orientacoes,
    },
    free_text: freeText || null,
    created_at_device: createdAtDevice,
    signed_at: new Date().toISOString(),
  });

  if (error) {
    return { success: false, error: "Não foi possível salvar a evolução. Tente de novo." };
  }

  revalidatePath("/terapeuta");
  return { success: true };
}
```

- [ ] **Step 2: Verificar tipos**

`npx tsc --noEmit` — não deve haver erro (arquivo ainda não é chamado por nenhuma UI; a Task 4 conecta).

- [ ] **Step 3: Commit**

```bash
git add app/terapeuta/evolucao/actions.ts
git commit -m "feat: server action createSessionNote — grava evolução clínica mínima"
```

---

## Task 4: Página e formulário de evolução

**Files:**
- Create: `app/terapeuta/evolucao/[appointmentId]/page.tsx`
- Create: `app/terapeuta/evolucao/[appointmentId]/evolution-form.tsx`

**Interfaces:**
- Consumes: `createAdminClient` (`lib/supabase/admin.ts`), `createSessionNote` (Task 3), `BEHAVIOR_TYPES`/`BEHAVIOR_INTENSITIES`/`FAMILY_GUIDANCE_OPTIONS` (Task 1), `PageHeader` (`components/page-header.tsx`).
- Produces: rota `/terapeuta/evolucao/[appointmentId]` que a Task 2 já linka.

- [ ] **Step 1: Criar o componente de formulário**

```tsx
// app/terapeuta/evolucao/[appointmentId]/evolution-form.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSessionNote } from "../actions";
import {
  BEHAVIOR_TYPES,
  BEHAVIOR_INTENSITIES,
  FAMILY_GUIDANCE_OPTIONS,
} from "@/lib/session-note-fields";

const PRESENCE_SCALE = [1, 2, 3, 4, 5] as const;

export function EvolutionForm({
  appointmentId,
  therapistId,
}: {
  appointmentId: string;
  therapistId: string;
}) {
  const [presence, setPresence] = useState<number | null>(null);
  const [selectedBehaviors, setSelectedBehaviors] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggleBehavior(value: string) {
    setSelectedBehaviors((prev) => ({ ...prev, [value]: !prev[value] }));
  }

  return (
    <form
      className="flex max-w-xl flex-col gap-6"
      action={(formData) => {
        setError(null);
        formData.set("created_at_device", new Date().toISOString());
        if (presence !== null) {
          formData.set("presenca_engajamento", String(presence));
        }
        startTransition(async () => {
          const result = await createSessionNote(appointmentId, therapistId, formData);
          if (!result.success) {
            setError(result.error);
            return;
          }
          router.push(`/terapeuta?therapist=${therapistId}`);
        });
      }}
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
          Presença e engajamento
        </p>
        <div className="mt-2 flex gap-2">
          {PRESENCE_SCALE.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPresence(n)}
              className={`h-10 w-10 rounded-md border text-sm font-medium ${
                presence === n
                  ? "border-chart bg-chart text-paper"
                  : "border-paper-line-strong bg-paper text-ink"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
          Comportamentos-alvo observados
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {BEHAVIOR_TYPES.map((b) => (
            <div key={b.value} className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  name="comportamento_tipo"
                  value={b.value}
                  checked={!!selectedBehaviors[b.value]}
                  onChange={() => toggleBehavior(b.value)}
                />
                {b.label}
              </label>
              {selectedBehaviors[b.value] && (
                <select
                  name={`comportamento_intensidade_${b.value}`}
                  defaultValue="leve"
                  className="rounded-md border border-paper-line-strong bg-paper px-2 py-1 text-xs"
                >
                  {BEHAVIOR_INTENSITIES.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
          Orientação dada à família
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {FAMILY_GUIDANCE_OPTIONS.map((g) => (
            <label
              key={g.value}
              className="flex items-center gap-2 rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
            >
              <input type="checkbox" name="orientacao" value={g.value} />
              {g.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label
          className="text-xs font-medium uppercase tracking-wide text-ink-soft"
          htmlFor="free_text"
        >
          Texto livre (opcional)
        </label>
        <textarea
          id="free_text"
          name="free_text"
          rows={3}
          className="mt-2 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
      >
        {isPending ? "Salvando…" : "Confirmar e assinar"}
      </button>
      {error && <p className="text-xs text-status-negative-text">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Criar a página**

```tsx
// app/terapeuta/evolucao/[appointmentId]/page.tsx
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { EvolutionForm } from "./evolution-form";

export default async function EvolucaoPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  const supabase = createAdminClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, status, therapist_id, patients(full_name), profiles!therapist_id(full_name)",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) notFound();

  const { data: existingNote } = await supabase
    .from("session_notes")
    .select("id, signed_at")
    .eq("appointment_id", appointmentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const patientName = (appointment.patients as { full_name: string } | null)?.full_name ?? "";
  const therapistName =
    (appointment.profiles as { full_name: string } | null)?.full_name ?? "";

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Terapeuta"
        title={`Evolução — ${patientName}`}
        description={`${therapistName} · ${new Date(appointment.starts_at).toLocaleString("pt-BR")}`}
      />
      <div className="p-6 sm:p-10">
        {appointment.status !== "realizada" ? (
          <p className="text-sm text-status-negative-text">
            Esta sessão ainda não foi realizada — não é possível registrar evolução.
          </p>
        ) : existingNote ? (
          <div className="rounded-md border border-paper-line-strong bg-paper/60 p-5 text-sm">
            <p className="font-medium text-status-positive-text">Evolução já registrada.</p>
            <p className="mt-2 text-ink-soft">
              Assinada em{" "}
              {existingNote.signed_at
                ? new Date(existingNote.signed_at).toLocaleString("pt-BR")
                : "—"}
              .
            </p>
          </div>
        ) : (
          <EvolutionForm appointmentId={appointment.id} therapistId={appointment.therapist_id} />
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Testar manualmente, fluxo completo**

Pré-requisito: pelo menos 1 sessão com `status='realizada'` sem evolução (usar o check-in/check-out da agenda, PR #2, ou `markEvaluationDone` na página do paciente).

1. Em `/terapeuta?therapist=<id-do-terapeuta-certo>`, confirmar que a sessão aparece em "Evoluções pendentes" e clicar nela.
2. Confirmar que abre `/terapeuta/evolucao/<id>` com o formulário (não a tela de "já registrada").
3. Preencher presença (clicar num número 1-5), marcar 1 comportamento (confirmar que o seletor de intensidade aparece só depois de marcado), marcar 1 orientação, preencher texto livre, clicar "Confirmar e assinar".
4. Confirmar que redireciona pra `/terapeuta?therapist=<id>` e a sessão não aparece mais em pendências.
5. Verificar no banco (`mcp__Supabase__execute_sql`): `select structured, free_text, signed_at, version, supersedes_id from session_notes where appointment_id = '<id>';` — `structured` deve ter os 3 campos certos, `signed_at` preenchido, `version=1`, `supersedes_id` null.
6. Tentar submeter sem selecionar presença → erro "Selecione a presença/engajamento (1 a 5)." em português, sem gravar nada (confirmar que não criou linha duplicada no banco).
7. Reabrir a mesma URL `/terapeuta/evolucao/<id>` (da sessão que acabou de ganhar evolução) → deve mostrar "Evolução já registrada." em vez do formulário.

- [ ] **Step 4: Commit**

```bash
git add app/terapeuta/evolucao/
git commit -m "feat: formulário de evolução clínica mínima"
```

---

## Self-Review

**Spec coverage:** identidade do terapeuta via seletor (Task 2), evoluções pendentes antes das sessões de hoje na hierarquia visual (Task 2), campos estruturados do §9.4 sem metas (Task 1 + 4), assinatura sem PIN gravando `signed_at` na mesma inserção (Task 3), `version=1`/`supersedes_id=null` fixos nesta entrega (Task 3), tela de "já registrada" em vez de permitir reedição (Task 4) — todos os itens do spec `2026-09-04-evolucao-clinica-minima-design.md` têm task correspondente. Anexos, offline-first e metas ficam deliberadamente de fora — nenhuma task tenta implementá-los.

**Placeholder scan:** nenhum "TBD"/"implementar depois" — a única nota de dependência entre tasks (link da Task 2 pra rota que só existe na Task 4, dando 404 até lá) já vem com a instrução exata de que é esperado, não é um placeholder vazio.

**Type consistency:** `ActionResult` (Task 3) segue o mesmo formato `{success:true}|{success:false,error:string}` de toda Server Action do projeto. `SessionNoteStructured` (Task 1) é definido uma vez e usado como referência do formato gravado, sem ser re-declarado em outro arquivo. `BEHAVIOR_TYPES`/`BEHAVIOR_INTENSITIES`/`FAMILY_GUIDANCE_OPTIONS` são importados (não redefinidos) tanto pela Server Action (Task 3, validação) quanto pelo formulário (Task 4, opções exibidas) — as duas pontas não podem divergir.
