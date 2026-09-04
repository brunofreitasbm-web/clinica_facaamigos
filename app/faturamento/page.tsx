import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { FaturamentoHeader } from "./faturamento-header";
import { getCurrentCompetenceOverview } from "./overview-data";

export const dynamic = "force-dynamic";

function formatCurrency(amount: number): string {
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CLINIC_TIMEZONE,
  });
}

/**
 * Home de faturamento = a tela "Fechamento" do mock (Faturamento.dc.html),
 * mas agregada pra clínica inteira, todos os convênios de uma vez — as
 * ações de fechar/reprocessar/exportar continuam vivendo em
 * `competencias/[id]` (uma competência é sempre convênio+mês, nunca "todos
 * os convênios" de uma vez, então não faz sentido duplicar esses botões
 * aqui). Esta página é só leitura: sessões bloqueadas por falta de
 * evolução (o que mais custa receita) e um raio-x por convênio da
 * competência corrente.
 */
export default async function FaturamentoPage() {
  const supabase = await createClient();
  const overview = await getCurrentCompetenceOverview(supabase, DEV_CLINIC_ID);

  const { blocked, byInsurer, trace } = overview;

  return (
    <main className="flex flex-1 flex-col">
      <FaturamentoHeader active="competencia" />

      <div className="flex flex-col gap-12 px-10 py-10">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Competência · {overview.monthLabel}
            </h6>
            <h1 className="m-0">Fechamento</h1>
          </div>
          <div className="flex gap-2.5">
            <Link href="/faturamento/competencias" className="btn btn-secondary">
              Ver competências
            </Link>
            <Link href="/faturamento/competencias" className="btn btn-primary">
              Nova competência
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h6 className="mb-2 text-ink-soft">Sessões realizadas</h6>
            <div
              className="tabular-figure text-[40px] font-semibold"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {overview.sessionsRealized}
            </div>
          </div>
          <div>
            <h6 className="mb-2 text-ink-soft">Faturáveis · evolução e guia</h6>
            <div
              className="tabular-figure text-[40px] font-semibold"
              style={{ fontFamily: "var(--font-heading)", color: "var(--status-realizada)" }}
            >
              {overview.billableCount}
            </div>
          </div>
          <div>
            <h6 className="mb-2 text-ink-soft">Bloqueadas sem evolução</h6>
            <div
              className="tabular-figure text-[40px] font-semibold"
              style={{ fontFamily: "var(--font-heading)", color: "var(--status-falta)" }}
            >
              {blocked.length}
            </div>
          </div>
          <div>
            <h6 className="mb-2 text-ink-soft">R$ previsto na competência</h6>
            <div
              className="tabular-figure text-[32px] font-semibold sm:text-[40px]"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-accent-2-600)" }}
            >
              {formatCurrency(overview.billableAmount)}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-14 lg:grid-cols-[1fr_400px]">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Bloqueadas · realizadas sem evolução
            </h6>
            <p className="mb-2 text-[13px] text-ink-faint">
              o banco recusa billing_items para estas sessões
            </p>
            <p className="mb-4 max-w-[640px] text-sm text-ink-soft">
              Cada linha é receita parada. Cobre o terapeuta; quando a evolução for assinada, a
              sessão entra automaticamente no lote na próxima abertura ou reprocessamento da
              competência.
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Paciente</th>
                  <th>Terapeuta</th>
                  <th>Convênio · guia</th>
                  <th>Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {blocked.map((b) => (
                  <tr key={b.appointmentId}>
                    <td className="tabular-figure whitespace-nowrap">{formatDate(b.startsAt)}</td>
                    <td>{b.patientName}</td>
                    <td>
                      {b.therapistName}
                      <div className="text-xs" style={{ color: "var(--status-falta)" }}>
                        {b.daysSinceSession} {b.daysSinceSession === 1 ? "dia" : "dias"} sem evolução
                      </div>
                    </td>
                    <td>
                      {b.insurerName} · {b.guideNumber ?? "sem guia"}
                    </td>
                    <td className="tabular-figure">{b.amount != null ? formatCurrency(b.amount) : "—"}</td>
                    <td className="text-right">
                      <Link href={`/recepcao/pacientes/${b.patientId}`} className="btn btn-ghost text-xs">
                        Ver paciente
                      </Link>
                    </td>
                  </tr>
                ))}
                {blocked.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ color: "var(--status-realizada)" }}>
                      Nenhuma sessão bloqueada. A competência pode ser fechada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <aside className="flex flex-col gap-10">
            <div>
              <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
                Por convênio
              </h6>
              <div className="flex flex-col gap-4">
                {byInsurer.map((entry) => {
                  const total = entry.okAmount + entry.glosaAmount + entry.blockedAmount;
                  const totalCount = entry.okCount + entry.glosaCount + entry.blockedCount;
                  const pct = (n: number) => (totalCount > 0 ? (n / totalCount) * 100 : 0);
                  return (
                    <div key={entry.insurerId}>
                      <div className="mb-1 flex items-baseline justify-between text-sm">
                        {entry.billingPeriodId ? (
                          <Link href={`/faturamento/competencias/${entry.billingPeriodId}`} className="font-semibold">
                            {entry.insurerName}
                          </Link>
                        ) : (
                          <span className="font-semibold">{entry.insurerName}</span>
                        )}
                        <span className="tabular-figure">{formatCurrency(total)}</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-sm" style={{ background: "var(--color-neutral-200)" }}>
                        <span
                          style={{ width: `${pct(entry.okCount)}%`, background: "var(--status-realizada)" }}
                          title={`${entry.okCount} em processamento/pagas`}
                        />
                        <span
                          style={{ width: `${pct(entry.blockedCount)}%`, background: "var(--status-falta)" }}
                          title={`${entry.blockedCount} bloqueadas`}
                        />
                        <span
                          style={{ width: `${pct(entry.glosaCount)}%`, background: "var(--color-accent-2)" }}
                          title={`${entry.glosaCount} glosadas`}
                        />
                      </div>
                      <div className="mt-1 text-xs text-ink-faint">
                        {entry.okCount} ok · {entry.blockedCount} bloqueadas · {entry.glosaCount} glosa
                      </div>
                    </div>
                  );
                })}
                {byInsurer.length === 0 && (
                  <p className="text-sm text-ink-faint">Nenhum lançamento nesta competência ainda.</p>
                )}
              </div>
            </div>

            <div>
              <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
                Rastro
              </h6>
              <div className="flex flex-col gap-2 text-sm">
                {trace.map((entry, idx) => (
                  <div key={idx} className="flex gap-2">
                    {entry.when && (
                      <span className="tabular-figure shrink-0 text-ink-faint">{formatDateTime(entry.when)}</span>
                    )}
                    <span className="text-ink-soft">{entry.message}</span>
                  </div>
                ))}
                {trace.length === 0 && (
                  <p className="text-ink-faint">Nenhum evento registrado nesta competência ainda.</p>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
