import Link from "next/link";
import { getWhatsappMessages } from "./actions";

export default async function WhatsappDashboardPage() {
  const messages = await getWhatsappMessages();

  const totalSent = messages.length;
  const confirmedCount = messages.filter((m) => m.status === "confirmado").length;
  const rescheduleCount = messages.filter(
    (m) => m.status === "reagendar_solicitado"
  ).length;
  const pendingCount = messages.filter((m) =>
    ["enviado", "entregue", "lido"].includes(m.status)
  ).length;

  return (
    <div className="min-h-screen bg-canvas p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              <Link href="/recepcao" className="hover:underline">
                Recepção
              </Link>
              <span>/</span>
              <span className="text-ink">WhatsApp D-1</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-ink">
              Painel de Controle WhatsApp (Disparos D-1)
            </h1>
            <p className="text-sm text-ink-soft">
              Acompanhamento em tempo real dos lembretes de confirmação enviados aos responsáveis.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/recepcao"
              className="rounded-md border border-paper-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-paper-subtle"
            >
              Voltar para Recepção
            </Link>
          </div>
        </div>

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-paper-line bg-paper p-4 shadow-sm">
            <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">
              Total Disparados Hoje
            </p>
            <p className="mt-2 text-3xl font-bold text-ink">{totalSent}</p>
            <span className="mt-1 inline-block text-xs text-ink-faint">
              Lembretes D-1 agendados
            </span>
          </div>

          <div className="rounded-lg border border-status-positive/30 bg-status-positive-soft/40 p-4 shadow-sm">
            <p className="text-xs font-medium text-status-positive-text uppercase tracking-wide">
              Confirmados (Resposta "1")
            </p>
            <p className="mt-2 text-3xl font-bold text-status-positive-text">
              {confirmedCount}
            </p>
            <span className="mt-1 inline-block text-xs text-status-positive-text/80">
              {totalSent > 0 ? Math.round((confirmedCount / totalSent) * 100) : 0}% de taxa de confirmação
            </span>
          </div>

          <div className="rounded-lg border border-status-pending/30 bg-status-pending-soft/40 p-4 shadow-sm">
            <p className="text-xs font-medium text-status-pending-text uppercase tracking-wide">
              Solicitou Reagendamento ("2")
            </p>
            <p className="mt-2 text-3xl font-bold text-status-pending-text">
              {rescheduleCount}
            </p>
            <span className="mt-1 inline-block text-xs text-status-pending-text/80">
              Requer atenção da recepção
            </span>
          </div>

          <div className="rounded-lg border border-paper-line bg-paper p-4 shadow-sm">
            <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">
              Aguardando Resposta
            </p>
            <p className="mt-2 text-3xl font-bold text-ink">{pendingCount}</p>
            <span className="mt-1 inline-block text-xs text-ink-faint">
              Enviados, entregues ou lidos
            </span>
          </div>
        </div>

        {/* Tabela de Disparos WhatsApp */}
        <div className="rounded-lg border border-paper-line bg-paper p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold text-ink">
              Histórico de Envio D-1
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-soft">Canal Oficial:</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                Meta Cloud API / Z-API Ativa
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-paper-line bg-paper-subtle text-xs font-semibold text-ink-soft uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Paciente / Responsável</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Sessão Agendada</th>
                  <th className="px-4 py-3">Status WhatsApp</th>
                  <th className="px-4 py-3">Horário Disparo</th>
                  <th className="px-4 py-3">Preview Mensagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {messages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-paper-subtle/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-ink">{msg.patient_name}</p>
                      <p className="text-xs text-ink-soft">Resp: {msg.guardian_name}</p>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-ink-soft">
                      {msg.guardian_phone}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-medium">{msg.appointment_date}</span>
                      <span className="ml-1 text-xs text-ink-soft">às {msg.appointment_time}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {msg.status === "confirmado" && (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          ✓ Confirmado (Resp: 1)
                        </span>
                      )}
                      {msg.status === "reagendar_solicitado" && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          ⚠ Reagendar (Resp: 2)
                        </span>
                      )}
                      {msg.status === "lido" && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          ✓✓ Lido
                        </span>
                      )}
                      {msg.status === "entregue" && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          ✓ Entregue
                        </span>
                      )}
                      {msg.status === "enviado" && (
                        <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-500 border border-gray-200">
                          Enviado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-ink-soft">
                      {new Date(msg.sent_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-ink-soft max-w-xs truncate" title={msg.body}>
                      {msg.body}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
