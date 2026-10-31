const ESCALATION_LABEL: Record<string, string> = {
  fora_da_base: "Fora da base de conhecimento",
  clinico: "Pergunta clínica",
  pediu_humano: "Pediu atendimento humano",
  relatorio: "Pedido de relatório/documento",
  lista_espera: "Quer entrar na lista de espera",
  particular: "Venda particular (atendente)",
  particular_agendar: "Venda particular: agendar avaliação",
};

export type ChatbotDashboardStats = {
  conversationsByStatus: { open: number; pending: number; closed: number };
  conversationsByKind: { patient: number; lead: number };
  messagesTodayByType: { user: number; bot: number; agent: number };
  escalationsByReason: Record<string, number>;
  /** Semana mais recente de `metabase_chatbot_kpis_semanais`, já com o comparativo vs. a anterior. */
  weekly: WeeklyKpiRow | null;
};

export type WeeklyKpiRow = {
  semana: string | null;
  semana_em_andamento: boolean | null;
  msgs_familia: number | null;
  conversas_novas: number | null;
  conversas_com_resposta_humana: number | null;
  pct_fallback_atual: number | null;
  pct_fallback_semana_anterior: number | null;
  variacao_fallback_pp: number | null;
  meta_max_pct_fallback: number | null;
  pct_regras_atual: number | null;
  pct_regras_semana_anterior: number | null;
  variacao_regras_pp: number | null;
  pct_conversas_com_humano_atual: number | null;
  pct_conversas_com_humano_semana_anterior: number | null;
  variacao_humano_pp: number | null;
  ia_indisponivel_atual: number | null;
  ia_indisponivel_semana_anterior: number | null;
};

/** KPI com comparativo obrigatório (diretriz do projeto): valor atual, semana anterior e, quando há, a meta. */
function KpiCard({
  label,
  value,
  previous,
  deltaPp,
  goodWhen,
  target,
  unit = "%",
}: {
  label: string;
  value: number | null;
  previous: number | null;
  deltaPp: number | null;
  goodWhen: "down" | "up";
  target?: number | null;
  unit?: string;
}) {
  const hasDelta = deltaPp !== null && deltaPp !== undefined;
  const improved = hasDelta && (goodWhen === "down" ? deltaPp < 0 : deltaPp > 0);
  const worsened = hasDelta && (goodWhen === "down" ? deltaPp > 0 : deltaPp < 0);
  return (
    <div className="rounded-md border border-paper-line-strong bg-paper/60 p-4">
      <div className="text-2xl font-semibold text-ink">{value === null ? "—" : `${value}${unit}`}</div>
      <div className="text-xs text-ink-faint">{label}</div>
      <div
        className={`mt-2 text-xs ${
          improved ? "text-status-positive-text" : worsened ? "text-status-negative-text" : "text-ink-faint"
        }`}
      >
        {previous === null
          ? "Sem semana anterior para comparar"
          : `${hasDelta ? `${deltaPp > 0 ? "+" : ""}${deltaPp} p.p. ` : ""}vs. ${previous}${unit} na semana anterior`}
      </div>
      {target !== null && target !== undefined && (
        <div className="text-xs text-ink-faint">
          Meta: {goodWhen === "down" ? "até" : "a partir de"} {target}
          {unit}
        </div>
      )}
    </div>
  );
}

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

      {stats.weekly && (
        <div>
          <h4 className="mb-1 text-sm font-semibold">
            Qualidade do bot na semana de {stats.weekly.semana ? new Date(`${stats.weekly.semana}T12:00:00`).toLocaleDateString("pt-BR") : "—"}
            {stats.weekly.semana_em_andamento ? " (em andamento)" : ""}
          </h4>
          <p className="mb-3 text-xs text-ink-faint">
            Cada indicador é comparado com a semana anterior. Semana em andamento ainda está incompleta.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard
              label="Respostas genéricas (bot não soube tratar)"
              value={stats.weekly.pct_fallback_atual}
              previous={stats.weekly.pct_fallback_semana_anterior}
              deltaPp={stats.weekly.variacao_fallback_pp}
              goodWhen="down"
              target={stats.weekly.meta_max_pct_fallback}
            />
            <KpiCard
              label="Respostas sem IA (custo zero)"
              value={stats.weekly.pct_regras_atual}
              previous={stats.weekly.pct_regras_semana_anterior}
              deltaPp={stats.weekly.variacao_regras_pp}
              goodWhen="up"
            />
            <KpiCard
              label="Conversas novas com resposta humana"
              value={stats.weekly.pct_conversas_com_humano_atual}
              previous={stats.weekly.pct_conversas_com_humano_semana_anterior}
              deltaPp={stats.weekly.variacao_humano_pp}
              goodWhen="up"
            />
          </div>
        </div>
      )}

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
