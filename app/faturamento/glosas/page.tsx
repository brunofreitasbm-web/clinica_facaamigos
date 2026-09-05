import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { GlosaRegisterForm, type EligibleBillingItem, type Therapist } from "./glosa-register-form";
import { GlosaRowActions } from "./glosa-row-actions";
import { CsvImportForm } from "./csv-import-form";
import { getGlosaBreakdown, type GlosaBreakdownRow } from "@/lib/glosa-analytics";

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
    appointments: {
      starts_at: string;
      patients: { full_name: string } | null;
      authorizations: { guide_number: string | null } | null;
    } | null;
  } | null;
  attributable_profile: { full_name: string } | null;
};

export default async function GlosasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const supabase = await createClient();

  const [{ data: therapistsRaw }, { data: rawGlosas }, breakdown] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", DEV_CLINIC_ID)
      .eq("role", "terapeuta")
      .order("full_name"),
    supabase
      .from("glosas")
      .select(
        "id, reason_code, reason_text, attributable_to, amount, appealed_at, recovered_amount, billing_items(procedure_code, appointments(starts_at, patients(full_name), authorizations(guide_number))), attributable_profile:profiles!attributable_profile_id(full_name)",
      )
      // `glosas` não tem coluna de data de criação — `id` (ordem de inserção
      // aproximada) é o melhor proxy disponível pra "mais recentes primeiro",
      // mesmo padrão já usado em app/faturamento/competencias/[id]/page.tsx
      // pra billing_items (que também não tem created_at).
      .order("id", { ascending: false })
      .limit(200),
    getGlosaBreakdown(supabase, DEV_CLINIC_ID),
  ]);

  const therapists: Therapist[] = (therapistsRaw ?? []).map((t) => ({ id: t.id, fullName: t.full_name }));

  const eligibleItems = query.length >= 2 ? await searchEligibleBillingItems(supabase, query) : [];

  const glosas = ((rawGlosas ?? []) as unknown as RawGlosaRow[]).map((g) => {
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
      patientName: appt?.patients?.full_name ?? "Paciente",
      guideNumber: appt?.authorizations?.guide_number ?? null,
      startsAt: appt?.starts_at ?? null,
    };
  });

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Faturamento"
        title="Glosas"
        description="Registro manual de glosas recebidas dos convênios, acompanhamento de recurso e recuperação."
      />
      <div className="flex flex-col gap-6 p-6 sm:p-10">
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

        {breakdown.totalCount > 0 && (
          <section className="rounded-md border border-paper-line-strong bg-paper/60 p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                Painel de glosa ({breakdown.totalCount})
              </h2>
              <span className="text-sm text-ink-soft">
                Total glosado: <strong className="text-status-negative-text">{currencyFormatter.format(breakdown.totalAmount)}</strong>
                {" · "}Recuperado: <strong className="text-status-positive-text">{currencyFormatter.format(breakdown.totalRecovered)}</strong>
              </span>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <GlosaBreakdownTable title="Por motivo" rows={breakdown.byReason} />
              <GlosaBreakdownTable title="Por convênio" rows={breakdown.byInsurer} />
              <GlosaBreakdownTable title="Por pessoa/cargo atribuído" rows={breakdown.byPerson} />
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">
            Glosas registradas ({glosas.length})
          </h2>
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

function GlosaBreakdownTable({ title, rows }: { title: string; rows: GlosaBreakdownRow[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-ink-faint">Sem dados.</p>
      ) : (
        <table className="w-full text-left text-xs">
          <tbody className="divide-y divide-paper-line">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="py-1.5 pr-2">
                  <p className="font-medium text-ink">{r.label}</p>
                  <p className="text-ink-faint">{r.count} glosa(s)</p>
                </td>
                <td className="py-1.5 text-right tabular-figure">
                  <p className="font-medium text-status-negative-text">{currencyFormatter.format(r.amount)}</p>
                  <p className="text-ink-faint">
                    {r.recoveryRatePct !== null ? `${r.recoveryRatePct}% recuperado` : "—"}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
