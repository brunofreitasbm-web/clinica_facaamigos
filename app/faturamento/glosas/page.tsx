import Link from "next/link";
import { FaturamentoHeader } from "../faturamento-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { GlosaRegisterForm, type EligibleBillingItem, type Therapist } from "./glosa-register-form";
import { GlosaRowActions } from "./glosa-row-actions";
import { CsvImportForm } from "./csv-import-form";
import { PatternAcknowledgeButton } from "./pattern-acknowledge-button";

export const dynamic = "force-dynamic";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const ATTRIBUTABLE_LABEL: Record<string, string> = {
  terapeuta: "Terapeuta",
  recepcao: "Recepção",
  faturamento: "Faturamento",
  operadora: "Operadora",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CLINIC_TIMEZONE,
  });
}

type RawAppointment = {
  starts_at: string;
  patients: { full_name: string } | null;
  therapist: { full_name: string } | null;
  authorizations: {
    guide_number: string | null;
    patient_insurance: { card_number: string | null } | null;
  } | null;
};

type RawSearchRow = {
  id: string;
  procedure_code: string;
  amount: number;
  appointments: RawAppointment | null;
};

function mapSearchRow(row: RawSearchRow): EligibleBillingItem {
  const appt = row.appointments;
  return {
    id: row.id,
    procedureCode: row.procedure_code,
    amount: Number(row.amount),
    startsAt: appt?.starts_at ?? null,
    patientName: appt?.patients?.full_name ?? "Paciente",
    therapistName: appt?.therapist?.full_name ?? "—",
    guideNumber: appt?.authorizations?.guide_number ?? null,
    cardNumber: appt?.authorizations?.patient_insurance?.card_number ?? null,
  };
}

/**
 * Busca `billing_items` elegíveis ('enviado') por nome do paciente OU número
 * da guia. PostgREST não permite `OR` de filtros que atravessam dois
 * caminhos de embed diferentes numa única consulta (cada um precisaria de
 * `!inner` no seu próprio relacionamento, o que forçaria interseção, não
 * união) — por isso são duas consultas separadas, mescladas por `id` aqui.
 */
async function searchEligibleBillingItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  query: string,
): Promise<EligibleBillingItem[]> {
  const pattern = `%${query}%`;

  const [byPatient, byGuide] = await Promise.all([
    supabase
      .from("billing_items")
      .select(
        "id, procedure_code, amount, appointments!inner(starts_at, patients!inner(full_name), therapist:profiles!therapist_id(full_name), authorizations(guide_number, patient_insurance(card_number)))",
      )
      .eq("status", "enviado")
      .ilike("appointments.patients.full_name", pattern)
      .order("id")
      .limit(20),
    supabase
      .from("billing_items")
      .select(
        "id, procedure_code, amount, appointments!inner(starts_at, patients(full_name), therapist:profiles!therapist_id(full_name), authorizations!inner(guide_number, patient_insurance(card_number)))",
      )
      .eq("status", "enviado")
      .ilike("appointments.authorizations.guide_number", pattern)
      .order("id")
      .limit(20),
  ]);

  const merged = new Map<string, EligibleBillingItem>();
  for (const row of (byPatient.data ?? []) as unknown as RawSearchRow[]) {
    merged.set(row.id, mapSearchRow(row));
  }
  for (const row of (byGuide.data ?? []) as unknown as RawSearchRow[]) {
    merged.set(row.id, mapSearchRow(row));
  }
  return Array.from(merged.values());
}

type RawGlosaRow = {
  id: string;
  reason_code: string;
  reason_text: string | null;
  attributable_to: string;
  amount: number;
  appealed_at: string | null;
  recovered_amount: number | null;
  billing_items: {
    procedure_code: string;
    billing_periods: { insurer_id: string } | null;
    appointments: {
      starts_at: string;
      patients: { full_name: string } | null;
      authorizations: { guide_number: string | null } | null;
    } | null;
  } | null;
  attributable_profile: { full_name: string } | null;
};

