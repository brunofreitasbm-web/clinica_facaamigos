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

export default async function AuditoriaPage() {
  const supabase = await createClient();

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
          <h1 className="text-2xl font-bold text-ink">Log de Acesso a Prontuário</h1>
          <p className="text-sm text-ink-soft">
            Exigência LGPD (§11 do PRD): toda leitura de prontuário de paciente fica registrada
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
