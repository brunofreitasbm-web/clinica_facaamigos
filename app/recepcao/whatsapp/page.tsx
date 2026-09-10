import { getWhatsappHistory } from "./actions";
import { PageContainer } from "@/components/page-container";

export default async function WhatsappDashboardPage() {
  const history = await getWhatsappHistory();

  const confirmedCount = history.filter((m) => m.status === "confirmado").length;
  const rescheduleCount = history.filter((m) => m.status === "reagendar_solicitado").length;

  return (
    <PageContainer>
      {/* Cabeçalho + atalhos globais da recepção vêm do layout (RecepcaoNav). */}
      <div>
          <h1 className="mt-1 text-2xl font-bold text-ink">Confirmação D-1 por WhatsApp</h1>
          <p className="text-sm text-ink-soft">
            Envio manual: cada card abre o WhatsApp já logado no seu celular/computador com a
            mensagem pronta. Não há integração automática (Meta Cloud API/Z-API) — você confere
            e aperta enviar.
          </p>
        </div>

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-status-positive/30 bg-status-positive-soft/40 p-4 shadow-sm">
            <p className="text-xs font-medium text-status-positive-text uppercase tracking-wide">
              Confirmados hoje
            </p>
            <p className="mt-2 text-3xl font-bold text-status-positive-text">{confirmedCount}</p>
          </div>
          <div className="rounded-lg border border-status-pending/30 bg-status-pending-soft/40 p-4 shadow-sm">
            <p className="text-xs font-medium text-status-pending-text uppercase tracking-wide">
              Cancelaram/reagendaram hoje
            </p>
            <p className="mt-2 text-3xl font-bold text-status-pending-text">{rescheduleCount}</p>
          </div>
        </div>

        {/* Histórico de hoje */}
        <div className="rounded-lg border border-paper-line bg-paper p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-ink">Enviados hoje ({history.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-paper-line bg-paper-subtle text-xs font-semibold text-ink-soft uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Paciente / Responsável</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Sessão</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Enviado às</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-ink-soft">
                      Nenhum lembrete registrado hoje.
                    </td>
                  </tr>
                )}
                {history.map((msg) => (
                  <tr key={msg.id} className="hover:bg-paper-subtle/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-ink">{msg.patientName}</p>
                      <p className="text-xs text-ink-soft">Resp: {msg.guardianName}</p>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-ink-soft">{msg.guardianPhone}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-medium">{msg.appointmentDate}</span>
                      <span className="ml-1 text-xs text-ink-soft">às {msg.appointmentTime}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {msg.status === "confirmado" && (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          ✓ Confirmado
                        </span>
                      )}
                      {msg.status === "reagendar_solicitado" && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          ⚠ Cancelado/reagendar
                        </span>
                      )}
                      {msg.status === "enviado" && (
                        <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-500 border border-gray-200">
                          Enviado, aguardando
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-ink-soft">
                      {new Date(msg.sentAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
    </PageContainer>
  );
}
