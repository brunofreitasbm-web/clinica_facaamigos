# Cadastro Contínuo + Agenda + Convênios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir, em cima do scaffold Next.js já existente, o CRUD de convênios, uma agenda visual mínima e o cadastro contínuo de paciente nos 5 estágios do PRD §9.1 — usando um cliente Supabase service-role (sem RLS) porque não há login funcional ainda.

**Architecture:** Server Components para leitura direta do banco (via cliente admin), Server Actions para escrita, mapeamento explícito de erros de constraint do Postgres pra mensagens em português. Ver `docs/superpowers/specs/2026-09-04-cadastro-continuo-design.md` para o design completo.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, `@supabase/supabase-js` (cliente admin service-role), Supabase Postgres (projeto `vththexblpxwocbowhsv`).

## Global Constraints

- Todo cliente admin (`lib/supabase/admin.ts`) só é importado por Server Actions e Server Components — nunca por um arquivo com `"use client"`.
- Toda Server Action retorna `{ success: true, data: T } | { success: false, error: string }` — nunca lança exceção sem tratamento pro client component.
- Mensagens de erro de constraint do Postgres (sqlstate, texto de exceção do trigger) nunca aparecem cruas na UI — sempre mapeadas para texto em português.
- Cores de status e componentes visuais seguem o design system já commitado (`DESIGN.md`, `components/measurement-card.tsx`, `components/page-header.tsx`) — reusar, não reinventar.
- `clinic_id` fixo usado em todas as escritas: o único registro em `clinics` criado na Task 1 (não existe seletor de clínica — UI single-tenant, PRD §2/§6).
- Sem autenticação real nesta entrega — débito técnico já registrado no spec.

---

## Task 1: Dados de desenvolvimento + cliente Supabase admin

**Files:**
- Create: `lib/supabase/admin.ts`
- Create: `docs/superpowers/scratch/seed-dev-data.sql` (script de referência, não é migration — dado, não schema)

**Interfaces:**
- Produces: `createAdminClient(): SupabaseClient<Database>` — cliente service-role, usado por todas as tasks seguintes.
- Produces (dados fixos, IDs reais no banco após rodar): 1 `clinics` row, 2 `rooms`, 3 `profiles` (1 gestor, 2 terapeutas) com `auth.users` correspondentes.

- [ ] **Step 1: Pedir a service role key ao usuário e configurar `.env.local`**

A service role key não é exposta por nenhuma ferramenta MCP (segurança). Peça ao usuário: "Supabase Dashboard → Project Settings → API → service_role key (secret)" do projeto `vththexblpxwocbowhsv`, e adicione em `.env.local` (NÃO em `.env.local.example`, que fica sem segredo):

```
SUPABASE_SERVICE_ROLE_KEY=<colar aqui>
```

- [ ] **Step 2: Criar `lib/supabase/admin.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cliente service-role: ignora RLS. Só para uso em Server Actions/Server
 * Components, nunca em código client-side. Débito técnico registrado em
 * docs/superpowers/specs/2026-09-04-cadastro-continuo-design.md —
 * substituir por escrita autenticada quando o login existir.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
```

- [ ] **Step 3: Seed de dados de desenvolvimento (rodar uma vez via `mcp__Supabase__execute_sql`, project_id="vththexblpxwocbowhsv")**

```sql
insert into auth.users (id, email) values
  ('c1000000-0000-0000-0000-000000000001', 'gestor@facaamigos.dev'),
  ('c1000000-0000-0000-0000-000000000002', 'terapeuta.ana@facaamigos.dev'),
  ('c1000000-0000-0000-0000-000000000003', 'terapeuta.bruno@facaamigos.dev')
on conflict do nothing;

insert into clinics (id, name) values
  ('c0000000-0000-0000-0000-000000000001', 'FaçaAmigos')
on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name, active) values
  ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'gestor', 'Bruno Freitas', true),
  ('c1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Ana Souza', true),
  ('c1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Bruno Lima', true)
on conflict do nothing;

insert into rooms (id, clinic_id, name, capacity) values
  ('c2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Sala 1', 1),
  ('c2000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Sala 2', 1)
on conflict do nothing;
```

Salve esse SQL em `docs/superpowers/scratch/seed-dev-data.sql` para referência futura (não roda automaticamente — é idempotente via `on conflict do nothing`, pode rodar de novo à toa).

- [ ] **Step 4: Verificar**

```sql
select (select count(*) from clinics) as clinics,
       (select count(*) from rooms) as rooms,
       (select count(*) from profiles) as profiles;
```

Expected: `clinics=1, rooms=2, profiles=3`.

- [ ] **Step 5: Criar constante de clínica fixa**

Crie `lib/constants.ts`:

