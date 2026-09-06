"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ConfigSidebar } from "../config-sidebar";

interface RoomItem {
  id: string;
  name: string;
  capacity: number;
  modalities: string[];
  resources: string;
}

const INITIAL_ROOMS: RoomItem[] = [
  { id: "r-1", name: "Sala 01 - ABA Sensorial", capacity: 2, modalities: ["Individual"], resources: "Tatame, Balanço sensorial, Espelho unidirecional" },
  { id: "r-2", name: "Sala 02 - Fonoaudiologia & Comunicação", capacity: 2, modalities: ["Individual"], resources: "Mesa adaptada, Jogos de fala, Gravador" },
  { id: "r-3", name: "Sala 03 - Terapia Ocupacional (Integração)", capacity: 3, modalities: ["Individual", "Grupo"], resources: "Piscina de bolinhas, Rampa, Pneu sensorial" },
  { id: "r-4", name: "Sala 04 - Treino de Habilidades Sociais", capacity: 6, modalities: ["Grupo"], resources: "Mesa coletiva, Brinquedoteca estruturada" },
];

interface CancelReason {
  id: string;
  label: string;
  origin: "familia" | "terapeuta" | "clinica";
  requiresJustification: boolean;
}

const CANCEL_REASONS: CancelReason[] = [
  { id: "c-1", label: "Atestado Médico do Paciente", origin: "familia", requiresJustification: true },
  { id: "c-2", label: "Imprevisto Familiar / Falta Não Justificada", origin: "familia", requiresJustification: false },
  { id: "c-3", label: "Imprevisto / Problema de Saúde do Terapeuta", origin: "terapeuta", requiresJustification: true },
  { id: "c-4", label: "Manutenção Emergencial de Sala", origin: "clinica", requiresJustification: true },
];

export function AtendimentosManager() {
  const [rooms, setRooms] = useState<RoomItem[]>(INITIAL_ROOMS);
  const [activeTab, setActiveTab] = useState<"salas" | "motivos" | "reagendamento">("salas");

  const [janelaReagendamentoDias, setJanelaReagendamentoDias] = useState(7);

  return (
    <>
      <ConfigSidebar active="atendimentos" />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Configurações"
          title="Atendimentos & Agenda"
          description="Gestão de salas físicas, motivos de falta/cancelamento por origem e regras de reagendamento."
        />

        <div className="flex flex-col gap-6 p-6 sm:p-10 max-w-4xl">
          {/* Abas Superiores */}
          <div className="flex border-b border-paper-line gap-6">
            <button
              onClick={() => setActiveTab("salas")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "salas"
                  ? "border-accent text-accent"
                  : "border-transparent text-ink-faint hover:text-ink-strong"
              }`}
            >
              Salas Físicas ({rooms.length})
            </button>
            <button
              onClick={() => setActiveTab("motivos")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "motivos"
                  ? "border-accent text-accent"
                  : "border-transparent text-ink-faint hover:text-ink-strong"
              }`}
            >
              Motivos de Falta / Cancelamento
            </button>
            <button
              onClick={() => setActiveTab("reagendamento")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "reagendamento"
                  ? "border-accent text-accent"
                  : "border-transparent text-ink-faint hover:text-ink-strong"
              }`}
            >
              Recuperação & Reagendamento
            </button>
          </div>

          {/* Aba 1: Salas */}
          {activeTab === "salas" && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-ink-faint">Cadastro de espaços com restrição de capacidade e recursos para prevenção de conflito de agenda (PRD §7.1).</p>
                <button
                  onClick={() => alert("Janela para cadastrar nova sala física.")}
                  className="button button-primary"
                >
                  + Nova Sala
                </button>
              </div>

              <table className="table">
                <thead>
                  <tr>
                    <th>Nome da Sala</th>
                    <th>Capacidade</th>
                    <th>Modalidades</th>
                    <th>Recursos</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => (
                    <tr key={r.id}>
                      <td className="font-semibold text-sm">{r.name}</td>
                      <td>{r.capacity} pessoa(s)</td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          {r.modalities.map((m) => (
                            <span key={m} className="tag tag-outline text-[10px]">
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-xs text-ink-faint">{r.resources}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Aba 2: Motivos */}
          {activeTab === "motivos" && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-ink-faint">Mapeamento obrigatório de falta e quem cancelou para alimentar relatórios de no-show por origem (PRD §5).</p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Motivo de Cancelamento</th>
                    <th>Origem (Quem cancelou)</th>
                    <th>Exige Justificativa</th>
                  </tr>
                </thead>
                <tbody>
                  {CANCEL_REASONS.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium text-sm">{c.label}</td>
                      <td>
                        <span className="tag capitalize font-medium text-[11px]">
                          {c.origin === "familia" ? "Família / Responsável" : c.origin === "terapeuta" ? "Terapeuta" : "Clínica"}
                        </span>
                      </td>
                      <td className="text-xs font-semibold">
                        {c.requiresJustification ? "Sim (Documento/Atestado)" : "Não"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Aba 3: Reagendamento */}
          {activeTab === "reagendamento" && (
            <div className="flex flex-col gap-4 rounded-xl border border-paper-line bg-paper-panel p-6 shadow-sm">
              <h3 className="text-base font-semibold text-ink-strong">Regra para Reagendamento de Falta (Recuperação)</h3>
              <p className="text-xs text-ink-faint">Sugestão e limite de tempo para reagendamento sem gerar no-show irreversível ou perda da sessão na guia autorizada.</p>

              <div className="flex flex-col gap-2 max-w-md mt-2">
                <label className="text-xs font-medium text-ink-strong">Janela máxima para reposição de sessão (dias)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  className="input"
                  value={janelaReagendamentoDias}
                  onChange={(e) => setJanelaReagendamentoDias(Number(e.target.value))}
                />
                <span className="text-[11px] text-ink-faint">Prazo em que a sessão desmarcada pode ser remarcada na mesma semana ou período.</span>
              </div>

              <div className="pt-3">
                <button onClick={() => alert("Regra de reagendamento salva!")} className="button button-primary">
                  Salvar Regra de Reagendamento
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
