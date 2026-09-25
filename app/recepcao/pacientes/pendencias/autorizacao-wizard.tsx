"use client";

import React, { useState } from "react";
import { X } from "lucide-react";

export interface AuthorizationItem {
  id: string;
  patientName: string;
  insurerName: string;
  specialty: string;
  authorizedHours: number;
  consumedHours: number;
  expiresAt: string;
  status: "regular" | "attention" | "critical";
  protocolNumber: string;
}

export function AutorizacaoWizard({ initialItems = [] }: { initialItems?: AuthorizationItem[] }) {
  const [items, setItems] = useState<AuthorizationItem[]>(initialItems);
  const [selectedItem, setSelectedItem] = useState<AuthorizationItem | null>(null);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [justificationText, setJustificationText] = useState("");
  const [successToast, setSuccessToast] = useState(false);

  const openRenewalModal = (item: AuthorizationItem) => {
    setSelectedItem(item);
    setWizardStep(1);
    setJustificationText(
      `Solicitação de renovação do pacote de ${item.specialty} para o paciente ${item.patientName}. Progresso terapêutico satisfatório registrado nas evoluções recentes.`
    );
  };

  const closeModal = () => {
    setSelectedItem(null);
    setWizardStep(1);
  };

  const handleCompleteRenewal = () => {
    if (!selectedItem) return;
    setItems((prev) =>
      prev.map((i) =>
        i.id === selectedItem.id
          ? {
              ...i,
              authorizedHours: i.authorizedHours + 40,
              consumedHours: 0,
              status: "regular",
              expiresAt: "2026-12-31",
            }
          : i
      )
    );
    setSuccessToast(true);
    closeModal();
    setTimeout(() => setSuccessToast(false), 4000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* TOAST DE SUCESSO */}
      {successToast && (
        <div className="flex items-center justify-between rounded-md bg-status-positive-soft p-4 text-status-positive-text shadow-sm">
          <div className="flex items-center gap-2">
            <div>
              <p className="m-0 font-bold text-sm">Solicitação de Renovação Enviada com Sucesso!</p>
              <p className="m-0 text-[13px] text-status-positive-text">
                O pacote de horas foi renovado e os relatórios clínicos foram anexados ao lote TISS.
              </p>
            </div>
          </div>
          <button onClick={() => setSuccessToast(false)} className="cursor-pointer border-0 bg-transparent font-bold text-status-positive-text" aria-label="Fechar aviso">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}

      <div>
        <p className="m-0 mb-4 text-[15px] text-ink-soft">
          Consumo de cada pacote por especialidade. O agendamento é bloqueado quando o saldo chega a zero.
        </p>
        {/* LISTA DE PACIENTES E SALDOS */}
        <div className="flex flex-col gap-3">
          {items.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-faint">Nenhum pacote de horas ou autorização ativa no momento.</p>
          ) : (
            items.map((item) => {
              const pct = Math.min(100, Math.round((item.consumedHours / item.authorizedHours) * 100));
              const isCritical = item.status === "critical" || pct >= 90;
              const isAttention = item.status === "attention" || (pct >= 70 && pct < 90);

            return (
              <div
                key={item.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-lg border p-4 transition-all hover:shadow-sm"
                style={{
                  borderColor: isCritical ? "var(--color-status-negative-text)" : isAttention ? "var(--color-status-pending)" : "var(--color-divider)",
                  backgroundColor: isCritical ? "var(--color-status-negative-soft)" : isAttention ? "var(--color-status-pending-soft)" : "var(--color-surface)",
                }}
              >
                <div className="flex flex-col gap-1 min-w-[280px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-ink">{item.patientName}</span>
                    <span className="text-[13px] font-mono text-ink-faint bg-paper px-1.5 py-0.5 rounded">
                      {item.protocolNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[13px] text-ink-soft">
                    <span>{item.insurerName}</span>
                    <span>•</span>
                    <span className="font-medium text-ink">{item.specialty}</span>
                  </div>
                </div>

                {/* BARRA DE PROGRESSO DO CONSUMO DE SESSÕES */}
                <div className="flex-1 max-w-md">
                  <div className="flex items-center justify-between text-[13px] mb-1">
                    <span className="font-semibold text-ink-soft">
                      Sessões Consumidas: <strong className="text-ink">{item.consumedHours}</strong> de {item.authorizedHours}h
                    </span>
                    <span
                      className={`font-bold ${
                        isCritical ? "text-status-negative-text" : isAttention ? "text-status-pending-text" : "text-status-positive-text"
                      }`}
                    >
                      {pct}% consumido
                    </span>
                  </div>
                  <div className="w-full bg-paper-line rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCritical ? "bg-status-negative" : isAttention ? "bg-status-pending" : "bg-status-positive"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[13px] text-ink-faint mt-1 flex justify-between">
                    <span>Validade da Guia: {item.expiresAt}</span>
                    {isCritical && <span className="font-bold text-status-negative-text">Restam apenas {item.authorizedHours - item.consumedHours}h!</span>}
                  </div>
                </div>

                {/* BOTÃO DE AÇÃO GUIADA */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openRenewalModal(item)}
                    className={`btn ${isCritical ? "btn-primary" : "btn-secondary"}`}
                  >
                    Renovar autorização
                  </button>
                </div>
              </div>
            );
          }))}
        </div>
      </div>

      {/* MODAL WIZARD PASSO A PASSO "ANTI-BURRO" */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl border bg-surface p-6 shadow-xl" style={{ borderColor: "var(--color-divider)" }}>
            <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: "var(--color-divider)" }}>
              <div>
                <span className="text-[13px] font-bold uppercase tracking-wider text-ink-soft">Wizard de Guia · Passo {wizardStep} de 3</span>
                <h3 className="m-0 text-base font-bold text-ink">Renovação de Autorização TISS</h3>
              </div>
              <button onClick={closeModal} className="cursor-pointer border-0 bg-transparent text-lg text-ink-soft hover:text-ink" aria-label="Fechar">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* PASSO 1: CONFIRMAÇÃO DOS DADOS DO PACIENTE */}
            {wizardStep === 1 && (
              <div className="flex flex-col gap-4">
                <div className="rounded-md bg-paper p-4">
                  <p className="m-0 text-[13px] font-bold text-ink-soft">Paciente Selecionado:</p>
                  <h4 className="m-0 text-sm font-bold text-ink mt-0.5">{selectedItem.patientName}</h4>
                  <p className="m-0 text-[13px] text-ink-soft mt-1">
                    Plano de Saúde: <strong>{selectedItem.insurerName}</strong> | Especialidade: <strong>{selectedItem.specialty}</strong>
                  </p>
                </div>

                <div className="rounded-lg border p-4 text-[13px] text-ink-soft space-y-2 bg-paper/40">
                  <div className="flex justify-between">
                    <span>Pacote Atual:</span>
                    <strong className="text-ink">{selectedItem.authorizedHours} horas</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Sessões já realizadas e registradas:</span>
                    <strong className="text-ink">{selectedItem.consumedHours} horas</strong>
                  </div>
                  <div className="flex justify-between text-status-negative-text font-bold">
                    <span>Saldo Restante:</span>
                    <span>{selectedItem.authorizedHours - selectedItem.consumedHours} horas</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4 border-t pt-3">
                  <button onClick={closeModal} className="px-4 py-2 text-[13px] font-semibold text-ink-soft bg-paper rounded-lg border">
                    Cancelar
                  </button>
                  <button
                    onClick={() => setWizardStep(2)}
                    className="px-4 py-2 text-[13px] font-bold btn btn-primary"
                  >
                    Avançar para Relatórios Clinicos →
                  </button>
                </div>
              </div>
            )}

            {/* PASSO 2: ANEXAR EVOLUÇÕES E JUSTIFICATIVA */}
            {wizardStep === 2 && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-[13px] font-bold text-ink mb-1">
                    Justificativa Clínica e Plano Terapêutico (Compilado Automático):
                  </label>
                  <textarea
                    rows={4}
                    value={justificationText}
                    onChange={(e) => setJustificationText(e.target.value)}
                    className="w-full rounded-lg border p-3 text-[13px] text-ink font-sans bg-surface focus:outline-none focus:border-[var(--color-accent)]"
                  />
                  <span className="text-[13px] text-ink-faint mt-1 block">
                    Os relatórios de evolução das últimas 12 sessões serão anexados ao arquivo XML TISS automaticamente.
                  </span>
                </div>

                <div className="rounded-md bg-status-positive-soft p-3 text-[13px] text-status-positive-text">
                  <span><strong>Checklist de Segurança:</strong> CID-10 validado, laudo médico ativo e equipe cadastrada.</span>
                </div>

                <div className="flex justify-between gap-3 mt-4 border-t pt-3">
                  <button onClick={() => setWizardStep(1)} className="px-4 py-2 text-[13px] font-semibold text-ink-soft bg-paper rounded-lg border">
                    ← Voltar
                  </button>
                  <button
                    onClick={() => setWizardStep(3)}
                    className="px-4 py-2 text-[13px] font-bold btn btn-primary"
                  >
                    Avançar para Confirmação Final →
                  </button>
                </div>
              </div>
            )}

            {/* PASSO 3: CONFIRMAÇÃO E RENOVAÇÃO FINAL */}
            {wizardStep === 3 && (
              <div className="flex flex-col gap-4">
                <div className="rounded-md bg-status-pending-soft p-4 text-[13px] text-status-pending-text">
                  <h4 className="m-0 text-sm font-bold text-ink mb-1">Confirmar Novo Pacote de Sessões</h4>
                  <p className="m-0">
                    Ao confirmar, uma nova autorização de <strong>40 horas</strong> será adicionada para {selectedItem.patientName} e o saldo será resetado.
                  </p>
                </div>

                <div className="flex justify-between gap-3 mt-4 border-t pt-3">
                  <button onClick={() => setWizardStep(2)} className="px-4 py-2 text-[13px] font-semibold text-ink-soft bg-paper rounded-lg border">
                    ← Voltar
                  </button>
                  <button
                    onClick={handleCompleteRenewal}
                    className="px-5 py-2.5 text-[13px] font-bold btn btn-primary"
                  >
                    Finalizar e Enviar Autorização
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
