import { AuditoriaSubnav } from "@/components/auditoria-subnav";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  prontuario: "Prontuário (visão geral)",
  avaliacao_protocolo: "Avaliação de protocolo (VB-MAPP/ABLLS-R/ESDM)",
  metricas_aba: "Métricas / coleta ABA",
  relatorio_devolutivo: "Relatório devolutivo",
  gestao: "Gestão",
  rede_externa: "Rede externa",
  cadastro_assistido_ia: "Cadastro assistido por IA",
};

const ROLE_LABEL: Record<string, string> = {
  gestor: "Gestor",
  recepcao: "Recepção",
  terapeuta: "Terapeuta",
  supervisor: "Supervisor",
  faturamento: "Faturamento",
  admin: "Administrador",
};

// Contas de demonstração/compartilhadas não deveriam ler prontuário real (P0-7).
const SHARED_ACCOUNT = /\(demo\)|\bdemo\b|faça ?amigos$/i;

const QUEUE_CATEGORY_LABEL: Record<string, string> = {
  guia_vencendo: "Guia vencendo",
  guia_poucas_sessoes: "Guia com poucas sessões",
  cadastro_incompleto: "Cadastro incompleto",
  cadastro_assistido_ia: "Cadastro assistido por IA aguardando revisão",
  evolucao_atrasada: "Evolução pendente",
  documento_vencido: "Documento vencido",
  interessado_sem_retorno: "Interessado sem retorno",
  falta_sem_motivo: "Falta sem motivo",
  renovacao_solicitada: "Renovação de guia solicitada",
  remarcacao_solicitada: "Pedido de remarcação",
  chegada_nao_confirmada: "Chegada aguardando confirmação",
};

export default async function AuditoriaPage() {
  const supabase = await createClient();

  // §9.1 "dono + prazo": item da fila de pendências (lib/reception-queue.ts)
  // que estourou o due_at sem ninguém resolver — escalate_overdue_queue_items()
  // (pg_cron de hora em hora) marca escalated_at, e é isso que o gestor
  // precisa enxergar aqui pra cobrar quem está travando a fila.
  // Total real de escalados abertos (a lista abaixo mostra só os 100 mais recentes).
  const { count: escalatedTotal } = await supabase
    .from("pending_queue_assignments")
    .select("id", { count: "exact", head: true })
    .not("escalated_at", "is", null)
    .is("resolved_at", null);

  const { data: escalatedRows } = await supabase
    .from("pending_queue_assignments")
    .select("id, item_id, category, due_at, escalated_at, patients(full_name), profiles!assigned_to(full_name)")
    .not("escalated_at", "is", null)
    .is("resolved_at", null)
    .order("escalated_at", { ascending: false })
    .limit(100);

  const escalatedAll = (escalatedRows ?? []).map((r) => {
    const patient = Array.isArray(r.patients) ? r.patients[0] : r.patients;
    const owner = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      category: r.category as string,
      categoryLabel: QUEUE_CATEGORY_LABEL[r.category] ?? r.category,
      patientName: patient?.full_name ?? "—",
      ownerName: owner?.full_name ?? "Sem dono",
      dueAt: new Date(r.due_at).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE }),
      escalatedAt: new Date(r.escalated_at as string).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE }),
    };
  });

  // Mesmo item repetido (categoria + paciente + dono) vira uma linha só, com
  // contagem — a fila tinha dezenas de linhas idênticas.
  const groupedMap = new Map<string, (typeof escalatedAll)[number] & { count: number }>();
  for (const item of escalatedAll) {
    const key = `${item.category}|${item.patientName}|${item.ownerName}`;
    const existing = groupedMap.get(key);
    if (existing) existing.count += 1;
    else groupedMap.set(key, { ...item, count: 1 });
  }
  const escalatedItems = [...groupedMap.values()];
  const countByCategory = new Map<string, number>();
  for (const item of escalatedAll) {
    countByCategory.set(item.categoryLabel, (countByCategory.get(item.categoryLabel) ?? 0) + 1);
  }

  const { data: rows } = await supabase
    .from("record_access_log")
    .select("id, patient_id, accessed_at, reason, patients(full_name), profiles!accessed_by(full_name, role)")
    .order("accessed_at", { ascending: false })
    .limit(200);

  const seenAccess = new Set<string>();
  const logRows = (rows ?? []).flatMap((r) => {
    const patient = Array.isArray(r.patients) ? r.patients[0] : r.patients;
    const accessor = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    // Eventos repetidos no mesmo segundo (mesmo paciente, usuário e tela) são um acesso só.
    const dedupeKey = `${r.patient_id}|${accessor?.full_name}|${r.reason}|${r.accessed_at.slice(0, 19)}`;
    if (seenAccess.has(dedupeKey)) return [];
    seenAccess.add(dedupeKey);
    return [
      {
        id: r.id,
        patientName: patient?.full_name ?? "—",
        accessorName: accessor?.full_name ?? "—",
        accessorRole: ROLE_LABEL[accessor?.role ?? ""] ?? accessor?.role ?? "—",
        reason: r.reason ?? "—",
        accessedAt: new Date(r.accessed_at).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE }),
        sharedAccount: SHARED_ACCOUNT.test(accessor?.full_name ?? ""),
      },
    ];
  });

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <AuditoriaSubnav activeTab="lgpd" />

      <PageContainer>
        <div>
          <h1 className="text-2xl font-bold text-ink">Pendências escaladas</h1>
          <p className="text-sm text-ink-soft">
            Itens da fila da recepção que passaram do prazo sem ninguém resolver. A
            verificação roda de hora em hora. Cobre quem está com o item.
          </p>
          {escalatedAll.length > 0 && (
            <p className="mt-2 text-xs text-ink-soft">
              Mostrando {escalatedAll.length}
              {escalatedTotal != null && escalatedTotal > escalatedAll.length ? ` de ${escalatedTotal}` : ""} itens em{" "}
              {escalatedItems.length} linhas agrupadas:{" "}
              {[...countByCategory.entries()].map(([label, n]) => `${label} (${n})`).join(" · ")}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-paper-line bg-paper p-5 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-paper-line bg-paper-subtle text-xs font-semibold text-ink-soft uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Dono</th>
                  <th className="px-4 py-3">Itens</th>
                  <th className="px-4 py-3">Prazo</th>
                  <th className="px-4 py-3">Escalado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {escalatedItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-ink-soft">
                      Nenhum item escalado no momento.
                    </td>
                  </tr>
                )}
                {escalatedItems.map((r) => (
                  <tr key={r.id} className="hover:bg-paper-subtle/50 transition-colors">
                    <td className="px-4 py-3.5 font-medium">{r.categoryLabel}</td>
                    <td className="px-4 py-3.5">{r.patientName}</td>
                    <td className="px-4 py-3.5 text-xs text-ink-soft">{r.ownerName}</td>
                    <td className="px-4 py-3.5 text-xs tabular-nums">{r.count}</td>
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
            Exigência da LGPD: toda leitura de prontuário fica registrada aqui, separada
            do registro de alterações. Últimos 200 acessos. Contas de demonstração ou
            compartilhadas aparecem marcadas.
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
                    <td className="px-4 py-3.5">
                      {r.accessorName}
                      {r.sharedAccount && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          conta compartilhada/demo
                        </span>
                      )}
                    </td>
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
      </PageContainer>
    </div>
  );
}
