import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { PageContainer } from "@/components/page-container";
import { findPlaygroundUnit } from "@/lib/playground/units";
import { computeVisitStatus, type PlaygroundVisitStatus } from "@/lib/playground/status";
import { buildSupervisorQueue, computeOnTimeKpi, type QueueItem, type QueueKind } from "@/lib/playground/queue";
import { LocationsPanel, NewSeriesDialog, QueueRowAction, SeriesRowActions, type RowAction } from "./playground-client";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: CLINIC_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const fmtDay = new Intl.DateTimeFormat("pt-BR", { timeZone: CLINIC_TIMEZONE, day: "2-digit", month: "2-digit" });
const when = (iso: string | null) => (iso ? fmt.format(new Date(iso)).replace(",", "") : "");
const day = (iso: string | null) => (iso ? fmtDay.format(new Date(iso)) : "");

const KIND_TEXT: Record<QueueKind, { title: string; hint: (i: QueueItem) => string; action: RowAction; tone: string }> = {
  atrasada: {
    title: "Avaliação atrasada",
    hint: (i) => `Saiu do playground na visita ${i.visitNo ?? ""} e ninguém preencheu ainda. O caixa do local já está avisado.`,
    action: null,
    tone: "var(--status-falta)",
  },
  conclusao_pendente: {
    title: "Falta concluir a avaliação",
    hint: (i) => `A última visita (${day(i.referenceStart)}) passou sem concluir. Adicione uma visita ou peça ao playground para concluir.`,
    action: "prorrogar",
    tone: "var(--status-falta)",
  },
  confirmar_saida: {
    title: "Saída não confirmada",
    hint: () => "O caixa do playground ainda não marcou a saída da criança.",
    action: null,
    tone: "#b45309",
  },
  nao_feita: {
    title: "Visita sem avaliação",
    hint: (i) => `A visita ${i.visitNo ?? ""} de ${day(i.referenceStart)} aconteceu e não foi avaliada. Remarque a visita.`,
    action: "reagendar",
    tone: "var(--status-falta)",
  },
  faltou: {
    title: "Não compareceu",
    hint: (i) => `A criança não veio na visita ${i.visitNo ?? ""} de ${day(i.referenceStart)}. Remarque a visita.`,
    action: "reagendar",
    tone: "#b45309",
  },
  rascunho: {
    title: "Aguardando o OK",
    hint: () => "Ainda não aparece no PDV. Libere para o playground receber a criança.",
    action: "liberar",
    tone: "var(--color-accent-2-600)",
  },
};

const VISIT_STATUS_LABEL: Record<PlaygroundVisitStatus, string> = {
  futura: "Agendada",
  aguardando_chegada: "Aguardando chegada",
  no_playground: "No playground",
  confirmar_saida: "Confirmar saída",
  avaliar_agora: "Avaliar agora",
  atrasada: "Atrasada",
  registrada_no_prazo: "Registrada",
  registrada_com_atraso: "Registrada com atraso",
  nao_feita: "Não feita",
  faltou: "Faltou",
  cancelada: "Cancelada",
};

const SERIES_STATUS_LABEL: Record<string, string> = {
  rascunho: "Aguardando OK",
  liberada: "Liberada",
  concluida: "Concluída",
};

