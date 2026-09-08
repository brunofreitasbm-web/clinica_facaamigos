import { GestorNav } from "@/components/gestor-nav";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  prontuario: "Prontuário (visão geral)",
  avaliacao_protocolo: "Avaliação de protocolo (VB-MAPP/ABLLS-R/ESDM)",
  metricas_aba: "Métricas / coleta ABA",
  relatorio_devolutivo: "Relatório devolutivo",
};

const QUEUE_CATEGORY_LABEL: Record<string, string> = {
  guia_vencendo: "Guia vencendo",
  guia_poucas_sessoes: "Guia com poucas sessões",
  cadastro_incompleto: "Cadastro incompleto",
  evolucao_atrasada: "Evolução pendente",
  documento_vencido: "Documento vencido",
  interessado_sem_retorno: "Interessado sem retorno",
  falta_sem_motivo: "Falta sem motivo",
};

export default async function AuditoriaPage() {
  const supabase = await createClient();

  // §9.1 "dono + prazo": item da fila de pendências (lib/reception-queue.ts)
  // que estourou o due_at sem ninguém resolver — escalate_overdue_queue_items()
  // (pg_cron de hora em hora) marca escalated_at, e é isso que o gestor
  // precisa enxergar aqui pra cobrar quem está travando a fila.
  const { data: escalatedRows } = await supabase
    .from("pending_queue_assignments")
    .select("id, item_id, category, due_at, escalated_at, patients(full_name), profiles!assigned_to(full_name)")
    .not("escalated_at", "is", null)
    .is("resolved_at", null)
    .order("escalated_at", { ascending: false })
    .limit(100);

  const escalatedItems = (escalatedRows ?? []).map((r) => {
    const patient = Array.isArray(r.patients) ? r.patients[0] : r.patients;
    const owner = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      categoryLabel: QUEUE_CATEGORY_LABEL[r.category] ?? r.category,
      patientName: patient?.full_name ?? "—",
      ownerName: owner?.full_name ?? "Sem dono",
      dueAt: new Date(r.due_at).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE }),
      escalatedAt: new Date(r.escalated_at as string).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE }),
    };
  });

  const { data: rows } = await supabase
    .from("record_access_log")
    .select("id, patient_id, accessed_at, reason, patients(full_name), profiles!accessed_by(full_name, role)")
    .order("accessed_at", { ascending: false })
    .limit(200);

  const logRows = (rows ?? []).map((r) => {
    const patient = Array.isArray(r.patients) ? r.patients[0] : r.patients;
    const accessor = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      patientName: patient?.full_name ?? "—",
      accessorName: accessor?.full_name ?? "—",
      accessorRole: accessor?.role ?? "—",
      reason: r.reason ?? "—",
      accessedAt: new Date(r.accessed_at).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE }),
    };
  });

  return (
    <div className="min-h-screen bg-canvas">
      <GestorNav />

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Pendências escaladas</h1>
          <p className="text-sm text-ink-soft">
            Item da fila de pendências da recepção (/recepcao/pacientes/pendencias) que
            passou do prazo sem ninguém resolver — a rotina `escalate_overdue_queue_items()`
            (pg_cron, hora em hora) marca aqui pra você cobrar quem está com o item.
          </p>
        </div>

        <div className="rounded-lg border border-paper-line bg-paper p-5 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-paper-line bg-paper-subtle text-xs font-semibold text-ink-soft uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Dono</th>
                  <th className="px-4 py-3">Prazo</th>
                  <th className="px-4 py-3">Escalado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {escalatedItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-ink-soft">
                      Nenhum item escalado no momento.
                    </td>
                  </tr>
                )}
                {escalatedItems.map((r) => (
                  <tr key={r.id} className="hover:bg-paper-subtle/50 transition-colors">
                    <td className="px-4 py-3.5 font-medium">{r.categoryLabel}</td>
                    <td className="px-4 py-3.5">{r.patientName}</td>
                    <td className="px-4 py-3.5 text-xs text-ink-soft">{r.ownerName}</td>
                    <td className="px-4 py-3.5 text-xs text-ink-soft">{r.dueAt}</td>
                    <td className="px-4 py-3.5 text-xs font-semibold text-status-negative-text">
                      {r.escalatedAt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-ink">Log de Acesso a Prontuário</h1>
          <p className="text-sm text-ink-soft">
            Exigência LGPD: toda leitura de prontuário de paciente fica registrada
            aqui, separado do log de escrita (`audit_log`). Últimos 200 acessos.
          </p>
        </div>

        <div className="rounded-lg border border-paper-line bg-paper p-5 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-paper-line bg-paper-subtle text-xs font-semibold text-ink-soft uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Acessado por</th>
                  <th className="px-4 py-3">Papel</th>
                  <th className="px-4 py-3">Tela</th>
                  <th className="px-4 py-3">Quando</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {logRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-ink-soft">
                      Nenhum acesso registrado ainda.
                    </td>
                  </tr>
                )}
                {logRows.map((r) => (
                  <tr key={r.id} className="hover:bg-paper-subtle/50 transition-colors">
                    <td className="px-4 py-3.5 font-medium">{r.patientName}</td>
                    <td className="px-4 py-3.5">{r.accessorName}</td>
                    <td className="px-4 py-3.5 text-xs text-ink-soft">{r.accessorRole}</td>
                    <td className="px-4 py-3.5 text-xs text-ink-soft">
                      {REASON_LABEL[r.reason] ?? r.reason}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-ink-soft">{r.accessedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
