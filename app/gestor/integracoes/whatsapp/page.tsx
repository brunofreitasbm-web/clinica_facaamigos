"use client";

import { useState } from "react";
import Link from "next/link";

interface MessageLog {
  id: string;
  patientName: string;
  phone: string;
  time: string;
  type: "lembrete_24h" | "confirmação" | "reagendamento";
  status: "enviado" | "respondido" | "confirmado";
  aiSummary: string;
}

const MOCK_LOGS: MessageLog[] = [
  {
    id: "m-1",
    patientName: "Gabriel Santos Silva",
    phone: "(11) 99876-5432",
    time: "Hoje, 09:15",
    type: "lembrete_24h",
    status: "confirmado",
    aiSummary: "Mãe confirmou presença para a sessão de TO às 14:00.",
  },
  {
    id: "m-2",
    patientName: "Lucas Oliveira Souza",
    phone: "(11) 98765-4321",
    time: "Hoje, 10:30",
    type: "confirmação",
    status: "confirmado",
    aiSummary: "Pai respondeu 'Sim, estaremos aí'. Agenda atualizada.",
  },
  {
    id: "m-3",
    patientName: "Beatriz Lima Pereira",
    phone: "(11) 97654-3210",
    time: "Hoje, 11:05",
    type: "reagendamento",
    status: "respondido",
    aiSummary: "Solicitou troca para sexta-feira. Notificação enviada à recepção.",
  },
];

export default function GestorWhatsappPage() {
  const [isBotActive, setIsBotActive] = useState(true);
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [reminderHours, setReminderHours] = useState("24");

  return (
    <div className="min-h-screen bg-paper text-ink p-8 space-y-6">
      {/* Top Bar / Breadcrumb */}
      <div className="flex items-center justify-between border-b border-paper-line pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-ink-soft mb-1">
            <Link href="/gestor" className="hover:underline text-chart">
              Gestão
            </Link>
            <span>/</span>
            <span>Integrações</span>
            <span>/</span>
            <span className="font-semibold text-ink">WhatsApp & Agente IA</span>
          </div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: "var(--font-heading)" }}>
            Agente Virtual de IA (WhatsApp 24/7)
          </h1>
          <p className="text-sm text-ink-soft">
            Confirmação de presença automatizada, envio de lembretes e pré-agendamento inteligente via WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-ink-soft">Status do Bot:</span>
          <button
            onClick={() => setIsBotActive(!isBotActive)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
              isBotActive ? "bg-status-positive-soft text-status-positive-text" : "bg-status-negative-soft text-status-negative-text"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isBotActive ? "bg-status-positive" : "bg-status-negative"}`} />
            {isBotActive ? "IA Operacional" : "IA Pausada"}
          </button>
        </div>
      </div>

      {/* Grid de Configurações */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-lg border border-paper-line-strong bg-white p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            🤖 Automação de Agendamentos
          </h3>
          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-ink-soft">Confirmação Automática na Agenda</span>
              <input
                type="checkbox"
                checked={autoConfirm}
                onChange={(e) => setAutoConfirm(e.target.checked)}
                className="rounded border-paper-line-strong text-chart"
              />
            </label>
            <p className="text-[11px] text-ink-faint">
              Marca a consulta como &quot;Confirmada&quot; imediatamente após resposta positiva do responsável.
            </p>

            <div className="pt-2 border-t border-paper-line space-y-1">
              <label className="text-ink-soft block">Antecedência do Lembrete:</label>
              <select
                value={reminderHours}
                onChange={(e) => setReminderHours(e.target.value)}
                className="w-full rounded-md border border-paper-line-strong bg-paper px-3 py-1.5 text-xs text-ink"
              >
                <option value="12">12 Horas antes da sessão</option>
                <option value="24">24 Horas antes da sessão (Recomendado)</option>
                <option value="48">48 Horas antes da sessão</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-paper-line-strong bg-white p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            📊 Desempenho do Mês
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-ink-soft">Mensagens Enviadas:</span>
              <span className="font-mono font-bold text-ink">412</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-ink-soft">Taxa de Resposta:</span>
              <span className="font-mono font-bold text-status-positive">94.2%</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-ink-soft">Faltas Evitadas (IA):</span>
              <span className="font-mono font-bold text-chart">28 sessões</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-paper-line-strong bg-paper p-5 space-y-3 shadow-sm">
          <h3 className="text-sm font-bold text-ink">💬 Modelo de Mensagem IA</h3>
          <p className="text-xs text-ink-soft leading-relaxed italic bg-white p-3 rounded border border-paper-line">
            &quot;Olá! Sou a assistente da Clínica FaçaAmigos. Lembrando que [Paciente] tem sessão amanhã às [Horário] com [Terapeuta]. Responda SIM para confirmar ou REAGENDAR se precisar trocar.&quot;
          </p>
        </div>
      </div>

      {/* Tabela de Logs de Mensagens */}
      <div className="rounded-lg border border-paper-line-strong bg-white overflow-hidden shadow-sm">
        <div className="p-4 border-b border-paper-line bg-paper">
          <h3 className="text-sm font-bold text-ink">Últimas Interações via WhatsApp</h3>
        </div>

        <table className="w-full text-left text-xs text-ink">
          <thead className="bg-paper border-b border-paper-line text-ink-faint font-medium uppercase">
            <tr>
              <th className="p-3.5">Paciente / Telefone</th>
              <th className="p-3.5">Horário</th>
              <th className="p-3.5">Tipo de Disparo</th>
              <th className="p-3.5">Resumo / Interpretado pela IA</th>
              <th className="p-3.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-paper-line">
            {MOCK_LOGS.map((log) => (
              <tr key={log.id} className="hover:bg-paper/60 transition-colors">
                <td className="p-3.5">
                  <div className="font-semibold text-ink">{log.patientName}</div>
                  <div className="text-[11px] text-ink-soft font-mono">{log.phone}</div>
                </td>
                <td className="p-3.5 font-mono text-ink-soft">{log.time}</td>
                <td className="p-3.5 font-medium">
                  <span className="rounded bg-paper px-2 py-1 border border-paper-line">
                    {log.type}
                  </span>
                </td>
                <td className="p-3.5 text-ink-soft">{log.aiSummary}</td>
                <td className="p-3.5 text-center">
                  <span className="rounded-full bg-status-positive-soft px-2.5 py-0.5 text-[10px] font-bold text-status-positive-text">
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