type RecurringPattern = {
  id: string;
  insurerId: string;
  insurerName: string;
  reasonCode: string;
  occurrencesCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

/**
 * Padrões recorrentes ativos (glosa_recurring_patterns, recalculada
 * diariamente por refresh_glosa_patterns via pg_cron — ver
 * supabase/migrations/20260906000017_glosa_recurring_patterns.sql). Mesmo
 * cuidado de getGlosaBreakdown (lib/glosa-analytics.ts): filtra clinic_id
 * na tabela-base (insurers) em vez de `.eq()` num embed aninhado.
 */
async function getActiveRecurringPatterns(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
): Promise<RecurringPattern[]> {
  const { data: insurers } = await supabase.from("insurers").select("id, name").eq("clinic_id", clinicId);
  const insurerIds = (insurers ?? []).map((i) => i.id);
  const insurerNameById = new Map((insurers ?? []).map((i) => [i.id, i.name]));
  if (insurerIds.length === 0) return [];

  const { data: patterns } = await supabase
    .from("glosa_recurring_patterns")
    .select("id, insurer_id, reason_code, occurrences_count, first_seen_at, last_seen_at")
    .in("insurer_id", insurerIds)
    .eq("status", "ativo")
    .order("occurrences_count", { ascending: false });

  return (patterns ?? []).map((p) => ({
    id: p.id,
    insurerId: p.insurer_id,
    insurerName: insurerNameById.get(p.insurer_id) ?? "Convênio",
    reasonCode: p.reason_code,
    occurrencesCount: p.occurrences_count,
    firstSeenAt: p.first_seen_at,
    lastSeenAt: p.last_seen_at,
  }));
}

export default async function GlosasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; padrao_convenio?: string; padrao_motivo?: string }>;
}) {
  const { q, padrao_convenio, padrao_motivo } = await searchParams;
  const query = (q ?? "").trim();
  const patternInsurerFilter = (padrao_convenio ?? "").trim();
  const patternReasonFilter = (padrao_motivo ?? "").trim();

  const supabase = await createClient();

  const [{ data: therapistsRaw }, { data: rawGlosas }, recurringPatterns] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", DEV_CLINIC_ID)
      .eq("role", "terapeuta")
      .order("full_name"),
    supabase
      .from("glosas")
      .select(
        "id, reason_code, reason_text, attributable_to, amount, appealed_at, recovered_amount, billing_items(procedure_code, billing_periods(insurer_id), appointments(starts_at, patients(full_name), authorizations(guide_number))), attributable_profile:profiles!attributable_profile_id(full_name)",
      )
      // `glosas` não tem coluna de data de criação — `id` (ordem de inserção
      // aproximada) é o melhor proxy disponível pra "mais recentes primeiro",
      // mesmo padrão já usado em app/faturamento/competencias/[id]/page.tsx
      // pra billing_items (que também não tem created_at).
      .order("id", { ascending: false })
      .limit(200),
    getActiveRecurringPatterns(supabase, DEV_CLINIC_ID),
  ]);

  const therapists: Therapist[] = (therapistsRaw ?? []).map((t) => ({ id: t.id, fullName: t.full_name }));

  const eligibleItems = query.length >= 2 ? await searchEligibleBillingItems(supabase, query) : [];

  const allGlosas = ((rawGlosas ?? []) as unknown as RawGlosaRow[]).map((g) => {
    const item = g.billing_items;
    const appt = item?.appointments ?? null;
    return {
      id: g.id,
      reasonCode: g.reason_code,
      reasonText: g.reason_text,
      attributableTo: g.attributable_to,
      attributableProfileName: g.attributable_profile?.full_name ?? null,
      amount: Number(g.amount),
      appealedAt: g.appealed_at,
      recoveredAmount: g.recovered_amount === null ? null : Number(g.recovered_amount),
      procedureCode: item?.procedure_code ?? "—",
      insurerId: item?.billing_periods?.insurer_id ?? null,
      patientName: appt?.patients?.full_name ?? "Paciente",
      guideNumber: appt?.authorizations?.guide_number ?? null,
      startsAt: appt?.starts_at ?? null,
    };
  });

  // Filtro "ver ocorrências" vindo do destaque de padrão recorrente — mesma
  // combinação convênio+motivo usada por refresh_glosa_patterns().
  const glosas = patternInsurerFilter
    ? allGlosas.filter((g) => g.insurerId === patternInsurerFilter && g.reasonCode === patternReasonFilter)
    : allGlosas;

  return (
    <main className="flex flex-1 flex-col">
      <FaturamentoHeader active="glosas" />
      <div className="flex flex-col gap-6 p-6 sm:p-10">
        <div>
          <h1 className="m-0 text-xl font-semibold text-ink">Glosas</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Registro manual de glosas recebidas dos convênios, acompanhamento de recurso e recuperação. Análise por
            motivo/convênio/pessoa está em{" "}
            <Link href="/gestor/financeiro" className="underline">
              Gestão › Financeiro
            </Link>
            .
          </p>
        </div>

        {recurringPatterns.length > 0 && (
          <section className="flex flex-col gap-3 rounded-md border border-status-negative-text/40 bg-status-negative-text/5 p-5">
            <h2 className="text-sm font-medium uppercase tracking-wide text-status-negative-text">
              Padrões recorrentes a evitar
            </h2>
            <p className="text-xs text-ink-soft">
              Estas combinações de convênio + motivo já bateram 3 ou mais ocorrências nos últimos 6 meses — vale
              investigar a causa raiz antes de faturar de novo.
            </p>
            <ul className="flex flex-col gap-2">
              {recurringPatterns.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-paper-line-strong bg-paper px-4 py-3 text-sm"
                >
                  <div>
                    <span className="font-medium text-ink">
                      {p.insurerName} + {p.reasonCode}
                    </span>
                    <span className="ml-2 text-ink-soft">
                      {p.occurrencesCount}ª ocorrência em 6 meses
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/faturamento/glosas?padrao_convenio=${p.insurerId}&padrao_motivo=${encodeURIComponent(p.reasonCode)}`}
                      className="text-xs underline text-ink-soft hover:text-ink"
                    >
                      Ver ocorrências
                    </Link>
                    <PatternAcknowledgeButton patternId={p.id} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">
            Registrar glosa
          </h2>
          <form className="flex items-center gap-2" method="get">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Buscar item por nome do paciente ou número da guia…"
              className="flex-1 rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
            />
            <button
              type="submit"
              className="rounded-md border border-paper-line-strong px-3 py-2 text-sm text-ink hover:border-chart"
            >
              Buscar
            </button>
          </form>
          <GlosaRegisterForm items={eligibleItems} therapists={therapists} searched={query.length >= 2} />
        </section>

        <CsvImportForm />

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">
              Glosas registradas ({glosas.length})
              {patternInsurerFilter && " · filtrado pelo padrão recorrente"}
            </h2>
            {patternInsurerFilter && (
              <Link href="/faturamento/glosas" className="text-xs underline text-ink-soft hover:text-ink">
                Limpar filtro
              </Link>
            )}
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {glosas.map((g) => (
              <li
                key={g.id}
                className="flex flex-col gap-2 rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-medium text-ink">{g.patientName}</span>
                  <span className="tabular-figure text-ink-soft">{formatDateTime(g.startsAt)}</span>
                  <span className="text-ink-soft">{g.procedureCode}</span>
                  <span className="text-ink-faint">Guia: {g.guideNumber ?? "—"}</span>
                  <span className="tabular-figure font-medium text-status-negative-text">
                    {currencyFormatter.format(g.amount)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-ink-soft">
                    <span className="font-medium">{g.reasonCode}</span>
                    {g.reasonText && <span className="ml-2 text-ink-faint">{g.reasonText}</span>}
                  </div>
                  <span className="text-ink-faint">
                    Atribuído: {ATTRIBUTABLE_LABEL[g.attributableTo] ?? g.attributableTo}
                    {g.attributableProfileName ? ` (${g.attributableProfileName})` : ""}
                  </span>
                </div>
                <GlosaRowActions
                  glosaId={g.id}
                  appealedAt={g.appealedAt}
                  recoveredAmount={g.recoveredAmount}
                  glosaAmount={g.amount}
                />
              </li>
            ))}
            {glosas.length === 0 && (
              <li className="text-sm text-ink-faint">Nenhuma glosa registrada ainda.</li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
