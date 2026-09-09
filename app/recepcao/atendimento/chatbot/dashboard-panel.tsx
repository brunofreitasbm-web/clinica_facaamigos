const ESCALATION_LABEL: Record<string, string> = {
  fora_da_base: "Fora da base de conhecimento",
  clinico: "Pergunta clínica",
  pediu_humano: "Pediu atendimento humano",
  relatorio: "Pedido de relatório/documento",
};

export type ChatbotDashboardStats = {
  conversationsByStatus: { open: number; pending: number; closed: number };
  conversationsByKind: { patient: number; lead: number };
  messagesTodayByType: { user: number; bot: number; agent: number };
  escalationsByReason: Record<string, number>;
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-paper-line-strong bg-paper/60 p-4">
      <div className="text-2xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-ink-faint">{label}</div>
    </div>
  );
}

export function DashboardPanel({ stats }: { stats: ChatbotDashboardStats }) {
  const totalConversations =
    stats.conversationsByStatus.open + stats.conversationsByStatus.pending + stats.conversationsByStatus.closed;
  const totalMessagesToday =
    stats.messagesTodayByType.user + stats.messagesTodayByType.bot + stats.messagesTodayByType.agent;
  const totalEscalations = Object.values(stats.escalationsByReason).reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="mb-1">Painel do Chatbot</h3>
        <p className="mb-4 text-sm text-ink-soft">Visão geral das conversas e do uso do bot de WhatsApp.</p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Conversas totais" value={totalConversations} />
          <StatCard label="Aguardando atendimento" value={stats.conversationsByStatus.pending} />
          <StatCard label="Conversas de leads" value={stats.conversationsByKind.lead} />
          <StatCard label="Mensagens hoje" value={totalMessagesToday} />
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold">Mensagens de hoje por origem</h4>
        <div className="grid grid-cols-3 gap-3 max-w-lg">
          <StatCard label="Famílias" value={stats.messagesTodayByType.user} />
          <StatCard label="Bot" value={stats.messagesTodayByType.bot} />
          <StatCard label="Recepção/equipe" value={stats.messagesTodayByType.agent} />
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold">Escalações para humano (motivo)</h4>
        {totalEscalations === 0 ? (
          <p className="text-sm text-ink-faint">Nenhuma escalação registrada nas conversas em aberto.</p>
        ) : (
          <table className="table max-w-lg">
            <thead>
              <tr>
                <th>Motivo</th>
                <th>Conversas</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.escalationsByReason)
                .sort(([, a], [, b]) => b - a)
                .map(([reason, count]) => (
                  <tr key={reason}>
                    <td>{ESCALATION_LABEL[reason] ?? reason}</td>
                    <td className="tabular-figure">{count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
