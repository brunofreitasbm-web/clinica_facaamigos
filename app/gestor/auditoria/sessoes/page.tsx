import { AuditoriaSubnav } from "@/components/auditoria-subnav";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { PageContainer } from "@/components/page-container";
import { NON_OCCURRED_STATUSES } from "@/lib/appointment-visibility";
import { toSessionAuditRow, type SessionAuditSource } from "@/lib/session-audit-pure";

export const dynamic = "force-dynamic";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE }) : "—";

export default async function AuditoriaSessoesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select(
      `id, starts_at, status, cancel_reason, cancelled_at,
       patient:patients ( full_name ),
       therapist:profiles!appointments_therapist_id_fkey ( full_name ),
       canceller:profiles!appointments_cancelled_by_fkey ( full_name )`,
    )
    .in("status", [...NON_OCCURRED_STATUSES])
    .order("starts_at", { ascending: false })
    .limit(300);

  const rows = ((data ?? []) as unknown as SessionAuditSource[]).map(toSessionAuditRow);

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <AuditoriaSubnav activeTab="sessoes" />
      <PageContainer>
        <div>
          <h1 className="text-2xl font-bold text-ink">Sessões canceladas e remarcadas</h1>
          <p className="text-sm text-ink-soft">
            Sessões que não ocorreram saem de todas as telas e dos indicadores; ficam
            registradas aqui só para rastreamento. Últimas 300 por data da sessão.
          </p>
        </div>

        {error && <p className="text-sm text-status-negative-text">Erro ao carregar: {error.message}</p>}

        <div className="rounded-lg border border-paper-line bg-paper p-5 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-paper-line bg-paper-subtle text-xs font-semibold text-ink-soft uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Sessão</th>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Terapeuta</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3">Cancelada por</th>
                  <th className="px-4 py-3">Cancelada em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-ink-soft">
                      Nenhuma sessão cancelada ou remarcada.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-paper-subtle/50 transition-colors">
                    <td className="px-4 py-3.5 text-xs">{fmt(r.startsAt)}</td>
                    <td className="px-4 py-3.5 font-medium">{r.patientName}</td>
                    <td className="px-4 py-3.5">{r.therapistName}</td>
                    <td className="px-4 py-3.5 text-xs font-semibold">{r.statusLabel}</td>
                    <td className="px-4 py-3.5 text-xs text-ink-soft">{r.reasonLabel}</td>
                    <td className="px-4 py-3.5 text-xs text-ink-soft">{r.cancelledBy}</td>
                    <td className="px-4 py-3.5 text-xs text-ink-soft">{fmt(r.cancelledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
