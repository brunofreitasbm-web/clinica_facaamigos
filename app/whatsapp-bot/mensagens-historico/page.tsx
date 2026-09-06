import { History, MessageCircle, Send, CheckCheck, Clock, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface MessageLog {
  id: string;
  patientName: string;
  phone: string;
  time: string;
  type: "anamnese_bot" | "lembrete_24h" | "confirmação" | "reagendamento";
  status: "entregue" | "lido" | "confirmado" | "pendente";
  aiSummary: string;
}

const MOCK_LOGS: MessageLog[] = [
  {
    id: "m-101",
    patientName: "Lucas Gabriel Ferreira",
    phone: "+55 (11) 98765-4321",
    time: "Hoje, 10:45",
    type: "anamnese_bot",
    status: "confirmado",
    aiSummary: "Laudo aprovado na supervisão. Pai selecionou horário de Anamnese para amanhã às 14h.",
  },
  {
    id: "m-102",
    patientName: "Sofia Martins",
    phone: "+55 (11) 99123-8877",
    time: "Hoje, 09:30",
    type: "lembrete_24h",
    status: "lido",
    aiSummary: "Mãe confirmou presença para sessão de Fonoaudiologia.",
  },
  {
    id: "m-103",
    patientName: "Enzo Gabriel Lima",
    phone: "+55 (11) 97711-2233",
    time: "Hoje, 08:15",
    type: "confirmação",
    status: "entregue",
    aiSummary: "Mensagem de confirmação enviada com sucesso via Twilio WhatsApp API.",
  },
];

export default function MensagensHistoricoPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              Histórico & Central de Disparos WhatsApp
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Auditoria de logs, notificações D-1 e relatórios de entregabilidade em tempo real.
            </p>
          </div>
        </div>

        <Link
          href="/recepcao/whatsapp"
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-500 text-white transition shadow-sm"
        >
          <Send className="w-3.5 h-3.5" />
          Fila de Confirmação D-1 (Recepção)
        </Link>
      </div>

      {/* Métricas Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Mensagens Enviadas (Mês)</p>
            <p className="text-xl font-bold text-white mt-1">412</p>
          </div>
          <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-400">
            <MessageCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Taxa de Confirmação</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">94.2%</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Tempo Médio de Resposta</p>
            <p className="text-xl font-bold text-teal-300 mt-1">3.5 min</p>
          </div>
          <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabela de Histórico */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">
            Últimas Interações Gravadas no Sistema
          </h3>
          <span className="text-xs text-slate-400 font-mono">Logs auditáveis</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-medium uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Paciente / Contato</th>
                <th className="p-3.5">Horário</th>
                <th className="p-3.5">Tipo de Disparo</th>
                <th className="p-3.5">Resumo Interpretado pelo Bot</th>
                <th className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {MOCK_LOGS.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3.5">
                    <div className="font-semibold text-white">{log.patientName}</div>
                    <div className="text-[11px] text-teal-400 font-mono">{log.phone}</div>
                  </td>
                  <td className="p-3.5 text-slate-400 font-mono">{log.time}</td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-medium text-[11px]">
                      {log.type === "anamnese_bot" ? "Anamnese Bot" : log.type}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-300 max-w-xs">{log.aiSummary}</td>
                  <td className="p-3.5 text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <ShieldCheck className="w-3 h-3" />
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