```typescript
export const DEV_CLINIC_ID = "c0000000-0000-0000-0000-000000000001";
```

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/admin.ts lib/constants.ts docs/superpowers/scratch/seed-dev-data.sql .env.local.example
git commit -m "feat: cliente Supabase admin (service-role) e seed de dados de desenvolvimento"
```

(`.env.local` com o segredo real não é commitado — já está no `.gitignore`.)

---

## Task 2: Convênios — listagem e criação

**Files:**
- Create: `app/gestor/convenios/page.tsx`
- Create: `app/gestor/convenios/actions.ts`
- Create: `app/gestor/convenios/insurer-form.tsx`

**Interfaces:**
- Consumes: `createAdminClient` (Task 1), `DEV_CLINIC_ID` (Task 1), `MeasurementCard`/`PageHeader` (scaffold existente).
- Produces: Server Action `createInsurer(formData: FormData): Promise<{ success: true } | { success: false; error: string }>`.

- [ ] **Step 1: Server Action `createInsurer`**

```typescript
// app/gestor/convenios/actions.ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { revalidatePath } from "next/cache";

export async function createInsurer(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const ansCode = String(formData.get("ans_code") ?? "").trim();

  if (!name) {
    return { success: false, error: "Nome do convênio é obrigatório." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("insurers").insert({
    clinic_id: DEV_CLINIC_ID,
    name,
    ans_code: ansCode || null,
  });

  if (error) {
    return { success: false, error: "Não foi possível salvar o convênio. Tente de novo." };
  }

  revalidatePath("/gestor/convenios");
  return { success: true };
}
```

- [ ] **Step 2: Form client component**

```tsx
// app/gestor/convenios/insurer-form.tsx
"use client";

import { useState, useTransition } from "react";
import { createInsurer } from "./actions";

export function InsurerForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-5 sm:flex-row sm:items-end"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createInsurer(formData);
          if (!result.success) {
            setError(result.error);
            return;
          }
          (document.getElementById("insurer-form") as HTMLFormElement)?.reset();
        });
      }}
      id="insurer-form"
    >
      <div className="flex-1">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="name">
          Nome do convênio
        </label>
        <input
          id="name"
          name="name"
          required
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="sm:w-40">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="ans_code">
          Código ANS
        </label>
        <input
          id="ans_code"
          name="ans_code"
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
      >
        {isPending ? "Salvando…" : "Adicionar"}
      </button>
      {error && <p className="text-xs text-status-negative-text sm:basis-full">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Página de listagem**

```tsx
// app/gestor/convenios/page.tsx
import { PageHeader } from "@/components/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { InsurerForm } from "./insurer-form";

export default async function ConveniosPage() {
  const supabase = createAdminClient();
  const { data: insurers } = await supabase
    .from("insurers")
    .select("id, name, ans_code")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("name");

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Gestor"
        title="Convênios"
        description="Só o gestor cadastra convênio novo — recepção e faturamento usam a lista pra vincular ao paciente."
      />
      <div className="flex flex-col gap-6 p-6 sm:p-10">
        <InsurerForm />
        <ul className="flex flex-col gap-2">
          {(insurers ?? []).map((insurer) => (
            <li
              key={insurer.id}
              className="rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm"
            >
              <span className="font-medium text-ink">{insurer.name}</span>
              {insurer.ans_code && (
                <span className="ml-2 text-ink-faint">ANS {insurer.ans_code}</span>
              )}
            </li>
          ))}
          {(insurers ?? []).length === 0 && (
            <li className="text-sm text-ink-faint">Nenhum convênio cadastrado ainda.</li>
          )}
        </ul>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Testar manualmente**

Rodar `npm run dev`, abrir `/gestor/convenios`, cadastrar um convênio ("Convênio Teste", ANS "123456"), confirmar que aparece na lista após o submit sem reload manual da página (via `revalidatePath`).

- [ ] **Step 5: Commit**

```bash
git add app/gestor/convenios/
git commit -m "feat: CRUD mínimo de convênios (gestor)"
```

---

## Task 3: Agenda — grade visual de leitura (sala × horário)

**Files:**
- Create: `app/recepcao/agenda/page.tsx`
- Create: `app/recepcao/agenda/day-grid.tsx`

**Interfaces:**
- Consumes: `createAdminClient`, `DEV_CLINIC_ID` (Task 1).
- Produces: tipo `AgendaAppointment` (exportado de `day-grid.tsx`) — `{ id: string; startsAt: string; endsAt: string; roomId: string; roomName: string; therapistName: string; patientName: string; status: string }`, usado pela Task 4.

- [ ] **Step 1: Componente de grade (recebe dados prontos, sem buscar nada)**

```tsx
// app/recepcao/agenda/day-grid.tsx
export type AgendaAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  roomId: string;
  roomName: string;
  therapistName: string;
  patientName: string;
  status: string;
};

const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i); // 08h–19h

const STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  falta_familia: "Falta",
  cancelada_familia: "Cancelada",
  cancelada_terapeuta: "Cancelada",
  cancelada_clinica: "Cancelada",
  remarcada: "Remarcada",
};

