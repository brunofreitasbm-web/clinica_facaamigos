"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { NewResourceForm } from "./new-resource-form";
import { NewRoomForm } from "./new-room-form";
import { RoomRowItem } from "./room-row";
import { RESOURCE_CATEGORY_LABEL } from "@/lib/resource-categories";
import { CANCEL_REASONS } from "@/lib/appointment-cancel-reasons";
import { TurmasAbaPanel } from "./turmas-aba-panel";
import type { AbaClassRow, ResourceRow, RoomRow, SpecialtyOption } from "./types";
import { PageContainer } from "@/components/page-container";

export function AtendimentosManager({
  resources,
  rooms,
  specialties,
  abaClasses,
}: {
  resources: ResourceRow[];
  rooms: RoomRow[];
  specialties: SpecialtyOption[];
  abaClasses: AbaClassRow[];
}) {
  const [activeTab, setActiveTab] = useState<"salas" | "turmas-aba" | "recursos" | "motivos">("salas");

  return (
    <>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Cadastros"
          title="Salas & Recursos"
          description="Gestão de salas físicas, recursos reserváveis e motivos de falta/cancelamento por origem."
        />

        <PageContainer>
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
              onClick={() => setActiveTab("turmas-aba")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "turmas-aba"
                  ? "border-accent text-accent"
                  : "border-transparent text-ink-faint hover:text-ink-strong"
              }`}
            >
              Turmas de Treino ABA ({abaClasses.length})
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
          </div>

          {/* Aba 1: Salas — cadastro real (tabela `rooms`), usada por toda a agenda */}
          {activeTab === "salas" && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-ink-faint">
                  Salas físicas da clínica — as mesmas que aparecem no agendamento da recepção e na grade
                  recorrente. Excluir uma sala com sessões associadas (passadas ou futuras) não é permitido.
                  Estagiários recomendados é uma sugestão (padrão: 1 por criança), não obrigatório. A
                  especialidade vinculada define, por sala, qual especialidade conta as crianças com check-in
                  no Alerta de Necessidade de Estagiário (Inteligência/BI).
                </p>
                <NewRoomForm specialties={specialties} />
              </div>

              <table className="table">
                <thead>
                  <tr>
                    <th>Nome da Sala</th>
                    <th>Capacidade</th>
                    <th>Estagiários (recomendado)</th>
                    <th>Especialidade</th>
                    <th>Tags</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => (
                    <RoomRowItem key={r.id} room={r} specialties={specialties} />
                  ))}
                  {rooms.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-ink-faint">
                        Nenhuma sala cadastrada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Aba Turmas: cadastro das turmas fixas de Treino ABA (tabela `aba_training_classes`) */}
          {activeTab === "turmas-aba" && <TurmasAbaPanel classes={abaClasses} rooms={rooms} />}

          {/* Aba Recursos: cadastro real (brinquedos sensoriais, testes, pranchas) */}
          {activeTab === "recursos" && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-ink-faint">
                  Cadastro mestre de recursos reserváveis. A recepção só reserva, em Salas e recursos.
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
                Motivos de falta/cancelamento que a recepção usa na agenda. Lista fixa do sistema — mudar
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

        </PageContainer>
      </div>
    </>
  );
}
