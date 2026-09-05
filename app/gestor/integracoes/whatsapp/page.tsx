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
    <div className="min-h-screen bg-[#faf8f3] text-[#1c2530] p-8 space-y-6">
      {/* Top Bar / Breadcrumb */}
      <div className="flex items-center justify-between border-b border-[#e4dfd2] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#57606b] mb-1">
            <Link href="/gestor" className="hover:underline text-[#0f5c7d]">
              Gestão
            </Link>
            <span>/</span>
            <span>Integrações</span>
            <span>/</span>
            <span className="font-semibold text-[#1c2530]">WhatsApp & Agente IA</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1c2530]" style={{ fontFamily: "var(--font-heading)" }}>
            Agente Virtual de IA (WhatsApp 24/7)
          </h1>
          <p className="text-sm text-[#57606b]">
            Confirmação de presença automatizada, envio de lembretes e pré-agendamento inteligente via WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-[#57606b]">Status do Bot:</span>
          <button
            onClick={() => setIsBotActive(!isBotActive)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
              isBotActive ? "bg-[#dcefe8] text-[#0e5c44]" : "bg-[#f5ded8] text-[#93301c]"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isBotActive ? "bg-[#1b8a6b]" : "bg-[#c4432b]"}`} />
            {isBotActive ? "IA Operacional" : "IA Pausada"}
          </button>
        </div>
      </div>

      {/* Grid de Configurações */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-lg border border-[#cfc8b4] bg-white p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-[#1c2530] flex items-center gap-2">
            🤖 Automação de Agendamentos
          </h3>
          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[#57606b]">Confirmação Automática na Agenda</span>
              <input
                type="checkbox"
                checked={autoConfirm}
                onChange={(e) => setAutoConfirm(e.target.checked)}
                className="rounded border-[#cfc8b4] text-[#0f5c7d]"
              />
            </label>
            <p className="text-[11px] text-[#5f656f]">
              Marca a consulta como &quot;Confirmada&quot; imediatamente após resposta positiva do responsável.
            </p>

            <div className="pt-2 border-t border-[#e4dfd2] space-y-1">
              <label className="text-[#57606b] block">Antecedência do Lembrete:</label>
              <select
                value={reminderHours}
                onChange={(e) => setReminderHours(e.target.value)}
                className="w-full rounded-md border border-[#cfc8b4] bg-[#faf8f3] px-3 py-1.5 text-xs text-[#1c2530]"
              >
                <option value="12">12 Horas antes da sessão</option>
                <option value="24">24 Horas antes da sessão (Recomendado)</option>
                <option value="48">48 Horas antes da sessão</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#cfc8b4] bg-white p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-[#1c2530] flex items-center gap-2">
            📊 Desempenho do Mês
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#57606b]">Mensagens Enviadas:</span>
              <span className="font-mono font-bold text-[#1c2530]">412</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#57606b]">Taxa de Resposta:</span>
              <span className="font-mono font-bold text-[#1b8a6b]">94.2%</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#57606b]">Faltas Evitadas (IA):</span>
              <span className="font-mono font-bold text-[#0f5c7d]">28 sessões</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#cfc8b4] bg-[#faf8f3] p-5 space-y-3 shadow-sm">
          <h3 className="text-sm font-bold text-[#1c2530]">💬 Modelo de Mensagem IA</h3>
          <p className="text-xs text-[#57606b] leading-relaxed italic bg-white p-3 rounded border border-[#e4dfd2]">
            &quot;Olá! Sou a assistente da Clínica FaçaAmigos. Lembrando que [Paciente] tem sessão amanhã às [Horário] com [Terapeuta]. Responda SIM para confirmar ou REAGENDAR se precisar trocar.&quot;
          </p>
        </div>
      </div>

      {/* Tabela de Logs de Mensagens */}
      <div className="rounded-lg border border-[#cfc8b4] bg-white overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#e4dfd2] bg-[#faf8f3]">
          <h3 className="text-sm font-bold text-[#1c2530]">Últimas Interações via WhatsApp</h3>
        </div>

        <table className="w-full text-left text-xs text-[#1c2530]">
          <thead className="bg-[#faf8f3] border-b border-[#e4dfd2] text-[#5f656f] font-medium uppercase">
            <tr>
              <th className="p-3.5">Paciente / Telefone</th>
              <th className="p-3.5">Horário</th>
              <th className="p-3.5">Tipo de Disparo</th>
              <th className="p-3.5">Resumo / Interpretado pela IA</th>
              <th className="p-3.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e4dfd2]">
            {MOCK_LOGS.map((log) => (
              <tr key={log.id} className="hover:bg-[#faf8f3]/60 transition-colors">
                <td className="p-3.5">
                  <div className="font-semibold text-[#1c2530]">{log.patientName}</div>
                  <div className="text-[11px] text-[#57606b] font-mono">{log.phone}</div>
                </td>
                <td className="p-3.5 font-mono text-[#57606b]">{log.time}</td>
                <td className="p-3.5 font-medium">
                  <span className="rounded bg-[#faf8f3] px-2 py-1 border border-[#e4dfd2]">
                    {log.type}
                  </span>
                </td>
                <td className="p-3.5 text-[#57606b]">{log.aiSummary}</td>
                <td className="p-3.5 text-center">
                  <span className="rounded-full bg-[#dcefe8] px-2.5 py-0.5 text-[10px] font-bold text-[#0e5c44]">
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