export function DayGrid({
  rooms,
  appointments,
}: {
  rooms: { id: string; name: string }[];
  appointments: AgendaAppointment[];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-paper-line-strong bg-paper/60">
      <div
        className="grid min-w-[600px]"
        style={{ gridTemplateColumns: `80px repeat(${rooms.length}, 1fr)` }}
      >
        <div className="border-b border-r border-paper-line-strong" />
        {rooms.map((room) => (
          <div
            key={room.id}
            className="border-b border-r border-paper-line-strong px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-soft last:border-r-0"
          >
            {room.name}
          </div>
        ))}
        {HOURS.map((hour) => (
          <div key={hour} className="contents">
            <div className="border-b border-r border-paper-line-strong px-2 py-3 font-mono text-xs text-ink-faint">
              {String(hour).padStart(2, "0")}:00
            </div>
            {rooms.map((room) => {
              const match = appointments.find((a) => {
                const startHour = new Date(a.startsAt).getHours();
                return a.roomId === room.id && startHour === hour;
              });
              return (
                <div
                  key={room.id}
                  className="min-h-14 border-b border-r border-paper-line-strong p-1 last:border-r-0"
                >
                  {match && (
                    <div className="rounded bg-chart-soft px-2 py-1 text-xs">
                      <p className="font-medium text-ink">{match.patientName}</p>
                      <p className="text-ink-soft">{match.therapistName}</p>
                      <p className="text-ink-faint">{STATUS_LABEL[match.status] ?? match.status}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Página que busca dados do dia**

```tsx
// app/recepcao/agenda/page.tsx
import { PageHeader } from "@/components/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { DayGrid, type AgendaAppointment } from "./day-grid";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const day = date ?? new Date().toISOString().slice(0, 10);

  const supabase = createAdminClient();

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("name");

  const dayStart = `${day}T00:00:00`;
  const dayEnd = `${day}T23:59:59`;

  const { data: rawAppointments } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, room_id, rooms(name), profiles!appointments_therapist_id_fkey(full_name), patients(full_name)",
    )
    .gte("starts_at", dayStart)
    .lte("starts_at", dayEnd);

  const appointments: AgendaAppointment[] = (rawAppointments ?? []).map((a) => ({
    id: a.id,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    roomId: a.room_id,
    roomName: (a.rooms as { name: string } | null)?.name ?? "",
    therapistName:
      (a.profiles as { full_name: string } | null)?.full_name ?? "",
    patientName: (a.patients as { full_name: string } | null)?.full_name ?? "",
    status: a.status,
  }));

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Agenda do dia"
        description={`Sessões de ${day.split("-").reverse().join("/")}, por sala.`}
      />
      <div className="flex flex-col gap-4 p-6 sm:p-10">
        <form className="flex items-center gap-2" method="get">
          <input
            type="date"
            name="date"
            defaultValue={day}
            className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
          />
          <button
            type="submit"
            className="rounded-md border border-paper-line-strong px-3 py-2 text-sm text-ink hover:border-chart"
          >
            Ver dia
          </button>
        </form>
        <DayGrid rooms={rooms ?? []} appointments={appointments} />
      </div>
    </main>
  );
}
```

**Nota:** o nome exato da foreign key `appointments_therapist_id_fkey` precisa ser confirmado contra o schema real antes de rodar — se o Postgrest reclamar de nome de relação ambíguo (`appointments` tem duas FKs pra `profiles`: `therapist_id` e `cancelled_by`), use a sintaxe `profiles!therapist_id(full_name)` no lugar (Postgrest aceita o nome da coluna FK direto desde v11+). Testar e ajustar no Step 3.

- [ ] **Step 3: Testar manualmente**

`npm run dev`, abrir `/recepcao/agenda` — deve carregar sem erro (grade vazia, já que não há appointments ainda). Se o Postgrest reclamar da relação `profiles`/`rooms`/`patients`, ajustar a sintaxe do `select` (ver nota do Step 2) e testar de novo.

- [ ] **Step 4: Commit**

```bash
git add app/recepcao/agenda/
git commit -m "feat: agenda — grade visual de leitura por sala e horário"
```

---

## Task 4: Agenda — criar sessão com tratamento de conflito

**Files:**
- Create: `app/recepcao/agenda/actions.ts`
- Create: `app/recepcao/agenda/appointment-form.tsx`
- Modify: `app/recepcao/agenda/page.tsx` (adicionar botão que abre o form)

**Interfaces:**
- Consumes: `AgendaAppointment` (Task 3), `createAdminClient`, `DEV_CLINIC_ID` (Task 1).
- Produces: Server Action `createAppointment(formData: FormData): Promise<{ success: true } | { success: false; error: string }>`, usada só nesta task (não referenciada por tasks seguintes, mas o padrão de mapeamento de erro do Postgres é reusado na Task 7).

- [ ] **Step 1: Server Action com mapeamento de erro do guard/exclude constraint**

```typescript
// app/recepcao/agenda/actions.ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function createAppointment(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const patientId = String(formData.get("patient_id") ?? "");
  const therapistId = String(formData.get("therapist_id") ?? "");
  const roomId = String(formData.get("room_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const discipline = String(formData.get("discipline") ?? "").trim();

  if (!patientId || !therapistId || !roomId || !date || !time || !discipline) {
    return { success: false, error: "Preencha todos os campos." };
  }

  const startsAt = new Date(`${date}T${time}:00`);
  const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000); // 50 min padrão

  const supabase = createAdminClient();
  const { error } = await supabase.from("appointments").insert({
    patient_id: patientId,
    therapist_id: therapistId,
    room_id: roomId,
    discipline,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "agendada",
  });

  if (error) {
    if (error.code === "23P01") {
      return {
        success: false,
        error: "Sala ou terapeuta já tem sessão nesse horário.",
      };
    }
    return { success: false, error: "Não foi possível agendar. Tente de novo." };
  }

  revalidatePath("/recepcao/agenda");
  return { success: true };
}
```

- [ ] **Step 2: Form client component**

```tsx
// app/recepcao/agenda/appointment-form.tsx
"use client";

import { useState, useTransition } from "react";
import { createAppointment } from "./actions";

export function AppointmentForm({
  patients,
  therapists,
  rooms,
  defaultDate,
}: {
  patients: { id: string; full_name: string }[];
  therapists: { id: string; full_name: string }[];
  rooms: { id: string; name: string }[];
  defaultDate: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper"
      >
        + Agendar sessão
      </button>
    );
  }

  return (
    <form
      className="grid grid-cols-1 gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-5 sm:grid-cols-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createAppointment(formData);
          if (!result.success) {
            setError(result.error);
            return;
          }
          setOpen(false);
        });
      }}
    >
      <select name="patient_id" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm">
        <option value="">Paciente</option>
        {patients.map((p) => (
          <option key={p.id} value={p.id}>{p.full_name}</option>
        ))}
      </select>
      <select name="therapist_id" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm">
        <option value="">Terapeuta</option>
        {therapists.map((t) => (
          <option key={t.id} value={t.id}>{t.full_name}</option>
        ))}
      </select>
      <select name="room_id" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm">
        <option value="">Sala</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
      <input type="date" name="date" required defaultValue={defaultDate} className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
      <input type="time" name="time" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
      <input type="text" name="discipline" required placeholder="Disciplina (ex: aba)" className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
      <div className="flex gap-2 sm:col-span-3">
        <button type="submit" disabled={isPending} className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50">
          {isPending ? "Agendando…" : "Confirmar"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-ink">
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs text-status-negative-text sm:col-span-3">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Ligar o form na página** — modificar `app/recepcao/agenda/page.tsx`: importar `AppointmentForm`, buscar `patients` (`id, full_name`) e `therapists` (`profiles` com `role='terapeuta'`), passar pro componente entre o form de data e o `DayGrid`.

```typescript
const { data: patients } = await supabase
  .from("patients")
  .select("id, full_name")
  .eq("clinic_id", DEV_CLINIC_ID)
  .order("full_name");

const { data: therapists } = await supabase
  .from("profiles")
  .select("id, full_name")
  .eq("clinic_id", DEV_CLINIC_ID)
  .eq("role", "terapeuta")
  .order("full_name");
```

```tsx
<AppointmentForm
  patients={patients ?? []}
  therapists={therapists ?? []}
  rooms={rooms ?? []}
  defaultDate={day}
/>
```

- [ ] **Step 4: Testar manualmente**

Com o seed da Task 1 (2 terapeutas, 2 salas), sem pacientes ainda (Task 5 cria o primeiro): confirmar que o dropdown de paciente aparece vazio até a Task 5 estar pronta. Depois de ter ao menos 1 paciente, agendar uma sessão, ver aparecer na grade. Tentar agendar duas sessões na mesma sala/horário e confirmar que a segunda mostra "Sala ou terapeuta já tem sessão nesse horário." em vez de travar/erro cru.

- [ ] **Step 5: Commit**

```bash
git add app/recepcao/agenda/
git commit -m "feat: agenda — criar sessão com tratamento de conflito de horário"
```

---

## Task 5: Cadastro — criar lead (estágio 1)

**Files:**
- Create: `app/recepcao/pacientes/novo/page.tsx`
- Create: `app/recepcao/pacientes/actions.ts`

**Interfaces:**
- Consumes: `createAdminClient`, `DEV_CLINIC_ID` (Task 1).
- Produces: Server Action `createLead(formData: FormData): Promise<{ success: true; patientId: string } | { success: false; error: string }>`, usada só aqui.

- [ ] **Step 1: Server Action**

```typescript
// app/recepcao/pacientes/actions.ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";

export async function createLead(
  formData: FormData,
): Promise<{ success: true; patientId: string } | { success: false; error: string }> {
  const childName = String(formData.get("child_name") ?? "").trim();
  const guardianName = String(formData.get("guardian_name") ?? "").trim();
  const guardianPhone = String(formData.get("guardian_phone") ?? "").trim();
  const entrySource = String(formData.get("entry_source") ?? "").trim();
  const complaint = String(formData.get("complaint") ?? "").trim();
  const birthDate = String(formData.get("birth_date") ?? "");

  if (!childName || !guardianName || !guardianPhone || !birthDate) {
    return { success: false, error: "Nome da criança, responsável, telefone e data de nascimento são obrigatórios." };
  }

  const supabase = createAdminClient();

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .insert({
      clinic_id: DEV_CLINIC_ID,
      full_name: childName,
      birth_date: birthDate,
      status: "lead",
      entry_source: entrySource || null,
      complaint: complaint || null,
      first_contact_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (patientError || !patient) {
    return { success: false, error: "Não foi possível salvar o paciente. Tente de novo." };
  }

  const { error: guardianError } = await supabase.from("guardians").insert({
    patient_id: patient.id,
    full_name: guardianName,
    phone: guardianPhone,
  });

  if (guardianError) {
    return { success: false, error: "Paciente salvo, mas houve erro ao salvar o responsável." };
  }

  return { success: true, patientId: patient.id };
}
```

- [ ] **Step 2: Página do formulário**

```tsx
// app/recepcao/pacientes/novo/page.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createLead } from "../actions";

export default function NovoPacientePage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Novo paciente"
        description="Cadastro mínimo — meta é 30 segundos. Resto dos dados vem depois, na ficha do paciente."
      />
      <form
        className="flex max-w-xl flex-col gap-4 p-6 sm:p-10"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await createLead(formData);
            if (!result.success) {
              setError(result.error);
              return;
            }
            router.push(`/recepcao/pacientes/${result.patientId}`);
          });
        }}
      >
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="child_name">
            Nome da criança
          </label>
          <input id="child_name" name="child_name" required className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink" />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="birth_date">
            Data de nascimento
          </label>
          <input id="birth_date" name="birth_date" type="date" required className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink" />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="guardian_name">
            Nome do responsável
          </label>
          <input id="guardian_name" name="guardian_name" required className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink" />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="guardian_phone">
            Telefone do responsável
          </label>
          <input id="guardian_phone" name="guardian_phone" required className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink" />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="entry_source">
            Origem
          </label>
          <input id="entry_source" name="entry_source" placeholder="WhatsApp, Instagram, indicação…" className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink" />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="complaint">
            Queixa em uma linha
          </label>
          <input id="complaint" name="complaint" className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink" />
        </div>
        <button type="submit" disabled={isPending} className="self-start rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50">
          {isPending ? "Salvando…" : "Cadastrar"}
        </button>
        {error && <p className="text-xs text-status-negative-text">{error}</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Testar manualmente**

`npm run dev`, abrir `/recepcao/pacientes/novo`, preencher e submeter. Deve redirecionar pra `/recepcao/pacientes/<id>` (que ainda não existe — Task 6 cria; até lá, confirmar via `execute_sql` que o paciente e o guardian foram criados corretamente).

- [ ] **Step 4: Commit**

```bash
git add app/recepcao/pacientes/novo/ app/recepcao/pacientes/actions.ts
git commit -m "feat: cadastro contínuo — estágio 1 (lead)"
```

---

## Task 6: Cadastro — página do paciente com checklist de estágios

**Files:**
- Create: `app/recepcao/pacientes/[id]/page.tsx`
- Create: `components/stage-checklist.tsx`

**Interfaces:**
- Consumes: `createAdminClient` (Task 1).
- Produces: componente `StageChecklist` (props: `{ stage: 1 | 2 | 3 | 4 | 5 }`) reusado só aqui (é renderizado nesta página, que a Task 7 também usa via revalidação).

- [ ] **Step 1: Componente de checklist visual**

```tsx
// components/stage-checklist.tsx
const STAGES = [
  { n: 1, label: "Lead" },
  { n: 2, label: "Avaliação agendada" },
  { n: 3, label: "Avaliação realizada" },
  { n: 4, label: "Autorização" },
  { n: 5, label: "Grade montada" },
] as const;

export function StageChecklist({ stage }: { stage: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <ol className="flex flex-col gap-2">
      {STAGES.map((s) => {
        const done = s.n < stage;
        const current = s.n === stage;
        return (
          <li key={s.n} className="flex items-center gap-3 text-sm">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                done
                  ? "bg-status-positive text-paper"
                  : current
                    ? "bg-chart text-paper"
                    : "bg-status-neutral-soft text-status-neutral-text"
              }`}
            >
              {done ? "✓" : s.n}
            </span>
            <span className={current ? "font-medium text-ink" : "text-ink-soft"}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: Página do paciente**

```tsx
// app/recepcao/pacientes/[id]/page.tsx
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StageChecklist } from "@/components/stage-checklist";
import { createAdminClient } from "@/lib/supabase/admin";

function computeStage(patient: {
  status: string;
  evaluated_at: string | null;
  first_session_at: string | null;
}): 1 | 2 | 3 | 4 | 5 {
  if (patient.status === "ativo" || patient.first_session_at) return 5;
  if (patient.status === "avaliacao" && patient.evaluated_at) return 4;
  if (patient.status === "avaliacao") return 3;
  return 1;
}

export default async function PacientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("id, full_name, status, evaluated_at, first_session_at, entry_source, complaint")
    .eq("id", id)
    .maybeSingle();

  if (!patient) notFound();

  const { data: guardians } = await supabase
    .from("guardians")
    .select("full_name, phone")
    .eq("patient_id", id);

  const stage = computeStage(patient);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title={patient.full_name}
        description={`Origem: ${patient.entry_source ?? "não informada"}`}
      />
      <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2 sm:p-10">
        <div className="rounded-md border border-paper-line-strong bg-paper/60 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">Estágio</h2>
          <div className="mt-3">
            <StageChecklist stage={stage} />
          </div>
        </div>
        <div className="rounded-md border border-paper-line-strong bg-paper/60 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">Responsáveis</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {(guardians ?? []).map((g) => (
              <li key={g.phone}>
                {g.full_name} — {g.phone}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Testar manualmente**

Abrir `/recepcao/pacientes/<id-do-lead-criado-na-task-5>` — deve mostrar estágio 1 marcado como atual, guardian listado.

- [ ] **Step 4: Commit**

```bash
git add app/recepcao/pacientes/\[id\]/ components/stage-checklist.tsx
git commit -m "feat: cadastro contínuo — página do paciente com checklist de 5 estágios"
```

---

## Task 7: Cadastro — ações de transição de estágio (2 a 5)

**Files:**
- Create: `app/recepcao/pacientes/[id]/stage-actions.ts`
- Modify: `app/recepcao/pacientes/[id]/page.tsx` (adicionar os botões/forms de transição)

**Interfaces:**
- Consumes: `computeStage` (Task 6, mover para arquivo compartilhado se necessário), `createAdminClient` (Task 1).
- Produces: Server Actions `scheduleEvaluation`, `markEvaluationDone`, `registerAuthorization`, `activatePatient` — todas com a mesma assinatura `(patientId: string, formData: FormData) => Promise<{ success: true } | { success: false; error: string }>`.

- [ ] **Step 1: Server Actions de transição**

```typescript
// app/recepcao/pacientes/[id]/stage-actions.ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

export async function scheduleEvaluation(
  patientId: string,
  formData: FormData,
): Promise<ActionResult> {
  const therapistId = String(formData.get("therapist_id") ?? "");
  const roomId = String(formData.get("room_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");

  if (!therapistId || !roomId || !date || !time) {
    return { success: false, error: "Preencha terapeuta, sala, data e hora." };
  }

  const startsAt = new Date(`${date}T${time}:00`);
  const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000);

  const supabase = createAdminClient();
  const { error: apptError } = await supabase.from("appointments").insert({
    patient_id: patientId,
    therapist_id: therapistId,
    room_id: roomId,
    discipline: "avaliacao",
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "agendada",
    is_evaluation: true,
  });

  if (apptError) {
    if (apptError.code === "23P01") {
      return { success: false, error: "Sala ou terapeuta já tem sessão nesse horário." };
    }
    return { success: false, error: "Não foi possível agendar a avaliação." };
  }

  const { error: patientError } = await supabase
    .from("patients")
    .update({ status: "avaliacao" })
    .eq("id", patientId);

  if (patientError) {
    return { success: false, error: "Avaliação agendada, mas houve erro ao atualizar o status do paciente." };
  }

  revalidatePath(`/recepcao/pacientes/${patientId}`);
  return { success: true };
}

export async function markEvaluationDone(patientId: string): Promise<ActionResult> {
  const supabase = createAdminClient();

  const { data: evalAppointment } = await supabase
    .from("appointments")
    .select("id")
    .eq("patient_id", patientId)
    .eq("is_evaluation", true)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!evalAppointment) {
    return { success: false, error: "Nenhuma avaliação agendada encontrada pra este paciente." };
  }

  const { error: apptError } = await supabase
    .from("appointments")
    .update({ status: "realizada" })
    .eq("id", evalAppointment.id);

  if (apptError) {
    return { success: false, error: "Não foi possível marcar a avaliação como realizada." };
  }

  const { error: patientError } = await supabase
    .from("patients")
    .update({ evaluated_at: new Date().toISOString() })
    .eq("id", patientId);

  if (patientError) {
    return { success: false, error: "Avaliação marcada, mas houve erro ao atualizar o paciente." };
  }

  revalidatePath(`/recepcao/pacientes/${patientId}`);
  return { success: true };
}

export async function registerAuthorization(
  patientId: string,
  formData: FormData,
): Promise<ActionResult> {
  const insurerId = String(formData.get("insurer_id") ?? "");
  const guideNumber = String(formData.get("guide_number") ?? "").trim();
  const procedureCode = String(formData.get("procedure_code") ?? "").trim();
  const sessionsAuthorized = Number(formData.get("sessions_authorized") ?? 0);
  const validFrom = String(formData.get("valid_from") ?? "");
  const validTo = String(formData.get("valid_to") ?? "");

  if (!insurerId || !procedureCode || !sessionsAuthorized || !validFrom || !validTo) {
    return { success: false, error: "Preencha convênio, procedimento, sessões autorizadas e vigência." };
  }

  const supabase = createAdminClient();

  const { data: patientInsurance, error: piError } = await supabase
    .from("patient_insurance")
    .insert({ patient_id: patientId, insurer_id: insurerId, is_private: false })
    .select("id")
    .single();

  if (piError || !patientInsurance) {
    return { success: false, error: "Não foi possível vincular o convênio ao paciente." };
  }

  const { error: authError } = await supabase.from("authorizations").insert({
    patient_insurance_id: patientInsurance.id,
    guide_number: guideNumber || null,
    procedure_code: procedureCode,
    sessions_authorized: sessionsAuthorized,
    valid_from: validFrom,
    valid_to: validTo,
    status: "ativa",
  });

  if (authError) {
    return { success: false, error: "Convênio vinculado, mas houve erro ao registrar a autorização." };
  }

  revalidatePath(`/recepcao/pacientes/${patientId}`);
  return { success: true };
}

export async function activatePatient(patientId: string, formData: FormData): Promise<ActionResult> {
  const therapistId = String(formData.get("therapist_id") ?? "");
  const roomId = String(formData.get("room_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const discipline = String(formData.get("discipline") ?? "").trim();

  if (!therapistId || !roomId || !date || !time || !discipline) {
    return { success: false, error: "Preencha terapeuta, sala, data, hora e disciplina." };
  }

  const supabase = createAdminClient();

  const { data: authorization } = await supabase
    .from("authorizations")
    .select("id, patient_insurance_id, patient_insurance!inner(patient_id)")
    .eq("patient_insurance.patient_id", patientId)
    .eq("status", "ativa")
    .limit(1)
    .maybeSingle();

  const startsAt = new Date(`${date}T${time}:00`);
  const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000);

  const { error: apptError } = await supabase.from("appointments").insert({
    patient_id: patientId,
    therapist_id: therapistId,
    room_id: roomId,
    discipline,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "agendada",
    authorization_id: authorization?.id ?? null,
  });

  if (apptError) {
    if (apptError.code === "23P01") {
      return { success: false, error: "Sala ou terapeuta já tem sessão nesse horário." };
    }
    return { success: false, error: "Não foi possível criar a primeira sessão da grade." };
  }

  const { error: patientError } = await supabase
    .from("patients")
    .update({ status: "ativo", first_session_at: startsAt.toISOString() })
    .eq("id", patientId);

  if (patientError) {
    return { success: false, error: "Sessão criada, mas houve erro ao ativar o paciente." };
  }

  revalidatePath(`/recepcao/pacientes/${patientId}`);
  return { success: true };
}
```

- [ ] **Step 2: Adicionar UI de transição em `app/recepcao/pacientes/[id]/page.tsx`**

Adicione, abaixo do bloco de estágio (dentro do mesmo `main`), um `<section>` cliente-separado por estágio corrente. Como as 4 actions recebem `patientId` como primeiro argumento (server action com argumento extra via `bind` é o padrão do Next.js), crie um pequeno componente client `stage-action-form.tsx` reusável:

```tsx
// app/recepcao/pacientes/[id]/stage-action-form.tsx
"use client";

import { useState, useTransition, type ReactNode } from "react";

export function StageActionForm({
  action,
  children,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<{ success: true } | { success: false; error: string }>;
  children: ReactNode;
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await action(formData);
          if (!result.success) setError(result.error);
        });
      }}
    >
      {children}
      <button type="submit" disabled={isPending} className="self-start rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50">
        {isPending ? "Salvando…" : submitLabel}
      </button>
      {error && <p className="text-xs text-status-negative-text">{error}</p>}
    </form>
  );
}
```

Depois, em `page.tsx`, importe `scheduleEvaluation`, `markEvaluationDone`, `registerAuthorization`, `activatePatient` de `./stage-actions`, `StageActionForm` de `./stage-action-form`, busque `therapists`, `rooms`, `insurers` (mesmo padrão de query das Tasks 2–4), e renderize condicionalmente por `stage`:

```tsx
{stage === 1 && (
  <StageActionForm action={scheduleEvaluation.bind(null, patient.id)} submitLabel="Agendar avaliação">
    <select name="therapist_id" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm">
      <option value="">Terapeuta</option>
      {(therapists ?? []).map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
    </select>
    <select name="room_id" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm">
      <option value="">Sala</option>
      {(rooms ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
    </select>
    <input type="date" name="date" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
    <input type="time" name="time" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
  </StageActionForm>
)}
{stage === 2 && (
  <StageActionForm action={async () => markEvaluationDone(patient.id)} submitLabel="Marcar avaliação como realizada">
    <p className="text-sm text-ink-soft">Confirma que a avaliação já aconteceu?</p>
  </StageActionForm>
)}
{stage === 3 && (
  <StageActionForm action={registerAuthorization.bind(null, patient.id)} submitLabel="Registrar autorização">
    <select name="insurer_id" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm">
      <option value="">Convênio</option>
      {(insurers ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
    </select>
    <input type="text" name="guide_number" placeholder="Número da guia" className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
    <input type="text" name="procedure_code" required placeholder="Código do procedimento" className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
    <input type="number" name="sessions_authorized" required placeholder="Sessões autorizadas" className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
    <input type="date" name="valid_from" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
    <input type="date" name="valid_to" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
  </StageActionForm>
)}
{stage === 4 && (
  <StageActionForm action={activatePatient.bind(null, patient.id)} submitLabel="Montar grade (1ª sessão)">
    <select name="therapist_id" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm">
      <option value="">Terapeuta</option>
      {(therapists ?? []).map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
    </select>
    <select name="room_id" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm">
      <option value="">Sala</option>
      {(rooms ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
    </select>
    <input type="date" name="date" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
    <input type="time" name="time" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
    <input type="text" name="discipline" required placeholder="Disciplina" className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
  </StageActionForm>
)}
{stage === 5 && <p className="text-sm text-status-positive-text">Paciente ativo — grade montada.</p>}
```

- [ ] **Step 3: Testar manualmente, fluxo completo**

Usando o paciente criado na Task 5: (1) agendar avaliação — confirmar estágio vira 2; (2) marcar avaliação realizada — estágio vira 3; (3) registrar autorização usando o convênio criado na Task 2 — estágio vira 4; (4) montar grade — estágio vira 5, paciente aparece com `status='ativo'`. Em cada passo, verificar também que a sessão criada aparece em `/recepcao/agenda` na data certa.

- [ ] **Step 4: Commit**

```bash
git add app/recepcao/pacientes/
git commit -m "feat: cadastro contínuo — transições de estágio 2 a 5 (avaliação, autorização, grade)"
```

---

## Task 8: Fila de pendências

**Files:**
- Create: `app/recepcao/pacientes/pendencias/page.tsx`

**Interfaces:**
- Consumes: `createAdminClient`, `DEV_CLINIC_ID` (Task 1), `computeStage` (mover de `[id]/page.tsx` para um arquivo compartilhado `lib/patient-stage.ts` nesta task, já que agora dois arquivos precisam dela).

- [ ] **Step 1: Extrair `computeStage` para arquivo compartilhado**

Crie `lib/patient-stage.ts` com o conteúdo da função `computeStage` (mesma implementação da Task 6), e atualize `app/recepcao/pacientes/[id]/page.tsx` para importar de lá em vez de definir localmente:

```typescript
// lib/patient-stage.ts
export function computeStage(patient: {
  status: string;
  evaluated_at: string | null;
  first_session_at: string | null;
}): 1 | 2 | 3 | 4 | 5 {
  if (patient.status === "ativo" || patient.first_session_at) return 5;
  if (patient.status === "avaliacao" && patient.evaluated_at) return 4;
  if (patient.status === "avaliacao") return 3;
  return 1;
}
```

- [ ] **Step 2: Página de pendências**

```tsx
// app/recepcao/pacientes/pendencias/page.tsx
import { PageHeader } from "@/components/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { computeStage } from "@/lib/patient-stage";

const STAGE_LABEL: Record<number, string> = {
  1: "Lead sem avaliação agendada",
  2: "Avaliação agendada, aguardando",
  3: "Avaliação feita, sem autorização",
  4: "Autorizado, sem grade montada",
};

const DAYS_THRESHOLD = 3;

export default async function PendenciasPage() {
  const supabase = createAdminClient();

  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, status, created_at, evaluated_at, first_session_at")
    .eq("clinic_id", DEV_CLINIC_ID)
    .neq("status", "ativo")
    .neq("status", "alta")
    .neq("status", "evadido");

  const now = Date.now();
  const pending = (patients ?? [])
    .map((p) => ({
      ...p,
      stage: computeStage(p),
      daysSinceCreated: Math.floor((now - new Date(p.created_at).getTime()) / 86_400_000),
    }))
    .filter((p) => p.stage < 5 && p.daysSinceCreated >= DAYS_THRESHOLD)
    .sort((a, b) => b.daysSinceCreated - a.daysSinceCreated);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Fila de pendências"
        description={`Pacientes travados em algum estágio há ${DAYS_THRESHOLD}+ dias.`}
      />
      <div className="flex flex-col gap-2 p-6 sm:p-10">
        {pending.length === 0 && (
          <p className="text-sm text-ink-faint">Nenhuma pendência no momento.</p>
        )}
        {pending.map((p) => (
          <a
            key={p.id}
            href={`/recepcao/pacientes/${p.id}`}
            className="flex items-center justify-between rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm hover:border-chart"
          >
            <div>
              <p className="font-medium text-ink">{p.full_name}</p>
              <p className="text-ink-faint">{STAGE_LABEL[p.stage] ?? "Estágio desconhecido"}</p>
            </div>
            <span className="tabular-figure text-status-negative-text">{p.daysSinceCreated}d</span>
          </a>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Testar manualmente**

Criar um paciente novo (Task 5), confirmar que ele NÃO aparece em `/recepcao/pacientes/pendencias` no dia da criação (< 3 dias). Ajustar `created_at` manualmente via `execute_sql` pra 5 dias atrás e confirmar que passa a aparecer, com o estágio certo.

- [ ] **Step 4: Commit**

```bash
git add app/recepcao/pacientes/pendencias/ lib/patient-stage.ts app/recepcao/pacientes/\[id\]/page.tsx
git commit -m "feat: fila de pendências da recepção"
```

---

## Self-Review

**Spec coverage:** os 5 estágios do PRD §9.1 estão nas Tasks 5-7; convênios (Task 2) e agenda (Tasks 3-4) são os pré-requisitos identificados no design; fila de pendências (Task 8) fecha o spec. Decisão de service-role está isolada em `lib/supabase/admin.ts` (Task 1) e usada consistentemente em todas as tasks seguintes — nunca reimplementada.

**Placeholder scan:** nenhum "TBD"/"implementar depois" nas tasks — a única nota de incerteza real (nome da FK no `select` da Task 3) já vem com a instrução exata de como resolver caso o Postgrest reclame, não é um placeholder vazio.

**Type consistency:** `AgendaAppointment` (Task 3) só é usado dentro da própria Task 3-4, sem vazamento pra outras tasks. `ActionResult` (Task 7) segue o mesmo formato `{success:true}|{success:false,error:string}` de todas as outras Server Actions do plano (Tasks 2, 4, 5). `computeStage` é definida uma vez (Task 6) e movida pra local compartilhado quando uma segunda task precisa dela (Task 8), em vez de duplicada.
