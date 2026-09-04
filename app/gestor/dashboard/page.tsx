import Link from "next/link";
import { GestorNav } from "@/components/gestor-nav";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getDashboardMetrics } from "./data";

export const dynamic = "force-dynamic";

function Bar({ widthPct, color }: { widthPct: number; color: string }) {
  return (
    <span style={{ display: "block", background: "var(--color-divider)", borderRadius: "var(--radius-sm)", height: 10 }}>
      <span
        style={{
          display: "block",
          height: "100%",
          width: `${Math.max(2, Math.min(100, widthPct))}%`,
          background: color,
          borderRadius: "var(--radius-sm)",
        }}
      />
    </span>
  );
}

export default async function GestorDashboardPage() {
  const supabase = await createClient();
  const metrics = await getDashboardMetrics(supabase, DEV_CLINIC_ID);

  const maxStatus = Math.max(...metrics.statusBars.map((b) => b.count), 1);
  const maxDay = Math.max(...metrics.dailyVolume.map((d) => d.count), 1);
  const maxRoom = Math.max(...metrics.roomBars.map((r) => r.hours), 1);

  return (
    <main className="flex flex-1 flex-col pb-16">
      <GestorNav active="painel" />

      <div className="flex flex-wrap items-end justify-between gap-6 px-10 pt-9">
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
            Painel
          </h6>
          <h1 className="m-0">Métricas operacionais</h1>
        </div>
        <Link href="/gestor" className="btn btn-secondary">
          Painel executivo →
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-6 px-10 pt-8 sm:grid-cols-3 lg:grid-cols-5">
        <div className="card">
          <span className="card-kicker">Pacientes</span>
          <span className="card-title tabular-figure" style={{ fontSize: 28 }}>{metrics.activePatients}</span>
          <span className="card-body">ativos</span>
        </div>
        <div className="card">
          <span className="card-kicker">Equipe</span>
          <span className="card-title tabular-figure" style={{ fontSize: 28 }}>{metrics.therapistsUnderContract}</span>
          <span className="card-body">terapeutas em contrato vigente</span>
        </div>
        <div className="card">
          <span className="card-kicker">Volume</span>
          <span className="card-title tabular-figure" style={{ fontSize: 28 }}>{metrics.sessionsThisMonth}</span>
          <span className="card-body">sessões realizadas no mês</span>
        </div>
        <div className="card">
          <span className="card-kicker">Salas</span>
          <span className="card-title tabular-figure" style={{ fontSize: 28 }}>
            {metrics.roomOccupancyPct != null ? `${metrics.roomOccupancyPct}%` : "—"}
          </span>
          <span className="card-body">ocupação (aprox. 8h úteis/sala/dia)</span>
        </div>
        <div className="card">
          <span className="card-kicker">Família</span>
          <span className="card-title tabular-figure" style={{ fontSize: 28 }}>{metrics.nps ?? "—"}</span>
          <span className="card-body">NPS{metrics.nps == null ? " (sem respostas ainda)" : ""}</span>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-15 px-10 pt-12 lg:grid-cols-2">
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-4">
            Sessões por status · mês
          </h6>
          <div className="flex flex-col gap-3">
            {metrics.statusBars.length > 0 ? (
              metrics.statusBars.map((b) => (
                <div key={b.status} className="grid grid-cols-[140px_1fr_36px] items-center gap-3 text-sm">
                  <span className={`tag-status ${b.tagClass}`}>{b.label}</span>
                  <Bar widthPct={(b.count / maxStatus) * 100} color="var(--color-accent)" />
                  <span className="tabular-figure text-right">{b.count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink-faint">Nenhuma sessão registrada neste mês.</p>
            )}
          </div>
        </div>
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-4">
            Volume diário · última semana
          </h6>
          <div className="flex items-end gap-3" style={{ height: 160 }}>
            {metrics.dailyVolume.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-2" style={{ height: "100%" }}>
                <span className="tabular-figure text-xs">{d.count}</span>
                <span
                  style={{
                    width: "100%",
                    height: `${Math.max(4, (d.count / maxDay) * 110)}px`,
                    background: d.isToday ? "var(--color-accent-2)" : "var(--color-accent)",
                    borderRadius: "var(--radius-sm)",
                  }}
                />
                <span className="text-xs text-ink-faint">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-15 px-10 pt-12 lg:grid-cols-2">
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-4">
            Ocupação por sala · horas realizadas no mês
          </h6>
          <div className="flex flex-col gap-3">
            {metrics.roomBars.length > 0 ? (
              metrics.roomBars.map((r) => (
                <div key={r.label} className="grid grid-cols-[140px_1fr_60px] items-center gap-3 text-sm">
                  <span className="truncate">{r.label}</span>
                  <Bar widthPct={(r.hours / maxRoom) * 100} color="var(--color-accent)" />
                  <span className="tabular-figure text-right">{r.hours}h</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink-faint">Nenhuma sala cadastrada.</p>
            )}
          </div>
        </div>
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-4">
            SLA de evolução · em 24h (30 dias)
          </h6>
          <div className="flex flex-col gap-3">
            {metrics.slaBars.length > 0 ? (
              metrics.slaBars.map((t) => (
                <div key={t.label} className="grid grid-cols-[140px_1fr_50px] items-center gap-3 text-sm">
                  <span className="truncate">{t.label}</span>
                  <Bar widthPct={t.ratePct ?? 0} color="var(--color-accent-2)" />
                  <span className="tabular-figure text-right">{t.ratePct != null ? `${t.ratePct}%` : "—"}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink-faint">Nenhuma sessão realizada nos últimos 30 dias.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
