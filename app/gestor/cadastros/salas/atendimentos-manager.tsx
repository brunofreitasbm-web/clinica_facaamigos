"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { CadastrosSidebar } from "../cadastros-sidebar";
import { NewResourceForm } from "./new-resource-form";
import { NewRoomForm } from "./new-room-form";
import { RoomRowItem } from "./room-row";
import { RESOURCE_CATEGORY_LABEL } from "@/lib/resource-categories";
import { CANCEL_REASONS } from "@/lib/appointment-cancel-reasons";
import type { ResourceRow, RoomRow } from "./types";

export function AtendimentosManager({ resources, rooms }: { resources: ResourceRow[]; rooms: RoomRow[] }) {
  const [activeTab, setActiveTab] = useState<"salas" | "recursos" | "motivos" | "reagendamento">("salas");

  const [janelaReagendamentoDias, setJanelaReagendamentoDias] = useState(7);

  return (
    <>
      <CadastrosSidebar active="salas" />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Cadastros"
          title="Salas & Recursos"
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
              onClick={() => setActiveTab("recursos")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "recursos"
                  ? "border-accent text-accent"
                  : "border-transparent text-ink-faint hover:text-ink-strong"
              }`}
            >
              Recursos ({resources.length})
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

          {/* Aba 1: Salas — cadastro real (tabela `rooms`), usada por toda a agenda */}
          {activeTab === "salas" && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-ink-faint">
                  Salas físicas da clínica (PRD §7.1) — as mesmas que aparecem no agendamento da recepção e na grade
                  recorrente. Excluir uma sala com sessões associadas (passadas ou futuras) não é permitido.
                </p>
                <NewRoomForm />
              </div>

              <table className="table">
                <thead>
                  <tr>
                    <th>Nome da Sala</th>
                    <th>Capacidade</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => (
                    <RoomRowItem key={r.id} room={r} />
                  ))}
                  {rooms.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-ink-faint">
                        Nenhuma sala cadastrada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Aba Recursos: cadastro real (brinquedos sensoriais, testes, pranchas) */}
          {activeTab === "recursos" && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-ink-faint">
                  Cadastro mestre de recursos reserváveis (PRD §10). A recepção só reserva, em Salas e recursos.
                </p>
                <NewResourceForm />
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Categoria</th>
                    <th>Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r) => (
                    <tr key={r.id}>
                      <td className="font-semibold text-sm">{r.name}</td>
                      <td>{RESOURCE_CATEGORY_LABEL[r.category] ?? r.category}</td>
                      <td className="text-xs text-ink-faint">{r.notes || "—"}</td>
                    </tr>
                  ))}
                  {resources.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-ink-faint">
                        Nenhum recurso cadastrado ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Aba 2: Motivos — lista fechada usada de verdade pela recepção
              (lib/appointment-cancel-reasons.ts), compartilhada com a
              validação no servidor pra nunca divergir. Não é editável aqui:
              é a mesma lista, não uma cópia solta que podia ficar
              desatualizada em relação ao que a agenda de fato aceita. */}
          {activeTab === "motivos" && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-ink-faint">
                Motivos de falta/cancelamento que a recepção usa na agenda (PRD §9.2). Lista fixa do sistema — mudar
                aqui exigiria mudar o código, porque o mesmo motivo é validado no servidor ao registrar a falta.
              </p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {CANCEL_REASONS.map((c) => (
                    <tr key={c.value}>
                      <td className="text-sm">{c.label}</td>
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
