"use client";

import React, { useState } from "react";

export interface SessionRoom {
  id: string;
  roomName: string;
  therapistName: string;
  patientName: string;
  specialty: string;
  startTime: string;
  endTime: string;
  status: "em_andamento" | "concluido" | "atrasado" | "falta_sem_justificativa" | "prontuario_pendente";
  noteStatus: "assinado" | "pendente_24h" | "trava_faturamento";
}

const MOCK_ROOMS: SessionRoom[] = [
  {
    id: "room-1",
    roomName: "Sala 01 · Integração Sensorial",
    therapistName: "Dra. Camila Nogueira (TO)",
    patientName: "Gabriel Mendonça",
    specialty: "Terapia Ocupacional",
    startTime: "14:00",
    endTime: "15:00",
    status: "em_andamento",
    noteStatus: "assinado",
  },
  {
    id: "room-2",
    roomName: "Sala 02 · Atendimento ABA",
    therapistName: "Prof. Lucas Arantes (Aplicador)",
    patientName: "Sofia Rocha",
    specialty: "Psicologia ABA",
    startTime: "14:00",
    endTime: "16:00",
    status: "em_andamento",
    noteStatus: "assinado",
  },
  {
    id: "room-3",
    roomName: "Sala 03 · Fonoaudiologia Neuro",
    therapistName: "Dra. Mariana Costa (Fono)",
    patientName: "Lucas T. Silva",
    specialty: "Fonoaudiologia",
    startTime: "13:00",
    endTime: "14:00",
    status: "prontuario_pendente",
    noteStatus: "pendente_24h",
  },
  {
    id: "room-4",
    roomName: "Sala 04 · Cabine de Aprendizagem",
    therapistName: "Dra. Beatriz Santos (Psicopedagoga)",
    patientName: "Matheus V. Lima",
    specialty: "Psicopedagogia",
    startTime: "13:00",
    endTime: "14:00",
    status: "falta_sem_justificativa",
    noteStatus: "trava_faturamento",
  },
];

export function SalasCockpit() {
  const [rooms] = useState<SessionRoom[]>(MOCK_ROOMS);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleNotifyTherapist = (therapistName: string) => {
    setToastMsg(`Lembrete automático enviado para ${therapistName} solicitando assinatura da evolução.`);
    setTimeout(() => setToastMsg(null), 3500);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* TOAST DE NOTIFICAÇÃO */}
      {toastMsg && (
        <div className="rounded-lg bg-blue-700 text-white px-4 py-3 shadow-md text-xs font-semibold flex items-center justify-between">
          <span>📲 {toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="bg-transparent border-0 text-white font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* PAINEL DE SALAS EM TEMPO REAL */}
      <div className="rounded-xl border bg-surface p-6 shadow-sm" style={{ borderColor: "var(--color-divider)" }}>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Visão em Tempo Real · Cockpit de Salas</span>
            <h3 className="m-0 text-base font-bold text-ink">Atendimentos do Bloco Atual & Auditoria de Prontuários</h3>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" /> 2 Em Andamento
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold">
              1 Prontuário Pendente
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-semibold">
              1 Falta Não Justificada
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rooms.map((r) => {
            const isRunning = r.status === "em_andamento";
            const isNotePending = r.noteStatus === "pendente_24h" || r.noteStatus === "trava_faturamento";

            return (
              <div
                key={r.id}
                className="rounded-lg border p-4 transition-all bg-surface hover:shadow-sm"
                style={{
                  borderColor: isRunning ? "rgba(16, 185, 129, 0.4)" : isNotePending ? "rgba(245, 158, 11, 0.4)" : "var(--color-divider)",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-ink-soft bg-paper px-2 py-0.5 rounded">
                    {r.roomName}
                  </span>
                  <span className="text-xs font-mono font-semibold text-ink">
                    ⏰ {r.startTime} às {r.endTime}
                  </span>
                </div>

                <div className="space-y-1 mb-3">
                  <p className="m-0 text-sm font-bold text-ink">
                    Patient: <span className="text-blue-700">{r.patientName}</span>
                  </p>
                  <p className="m-0 text-xs text-ink-soft">
                    Terapeuta: <strong>{r.therapistName}</strong> ({r.specialty})
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: "var(--color-divider)" }}>
                  {isRunning ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Sessão Ativa
                    </span>
                  ) : r.status === "falta_sem_justificativa" ? (
                    <span className="text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded">
                      ❌ Falta sem Atestado
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded">
                      ⚠️ Aguardando Evolução
                    </span>
                  )}

                  {isNotePending && (
                    <button
                      onClick={() => handleNotifyTherapist(r.therapistName)}
                      className="px-3 py-1 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded cursor-pointer transition-all"
                    >
                      📲 Cobrar Prontuário
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