export default async function PlaygroundPage() {
  const supabase = await createClient();
  const now = new Date();

  const [{ data: locationRows }, { data: seriesRows }, { data: patientRows }, { data: slaRows }] = await Promise.all([
    supabase.from("playground_locations").select("id, name, pos_unit_id").eq("clinic_id", DEV_CLINIC_ID).eq("active", true).order("name"),
    supabase
      .from("playground_series")
      .select("id, status, level, total_visits, patient_id, location_id, concluded_at, patients(full_name)")
      .eq("clinic_id", DEV_CLINIC_ID)
      .in("status", ["rascunho", "liberada", "concluida"])
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("patients")
      .select("id, full_name")
      .eq("clinic_id", DEV_CLINIC_ID)
      .neq("status", "arquivado")
      .order("full_name", { ascending: true })
      .limit(1000),
    supabase.from("playground_sla_v").select("month, on_time").eq("clinic_id", DEV_CLINIC_ID),
  ]);

  const locations = locationRows ?? [];
  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  const series = seriesRows ?? [];
  const seriesIds = series.map((s) => s.id);

  const [{ data: visitRows }, { data: entryRows }] = seriesIds.length
    ? await Promise.all([
        supabase.from("playground_visits").select("*").in("series_id", seriesIds).order("visit_no"),
        supabase.from("playground_entries").select("visit_id, saved_at").in("series_id", seriesIds),
      ])
    : [{ data: [] }, { data: [] }];

  const firstEntry = new Map<string, string>();
  for (const e of entryRows ?? []) {
    const cur = firstEntry.get(e.visit_id);
    if (!cur || e.saved_at < cur) firstEntry.set(e.visit_id, e.saved_at);
  }
  const visits = (visitRows ?? []).map((v) => ({
    id: v.id,
    seriesId: v.series_id,
    visitNo: v.visit_no,
    scheduledStart: v.scheduled_start,
    durationMin: v.duration_min,
    arrivedAt: v.arrived_at,
    leftAt: v.left_at,
    cancelledAt: v.cancelled_at,
    firstEntryAt: firstEntry.get(v.id) ?? null,
  }));

  const patientName = (s: (typeof series)[number]) => {
    const p = Array.isArray(s.patients) ? s.patients[0] : s.patients;
    return p?.full_name ?? "Criança";
  };

  const queue = buildSupervisorQueue({
    series: series.map((s) => ({
      id: s.id,
      status: s.status as "rascunho" | "liberada" | "concluida",
      patientName: patientName(s),
      locationName: locationName.get(s.location_id) ?? "",
    })),
    visits,
    now,
    timeZone: CLINIC_TIMEZONE,
  });

  const kpi = computeOnTimeKpi(
    (slaRows ?? []).flatMap((r) => (r.month ? [{ month: r.month, onTime: !!r.on_time }] : [])),
    now,
    CLINIC_TIMEZONE,
  );

  const inProgress = series.filter((s) => s.status === "rascunho" || s.status === "liberada");
  const recentlyDone = series.filter((s) => s.status === "concluida").slice(0, 10);

  return (
    <main className="flex flex-1 flex-col pb-8" style={{ background: "var(--color-bg)" }}>
      <PageContainer>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Avaliação paralela
            </h6>
            <h1 className="m-0">Playground</h1>
          </div>
          <NewSeriesDialog
            patients={(patientRows ?? []).map((p) => ({ id: p.id, full_name: p.full_name }))}
            locations={locations}
          />
        </div>

        {/* KPI compacto: o comparativo é uma linha dentro do próprio indicador (regra 1 e 5). */}
        <div className="rounded-xl border px-5 py-3 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
          <span className="text-sm font-semibold text-ink-faint">Feitas no prazo (mês): </span>
          {kpi.current.total === 0 ? (
            <span className="text-sm">sem visitas no mês</span>
          ) : (
            <span className="tabular-figure text-lg font-bold">
              {kpi.current.onTime}/{kpi.current.total} ({kpi.current.pct}%)
            </span>
          )}
          <span className="ml-3 text-xs text-ink-faint">
            {kpi.deltaPp === null
              ? "vs. mês anterior: sem dados para comparar"
              : `${kpi.deltaPp >= 0 ? "▲" : "▼"} ${Math.abs(kpi.deltaPp)} p.p. vs. mês anterior`}
          </span>
        </div>

        <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
          <h3 className="mb-4">Precisa de ação agora</h3>
          {queue.length === 0 ? (
            <p className="text-sm text-ink-faint">Nada pendente. As avaliações do playground estão em dia.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col divide-y p-0" style={{ borderColor: "var(--color-neutral-200)" }}>
              {queue.map((item) => {
                const text = KIND_TEXT[item.kind];
                return (
                  <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">
                        <span style={{ color: text.tone }}>{text.title}</span> · {item.patientName}
                        {item.locationName ? <span className="font-normal text-ink-faint"> · {item.locationName}</span> : null}
                      </div>
                      <div className="text-xs text-ink-faint">{text.hint(item)}</div>
                    </div>
                    <QueueRowAction action={text.action} seriesId={item.seriesId} visitId={item.visitId} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
          <h3 className="mb-4">Avaliações em andamento</h3>
          {inProgress.length === 0 ? (
            <p className="text-sm text-ink-faint">Nenhuma avaliação em andamento. Use “Nova avaliação” para começar.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col divide-y p-0" style={{ borderColor: "var(--color-neutral-200)" }}>
              {inProgress.map((s) => {
                const own = visits.filter((v) => v.seriesId === s.id && !v.cancelledAt);
                return (
                  <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">
                        {patientName(s)}
                        <span className="font-normal text-ink-faint">
                          {" "}
                          · {locationName.get(s.location_id) ?? ""} · Nível {s.level} · {SERIES_STATUS_LABEL[s.status]}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {own.map((v) => {
                          const status = computeVisitStatus(v, now, CLINIC_TIMEZONE);
                          return (
                            <span key={v.id} className="rounded-md border px-2 py-0.5 text-xs" style={{ borderColor: "var(--color-neutral-200)" }}>
                              {v.visitNo}ª · {when(v.scheduledStart)} · {VISIT_STATUS_LABEL[status]}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <SeriesRowActions seriesId={s.id} status={s.status} canExtend={s.total_visits < 5} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <details
          className="rounded-xl border p-6 shadow-sm"
          style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}
          open={locations.length === 0 || locations.some((l) => !findPlaygroundUnit(l.pos_unit_id))}
        >
          <summary className="cursor-pointer text-base font-semibold">Locais do playground ({locations.length})</summary>
          <div className="mt-4">
            <LocationsPanel locations={locations} />
          </div>
        </details>

        {recentlyDone.length > 0 && (
          <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <h3 className="mb-4">Concluídas recentemente</h3>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
              {recentlyDone.map((s) => (
                <li key={s.id}>
                  <a href={`/terapeuta/paciente/${s.patient_id}/playground`} className="font-semibold">
                    {patientName(s)}
                  </a>
                  <span className="text-ink-faint"> · concluída em {day(s.concluded_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </PageContainer>
    </main>
  );
}
